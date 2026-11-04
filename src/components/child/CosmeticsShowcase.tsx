"use client";

import { useMemo, useState } from "react";
import { ArrowDownUp, CheckCircle, ChevronDown, Crown, Flag, Lock, Sparkles, Target } from "lucide-react";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { getNameColor } from "@/lib/badgeStyles";
import { countByFilter, filterCards, sortCards, type CosmeticCard, type SortMode, type SourceFilter } from "@/lib/cosmetics/view";

const FILTERS: { id: SourceFilter; label: string; icon: typeof Sparkles }[] = [
  { id: "all", label: "Tous", icon: Sparkles },
  { id: "mission", label: "Missions", icon: Flag },
  { id: "subscription", label: "Abonnement", icon: Crown },
  { id: "owned", label: "Obtenus", icon: CheckCircle },
];
const SORTS: { id: SortMode; label: string }[] = [
  { id: "default", label: "Ordre du catalogue" },
  { id: "owned", label: "Obtenus d'abord" },
  { id: "progress", label: "Plus proches d'abord" },
  { id: "name", label: "Nom (A → Z)" },
];

/** Curseur à quatre positions : la pastille glisse sous le choix actif. */
function SourceSlider({ value, onChange, counts }: { value: SourceFilter; onChange: (v: SourceFilter) => void; counts: Record<SourceFilter, number> }) {
  const index = FILTERS.findIndex((f) => f.id === value);
  return (
    <div role="tablist" aria-label="Filtrer par façon de l'obtenir" className="relative grid grid-cols-4 rounded-full bg-gray-100 p-1 w-full max-w-2xl">
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 rounded-full bg-white shadow-sm border border-[rgba(197,161,72,0.35)] transition-transform duration-300 ease-out motion-reduce:transition-none"
        style={{ width: "calc((100% - 0.5rem) / 4)", transform: `translateX(${index * 100}%)` }}
      />
      {FILTERS.map((f) => {
        const Icon = f.icon;
        const active = f.id === value;
        return (
          <button
            key={f.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(f.id)}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${active ? "text-[var(--greek-blue)]" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0 hidden sm:block" />
            <span>{f.label}</span>
            <span className={`hidden sm:inline text-[10px] font-bold rounded-full px-1.5 py-0.5 ${active ? "bg-[var(--greek-blue)] text-white" : "bg-gray-200 text-gray-600"}`}>{counts[f.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

function SourceTags({ card }: { card: CosmeticCard }) {
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {card.byMission && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.5 flex items-center gap-1"><Flag className="w-2.5 h-2.5" />Mission</span>}
      {card.bySubscription && (
        <span className="text-[10px] font-bold bg-purple-100 text-purple-800 rounded-full px-1.5 py-0.5 flex items-center gap-1" title={card.plans.length ? `Inclus dans : ${card.plans.join(", ")}` : "Offert par certaines formules"}>
          <Crown className="w-2.5 h-2.5" />{card.plans.length ? card.plans.join(" · ") : "Abonnement"}
        </span>
      )}
    </div>
  );
}

function MissionDetails({ card }: { card: CosmeticCard }) {
  return (
    <div className="mt-2 w-full space-y-2 text-left">
      {card.missions.map((m) => (
        <div key={m.id} className="rounded-xl bg-gray-50 border border-gray-100 p-2.5">
          <p className="text-[11px] font-bold text-[var(--greek-blue)] flex items-center gap-1">
            <Target className="w-3 h-3" />{m.title}
            {m.earned && <span className="ml-auto text-green-700 bg-green-100 rounded-full px-1.5 text-[10px]">Accomplie</span>}
          </p>
          <p className="text-[11px] text-gray-500 mb-1.5">{m.description}</p>
          <ul className="space-y-1">
            {m.requirements.map((r) => (
              <li key={r.stat}>
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>{r.label}</span>
                  <span className={`font-bold ${r.done || m.earned ? "text-green-700" : ""}`}>{m.earned ? r.min : Math.min(r.value, r.min)} / {r.min}</span>
                </div>
                <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-1 rounded-full bg-[var(--greek-gold)]" style={{ width: `${m.earned ? 100 : Math.min(100, (r.value / r.min) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CardShell({ card, active, busy, onPick, children, wide }: { card: CosmeticCard; active: boolean; busy: boolean; onPick: () => void; children: React.ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const best = card.missions.length ? Math.round(card.bestRatio * 100) : null;
  return (
    <div className={`relative flex flex-col items-center rounded-2xl border-2 p-3 transition-all ${wide ? "min-w-[150px]" : "min-w-[120px]"} ${active ? "border-[var(--greek-blue)] bg-blue-50" : card.unlocked ? "border-[rgba(197,161,72,0.25)] bg-white hover:border-[var(--greek-gold)]" : "border-gray-100 bg-gray-50"}`}>
      <button onClick={onPick} disabled={!card.unlocked || busy} aria-label={`${card.unlocked ? "Équiper" : "Verrouillé"} : ${card.label}`} className={`flex flex-col items-center gap-1.5 ${card.unlocked ? "cursor-pointer" : "cursor-default opacity-80"}`}>
        <span className={card.unlocked ? "" : "grayscale"}>{children}</span>
        <span className={`text-xs font-bold ${card.unlocked ? "text-gray-700" : "text-gray-400"}`}>{card.label}</span>
      </button>
      <SourceTags card={card} />
      {!card.unlocked && best !== null && (
        <div className="mt-1.5 w-full" title={`Mission la plus avancée : ${best} %`}>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden"><div className="h-1.5 rounded-full bg-[var(--greek-gold)]" style={{ width: `${best}%` }} /></div>
          <p className="text-[10px] text-gray-400 text-center mt-0.5">{best} %</p>
        </div>
      )}
      {card.unlockedVia === "subscription" && <p className="text-[10px] text-purple-700 font-semibold mt-1">Via ton abonnement</p>}
      {card.missions.length > 0 && (
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-1.5 text-[10px] font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-0.5 cursor-pointer">
          {open ? "Masquer" : "Comment l'obtenir"}<ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      )}
      {open && <MissionDetails card={card} />}
      {!card.unlocked && <div className="absolute top-1.5 right-1.5 bg-gray-700/80 rounded-full p-0.5"><Lock className="w-2.5 h-2.5 text-white" /></div>}
      {active && <CheckCircle className="absolute top-1.5 right-1.5 w-4 h-4 text-[var(--greek-blue)]" />}
    </div>
  );
}

export default function CosmeticsShowcase({
  borders, colors, avatar, firstName, equippedBorder, equippedColor, busy, onEquip,
}: {
  borders: CosmeticCard[];
  colors: CosmeticCard[];
  avatar?: string;
  firstName: string;
  equippedBorder: string;
  equippedColor: string;
  busy: boolean;
  onEquip: (border?: string, color?: string) => void;
}) {
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<SortMode>("default");
  const all = useMemo(() => [...borders, ...colors], [borders, colors]);
  const counts = useMemo(() => countByFilter(all), [all]);
  const shownBorders = useMemo(() => sortCards(filterCards(borders, filter), sort), [borders, filter, sort]);
  const shownColors = useMemo(() => sortCards(filterCards(colors, filter), sort), [colors, filter, sort]);

  return (
    <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4 sm:p-6">
      <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] text-lg mb-1 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-[var(--greek-gold)]" />
        Contours et titres
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Une <strong>mission</strong> accomplie est à toi pour toujours. Un élément d&apos;<strong>abonnement</strong> reste équipable tant que ta formule le comprend.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <SourceSlider value={filter} onChange={setFilter} counts={counts} />
        <label className="flex items-center gap-1.5 text-xs text-gray-500 sm:ml-auto">
          <ArrowDownUp className="w-3.5 h-3.5" />
          <span className="sr-only">Trier</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="rounded-lg border border-[rgba(197,161,72,0.35)] bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
      </div>

      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Contour d&apos;avatar</p>
      {shownBorders.length === 0 ? <p className="text-sm text-gray-400 mb-6">Aucun contour dans cette catégorie.</p> : (
        <div className="flex gap-3 overflow-x-auto snap-x pb-3 mb-4 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
          {shownBorders.map((c) => (
            <div key={c.key} className="snap-start shrink-0">
              <CardShell card={c} active={equippedBorder === c.key} busy={busy} onPick={() => c.unlocked && onEquip(c.key)}>
                <AvatarWithBorder avatar={avatar} equippedBorder={c.key} name={firstName || "?"} size="md" />
              </CardShell>
            </div>
          ))}
        </div>
      )}

      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Titre (couleur du nom)</p>
      {shownColors.length === 0 ? <p className="text-sm text-gray-400">Aucun titre dans cette catégorie.</p> : (
        <div className="flex gap-3 overflow-x-auto snap-x pb-3 -mx-1 px-1 sm:flex-wrap sm:overflow-visible">
          {shownColors.map((c) => (
            <div key={c.key} className="snap-start shrink-0">
              <CardShell card={c} active={equippedColor === c.key} busy={busy} wide onPick={() => c.unlocked && onEquip(undefined, c.key)}>
                <span className={`text-sm font-bold px-2 ${getNameColor(c.key).cls}`}>{firstName || "Nom"}</span>
              </CardShell>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
