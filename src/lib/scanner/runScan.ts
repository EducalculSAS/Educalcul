import fs from "fs";
import path from "path";
import {
  createGenerationTracker,
  createLlmStartGate,
  GenerationCancelledError,
  sleep,
} from "@/lib/ai/runtime";
import { scanFindingsSchema } from "@/lib/ai/schemas";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getScanCategory, type ScanCategory } from "@/lib/scanner/categories";

const MAX_FILE_CHARS = 12_000; // fichiers plus gros: tronqués (rare pour page/route/composant)
const MAX_BATCH_CHARS = 22_000;
const MAX_BATCH_FILES = 8;

// Intervalle plus large que celui des générations interactives (course/quiz) :
// un scan n'est pas attendu par un admin en direct, mieux vaut aller plus
// lentement mais ne pas cogner le rate limit de Mistral. Partagé au niveau
// du module (pas par run) : si plusieurs catégories tournent en même temps,
// leurs appels IA restent quand même espacés les uns des autres.
const SCANNER_LLM_MIN_INTERVAL_MS = 3_000;
const MAX_RETRIES_PER_BATCH = 3;
const RETRY_BASE_DELAY_MS = 4_000;

const SKIP_DIRS = new Set(["node_modules", ".next", ".git"]);

function listFiles(root: ScanCategory["roots"][number]): string[] {
  // turbopackIgnore : lecture intentionnelle du code source à l'exécution
  // (audit du site) — le bundle est déjà forcé via outputFileTracingIncludes
  // dans next.config.ts, inutile que le bundler retrace tout le projet ici.
  const absRoot = path.join(/* turbopackIgnore: true */ process.cwd(), root.dir);
  const results: string[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // dossier absent (ex: en environnement de dev réduit) — on saute
    }
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (root.filter(entry.name)) {
        results.push(full);
      }
    }
  }

  walk(absRoot);
  return results;
}

function readFileForScan(absPath: string): { relPath: string; content: string } {
  const relPath = path.relative(process.cwd(), absPath);
  let content = "";
  try {
    content = fs.readFileSync(absPath, "utf8");
  } catch {
    content = "";
  }
  if (content.length > MAX_FILE_CHARS) {
    content = `${content.slice(0, MAX_FILE_CHARS)}\n… [fichier tronqué à ${MAX_FILE_CHARS} caractères]`;
  }
  return { relPath, content };
}

function buildBatches(files: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentChars = 0;

  for (const file of files) {
    const size = fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0;
    const estimated = Math.min(size, MAX_FILE_CHARS);
    if (
      current.length > 0 &&
      (current.length >= MAX_BATCH_FILES || currentChars + estimated > MAX_BATCH_CHARS)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(file);
    currentChars += estimated;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

type FindingRow = {
  severity: string;
  file: string;
  title: string;
  description: string;
  fix: string;
};

const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

async function insertFindings(runId: string, findings: FindingRow[]): Promise<number> {
  const rows = findings
    .filter((f) => f && f.title && f.description && f.file)
    .map((f) => ({
      run_id: runId,
      severity: VALID_SEVERITIES.has(f.severity) ? f.severity : "info",
      file_path: f.file,
      title: f.title,
      description: f.description,
      suggested_fix: f.fix || null,
    }));
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from("scan_findings").insert(rows);
  if (error) {
    console.error("[scanner] Échec insertion findings:", error.message);
    return 0;
  }
  return rows.length;
}

/**
 * Lance un scan pour une catégorie donnée. Conçu pour tourner dans un
 * after() — voir POST /api/admin/scanner/run, même patron que
 * runCourseGeneration (src/lib/courseGeneration.ts).
 */
export async function runScan(runId: string, categoryKey: string): Promise<void> {
  const tracker = createGenerationTracker("scan_runs", runId);
  const category = getScanCategory(categoryKey);

  if (!category) {
    await tracker.setStatus("failed", { error: "Catégorie de scan inconnue." });
    return;
  }

  try {
    await tracker.setStatus("running");

    const files = category.roots.flatMap((root) => listFiles(root));
    if (files.length === 0) {
      await tracker.updateProgress({ current: 0, total: 0, message: "Aucun fichier à analyser." });
      await tracker.setStatus("completed", { findings_count: 0 });
      return;
    }

    const batches = buildBatches(files);
    const generate = createLlmStartGate(SCANNER_LLM_MIN_INTERVAL_MS, () =>
      tracker.isCancelRequested(),
    );

    await tracker.updateProgress({
      current: 0,
      total: batches.length,
      message: `${files.length} fichier(s) à analyser en ${batches.length} lot(s)...`,
    });

    let totalFindings = 0;
    let failedBatches = 0;

    for (let i = 0; i < batches.length; i++) {
      if (await tracker.isCancelRequested()) {
        await tracker.setStatus("cancelled", { findings_count: totalFindings });
        return;
      }

      const batch = batches[i].map(readFileForScan);
      const prompt = batch
        .map((f) => `=== FICHIER: ${f.relPath} ===\n${f.content}`)
        .join("\n\n");

      let batchDone = false;
      for (let attempt = 1; attempt <= MAX_RETRIES_PER_BATCH && !batchDone; attempt++) {
        try {
          const result = await generate<{ findings: FindingRow[] }>(
            prompt,
            category.systemPrompt,
            scanFindingsSchema(),
            0.2,
            8_000,
          );
          totalFindings += await insertFindings(runId, result.findings || []);
          batchDone = true;
        } catch (err) {
          if (err instanceof GenerationCancelledError) {
            await tracker.setStatus("cancelled", { findings_count: totalFindings });
            return;
          }
          const isLastAttempt = attempt === MAX_RETRIES_PER_BATCH;
          if (isLastAttempt) {
            failedBatches++;
            console.error(`[scanner] Échec lot ${i + 1}/${batches.length} (${category.key}) après ${attempt} tentative(s):`, err);
          } else {
            // Le modèle IA est probablement rate-limité côté fournisseur
            // (plusieurs catégories peuvent tourner en même temps) — on
            // retente avec un délai croissant plutôt que d'abandonner le lot.
            await sleep(RETRY_BASE_DELAY_MS * attempt);
          }
        }
      }

      await tracker.updateProgress({
        current: i + 1,
        total: batches.length,
        message: `Lot ${i + 1}/${batches.length} analysé : ${totalFindings} problème(s) trouvé(s)${
          failedBatches > 0 ? `, ${failedBatches} lot(s) en échec` : ""
        }.`,
      });
    }

    await tracker.setStatus("completed", { findings_count: totalFindings });
  } catch (err) {
    console.error("[scanner] Échec inattendu:", err);
    await tracker.setStatus("failed", {
      error: err instanceof Error ? err.message : "Erreur inconnue",
    });
  }
}
