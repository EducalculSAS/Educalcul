"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Flag, X, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import GlassButton from "@/components/ui/GlassButton";

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

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    if (!authUser) {
      setReportMessage({ type: "error", text: "Tu dois être connecté pour signaler un profil." });
      return;
    }

    const { data: reporter } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!reporter) {
      setReportMessage({ type: "error", text: "Profil utilisateur introuvable." });
      return;
    }

    const { error } = await supabase.from("forum_reports").insert({
      reporter_id: reporter.id,
      reported_user_id: userId,
      reason: reportReason.trim(),
    });

    if (error) {
      setReportMessage({ type: "error", text: error.message || "Impossible d'envoyer le signalement." });
      return;
    }

    setReportOpen(false);
    setReportReason("");
    setReportMessage({ type: "success", text: "Profil signalé. L'administration va le consulter." });
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <button onClick={handleBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[var(--greek-gold)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--greek-blue)]">Signaler le profil</h2>
                <p className="text-sm text-gray-500">Explique brièvement pourquoi tu signales ce profil.</p>
              </div>
              <button onClick={() => setReportOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                aria-label="Raison du signalement"
                className="h-36 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
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
