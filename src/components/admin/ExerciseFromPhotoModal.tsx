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
}

interface Props {
  onGenerate: (params: ExerciseFromPhotoParams) => void;
  onClose: () => void;
  defaultLevel?: string;
}

interface Extracted {
  title: string;
  statement: string;
  subjectArea: string;
  questionCount: number;
  hasFigure: boolean;
  figureDescription: string;
}

const MAX_SIDE = 1400;

/** Réduit l'image (photos de téléphone très lourdes) et la renvoie en JPEG base64. */
async function toDataUrl(file: Blob): Promise<string> {
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
  return canvas.toDataURL("image/jpeg", 0.8);
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
      const dataUrl = await toDataUrl(file);
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
      setTitle(ex.title);
      setSourceCount(ex.questionCount);
      setParams((p) => ({
        ...p,
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
                Cadre bien l'énoncé, les consignes et quelques questions. L'IA en tirera un exercice voisin : mêmes
                questions avec d'autres valeurs, des questions en plus et des figures.
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
                <label className={labelClass}>Exercice lu sur l'image (corrige si besoin)</label>
                <textarea rows={9} className={`${fieldClass} font-mono text-sm`} value={statement} onChange={(e) => setStatement(e.target.value)} />
                <p className="text-xs text-gray-500 mt-1">Les formules sont en LaTeX entre $...$. Vérifie surtout les nombres : la lecture d'une photo peut se tromper.</p>
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
                <div>
                  <label className={labelClass}>Type de question</label>
                  <select className={fieldClass} value={params.blockType} onChange={(e) => setParams({ ...params, blockType: e.target.value as GenBlockType })}>
                    {BLOCK_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                </div>
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

              <div>
                <label className={labelClass}>
                  Nombre de questions : {params.questionCount}
                  <span className="font-normal text-gray-500"> (dont {Math.min(sourceCount, params.questionCount)} reprises de l'image, le reste est inventé)</span>
                </label>
                <input type="range" min={1} max={24} value={params.questionCount} onChange={(e) => setParams({ ...params, questionCount: parseInt(e.target.value) })} className="w-full accent-[var(--greek-blue)]" />
              </div>

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

              <div>
                <label className={labelClass}>Instructions supplémentaires (optionnel)</label>
                <textarea rows={2} className={fieldClass} value={params.instructions} onChange={(e) => setParams({ ...params, instructions: e.target.value })} placeholder="Ex: ajoute un tableau de valeurs, termine par une question de synthèse" />
              </div>

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
