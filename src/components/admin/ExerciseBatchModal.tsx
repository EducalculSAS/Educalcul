"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Loader2, Square, Play } from "lucide-react";
import GlassDialog from "@/components/ui/GlassDialog";
import GlassButton from "@/components/ui/GlassButton";
import GlassCheckbox from "@/components/ui/GlassCheckbox";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import Emblem3D from "@/components/Emblem3D";
import { SCHOOL_LEVELS } from "@/lib/constants";
import type { ContentGeneration } from "@/contexts/ContentGenerationsContext";

/**
 * Génération par lots : pour chaque cours d'un niveau, plusieurs exercices de styles différents, générés EN PARALLÈLE
 * (chaque exercice tourne dans sa propre génération serveur, la page ne fait que lancer et suivre). Chaque exercice
 * est lié à son cours (l'IA reçoit le cours résumé : notions, méthodes et exercices du cours comme étalon de niveau),
 * rangé dans le dossier d'exercices du même nom, et créé en brouillon.
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
    blockTypes: ["qcm", "matching", "fill_in_the_blank", "ordering"],
    instructions:
      "Exercice ludique et amusant mais rigoureux : énigme, enquête policière, escape game, chasse au trésor, défi entre amis ou mission spatiale, au choix. L'histoire tient en deux phrases et chaque étape fait utiliser une notion du cours (pas de hors-sujet). Ton complice et motivant, pas enfantin.",
  },
];

interface CourseRow { id: number; title: string; level: string | null; status: string | null; folder_id: number | null; chapter_order?: number | null }
interface FolderRow { id: number; name: string; parent_id: number | null; grade_level: string | null }

type JobState = "queued" | "running" | "done" | "error";
interface Job { key: string; course: CourseRow; style: BatchStyle; blockType: string; folderId: number | null; state: JobState; message?: string; warnings?: string[]; exerciseId?: number | null }

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default function ExerciseBatchModal({
  onClose,
  startOne,
  generationsRef,
  defaultLevel = "3eme",
}: {
  onClose: () => void;
  /** Lance une génération et renvoie son id (ou null). */
  startOne: (params: Record<string, unknown>) => Promise<string | null>;
  generationsRef: React.MutableRefObject<ContentGeneration[]>;
  defaultLevel?: string;
}) {
  const [level, setLevel] = useState(defaultLevel);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [exFolders, setExFolders] = useState<FolderRow[]>([]);
  const [courseFolders, setCourseFolders] = useState<FolderRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [styles, setStyles] = useState<Record<BatchStyle["id"], number>>({ guided: 1, problem: 1, fun: 1 });
  const [parallel, setParallel] = useState("4");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, ef, cf] = await Promise.all([
          fetch("/api/admin/courses?status=all").then((r) => r.json()),
          fetch("/api/admin/content-folders/exercise").then((r) => r.json()),
          fetch("/api/admin/content-folders/course").then((r) => r.json()),
        ]);
        setCourses(Array.isArray(c) ? c : c?.courses ?? c?.data ?? []);
        setExFolders(Array.isArray(ef) ? ef : ef?.folders ?? []);
        setCourseFolders(Array.isArray(cf) ? cf : cf?.folders ?? []);
      } catch {
        setLoadError("Impossible de charger les cours.");
      }
    })();
  }, []);

  const levelCourses = useMemo(
    () => courses.filter((c) => norm(c.level) === norm(level)).sort((a, b) => (a.chapter_order ?? 999) - (b.chapter_order ?? 999) || a.title.localeCompare(b.title)),
    [courses, level],
  );
  useEffect(() => { setSelected(new Set(levelCourses.map((c) => c.id))); }, [levelCourses]);

  /** Dossier d'exercices du cours : même nom que le cours, sinon même nom que son dossier de cours (domaine). */
  const folderFor = (course: CourseRow): number | null => {
    const inLevel = exFolders.filter((f) => norm(f.grade_level) === norm(level));
    const byTitle = inLevel.find((f) => norm(f.name) === norm(course.title)) ?? inLevel.find((f) => norm(f.name).startsWith(norm(course.title).slice(0, 12)));
    if (byTitle) return byTitle.id;
    const domain = courseFolders.find((f) => f.id === course.folder_id)?.name;
    const byDomain = domain ? inLevel.find((f) => norm(f.name) === norm(domain)) : undefined;
    return byDomain?.id ?? null;
  };

  const plan = (): Job[] => {
    const out: Job[] = [];
    levelCourses.filter((c) => selected.has(c.id)).forEach((course, ci) => {
      for (const style of BATCH_STYLES) {
        for (let k = 0; k < (styles[style.id] || 0); k++) {
          out.push({
            key: `${course.id}-${style.id}-${k}`,
            course,
            style,
            blockType: style.blockTypes[(ci + k) % style.blockTypes.length],
            folderId: folderFor(course),
            state: "queued",
          });
        }
      }
    });
    return out;
  };

  const total = levelCourses.filter((c) => selected.has(c.id)).length * Object.values(styles).reduce((a, b) => a + b, 0);
  const concurrency = Number(parallel);
  // Estimation : 2 à 3 minutes par exercice (plan, rédaction, relecture mathématique), N à la fois.
  const estimate = total ? `${Math.max(1, Math.round((Math.ceil(total / concurrency) * 2) ))} à ${Math.max(2, Math.round(Math.ceil(total / concurrency) * 3.2))} min` : "-";

  const update = (key: string, patch: Partial<Job>) => setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const runJob = async (job: Job) => {
    update(job.key, { state: "running", message: "Démarrage…" });
    const id = await startOne({
      exerciseType: job.style.exerciseType,
      blockType: job.blockType,
      linkedCourseId: job.course.id,
      subject: job.course.title,
      level,
      difficulty: job.style.difficulty,
      questionCount: job.style.questionCount,
      subjectArea: "Mathématiques",
      instructions: job.style.instructions,
      folder_id: job.folderId,
    });
    if (!id) return update(job.key, { state: "error", message: "Impossible de démarrer." });
    for (let waited = 0; waited < 25 * 60_000; waited += 2_000) {
      await new Promise((r) => setTimeout(r, 2_000));
      const g = generationsRef.current.find((x) => x.id === id);
      if (!g) return update(job.key, { state: "error", message: "Génération retirée de la liste." });
      if (g.status === "done") return update(job.key, { state: "done", message: "Créé en brouillon", warnings: g.progress?.warnings, exerciseId: g.contentId });
      if (g.status === "error") return update(job.key, { state: "error", message: g.error || "Erreur de génération." });
      if (g.status === "cancelled") return update(job.key, { state: "error", message: "Annulée." });
      if (g.progress?.message) update(job.key, { message: g.progress.message });
    }
    update(job.key, { state: "error", message: "Délai dépassé." });
  };

  const start = async () => {
    const queue = plan();
    setJobs(queue);
    setRunning(true);
    stopRef.current = false;
    let next = 0;
    const worker = async (slot: number) => {
      // Départs décalés : les premières requêtes n'arrivent pas toutes dans la même seconde.
      await new Promise((r) => setTimeout(r, slot * 1_500));
      while (!stopRef.current && next < queue.length) {
        const job = queue[next++];
        await runJob(job);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, (_, i) => worker(i)));
    setRunning(false);
  };

  const done = jobs.filter((j) => j.state === "done").length;
  const failed = jobs.filter((j) => j.state === "error").length;
  const flagged = jobs.filter((j) => j.warnings?.length).length;

  return (
    <GlassDialog
      title="Génération par lots"
      onClose={onClose}
      wide="xl"
      footer={(
        <>
          <GlassButton variant="ghost" onClick={onClose}>{running ? "Réduire" : "Fermer"}</GlassButton>
          {running ? (
            <GlassButton variant="danger" onClick={() => { stopRef.current = true; }}><Square className="w-4 h-4" />Arrêter après les exercices en cours</GlassButton>
          ) : (
            <GlassButton variant="navy" disabled={!total} onClick={start}><Play className="w-4 h-4" />Générer {total} exercice{total > 1 ? "s" : ""}</GlassButton>
          )}
        </>
      )}
    >
      {jobs.length === 0 ? (
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <Emblem3D kind="sparkles" size={56} float={false} className="shrink-0" />
            <p className="text-sm text-gray-600">
              Pour chaque cours coché, l&apos;IA lit le cours (notions, méthodes, exercices du cours comme étalon de niveau) et
              rédige des exercices de styles différents, liés au cours, rangés dans son dossier et créés en <strong>brouillon</strong>.
              Les figures sont vérifiées contre leur énoncé ; un écart est signalé ici.
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
            <span className="text-xs text-gray-500">Durée estimée : {estimate}. Au-delà de 4, le fournisseur d&apos;IA peut ralentir les requêtes.</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[var(--greek-blue)]">Cours ({selected.size}/{levelCourses.length})</p>
              <GlassButton size="sm" variant="ghost" onClick={() => setSelected(selected.size === levelCourses.length ? new Set() : new Set(levelCourses.map((c) => c.id)))}>
                {selected.size === levelCourses.length ? "Tout décocher" : "Tout cocher"}
              </GlassButton>
            </div>
            {loadError && <p className="text-sm text-red-600">{loadError}</p>}
            {!loadError && levelCourses.length === 0 && <p className="text-sm text-gray-500">Aucun cours pour ce niveau.</p>}
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
              <p className="text-lg font-bold text-[var(--greek-blue)]">{done}/{jobs.length} exercices créés{running ? "…" : ""}</p>
              <p className="text-sm text-gray-500">
                {failed ? `${failed} échec(s). ` : ""}{flagged ? `${flagged} exercice(s) avec une figure à vérifier.` : running ? "Tu peux réduire cette fenêtre, les générations continuent sur le serveur." : ""}
              </p>
            </div>
          </div>
          <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {jobs.map((j) => (
              <li key={j.key} className="rounded-xl border border-[rgba(197,161,72,0.25)] bg-white px-3 py-2">
                <div className="flex items-center gap-3">
                  {j.state === "done" ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : j.state === "error" ? <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" /> : j.state === "running" ? <Loader2 className="w-4 h-4 animate-spin text-[var(--greek-blue)] shrink-0" /> : <span className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />}
                  <span className="text-sm font-semibold text-[var(--greek-blue)] truncate">{j.course.title}</span>
                  <span className="text-xs text-gray-500 shrink-0">· {j.style.label}</span>
                  <span className="ml-auto text-xs text-gray-500 truncate max-w-[45%]">{j.message}</span>
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
