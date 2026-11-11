"use client";

import { useState } from "react";
import LoaderDots from "@/components/LoaderDots";
import { GraduationCap, Send } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { SCHOOL_LEVELS, getLevelLabel } from "@/lib/constants";
import { getMyProfile } from "@/lib/updateMyProfile";

/**
 * Le parent ne s'attribue pas lui-même des niveaux en plus : il en fait la
 * demande à l'équipe (ticket de support, avec le lien vers la fiche de
 * l'élève), qui l'accorde depuis l'admin (fiche utilisateur → Niveaux visibles).
 */
export default function LevelRequestCard({
  childId, childName, gradeLevel, extraLevels,
}: {
  childId: string | number;
  childName: string;
  gradeLevel: string;
  extraLevels: string[];
}) {
  const options = SCHOOL_LEVELS.filter((l) => l.value !== gradeLevel && !extraLevels.includes(l.value));
  const [level, setLevel] = useState(options[0]?.value ?? "");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!level) return;
    setSending(true);
    setError(null);
    try {
      const me = await getMyProfile<{ first_name?: string; last_name?: string; email?: string }>();
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: me?.email ?? "",
          userName: `${me?.first_name ?? ""} ${me?.last_name ?? ""}`.trim(),
          subject: `Niveau supplémentaire pour ${childName} : ${getLevelLabel(level)}`,
          message: [
            `Demande d'accès à un niveau en plus pour ${childName} (classe actuelle : ${getLevelLabel(gradeLevel)}).`,
            `Niveau demandé : ${getLevelLabel(level)}.`,
            reason.trim() ? `Motif : ${reason.trim()}` : "",
            `Fiche élève : /admin/users/detail?id=${childId}`,
          ].filter(Boolean).join("\n"),
          priority: "normal",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Envoi impossible");
      setDone(`Demande envoyée : l'équipe vous répondra dans votre espace Support.`);
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (options.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[rgba(197,161,72,0.25)] p-4 space-y-3">
      <p className="text-sm font-semibold text-[var(--greek-blue)] flex items-center gap-2">
        <GraduationCap className="w-4 h-4 text-[var(--greek-gold)]" /> Voir un autre niveau
      </p>
      <p className="text-xs text-gray-500">
        Pour que {childName} voie aussi les cours, exercices et quiz d&apos;un autre niveau (ex. revoir la Première en Terminale), faites-en la demande à l&apos;équipe.
        {extraLevels.length > 0 && <> Déjà accordé : {extraLevels.map(getLevelLabel).join(", ")}.</>}
      </p>
      {done ? (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">{done}</p>
      ) : (
        <>
          <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Niveau demandé" className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg">
            {options.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 500))}
            rows={2}
            placeholder="Pourquoi ? (facultatif)"
            aria-label="Motif de la demande"
            className="w-full px-4 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end">
            <GlassButton size="sm" variant="navy" onClick={send} disabled={sending || !level}>
              {sending ? <LoaderDots /> : <Send className="w-4 h-4" />} Envoyer la demande
            </GlassButton>
          </div>
        </>
      )}
    </div>
  );
}
