"use client";

import { useMemo, useState } from "react";
import { CheckCircle, Crown, Flag, Lock, Sparkles } from "lucide-react";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import GlassDialog from "@/components/ui/GlassDialog";
import { getNameColor } from "@/lib/badgeStyles";
import { countByFilter, filterCards, sortCards, type CosmeticCard, type SortMode, type SourceFilter } from "@/lib/cosmetics/view";

type Kind = "border" | "color";

/** Ligne d'état d'une carte : une seule information, la plus utile. */
function statusOf(card: CosmeticCard, equipped: boolean): { text: string; tone: "blue" | "green" | "purple" | "gold" | "gray" } {
  if (equipped) return { text: "Équipé", tone: "blue" };
  if (card.unlockedVia === "admin") return { text: "Imposé aux administrateurs", tone: "blue" };
  if (card.unlocked) return card.unlockedVia === "subscription" ? { text: "Via ton abonnement", tone: "purple" } : { text: "Obtenu", tone: "green" };
  if (card.byMission) return { text: `Mission · ${Math.round(card.bestRatio * 100)} %`, tone: "gold" };
  if (card.bySubscription) return { text: card.plans.length ? `Abonnement ${card.plans.join(" · ")}` : "Abonnement", tone: "purple" };
  return { text: "Verrouillé", tone: "gray" };
}
const TONE: Record<string, string> = {
  blue: "text-[var(--greek-blue)]",
  green: "text-green-700",
  purple: "text-purple-700",
  gold: "text-amber-700",
  gray: "text-gray-400",
};

function HowToGet({ card, onClose }: { card: CosmeticCard; onClose: () => void }) {
  return (
    <GlassDialog title={`Obtenir « ${card.label} »`} onClose={onClose}>
      <div className="space-y-4">
        {card.missions.map((m) => (
          <div key={m.id} className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-4">
            <p className="font-bold text-[var(--greek-blue)] flex items-center gap-2"><Flag className="w-4 h-4 text-[var(--greek-gold)]" />Mission « {m.title} »</p>
            <p className="text-sm text-gray-500 mb-3">{m.description} Une fois accomplie, elle est à toi pour toujours.</p>
            <ul className="space-y-2.5">
              {m.requirements.map((r) => {
                const pct = Math.min(100, (r.value / r.min) * 100);
                return (
                  <li key={r.stat}>
                    <div className="flex justify-between text-sm text-gray-700">
                      <span>{r.label}</span>
                      <span className={`font-bold ${r.done ? "text-green-700" : ""}`}>{Math.min(r.value, r.min)} / {r.min}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-1">
                      <div className="h-2 rounded-full bg-[var(--greek-gold)]" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {card.bySubscription && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4">
            <p className="font-bold text-purple-800 flex items-center gap-2"><Crown className="w-4 h-4" />Avec un abonnement</p>
            <p className="text-sm text-gray-600">
              {card.plans.length ? <>Inclus dans les formules <strong>{card.plans.join(" et ")}</strong>.</> : "Inclus dans certaines formules."} Il reste équipable tant que l&apos;abonnement est actif.
            </p>
          </div>
        )}
      </div>
    </GlassDialog>
  );
}

function Card({ card, kind, equipped, busy, avatar, firstName, onPick }: {
  card: CosmeticCard; kind: Kind; equipped: boolean; busy: boolean; avatar?: string; firstName: string; onPick: () => void;
}) {
  const status = statusOf(card, equipped);
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      aria-label={`${card.unlocked ? "Équiper" : "Comment obtenir"} : ${card.label}`}
      aria-pressed={equipped}
      className={`cosmetic-card relative h-full w-full flex flex-col items-center justify-between gap-2 rounded-2xl border-2 px-3 py-4 text-center transition-[border-color,box-shadow,transform] duration-200 cursor-pointer hover:-translate-y-0.5 motion-reduce:hover:translate-y-0
        ${equipped ? "border-[var(--greek-blue)] bg-blue-50/70 shadow-sm" : "border-[rgba(197,161,72,0.25)] bg-white hover:border-[var(--greek-gold)] hover:shadow-sm"}`}
    >
      <span className={`flex items-center justify-center h-[92px] ${card.unlocked ? "" : "opacity-55"}`}>
        {kind === "border" ? (
          <AvatarWithBorder avatar={avatar} equippedBorder={card.key} name={firstName || "?"} size="lg" still={!equipped} />
        ) : (
          <span className={`text-lg font-bold ${getNameColor(card.key).cls}`}>{firstName || "Nom"}</span>
        )}
      </span>
      <span className="text-sm font-bold text-gray-800">{card.label}</span>
      <span className={`text-xs font-semibold ${TONE[status.tone]}`}>{status.text}</span>
      {!card.unlocked && card.byMission && (
        <span className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
          <span className="block h-1.5 rounded-full bg-[var(--greek-gold)]" style={{ width: `${Math.round(card.bestRatio * 100)}%` }} />
        </span>
      )}
      {equipped && <CheckCircle className="absolute top-2 right-2 w-5 h-5 text-[var(--greek-blue)]" />}
      {!card.unlocked && <Lock className="absolute top-2 right-2 w-4 h-4 text-gray-400" />}
    </button>
  );
}

export default function CosmeticsShowcase({
  borders, colors, avatar, firstName, equippedBorder, equippedColor, busy, onEquip, isAdmin = false,
}: {
  borders: CosmeticCard[];
  colors: CosmeticCard[];
  avatar?: string;
  firstName: string;
  equippedBorder: string;
  equippedColor: string;
  busy: boolean;
  onEquip: (border?: string, color?: string) => void;
  isAdmin?: boolean;
}) {
  const [kind, setKind] = useState<Kind>("border");
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<SortMode>("default");
  const [details, setDetails] = useState<CosmeticCard | null>(null);

  const cards = kind === "border" ? borders : colors;
  const counts = useMemo(() => countByFilter(cards), [cards]);
  const shown = useMemo(() => sortCards(filterCards(cards, filter), sort), [cards, filter, sort]);
  const equippedKey = kind === "border" ? equippedBorder : equippedColor;
  const equippedLabel = (list: CosmeticCard[], key: string) => list.find((c) => c.key === key)?.label ?? "Classique";
  const locked = isAdmin;

  const pick = (card: CosmeticCard) => {
    if (!card.unlocked) return setDetails(card);
    if (locked || card.key === equippedKey) return;
    if (kind === "border") onEquip(card.key);
    else onEquip(undefined, card.key);
  };

  return (
    <section className="bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]">
      <div className="flex items-center gap-3 mb-1">
        <Sparkles className="w-5 h-5 text-[var(--greek-gold)]" />
        <h2 className="text-xl font-bold text-[var(--greek-blue)]">Contours et titres</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Une mission accomplie est à toi pour toujours. Un élément d&apos;abonnement reste équipable tant que la formule le comprend.
      </p>

      <div className="flex flex-col lg:flex-row gap-6 mb-6">
        {/* Aperçu de ce qui est porté */}
        <div className="flex items-center gap-4 rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-4 lg:w-72 shrink-0">
          <AvatarWithBorder avatar={avatar} equippedBorder={equippedBorder} name={firstName || "?"} size="xl" />
          <div className="min-w-0">
            <p className={`text-lg font-bold ${getNameColor(equippedColor).cls}`}>{firstName}</p>
            <p className="text-xs text-gray-500 mt-1">Contour : <strong className="text-gray-700">{equippedLabel(borders, equippedBorder)}</strong></p>
            <p className="text-xs text-gray-500">Titre : <strong className="text-gray-700">{equippedLabel(colors, equippedColor)}</strong></p>
          </div>
        </div>

        {/* Choix : quoi, d'où, dans quel ordre — les sélecteurs du site */}
        <div className="flex-1 min-w-0 space-y-3">
          <GlassSegmentedControl
            value={kind}
            onChange={(v) => { setKind(v as Kind); setFilter("all"); }}
            options={[{ id: "border", label: "Contours d'avatar" }, { id: "color", label: "Titres" }]}
          />
          {!locked && (
            <>
              <GlassSegmentedControl
                value={filter}
                onChange={(v) => setFilter(v as SourceFilter)}
                options={[
                  { id: "all", label: <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" />Tous · {counts.all}</span> },
                  { id: "mission", label: <span className="inline-flex items-center gap-1.5"><Flag className="w-3.5 h-3.5" />Missions · {counts.mission}</span> },
                  { id: "subscription", label: <span className="inline-flex items-center gap-1.5"><Crown className="w-3.5 h-3.5" />Abonnement · {counts.subscription}</span> },
                  { id: "owned", label: <span className="inline-flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" />Obtenus · {counts.owned}</span> },
                ]}
              />
              <GlassSegmentedControl
                size="sm"
                value={sort}
                onChange={(v) => setSort(v as SortMode)}
                options={[
                  { id: "default", label: "Catalogue" },
                  { id: "owned", label: "Obtenus d'abord" },
                  { id: "progress", label: "Plus proches" },
                  { id: "name", label: "A → Z" },
                ]}
              />
            </>
          )}
          {locked && <p className="text-sm text-gray-500">Le contour et le titre « Égide » sont portés d&apos;office par les administrateurs.</p>}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-8">Rien dans cette catégorie pour l&apos;instant.</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {shown.map((c) => (
            <li key={c.key}>
              <Card card={c} kind={kind} equipped={equippedKey === c.key} busy={busy} avatar={avatar} firstName={firstName} onPick={() => pick(c)} />
            </li>
          ))}
        </ul>
      )}

      {details && <HowToGet card={details} onClose={() => setDetails(null)} />}
    </section>
  );
}
