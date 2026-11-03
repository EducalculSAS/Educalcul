"use client";

import GlassCheckbox from "@/components/ui/GlassCheckbox";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { checkExercise, htmlToPlain, parseQuickEntry, type AuthoringBlock, type AuthoringIssue, type AuthoringPage } from "@/lib/contentAuthoring";

const HELP = `# Additions
12 + 8 =
(-5,5) - (+3) | -8,5 | On additionne les opposés
Un carré a 4 côtés | vrai
Capitale de la France ? | Paris* ; Lyon ; Nice
3 + ▢ = 8 | 5`;

interface QuickEntryProps {
  /** Pages existantes où ajouter ; absent = quiz (liste plate, pas de choix de page). */
  pages?: AuthoringPage[];
  /** Page où ajouter (null = nouvelle page). */
  defaultPageId: string | null;
  onApply: (groups: { title: string | null; blocks: AuthoringBlock[] }[], targetPageId: string | null) => void;
  onClose: () => void;
}

/** Saisie rapide : une question par ligne (ou un tableau Excel / CSV) → blocs d'exercice, réponses calculées et vérifiées en code. */
export function QuickEntryModal({ pages, defaultPageId, onApply, onClose, startIndex = 0 }: QuickEntryProps & { startIndex?: number }) {
  const [text, setText] = useState("");
  const [table, setTable] = useState(false);
  const [target, setTarget] = useState<string>(defaultPageId ?? "new");
  const fileRef = useRef<HTMLInputElement>(null);

  const targetPage = pages?.find((p) => p.id === target);
  const firstIndex = pages ? targetPage?.blocks.length ?? 0 : startIndex;
  const result = useMemo(() => parseQuickEntry(text, { table, startIndex: firstIndex }), [text, table, firstIndex]);
  const hasWarning = (note: string) => note.startsWith("⚠");

  const readFile = async (file: File) => {
    setText(await file.text());
    setTable(true);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1070] p-4 modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-[rgba(197,161,72,0.25)]">
        <div className="px-6 py-4 bg-gradient-to-r from-[var(--greek-blue)] to-blue-900 text-white flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Saisie rapide</h2>
            <p className="text-xs text-white/70">Une question par ligne, ou un tableau Excel / CSV : les réponses sont calculées et vérifiées, sans IA</p>
          </div>
          <GlassCloseButton onClick={onClose} variant="dark" />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {pages && (
              <label className="flex items-center gap-2">
                Ajouter dans
                <select value={target} onChange={(e) => setTarget(e.target.value)} className="border border-[rgba(197,161,72,0.25)] rounded-lg text-sm">
                  <option value="new">une nouvelle page</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.title || "Page sans titre"}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5" title="Première ligne = en-têtes : énoncé, réponse, explication, type, page">
              <GlassCheckbox checked={table} onChange={(e) => setTable(e.target.checked)} />
              Format tableau (CSV)
            </label>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
            <GlassButton size="sm" variant="ghost" type="button" onClick={() => fileRef.current?.click()}>
              <FileSpreadsheet size={14} /> Importer un fichier CSV
            </GlassButton>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            autoFocus
            spellCheck={false}
            placeholder={HELP}
            className="w-full px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
          />

          <div className="text-xs text-gray-600 space-y-1">
            <p><b>Calcul</b> : écris-le seul (« 12 + 8 = », « (-5,5) - (+3) », « $\frac{"{1}{2}"} + \frac{"{1}{3}"} =$ ») : la réponse est calculée ; si tu la donnes, elle est vérifiée.</p>
            <p><b>énoncé | réponse | explication</b> sur chaque ligne (ou colonnes collées depuis Excel). <b>Vrai/faux</b> : réponse « vrai » ou « faux ». <b>QCM</b> : « Paris* ; Lyon ; Nice » (étoile = bonne réponse). <b>Trous</b> : « 3 + ▢ = 8 | 5 » (plusieurs réponses séparées par « ; »). {pages && <><b>Nouvelle page</b> : une ligne « # Titre ».</>}{!pages && <>Les trous d&apos;un texte à trous deviennent « … » (un quiz n&apos;a pas ce type).</>}</p>
          </div>

          {result.total > 0 && (
            <div className="rounded-xl border border-[rgba(197,161,72,0.25)] bg-gray-50 p-4 space-y-2">
              <p className="text-sm font-semibold text-[var(--greek-blue)]">
                {result.total} question(s) prête(s){result.groups.length > 1 || result.groups[0]?.title ? ` sur ${result.groups.length} page(s)` : ""}
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {result.groups.flatMap((g) => g.blocks).map((b, i) => (
                  <li key={b.id} className="text-xs flex gap-2">
                    <span className="text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 truncate">{htmlToPlain(b.content)}</span>
                    <span className="font-mono text-gray-600 truncate max-w-[40%]">
                      {Array.isArray(b.correctAnswer) ? b.correctAnswer.join(" ; ") : b.type === "fill_in_the_blank" ? (b.blanks ?? []).join(" ; ") : String(b.correctAnswer ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
              {result.notes.length > 0 && (
                <ul className="text-xs space-y-0.5 pt-2 border-t border-[rgba(197,161,72,0.25)]">
                  {result.notes.map(([line, note], i) => (
                    <li key={i} className={hasWarning(note) || note.includes("manquante") || note.includes("aucune") ? "text-amber-700" : "text-gray-500"}>
                      ligne {line} : {note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[rgba(197,161,72,0.25)] flex justify-end gap-3 flex-shrink-0 bg-white">
          <GlassButton variant="ghost" type="button" onClick={onClose}>Annuler</GlassButton>
          <GlassButton
            variant="navy"
            type="button"
            disabled={result.total === 0}
            onClick={() => {
              onApply(result.groups, target === "new" ? null : target);
              onClose();
            }}
          >
            Ajouter {result.total > 0 ? `${result.total} question(s)` : ""}
          </GlassButton>
        </div>
      </div>
    </div>
  );
}

interface CheckPanelProps {
  pages: AuthoringPage[];
  onJump: (pageId: string, blockId: string) => void;
  onClose: () => void;
}

/** Vérificateur : liste les réponses fausses, champs vides, formules illisibles et doublons de l'exercice. */
export function CheckPanel({ pages, onJump, onClose }: CheckPanelProps) {
  const [issues, setIssues] = useState<AuthoringIssue[]>(() => checkExercise(pages));
  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.length - errors;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1070] p-4 modal-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden border border-[rgba(197,161,72,0.25)]">
        <div className="px-6 py-4 bg-gradient-to-r from-[var(--greek-blue)] to-blue-900 text-white flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold">Vérification de l&apos;exercice</h2>
            <p className="text-xs text-white/70">Calculs revérifiés en code, champs vides, formules, doublons</p>
          </div>
          <GlassCloseButton onClick={onClose} variant="dark" />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {issues.length === 0 ? (
            <div className="flex items-center gap-3 text-green-700 font-semibold py-6 justify-center">
              <CheckCircle2 size={24} /> Rien à signaler : réponses, formules et champs sont en ordre.
            </div>
          ) : (
            <>
              <p className="text-sm mb-3">
                <b className="text-red-600">{errors} erreur(s)</b>, <b className="text-amber-600">{warns} remarque(s)</b>
              </p>
              <ul className="space-y-2">
                {issues.map((issue, i) => {
                  const block = pages[issue.pageIndex]?.blocks[issue.blockIndex];
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => block && onJump(pages[issue.pageIndex].id, block.id)}
                        className={`w-full text-left flex gap-3 items-start rounded-xl border px-4 py-2.5 text-sm hover:shadow ${issue.severity === "error" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}
                      >
                        {issue.severity === "error" ? <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" /> : <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />}
                        <span>
                          <span className="font-semibold">{issue.pageTitle || `Page ${issue.pageIndex + 1}`} › {issue.blockTitle}</span>
                          <br />
                          {issue.message}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-[rgba(197,161,72,0.25)] flex justify-end gap-3 flex-shrink-0">
          <GlassButton variant="ghost" type="button" onClick={() => setIssues(checkExercise(pages))}>Revérifier</GlassButton>
          <GlassButton variant="navy" type="button" onClick={onClose}>Fermer</GlassButton>
        </div>
      </div>
    </div>
  );
}

