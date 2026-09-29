"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, CheckCircle, AlertTriangle } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

/** Bouton retour + modale de signalement : les deux seules actions
 * interactives (navigation historique du navigateur, mutation forum_reports)
 * de la page de profil public /u/[id]. Le reste de la page est rendu côté
 * serveur. */
export default function ProfileHeaderActions({
  userId, userRole, returnTo,
}: {
  userId: number;
  userRole: string;
  returnTo: string | null;
}) {
  const router = useRouter();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleBack = () => {
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    router.back();
  };

  const submitReport = async () => {
    if (!reportReason.trim()) return;

    let res: Response;
    try {
      res = await fetch("/api/forum/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "profile", targetId: userId, reason: reportReason.trim() }),
      });
    } catch (e) {
      console.error("[report] network error", e);
      setReportMessage({ type: "error", text: "Erreur réseau, réessaie." });
      return;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("[report] failed", res.status, data);
      setReportMessage({ type: "error", text: `${data.error || "Impossible d'envoyer le signalement."} (${res.status})` });
      return;
    }

    setReportOpen(false);
    setReportReason("");
    setReportMessage({ type: "success", text: "Profil signalé. L'administration va le consulter." });
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <GlassButton onClick={handleBack} variant="light" size="sm">
          <ArrowLeft className="w-4 h-4" /> Retour
        </GlassButton>
        {userRole !== "admin" && (
          <GlassButton onClick={() => setReportOpen(true)} variant="light" size="sm">
            <Flag className="w-4 h-4" /> Signaler le profil
          </GlassButton>
        )}
      </div>

      {reportMessage && (
        <div className={`container mx-auto max-w-2xl px-4 mb-4`}>
          <div className={`p-4 rounded-xl flex items-center justify-between gap-3 border ${reportMessage.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {reportMessage.type === "error" ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              <span>{reportMessage.text}</span>
            </div>
            <button onClick={() => setReportMessage(null)} className="font-bold">&times;</button>
          </div>
        </div>
      )}

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 modal-overlay">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[var(--greek-gold)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--greek-blue)]">Signaler le profil</h2>
                <p className="text-sm text-gray-500">Explique brièvement pourquoi tu signales ce profil.</p>
              </div>
              <GlassCloseButton onClick={() => setReportOpen(false)} variant="light" size="sm" />
            </div>
            <div className="space-y-4 px-6 py-5">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                aria-label="Raison du signalement"
                className="h-36 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[var(--text-dark)] placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                placeholder="Ex : contenu inapproprié, usurpation, harcèlement..."
              />
              <div className="flex gap-3">
                <GlassButton onClick={() => setReportOpen(false)} variant="ghost" size="sm" fullWidth>
                  Annuler
                </GlassButton>
                <GlassButton onClick={submitReport} variant="navy" size="sm" fullWidth>
                  Signaler
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
