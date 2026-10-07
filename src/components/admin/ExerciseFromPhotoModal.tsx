"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Sparkles, Loader2, Upload, RefreshCw } from "lucide-react";
import { SCHOOL_LEVELS } from "@/lib/constants";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { BLOCK_TYPE_OPTIONS, type GenBlockType } from "./ExerciseGeneratorModal";

export interface ExerciseFromPhotoParams {
  exerciseType: "simple" | "contextual";
  blockType: GenBlockType;
  subject: string;
  level: string;
  difficulty: "easy" | "medium" | "hard";
  questionCount: number;
  subjectArea: string;
  instructions: string;
  sourceExercise: string;
  sourceQuestionCount: number;
  sourceFigureDescription: string;
  /** Copie fidèle de la photo (défaut) ou variante (valeurs changées, questions en plus). */
  copyMode: boolean;
  /** Figures à cases lues sur l'image (pyramides, grilles), reproduites telles quelles en copie fidèle. */
  sourceFigures: unknown[];
}

interface Props {
  onGenerate: (params: ExerciseFromPhotoParams) => void;
  onClose: () => void;
  defaultLevel?: string;
}

interface Extracted {
  title: string;
  level?: string;
  statement: string;
  subjectArea: string;
  questionCount: number;
  hasFigure: boolean;
  figureDescription: string;
  figures?: unknown[];
}

const MAX_SIDE = 1400;

/** Réduit l'image (photos de téléphone très lourdes) et la renvoie en JPEG base64. */
/** Sous ce côté (en pixels), l'écriture n'est plus lisible : la lecture inventerait. */
const MIN_SIDE = 700;

async function toDataUrl(file: Blob): Promise<{ dataUrl: string; side: number }> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image illisible.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.8), side: Math.max(bitmap.width, bitmap.height) };
}

/** Relit les figures corrigées par l'admin ; une figure mal formée est ignorée (un exemple la remplace). */
function parseFigureTexts(list: { kind: "brick_pyramid" | "fill_grid"; section: number; text: string }[]): unknown[] {
  const out: unknown[] = [];
  for (const f of list) {
    const rows = f.text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split("|").map((c) => (c.trim() === "▢" ? "" : c.trim())));
    if (rows.length === 0) continue;
    if (f.kind === "brick_pyramid") {
      if (rows.length >= 2 && rows.every((r, i) => r.length === i + 1)) out.push({ kind: f.kind, section: f.section, levels: rows });
    } else if (rows.every((r) => r.length === rows[0].length)) {
      out.push({ kind: f.kind, section: f.section, cells: rows });
    }
  }
  return out;
}

const fieldClass =
  "w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 focus:border-[var(--greek-blue)] bg-white";
const labelClass = "block text-sm font-semibold text-[var(--greek-blue)] mb-1.5";

export default function ExerciseFromPhotoModal({ onGenerate, onClose, defaultLevel }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [statement, setStatement] = useState("");
  const [figure, setFigure] = useState("");
  const [title, setTitle] = useState("");
  const [sourceCount, setSourceCount] = useState(4);
  const [copyMode, setCopyMode] = useState(true);
  // Figures à cases lues sur l'image, éditables : une rangée par ligne, cases séparées par « | », ▢ = case vide.
  const [figureTexts, setFigureTexts] = useState<{ kind: "brick_pyramid" | "fill_grid"; section: number; text: string }[]>([]);
  const [params, setParams] = useState({
    exerciseType: "contextual" as "simple" | "contextual",
    blockType: "standard" as GenBlockType,
    level: defaultLevel || "6eme",
    difficulty: "medium" as "easy" | "medium" | "hard",
    questionCount: 6,
    subjectArea: "Algèbre",
    instructions: "",
  });

  const readImage = useCallback(async (file: Blob) => {
    setError(null);
    setReading(true);
    try {
      const { dataUrl, side } = await toDataUrl(file);
      if (side < MIN_SIDE) {
        throw new Error(`Image trop petite (${side} px de côté) : l'écriture ne serait pas lisible et la lecture inventerait du contenu. Envoie une image d'au moins ${MIN_SIDE} px (photo ou capture en pleine page).`);
      }
      setImage(dataUrl);
      const res = await fetch("/api/admin/ai/exercise/from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Lecture impossible.");
      const ex = data as Extracted;
      setExtracted(ex);
      setStatement(ex.statement);
      setFigure(ex.hasFigure ? ex.figureDescription : "");
      setFigureTexts(
        (Array.isArray(ex.figures) ? (ex.figures as { kind: "brick_pyramid" | "fill_grid"; section: number; levels?: string[][]; cells?: string[][] }[]) : []).map((f) => ({
          kind: f.kind,
          section: f.section,
          text: (f.kind === "brick_pyramid" ? f.levels ?? [] : f.cells ?? []).map((row) => row.map((c) => c || "▢").join(" | ")).join("\n"),
        })),
      );
      setTitle(ex.title);
      setSourceCount(ex.questionCount);
      setParams((p) => ({
        ...p,
        // Niveau deviné d'après la difficulté (une fiche de CP n'est pas une fiche de 6ème) ; modifiable ci-dessous.
        level: ex.level && SCHOOL_LEVELS.some((l) => l.value === ex.level) ? ex.level : p.level,
        subjectArea: ex.subjectArea,
        questionCount: Math.min(24, ex.questionCount + 2),
      }));
    } catch (e) {
      setExtracted(null);
      setError(e instanceof Error ? e.message : "Lecture impossible.");
    } finally {
      setReading(false);
    }
  }, []);

  // Ctrl+V : colle directement une capture d'écran.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void readImage(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [readImage]);

  const reset = () => {
    setImage(null);
    setExtracted(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement.trim()) {
      setError("L'énoncé est vide.");
      return;
    }
    onGenerate({
      ...params,
      subject: title.trim() || "Exercice inspiré d'une photo",
      sourceExercise: statement.trim(),
      sourceQuestionCount: sourceCount,
      sourceFigureDescription: figure.trim(),
      copyMode,
      sourceFigures: parseFigureTexts(figureTexts),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1060] p-4 modal-overlay">
      <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-[rgba(197,161,72,0.25)]">
        <div className="px-8 py-6 bg-gradient-to-r from-[var(--greek-blue)] to-blue-900 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[var(--greek-gold)]/20 border border-[var(--greek-gold)]/40 flex items-center justify-center">
              <Camera className="text-[var(--greek-gold)]" size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold font-[family-name:var(--font-display)]">Exercice depuis une photo</h2>
              <p className="text-xs text-white/70 mt-0.5">
                {extracted ? "Relis la transcription, puis lance la génération" : "Photo ou capture d'un exercice à adapter"}
              </p>
            </div>
          </div>
          <GlassCloseButton onClick={onClose} variant="dark" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {!extracted ? (
            <div className="p-8 space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readImage(f);
                }}
              />
              {reading ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  {image && <img src={image} alt="Exercice" className="max-h-48 rounded-xl border border-[rgba(197,161,72,0.25)]" />}
                  <Loader2 className="animate-spin text-[var(--greek-blue)]" size={36} />
                  <p className="text-sm text-gray-600">Lecture de l'exercice en cours...</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f && f.type.startsWith("image/")) void readImage(f);
                  }}
                  className="w-full flex flex-col items-center gap-3 py-14 rounded-2xl border-2 border-dashed border-[rgba(197,161,72,0.5)] bg-white hover:border-[var(--greek-gold)] hover:shadow-lg transition-all"
                >
                  <Upload className="text-[var(--greek-blue)]" size={32} />
                  <span className="font-bold text-[var(--greek-blue)]">Choisir une photo ou déposer une image</span>
                  <span className="text-sm text-gray-500">Tu peux aussi coller une capture d'écran avec Ctrl+V</span>
                </button>
              )}
              <p className="text-xs text-gray-500">
                Cadre bien l'énoncé, les consignes et les questions. Par défaut, l'exercice est une copie fidèle (rien
                n'est inventé) que tu modifies ensuite ; tu peux aussi demander une variante avec d'autres valeurs.
              </p>
              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
            </div>
          ) : (
            <form onSubmit={submit} className="p-8 space-y-5">
              <div className="flex items-start gap-4">
                {image && <img src={image} alt="Exercice" className="w-24 h-24 object-cover rounded-xl border border-[rgba(197,161,72,0.25)] flex-shrink-0" />}
                <div className="flex-1">
                  <label className={labelClass}>Titre</label>
                  <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Aire et périmètre" />
                  <button type="button" onClick={reset} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--greek-blue)] hover:underline">
                    <RefreshCw size={12} /> Choisir une autre image
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Exercice lu sur l'image : c'est ce qui sera copié (corrige-le ici si besoin)</label>
                <textarea rows={9} className={`${fieldClass} font-mono text-sm`} value={statement} onChange={(e) => setStatement(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">Les formules sont en LaTeX entre $...$. Vérifie surtout les nombres : la lecture d'une photo peut se tromper.</p>
              </div>

              {figureTexts.length > 0 && (
                <div className="space-y-3">
                  <label className={labelClass}>Figures à cases lues sur l'image (corrige-les)</label>
                  <p className="text-xs text-gray-500 -mt-1">Une rangée par ligne, cases séparées par « | », ▢ pour une case vide. Pyramide : du sommet vers la base.</p>
                  {figureTexts.map((f, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-gray-600 mb-1">{f.kind === "brick_pyramid" ? "Pyramide de briques" : "Grille ou carré magique"} (exercice {f.section})</p>
                      <textarea
                        rows={Math.min(8, f.text.split("\n").length + 1)}
                        className={`${fieldClass} font-mono text-sm`}
                        value={f.text}
                        onChange={(e) => setFigureTexts((list) => list.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className={labelClass}>Que veux-tu obtenir ?</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    [true, "Copie fidèle", "Mêmes énoncés, mêmes nombres, mêmes figures : rien n'est inventé. Tu modifies ensuite."],
                    [false, "Variante", "Mêmes types de questions mais d'autres valeurs, des questions en plus."],
                  ] as const).map(([value, label, hint]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setCopyMode(value)}
                      style={{
                        background: copyMode === value ? "var(--greek-blue)" : "#fff",
                        color: copyMode === value ? "#fff" : "var(--greek-blue)",
                        borderColor: copyMode === value ? "var(--greek-blue)" : "rgba(197,161,72,0.25)",
                      }}
                      className="text-left px-4 py-3 rounded-xl border-2 transition-all"
                    >
                      <span className="block text-sm font-bold">{label}</span>
                      <span className="block text-xs opacity-80 mt-0.5">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Figure de l'exercice (décris-la pour qu'elle soit redessinée, optionnel)</label>
                <textarea rows={3} className={fieldClass} value={figure} onChange={(e) => setFigure(e.target.value)} placeholder="Ex: triangle ABC rectangle en A, AB = 6 cm, AC = 8 cm, point M milieu de [BC]" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Niveau scolaire</label>
                  <select className={fieldClass} value={params.level} onChange={(e) => setParams({ ...params, level: e.target.value })}>
                    {SCHOOL_LEVELS.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}
                  </select>
                </div>
                {!copyMode && (
                  <div>
                    <label className={labelClass}>Type de question</label>
                    <select className={fieldClass} value={params.blockType} onChange={(e) => setParams({ ...params, blockType: e.target.value as GenBlockType })}>
                      {BLOCK_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Difficulté</label>
                <div className="flex gap-2">
                  {([["easy", "Facile"], ["medium", "Moyen"], ["hard", "Difficile"]] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setParams({ ...params, difficulty: v })}
                      style={{
                        background: params.difficulty === v ? "var(--greek-blue)" : "#fff",
                        color: params.difficulty === v ? "#fff" : "var(--greek-blue)",
                        borderColor: params.difficulty === v ? "var(--greek-blue)" : "rgba(197,161,72,0.25)",
                      }}
                      className="flex-1 py-2.5 text-sm font-bold rounded-xl border-2 transition-all"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {copyMode && (
                <p className="text-xs text-gray-500 -mt-1">
                  Copie fidèle : toutes les questions de la photo sont reprises (environ {sourceCount}), dans l'ordre, avec leurs
                  trous et leurs figures. Les réponses sont calculées ; une réponse douteuse est marquée « À vérifier ».
                </p>
              )}

              {!copyMode && (
              <div>
                <label className={labelClass}>
                  Nombre de questions : {params.questionCount}
                  <span className="font-normal text-gray-500"> (dont {Math.min(sourceCount, params.questionCount)} reprises de l'image, le reste est inventé)</span>
                </label>
                <input type="range" min={1} max={24} value={params.questionCount} onChange={(e) => setParams({ ...params, questionCount: parseInt(e.target.value) })} className="w-full accent-[var(--greek-blue)]" />
              </div>
              )}

              {!copyMode && (
              <div>
                <label className={labelClass}>Énoncé commun</label>
                <div className="flex gap-2">
                  {([["contextual", "Avec mise en situation"], ["simple", "Questions directes"]] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setParams({ ...params, exerciseType: v })}
                      style={{
                        background: params.exerciseType === v ? "var(--greek-blue)" : "#fff",
                        color: params.exerciseType === v ? "#fff" : "var(--greek-blue)",
                        borderColor: params.exerciseType === v ? "var(--greek-blue)" : "rgba(197,161,72,0.25)",
                      }}
                      className="flex-1 py-2.5 text-sm font-bold rounded-xl border-2 transition-all"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {!copyMode && (
              <div>
                <label className={labelClass}>Instructions supplémentaires (optionnel)</label>
                <textarea rows={2} className={fieldClass} value={params.instructions} onChange={(e) => setParams({ ...params, instructions: e.target.value })} placeholder="Ex: ajoute un tableau de valeurs, termine par une question de synthèse" />
              </div>
              )}

              {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <GlassButton type="button" variant="ghost" onClick={onClose}>Annuler</GlassButton>
                <GlassButton type="submit" variant="navy">
                  <Sparkles size={16} /> Générer l'exercice
                </GlassButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
