"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarPlus, Check } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { supabase } from "@/lib/supabaseClient";

async function headers(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) };
}

/** Choix de la date d'examen et ajout du parcours au calendrier. */
export default function ExamControls({ examDate, suggestedDate, suggestedLabel, canSchedule }: { examDate: string | null; suggestedDate: string | null; suggestedLabel: string; canSchedule: boolean }) {
  const router = useRouter();
  const [date, setDate] = useState(examDate ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const saveDate = async (value: string) => {
    setError("");
    setDate(value);
    const res = await fetch("/api/child/goals", { method: "PATCH", headers: await headers(), body: JSON.stringify({ examDate: value || null }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "Enregistrement impossible.");
    router.refresh();
  };

  const schedule = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/child/exam-plan", { method: "POST", headers: await headers(), body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ajout impossible.");
      setMessage(`${data.added} rendez-vous ajoutés à ton calendrier.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ajout impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700" htmlFor="exam-date">Date de l&apos;examen</label>
        <input id="exam-date" type="date" value={date} onChange={(e) => saveDate(e.target.value)} className="rounded-lg border border-[rgba(197,161,72,0.3)] bg-white px-3 py-1.5 text-sm" />
        {suggestedDate && date !== suggestedDate && (
          <GlassButton size="sm" variant="outline" onClick={() => saveDate(suggestedDate)}>
            {suggestedLabel}
          </GlassButton>
        )}
      </div>
      {canSchedule && (
        <div className="flex flex-wrap items-center gap-3">
          <GlassButton size="sm" variant="navy" onClick={schedule} disabled={busy}>
            <CalendarPlus className="w-4 h-4" /> Ajouter le parcours à mon calendrier
          </GlassButton>
          {message && <span className="text-sm text-green-600 font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> {message}</span>}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
