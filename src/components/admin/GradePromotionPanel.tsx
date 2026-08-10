"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp, GraduationCap, Loader2, CheckCircle, AlertCircle, X, RotateCcw } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

interface LastRun {
  id: number;
  run_at: string;
  undone_at: string | null;
}

export default function GradePromotionPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("09-01");
  const [lastRunYear, setLastRunYear] = useState<number | null>(null);
  const [lastRun, setLastRun] = useState<LastRun | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const authHeaders = async (extra?: Record<string, string>) => {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token || ""}`, ...extra };
  };

  const load = async () => {
    const res = await fetch("/api/admin/grade-promotion", { headers: await authHeaders() });
    const data = await res.json();
    if (res.ok) {
      setDate(data.date);
      setLastRunYear(data.lastRunYear);
      setLastRun(data.lastRun);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveDate = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/grade-promotion", {
        method: "PUT",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: "success", text: "Date enregistrée." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erreur." });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const runNow = async () => {
    setShowConfirm(false);
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/grade-promotion", { method: "POST", headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLastRunYear(new Date().getFullYear());
      setMessage({
        type: "success",
        text: `${data.advanced} enfant(s) avancé(s) de niveau, ${data.graduated} diplômé(s), ${data.needsManualChoice} élève(s) en Seconde devront choisir leur spécialité à leur prochaine connexion.`,
      });
      load();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erreur." });
    } finally {
      setRunning(false);
    }
  };

  const undoLast = async () => {
    setShowUndoConfirm(false);
    setUndoing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/grade-promotion", { method: "DELETE", headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage({ type: "success", text: `${data.restored} compte(s) restauré(s) à leur niveau précédent.` });
      load();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erreur." });
    } finally {
      setUndoing(false);
    }
  };

  const canUndo = lastRun && !lastRun.undone_at;

  return (
    <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden mb-6">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 font-bold text-[var(--greek-blue)]">
          <GraduationCap className="w-5 h-5" />
          Passage automatique de classe
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-[rgba(197,161,72,0.15)] pt-4">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Chaque année à la date choisie, tous les comptes enfant avancent automatiquement d'un niveau (CP → CE1 → … → Seconde, et Première → Terminale sur la même spécialité). Les élèves en Seconde devront choisir leur spécialité maths eux-mêmes, via un popup obligatoire à leur prochaine connexion. Les élèves déjà en Terminale sont marqués diplômés.
              </p>

              {message && (
                <div className={`flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-sm font-medium ${message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {message.text}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date déclencheur (jour/mois)</label>
                  <input
                    type="text"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    placeholder="MM-JJ"
                    className="px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-lg text-sm w-28"
                  />
                </div>
                <GlassButton size="sm" variant="navy" disabled={saving} onClick={saveDate}>
                  {saving ? "Enregistrement..." : "Enregistrer la date"}
                </GlassButton>
                <GlassButton size="sm" variant="danger" disabled={running} onClick={() => setShowConfirm(true)}>
                  {running ? "Passage en cours..." : "Déclencher maintenant"}
                </GlassButton>
                {canUndo && (
                  <GlassButton size="sm" variant="danger" disabled={undoing} onClick={() => setShowUndoConfirm(true)}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    {undoing ? "Annulation..." : "Annuler le dernier passage"}
                  </GlassButton>
                )}
              </div>

              {lastRunYear && (
                <p className="text-xs text-gray-400">Dernier passage exécuté : {lastRunYear}</p>
              )}
            </>
          )}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(15,30,58,0.55)" }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 border border-[rgba(197,161,72,0.25)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-[var(--greek-blue)]">Confirmer le passage de classe</h3>
              <button onClick={() => setShowConfirm(false)} aria-label="Fermer" className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Tous les comptes enfant vont avancer d'un niveau immédiatement, quelle que soit la date configurée. Une annulation reste possible juste après (bouton "Annuler le dernier passage"). Continuer ?
            </p>
            <div className="flex justify-end gap-2">
              <GlassButton size="sm" variant="ghost" onClick={() => setShowConfirm(false)}>Annuler</GlassButton>
              <GlassButton size="sm" variant="danger" onClick={runNow}>Confirmer</GlassButton>
            </div>
          </div>
        </div>
      )}

      {showUndoConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(15,30,58,0.55)" }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 border border-[rgba(197,161,72,0.25)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-[var(--greek-blue)]">Annuler le dernier passage</h3>
              <button onClick={() => setShowUndoConfirm(false)} aria-label="Fermer" className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Tous les comptes touchés par le dernier passage de classe reviennent à leur niveau précédent. Les choix de spécialité déjà faits entre-temps par des élèves ne seront pas défaits. Continuer ?
            </p>
            <div className="flex justify-end gap-2">
              <GlassButton size="sm" variant="ghost" onClick={() => setShowUndoConfirm(false)}>Annuler</GlassButton>
              <GlassButton size="sm" variant="danger" onClick={undoLast}>Confirmer</GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
