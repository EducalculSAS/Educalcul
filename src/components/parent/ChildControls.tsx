"use client";

import { useState } from "react";
import { Check, Copy, FileText, Link2, Moon, Target, Unlink } from "lucide-react";
import StreakFlame from "@/components/StreakFlame";
import GlassButton from "@/components/ui/GlassButton";
import GlassSwitch from "@/components/ui/GlassSwitch";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { supabase } from "@/lib/supabaseClient";

export interface ControlPrefs {
  dailyGoal: number;
  weeklyTarget: number | null;
  quiet: { enabled: boolean; start: string; end: string };
  quietOverrideUntil: string | null;
  examDate: string | null;
}

export interface ControlSummary {
  today: number;
  dailyGoal: number;
  streak: number;
  weekTotal: number;
  weeklyTarget: number | null;
  daysSinceActive: number | null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) };
}

/** Objectifs, repos et partage du suivi : tout ce qu'un parent règle pour un enfant, au même endroit. */
export default function ChildControls({ childId, childName, initialPrefs, summary }: { childId: number; childName: string; initialPrefs: ControlPrefs; summary: ControlSummary }) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [weekly, setWeekly] = useState(initialPrefs.weeklyTarget ? String(initialPrefs.weeklyTarget) : "");
  const [saved, setSaved] = useState<string>("");
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const patch = async (body: Record<string, unknown>, label: string) => {
    setError("");
    try {
      const res = await fetch("/api/parent/child-settings", { method: "PATCH", headers: await authHeaders(), body: JSON.stringify({ childId, ...body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible.");
      setPrefs(data.prefs);
      setSaved(label);
      setTimeout(() => setSaved(""), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    }
  };

  const share = async (action: "create" | "revoke") => {
    setError("");
    try {
      const res = await fetch("/api/parent/share-child", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ childId, action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action impossible.");
      if (action === "create") setShareUrl(data.url);
      else {
        setShareUrl("");
        setSaved("Liens révoqués");
        setTimeout(() => setSaved(""), 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const overrideActive = prefs.quietOverrideUntil && new Date(prefs.quietOverrideUntil).getTime() > Date.now();
  const card = "bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5";
  const input = "rounded-lg border border-[rgba(197,161,72,0.3)] bg-white px-3 py-1.5 text-sm";

  return (
    <section className="mb-8" aria-label="Objectifs et contrôle">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Objectifs et contrôle</h2>
        <div className="flex items-center gap-2 text-sm">
          {saved && <span className="text-green-600 font-semibold flex items-center gap-1"><Check className="w-4 h-4" /> {saved}</span>}
          <GlassButton href={`/parent/child/${childId}/bulletin`} variant="navy" size="sm">
            <FileText className="w-4 h-4" /> Bulletin PDF
          </GlassButton>
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Aujourd'hui */}
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">En ce moment</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Target className="w-4 h-4 text-[var(--greek-gold)]" /> Aujourd&apos;hui : <strong className="text-[var(--greek-blue)]">{summary.today}/{prefs.dailyGoal}</strong> activité{prefs.dailyGoal > 1 ? "s" : ""}</div>
            <div className="flex items-center gap-2"><StreakFlame lit={summary.streak > 0} count={summary.streak} size={36} /> Série : <strong className="text-[var(--greek-blue)]">{summary.streak} jour{summary.streak > 1 ? "s" : ""}</strong></div>
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Cette semaine</span><span>{summary.weekTotal}{prefs.weeklyTarget ? ` / ${prefs.weeklyTarget}` : ""}</span></div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full bg-[var(--greek-gold)]" style={{ width: `${prefs.weeklyTarget ? Math.min(100, Math.round((summary.weekTotal / prefs.weeklyTarget) * 100)) : Math.min(100, summary.weekTotal * 10)}%` }} /></div>
            </div>
            <p className="text-xs text-gray-400">
              {summary.daysSinceActive === null ? `${childName} n'a pas encore commencé.` : summary.daysSinceActive === 0 ? `${childName} a travaillé aujourd'hui.` : `Dernière activité il y a ${summary.daysSinceActive} jour${summary.daysSinceActive > 1 ? "s" : ""}.`}
            </p>
          </div>
        </div>

        {/* Objectifs */}
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Objectifs</p>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-gray-700 mb-1.5">Par jour</p>
              <GlassSegmentedControl size="sm" options={[1, 2, 3, 5].map((g) => ({ id: String(g), label: String(g) }))} value={String(prefs.dailyGoal)} onChange={(id) => patch({ dailyGoal: Number(id) }, "Objectif enregistré")} />
            </div>
            <div>
              <label className="font-medium text-gray-700 block mb-1.5" htmlFor={`weekly-${childId}`}>Cible de la semaine (activités)</label>
              <div className="flex gap-2">
                <input id={`weekly-${childId}`} type="number" min={1} max={60} value={weekly} onChange={(e) => setWeekly(e.target.value)} placeholder="Aucune" className={`${input} w-24`} />
                <GlassButton size="sm" variant="navy" onClick={() => patch({ weeklyTarget: weekly === "" ? null : Number(weekly) }, "Cible enregistrée")}>Fixer</GlassButton>
              </div>
            </div>
            <div>
              <label className="font-medium text-gray-700 block mb-1.5" htmlFor={`exam-${childId}`}>Date de l&apos;examen visé</label>
              <input id={`exam-${childId}`} type="date" value={prefs.examDate ?? ""} onChange={(e) => patch({ examDate: e.target.value || null }, "Date enregistrée")} className={input} />
            </div>
          </div>
        </div>

        {/* Repos */}
        <div className={card}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-1.5"><Moon className="w-3.5 h-3.5" /> Heures de repos</p>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-700">Fermer l&apos;accès à {childName}</span>
              <GlassSwitch checked={prefs.quiet.enabled} label="Heures de repos" onChange={(enabled) => patch({ quiet: { ...prefs.quiet, enabled } }, enabled ? "Repos activé" : "Repos désactivé")} />
            </div>
            {prefs.quiet.enabled && (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-600">de</span>
                  <input type="time" value={prefs.quiet.start} onChange={(e) => e.target.value && patch({ quiet: { ...prefs.quiet, start: e.target.value } }, "Heures enregistrées")} className={input} />
                  <span className="text-gray-600">à</span>
                  <input type="time" value={prefs.quiet.end} onChange={(e) => e.target.value && patch({ quiet: { ...prefs.quiet, end: e.target.value } }, "Heures enregistrées")} className={input} />
                </div>
                <div>
                  {overrideActive ? (
                    <button type="button" className="text-xs font-semibold text-[var(--greek-bronze)] hover:underline" onClick={() => patch({ liftQuietMinutes: 0 }, "Repos rétabli")}>Repos levé jusqu&apos;à {new Date(prefs.quietOverrideUntil!).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} : rétablir</button>
                  ) : (
                    <button type="button" className="text-xs font-semibold text-[var(--greek-blue)] hover:underline" onClick={() => patch({ liftQuietMinutes: 120 }, "Repos levé 2 heures")}>Exceptionnellement, autoriser 2 heures</button>
                  )}
                </div>
              </>
            )}
            <p className="text-xs text-gray-400">Heures de Paris. Pendant ce temps, {childName} voit un écran de pause.</p>
          </div>
        </div>
      </div>

      {/* Partage */}
      <div className={`${card} mt-4`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-xl">
            <p className="font-bold text-[var(--greek-blue)] flex items-center gap-2"><Link2 className="w-4 h-4 text-[var(--greek-gold)]" /> Partager le suivi</p>
            <p className="text-sm text-gray-500 mt-1">Un lien en lecture seule pour l&apos;autre parent, un grand-parent ou un répétiteur : il voit le bulletin de {childName}, sans compte et sans rien pouvoir modifier. Valable 30 jours, révocable à tout moment.</p>
          </div>
          <div className="flex gap-2">
            <GlassButton size="sm" variant="navy" onClick={() => share("create")}><Link2 className="w-4 h-4" /> Créer un lien</GlassButton>
            <GlassButton size="sm" variant="outline" rounded="xl" onClick={() => share("revoke")}><Unlink className="w-4 h-4" /> Révoquer</GlassButton>
          </div>
        </div>
        {shareUrl && (
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} className={`${input} flex-1 min-w-0 font-mono text-xs`} aria-label="Lien de suivi" />
            <GlassButton size="sm" variant="navy" onClick={copy}>{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copié" : "Copier"}</GlassButton>
          </div>
        )}
      </div>
    </section>
  );
}
