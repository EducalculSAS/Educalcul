"use client";
import { useState } from "react";
import type { AnswerValue } from "@/types/answers";
import GlassButton from "@/components/ui/GlassButton";
import { CheckCircle, XCircle } from "lucide-react";

/** Zone commentaire + édition de réponse affichée sous une question, en revue
 * admin uniquement (`adminMode` fourni par le parent). Composant local pour
 * ne pas alourdir l'état déjà volumineux d'ExerciseViewer — gère juste ses
 * deux champs (textarea) et délègue la sauvegarde au parent. */
export function AdminAttemptControls<T = AnswerValue>({
  itemKey,
  currentAnswer,
  existingComment,
  existingEditedAnswer,
  adminMode,
}: {
  itemKey: string;
  currentAnswer: T;
  existingComment?: string;
  existingEditedAnswer?: T;
  adminMode: { onComment: (key: string, text: string) => void; onEditAnswer: (key: string, value: T) => void; onVerdict?: (key: string, correct: boolean) => void; saving?: boolean };
}) {
  const [comment, setComment] = useState(existingComment || "");
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(() =>
    JSON.stringify(existingEditedAnswer !== undefined ? existingEditedAnswer : currentAnswer, null, 2)
  );

  return (
    <div className="mt-3 pt-3 border-t border-dashed border-purple-200 space-y-2">
      <div className="flex items-center gap-2">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Laisser un commentaire pour l'élève sur cette question..."
          className="flex-1 text-xs border border-purple-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-300"
          rows={2}
        />
        <GlassButton size="sm" variant="outline" onClick={() => adminMode.onComment(itemKey, comment)} disabled={adminMode.saving}>
          Enregistrer
        </GlassButton>
      </div>
      {adminMode.onVerdict && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-purple-700">Correction manuelle :</span>
          <GlassButton size="sm" variant="outline" onClick={() => adminMode.onVerdict?.(itemKey, true)} disabled={adminMode.saving}>
            <CheckCircle className="w-3.5 h-3.5 text-green-600" /> Compter juste
          </GlassButton>
          <GlassButton size="sm" variant="outline" onClick={() => adminMode.onVerdict?.(itemKey, false)} disabled={adminMode.saving}>
            <XCircle className="w-3.5 h-3.5 text-red-600" /> Compter fausse
          </GlassButton>
        </div>
      )}
      {!editing ? (
        <GlassButton onClick={() => setEditing(true)} variant="outline" size="sm">
          Modifier la réponse enregistrée
        </GlassButton>
      ) : (
        <div className="space-y-1.5">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full text-xs font-mono border border-purple-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-purple-300"
            rows={2}
          />
          <div className="flex gap-2">
            <GlassButton
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  adminMode.onEditAnswer(itemKey, JSON.parse(editValue));
                  setEditing(false);
                } catch {
                  // JSON invalide — on laisse le champ ouvert pour correction.
                }
              }}
              disabled={adminMode.saving}
            >
              Enregistrer la correction
            </GlassButton>
            <GlassButton size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</GlassButton>
          </div>
        </div>
      )}
    </div>
  );
}
