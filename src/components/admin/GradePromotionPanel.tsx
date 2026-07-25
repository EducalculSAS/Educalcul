"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronDown, ChevronUp, GraduationCap, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";

export default function GradePromotionPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("09-01");
  const [lastRunYear, setLastRunYear] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/admin/grade-promotion", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setDate(data.date);
      setLastRunYear(data.lastRunYear);
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
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch("/api/admin/grade-promotion", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLastRunYear(new Date().getFullYear());
      setMessage({
        type: "success",
        text: `${data.advanced} enfant(s) avancé(s) de niveau. ${data.needsManualChoice} en Seconde nécessitent un choix de spécialité manuel.`,
      });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Erreur." });
    } finally {
      setRunning(false);
    }
  };

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
                Chaque année à la date choisie, tous les comptes enfant avancent automatiquement d'un niveau (CP → CE1 → … → Seconde, et Première → Terminale sur la même spécialité). Les élèves en Seconde nécessitent un choix manuel de spécialité maths et ne sont pas avancés automatiquement.
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
                <button
                  onClick={saveDate}
                  disabled={saving}
                  className="px-4 py-2 bg-[var(--greek-blue)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Enregistrement..." : "Enregistrer la date"}
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={running}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  {running ? "Passage en cours..." : "Déclencher maintenant"}
                </button>
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
              <button onClick={() => setShowConfirm(false)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-400"><X size={18} /></button>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Tous les comptes enfant vont avancer d'un niveau immédiatement, quelle que soit la date configurée. Cette action ne peut pas être annulée automatiquement. Continuer ?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-gray-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors">Annuler</button>
              <button onClick={runNow} className="px-4 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
