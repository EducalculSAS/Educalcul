"use client";

import { useMemo, useState } from "react";
import {
  Award, Bell, BookOpen, Bot, Brain, Calculator, Calendar, CalendarClock, ClipboardCheck, Construction, CreditCard,
  Download, Gamepad2, Gift, GraduationCap, Languages, LifeBuoy, ListOrdered, Mail, Medal, MessageCircle,
  MessagesSquare, PenLine, Puzzle, RotateCcw, Search, Sparkles, ToggleRight, Trophy, UserCog, UserPlus, UserRound,
  UserRoundPlus, Volume2, Zap, type LucideIcon,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassSwitch from "@/components/ui/GlassSwitch";
import { useConfirm } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { FEATURES, FEATURE_BY_KEY, FEATURE_GROUPS, MAINTENANCE_KEY, type FeatureDef } from "@/lib/featureCatalog";
import { relativeTime } from "@/lib/relativeTime";

const ICONS: Record<string, LucideIcon> = {
  Award, Bell, BookOpen, Bot, Brain, Calculator, Calendar, CalendarClock, ClipboardCheck, Construction, CreditCard,
  Download, Gamepad2, Gift, GraduationCap, Languages, LifeBuoy, ListOrdered, Mail, Medal, MessageCircle,
  MessagesSquare, PenLine, Puzzle, Sparkles, Trophy, UserCog, UserPlus, UserRound, UserRoundPlus, Volume2, Zap,
};

interface FeatureState {
  key: string;
  enabled: boolean;
  message: string | null;
  updated_at: string | null;
}

/**
 * Toutes les fonctionnalités du site, activables / désactivables d'un
 * interrupteur (aucune clé à inventer : la liste vient de featureCatalog.ts).
 * Une fonctionnalité coupée affiche aux élèves et aux parents une page
 * « momentanément indisponible » (et ses API répondent 503) ; le mode
 * maintenance ferme tout le site sauf l'admin. Effet partout en 10 s au plus.
 */
export default function AdminFeatureFlagsClient({ initialStates }: { initialStates: FeatureState[] }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [states, setStates] = useState<Record<string, FeatureState>>(() =>
    Object.fromEntries(initialStates.map((s) => [s.key, s])),
  );
  const [messages, setMessages] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialStates.map((s) => [s.key, s.message ?? ""])),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const isOn = (key: string) => states[key]?.enabled !== false;
  const disabledCount = FEATURES.filter((f) => f.key !== MAINTENANCE_KEY && !isOn(f.key)).length;
  const maintenanceOn = !isOn(MAINTENANCE_KEY);

  const save = async (key: string, enabled: boolean, message = messages[key] ?? "") => {
    const previous = states[key];
    setBusy(key);
    setStates((s) => ({ ...s, [key]: { key, enabled, message: message || null, updated_at: new Date().toISOString() } }));
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'enregistrement");
      setStates((s) => ({ ...s, [key]: data.state }));
      return true;
    } catch (e) {
      setStates((s) => {
        const next = { ...s };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (f: FeatureDef, next: boolean) => {
    if (f.key === MAINTENANCE_KEY && !next) {
      const ok = await confirm(
        "Élèves et parents verront la page de maintenance à la place du site. L'admin, la connexion et les paiements continuent de fonctionner.",
        { title: "Passer le site en maintenance ?", confirmLabel: "Activer la maintenance" },
      );
      if (!ok) return;
    }
    if (await save(f.key, next)) {
      toast.success(
        f.key === MAINTENANCE_KEY
          ? next ? "Le site est de nouveau ouvert." : "Maintenance activée."
          : next ? `« ${f.label} » réactivé.` : `« ${f.label} » coupé pour les élèves et les parents.`,
      );
    }
  };

  const enableAll = async () => {
    const ok = await confirm("Toutes les fonctionnalités coupées seront réactivées (maintenance comprise).", {
      title: "Tout réactiver ?", confirmLabel: "Tout réactiver", danger: false,
    });
    if (!ok) return;
    setBusy("*");
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable_all" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Échec");
      setStates((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, enabled: true }])));
      toast.success("Tout est réactivé.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      FEATURES.filter(
        (f) => f.key !== MAINTENANCE_KEY && (!q || `${f.label} ${f.description}`.toLowerCase().includes(q)),
      ),
    [q],
  );

  const maintenance = FEATURE_BY_KEY.get(MAINTENANCE_KEY)!;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={ToggleRight}
        title="Fonctionnalités"
        subtitle="Coupez n'importe quelle partie du site d'un geste : élèves et parents voient une page « momentanément indisponible ». Effet partout en 10 secondes."
      />

      {/* ── Maintenance ── */}
      <section
        className={`rounded-[20px] border p-6 transition-colors duration-500 ${
          maintenanceOn ? "bg-red-50 border-red-200" : "bg-white border-[rgba(197,161,72,0.25)] shadow-sm"
        }`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${maintenanceOn ? "bg-red-100 text-red-600" : "bg-[rgba(15,30,58,0.06)] text-[var(--greek-blue)]"}`}>
            <Construction className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-bold text-lg text-[var(--greek-blue)]">{maintenance.label}</h2>
                <p className="text-sm text-[var(--text-muted)]">{maintenance.description}</p>
              </div>
              <GlassSwitch
                tone="danger"
                checked={maintenanceOn}
                disabled={busy !== null}
                onChange={(active) => toggle(maintenance, !active)}
                label="Mode maintenance"
              />
            </div>
            <MessageField
              value={messages[MAINTENANCE_KEY] ?? ""}
              onChange={(v) => setMessages((m) => ({ ...m, [MAINTENANCE_KEY]: v }))}
              onSave={() => save(MAINTENANCE_KEY, isOn(MAINTENANCE_KEY)).then((ok) => ok && toast.success("Message enregistré."))}
              placeholder="Message affiché pendant la maintenance (facultatif) — ex. « Retour prévu à 14 h »."
              saving={busy === MAINTENANCE_KEY}
            />
            {maintenanceOn && (
              <p className="mt-3 text-sm font-semibold text-red-700">
                Le site est fermé aux élèves et aux parents{states[MAINTENANCE_KEY]?.updated_at ? ` depuis ${relativeTime(states[MAINTENANCE_KEY]?.updated_at)}` : ""}.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Barre d'outils ── */}
      <div className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <label className="relative flex-1 max-w-md">
          <span className="sr-only">Rechercher une fonctionnalité</span>
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (forum, Calia, paiements…)"
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[rgba(197,161,72,0.3)] bg-[var(--greek-cream)]/60 text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25"
          />
        </label>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${disabledCount ? "text-orange-600" : "text-emerald-700"}`}>
            {disabledCount ? `${disabledCount} fonctionnalité${disabledCount > 1 ? "s" : ""} coupée${disabledCount > 1 ? "s" : ""}` : "Tout est actif"}
          </span>
          {(disabledCount > 0 || maintenanceOn) && (
            <GlassButton variant="outline" size="sm" onClick={enableAll} disabled={busy !== null}>
              <RotateCcw className="w-4 h-4" /> Tout réactiver
            </GlassButton>
          )}
        </div>
      </div>

      {/* ── Groupes ── */}
      {FEATURE_GROUPS.filter((g) => g.id !== "global").map((group) => {
        const items = visible.filter((f) => f.group === group.id);
        if (items.length === 0) return null;
        return (
          <section key={group.id} className="bg-white rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
            <header className="px-6 py-4 border-b border-[rgba(197,161,72,0.18)] bg-[var(--greek-cream)]/50">
              <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">{group.label}</h2>
              <p className="text-xs text-[var(--text-muted)]">{group.description}</p>
            </header>
            <ul className="divide-y divide-[rgba(197,161,72,0.15)]">
              {items.map((f) => {
                const Icon = ICONS[f.icon] ?? ToggleRight;
                const on = isOn(f.key);
                const parentOff = f.parent ? !isOn(f.parent) : false;
                return (
                  <li key={f.key} className={`px-6 py-4 transition-colors duration-300 ${on ? "" : "bg-orange-50/60"}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${on && !parentOff ? "bg-[rgba(15,30,58,0.06)] text-[var(--greek-blue)]" : "bg-orange-100 text-orange-600"}`}>
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[var(--greek-blue)]">{f.label}</p>
                          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[rgba(197,161,72,0.14)] text-[var(--greek-bronze)]">{f.audience}</span>
                          {!on && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Coupé</span>}
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">{f.description}</p>
                        {parentOff && on && (
                          <p className="text-xs font-semibold text-orange-700 mt-1">
                            Indisponible aussi car « {FEATURE_BY_KEY.get(f.parent!)?.label} » est coupé.
                          </p>
                        )}
                        {!on && (
                          <MessageField
                            value={messages[f.key] ?? ""}
                            onChange={(v) => setMessages((m) => ({ ...m, [f.key]: v }))}
                            onSave={() => save(f.key, false).then((ok) => ok && toast.success("Message enregistré."))}
                            placeholder="Message affiché aux utilisateurs (facultatif)"
                            saving={busy === f.key}
                          />
                        )}
                        {states[f.key]?.updated_at && (
                          <p className="text-[11px] text-gray-400 mt-1">Modifié {relativeTime(states[f.key]!.updated_at)}</p>
                        )}
                      </div>
                      <GlassSwitch checked={on} disabled={busy !== null} onChange={(next) => toggle(f, next)} label={f.label} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {visible.length === 0 && (
        <p className="text-center text-[var(--text-muted)] py-10">Aucune fonctionnalité ne correspond à « {query} ».</p>
      )}
    </div>
  );
}

function MessageField({
  value, onChange, onSave, placeholder, saving,
}: {
  value: string; onChange: (v: string) => void; onSave: () => void; placeholder: string; saving: boolean;
}) {
  return (
    <div className="mt-3 flex flex-col sm:flex-row gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 500))}
        onKeyDown={(e) => e.key === "Enter" && onSave()}
        placeholder={placeholder}
        aria-label="Message affiché aux utilisateurs"
        className="flex-1 px-4 py-2 rounded-xl border border-[rgba(197,161,72,0.3)] bg-white text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25"
      />
      <GlassButton variant="ghost" size="sm" onClick={onSave} disabled={saving}>Enregistrer le message</GlassButton>
    </div>
  );
}
