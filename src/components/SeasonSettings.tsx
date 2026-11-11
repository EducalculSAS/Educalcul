"use client";

import SectionTitle from "@/components/SectionTitle";
import { useState } from "react";

import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { SEASON_HINT, SEASON_LABEL, applySeason, readStoredSeason, resolveSeason, type SeasonPreference } from "@/lib/season";

const ORDER: SeasonPreference[] = ["auto", "classique", "noel", "paques", "foot", "halloween"];
/** Nuancier d'aperçu (couleur principale, accent) de chaque thème. */
const SWATCH: Record<string, [string, string]> = {
  classique: ["#0f1e3a", "#c5a148"],
  noel: ["#123f2b", "#c8102e"],
  paques: ["#3b2a6b", "#6fae3c"],
  foot: ["#0b4d24", "#e2b400"],
  halloween: ["#2a1035", "#ff7a18"],
};

/** Carte « Thème du site » des pages Profil : saisons (Noël, Pâques, Coupe du monde…), mémorisée sur le compte. */
export default function SeasonSettings() {
  const [pref, setPref] = useState<SeasonPreference>(() => (typeof window === "undefined" ? "auto" : readStoredSeason()));
  const shown = resolveSeason(pref);

  const change = (next: string) => {
    const p = next as SeasonPreference;
    setPref(p);
    applySeason(p);
    void fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ season_preference: p }) });
  };

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
      <SectionTitle emblem="star" divider>Thème du site</SectionTitle>
      <GlassSegmentedControl value={pref} onChange={change} options={ORDER.map((id) => ({ id, label: SEASON_LABEL[id] }))} />
      <div className="mt-4 flex items-center gap-4">
        <span className="flex shrink-0 overflow-hidden rounded-xl border border-[rgba(197,161,72,0.25)]" aria-hidden="true">
          <span className="w-9 h-9" style={{ background: SWATCH[shown][0] }} />
          <span className="w-9 h-9" style={{ background: SWATCH[shown][1] }} />
        </span>
        <div>
          <p className="font-medium text-gray-800">
            {SEASON_LABEL[pref]}
            {pref === "auto" && <span className="text-gray-500 font-normal"> · en ce moment : {SEASON_LABEL[shown]}</span>}
          </p>
          <p className="text-sm text-gray-500">{SEASON_HINT[pref]}</p>
        </div>
      </div>
    </div>
  );
}
