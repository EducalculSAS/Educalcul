"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Square, Play, RotateCcw, Plus } from "lucide-react";
import GlassDialog from "@/components/ui/GlassDialog";
import GlassButton from "@/components/ui/GlassButton";
import GlassCheckbox from "@/components/ui/GlassCheckbox";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import Emblem3D from "@/components/Emblem3D";
import { SCHOOL_LEVELS } from "@/lib/constants";

/**
 * Génération par lots : pour chaque cours d'un niveau, plusieurs exercices de styles différents, générés en parallèle
 * PAR LE SERVEUR (file + chaînes, voir src/lib/ai/exerciseBatch.ts) : fermer la page n'arrête rien, on retrouve le lot
 * en rouvrant cette fenêtre. Chaque exercice est lié à son cours (l'IA reçoit le cours résumé : notions, méthodes et
 * exercices du cours comme étalon de niveau), rangé dans le dossier d'exercices du cours (créé au besoin), en brouillon.
 */

export interface BatchStyle {
  id: "guided" | "problem" | "fun";
  label: string;
  description: string;
  exerciseType: "simple" | "contextual";
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  /** Types de questions utilisés à tour de rôle d'un cours à l'autre. */
  blockTypes: string[];
  instructions: string;
}

export const BATCH_STYLES: BatchStyle[] = [
  {
    id: "guided",
    label: "Entraînement avec consignes",
    description: "Application directe du cours, consignes claires et progressives.",
    exerciseType: "simple",
    difficulty: "easy",
    questionCount: 5,
    blockTypes: ["standard"],
    instructions:
      "Exercice d'entraînement fidèle au cours : chaque question commence par une consigne précise (Calcule…, Justifie…, Détermine…, Complète…, Construis…). Progression du plus simple au plus exigeant, exactement les méthodes du cours. Figures EduFig dès qu'une question porte sur une figure, un repère ou des données.",
  },
  {
    id: "problem",
    label: "Problème en situation",
    description: "Situation concrète, questions enchaînées (type brevet en 3ème).",
    exerciseType: "contextual",
    difficulty: "medium",
    questionCount: 4,
    blockTypes: ["standard"],
    instructions:
      "Problème concret de la vie courante, du niveau attendu en fin d'année (type brevet en 3ème), qui mobilise les notions du cours. Questions numérotées qui s'enchaînent logiquement, chacune avec une consigne claire ; données réalistes ; au moins une question demande de justifier. Figure EduFig fidèle aux données quand la situation est géométrique ou statistique.",
  },
  {
    id: "fun",
    label: "Défi ludique",
    description: "Énigme, enquête, escape game… sur les notions du cours.",
    exerciseType: "contextual",
    difficulty: "medium",
    questionCount: 4,
    blockTypes: ["qcm", "matching", "qcm", "fill_in_the_blank"],
    instructions:
      "Exercice ludique et amusant mais rigoureux : énigme, enquête policière, escape game, chasse au trésor, défi entre amis ou mission spatiale, au choix. L'histoire tient en deux phrases et chaque étape fait utiliser une notion du cours (pas de hors-sujet). Ton complice et motivant, pas enfantin.",
  },
];

interface CourseRow { id: number; title: string; level: string | null; status: string | null; folder_id: number | null; chapter_order?: number | null }
interface BatchRow { id: string; status: string; error: string | null; exerciseId: number | null; message: string; warnings: string[]; courseTitle: string; styleLabel: string; blockType?: string }

const STORAGE_KEY = "edu-exercise-batch";
const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const readStored = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const store = (v: string | null) => { try { if (v) localStorage.setItem(STORAGE_KEY, v); else localStorage.removeItem(STORAGE_KEY); } catch { /* stockage indisponible */ } };

export default function ExerciseBatchModal({ onClose, defaultLevel = "3eme", initialBatchId }: { onClose: () => void; defaultLevel?: string; initialBatchId?: string }) {
  const [level, setLevel] = useState(defaultLevel);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [styles, setStyles] = useState<Record<BatchStyle["id"], number>>({ guided: 1, problem: 1, fun: 1 });
  const [parallel, setParallel] = useState("4");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialBatchId) store(initialBatchId);
    setBatchId(initialBatchId ?? readStored());
    fetch("/api/admin/courses?status=all")
      .then((r) => r.json())
      .then((c) => setCourses(Array.isArray(c) ? c : []))
      .catch(() => setError("Impossible de charger les cours."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const levelCourses = useMemo(
    () => courses.filter((c) => norm(c.level) === norm(level)).sort((a, b) => (a.chapter_order ?? 999) - (b.chapter_order ?? 999) || a.title.localeCompare(b.title)),
    [courses, level],
  );
  useEffect(() => { setSelected(new Set(levelCourses.map((c) => c.id))); }, [levelCourses]);

  // Suivi du lot : l'état vient du serveur, il survit à la fermeture de la page.
  useEffect(() => {
    if (!batchId) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/ai/exercise/batch?batch=${encodeURIComponent(batchId)}`);
        if (!res.ok) return;
        const data = (await res.json()) as BatchRow[];
        if (alive) setRows(data);
      } catch { /* réseau : on réessaie au prochain tour */ }
    };
    load();
    pollRef.current = window.setInterval(load, 4_000);
    return () => { alive = false; if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [batchId]);

  const total = levelCourses.filter((c) => selected.has(c.id)).length * Object.values(styles).reduce((a, b) => a + b, 0);
  const concurrency = Number(parallel);
  // Mesuré en production : 1 min 30 en moyenne par exercice ; N exercices à la fois.
  const estimate = total ? `environ ${Math.max(2, Math.round((Math.ceil(total / concurrency) * 1.6)))} min` : "-";

  const start = async () => {
    setBusy(true);
    setError(null);
    const jobs: Record<string, unknown>[] = [];
    levelCourses.filter((c) => selected.has(c.id)).forEach((course, ci) => {
      for (const style of BATCH_STYLES) {
        for (let k = 0; k < (styles[style.id] || 0); k++) {
          jobs.push({
            exerciseType: style.exerciseType,
            blockType: style.blockTypes[(ci + k) % style.blockTypes.length],
            linkedCourseId: course.id,
            subject: course.title,
            courseTitle: course.title,
            styleLabel: style.label,
            difficulty: k === 0 ? style.difficulty : k === 1 ? "medium" : "hard",
            questionCount: style.questionCount,
            instructions: style.instructions,
          });
        }
      }
    });
    try {
      const res = await fetch("/api/admin/ai/exercise/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level, concurrency, jobs }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lancement impossible.");
      store(data.batchId);
      setBatchId(data.batchId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lancement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (payload: Record<string, unknown>) => {
    if (!batchId) return;
    setBusy(true);
    await fetch("/api/admin/ai/exercise/batch", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batch: batchId, concurrency, ...payload }) }).catch(() => null);
    setBusy(false);
  };

  const done = rows.filter((r) => r.status === "done").length;
  const failed = rows.filter((r) => r.status === "error").length;
  const active = rows.filter((r) => ["queued", "pending", "running"].includes(r.status)).length;
  const flagged = rows.filter((r) => r.warnings?.length).length;
  const running = active > 0;

  return (
    <GlassDialog
      title="Génération par lots"
      onClose={onClose}
      wide="xl"
      footer={batchId ? (
        <>
          <GlassButton variant="ghost" onClick={onClose}>Fermer</GlassButton>
          {failed > 0 && !running && <GlassButton variant="outline" disabled={busy} onClick={() => patch({ retryErrors: true })}><RotateCcw className="w-4 h-4" />Relancer les {failed} échec{failed > 1 ? "s" : ""}</GlassButton>}
          {running ? (
            <>
              <GlassButton variant="outline" disabled={busy} onClick={() => patch({})}><RotateCcw className="w-4 h-4" />Relancer la file</GlassButton>
              <GlassButton variant="danger" disabled={busy} onClick={() => patch({ action: "cancel" })}><Square className="w-4 h-4" />Annuler les exercices en attente</GlassButton>
            </>
          ) : (
            <GlassButton variant="navy" onClick={() => { store(null); setBatchId(null); setRows([]); }}><Plus className="w-4 h-4" />Nouveau lot</GlassButton>
          )}
        </>
      ) : (
        <>
          <GlassButton variant="ghost" onClick={onClose}>Fermer</GlassButton>
          <GlassButton variant="navy" disabled={!total || busy} onClick={start}><Play className="w-4 h-4" />Générer {total} exercice{total > 1 ? "s" : ""}</GlassButton>
        </>
      )}
    >
      {!batchId ? (
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <Emblem3D kind="sparkles" size={56} float={false} className="shrink-0" />
            <p className="text-sm text-gray-600">
              Pour chaque cours coché, l&apos;IA lit le cours (notions, méthodes, exercices du cours comme étalon de niveau) et
              rédige des exercices de styles différents, liés au cours, rangés dans son dossier et créés en <strong>brouillon</strong>.
              La génération se fait sur le serveur : <strong>tu peux fermer la page</strong>, le lot continue.
            </p>
          </div>

          <div className="grid sm:grid-cols-[auto_1fr] gap-3 items-center">
            <span className="text-sm font-semibold text-[var(--greek-blue)]">Niveau</span>
            <select className="w-full sm:w-64 rounded-xl border border-[rgba(197,161,72,0.35)] bg-white px-3 py-2 text-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
              {SCHOOL_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--greek-blue)] mb-2">Exercices par cours</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {BATCH_STYLES.map((s) => (
                <div key={s.id} className="rounded-2xl border border-[rgba(197,161,72,0.3)] bg-white p-3">
                  <p className="text-sm font-bold text-[var(--greek-blue)]">{s.label}</p>
                  <p className="text-xs text-gray-500 mb-2">{s.description}</p>
                  <GlassSegmentedControl size="sm" value={String(styles[s.id])} onChange={(v) => setStyles({ ...styles, [s.id]: Number(v) })} options={["0", "1", "2", "3"].map((v) => ({ id: v, label: v }))} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-[var(--greek-blue)]">En parallèle</span>
            <GlassSegmentedControl size="sm" value={parallel} onChange={setParallel} options={["2", "4", "6"].map((v) => ({ id: v, label: v }))} />
            <span className="text-xs text-gray-500">Durée estimée : {estimate}. Au-delà de 4, Mistral peut ralentir les requêtes.</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[var(--greek-blue)]">Cours ({selected.size}/{levelCourses.length})</p>
              <GlassButton size="sm" variant="ghost" onClick={() => setSelected(selected.size === levelCourses.length ? new Set() : new Set(levelCourses.map((c) => c.id)))}>
                {selected.size === levelCourses.length ? "Tout décocher" : "Tout cocher"}
              </GlassButton>
            </div>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            {levelCourses.length === 0 && !error && <p className="text-sm text-gray-500">Aucun cours pour ce niveau.</p>}
            <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {levelCourses.map((c) => (
                <label key={c.id} className="flex items-center gap-3 rounded-xl border border-[rgba(197,161,72,0.25)] bg-white px-3 py-2 cursor-pointer">
                  <GlassCheckbox checked={selected.has(c.id)} onChange={(e) => { const n = new Set(selected); if (e.target.checked) n.add(c.id); else n.delete(c.id); setSelected(n); }} />
                  <span className="text-sm text-[var(--greek-blue)] truncate">{c.title}</span>
                  {c.status !== "published" && <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-400">brouillon</span>}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <Emblem3D kind={running ? "sparkles" : failed ? "alert" : "check"} size={56} float={running} />
            <div>
              <p className="text-lg font-bold text-[var(--greek-blue)]">{done}/{rows.length} exercices créés{running ? "…" : ""}</p>
              <p className="text-sm text-gray-500">
                {running ? `${active} en cours ou en attente. Tu peux fermer cette fenêtre : le serveur continue. ` : ""}
                {failed ? `${failed} échec(s). ` : ""}{flagged ? `${flagged} exercice(s) avec une figure à vérifier.` : ""}
              </p>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {rows.map((j) => (
              <li key={j.id} className="rounded-xl border border-[rgba(197,161,72,0.25)] bg-white px-3 py-2">
                <div className="flex items-center gap-3">
                  {j.status === "done" ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : j.status === "error" ? <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" /> : j.status === "queued" || j.status === "cancelled" ? <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin text-[var(--greek-blue)] shrink-0" />}
                  <span className="text-sm font-semibold text-[var(--greek-blue)] truncate">{j.courseTitle}</span>
                  <span className="text-xs text-gray-500 shrink-0">· {j.styleLabel}</span>
                  <span className="ml-auto text-xs text-gray-500 truncate max-w-[45%]">
                    {j.status === "error" ? j.error : j.status === "queued" ? (j.message || "En file d'attente") : j.status === "cancelled" ? "Annulé" : j.status === "done" ? "Créé en brouillon" : j.message}
                  </span>
                </div>
                {j.warnings?.length ? (
                  <ul className="mt-1 ml-7 text-xs text-amber-800 list-disc">{j.warnings.slice(0, 3).map((w) => <li key={w}>{w}</li>)}</ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassDialog>
  );
}
