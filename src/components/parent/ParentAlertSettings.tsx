"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import GlassSwitch from "@/components/ui/GlassSwitch";
import { supabase } from "@/lib/supabaseClient";

export interface AlertPrefs {
  inactivity: boolean;
  inactivityDays: number;
  chapter: boolean;
  goals: boolean;
  email: boolean;
}

/** Alertes en direct sur la progression des enfants (cloche, et e-mail pour l'inactivité). */
export default function ParentAlertSettings({ initial }: { initial: AlertPrefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState("");

  const save = async (patch: Partial<AlertPrefs>) => {
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/parent/alert-prefs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Enregistrement impossible.");
    } catch (e) {
      setPrefs(previous);
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  };

  const rows: { key: "inactivity" | "chapter" | "goals"; label: string; desc: string }[] = [
    { key: "inactivity", label: "Enfant inactif", desc: `Être prévenu quand un enfant n'a rien fait depuis ${prefs.inactivityDays} jours` },
    { key: "chapter", label: "Cours terminé", desc: "Être prévenu quand un enfant termine un cours" },
    { key: "goals", label: "Cibles et séries", desc: "Cible de la semaine atteinte, 7, 14, 30 jours de suite..." },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
      <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
        <BellRing className="w-5 h-5 mr-2" />
        Alertes sur vos enfants
      </h2>
      <div className="space-y-4">
        {rows.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-gray-800">{label}</p>
              <p className="text-sm text-gray-500">{desc}</p>
            </div>
            <GlassSwitch checked={prefs[key]} label={label} onChange={(next) => save({ [key]: next })} />
          </div>
        ))}

        {prefs.inactivity && (
          <div className="flex items-center justify-between gap-4 pl-4 border-l-2 border-[var(--greek-gold)]">
            <div>
              <p className="font-medium text-gray-800">Seuil d&apos;inactivité</p>
              <p className="text-sm text-gray-500">Nombre de jours sans activité avant l&apos;alerte</p>
            </div>
            <select value={prefs.inactivityDays} onChange={(e) => save({ inactivityDays: Number(e.target.value) })} className="rounded-lg border border-[rgba(197,161,72,0.3)] px-3 py-1.5 text-sm">
              {[2, 3, 4, 5, 7, 10, 14].map((d) => (
                <option key={d} value={d}>{d} jours</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-gray-800">Alerte d&apos;inactivité par e-mail</p>
            <p className="text-sm text-gray-500">En plus de la cloche, un e-mail (une seule fois par période d&apos;inactivité)</p>
          </div>
          <GlassSwitch checked={prefs.email} label="Alerte par e-mail" onChange={(next) => save({ email: next })} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
