"use client";

import SectionTitle from "@/components/SectionTitle";
import { useState } from "react";

import GlassButton from "@/components/ui/GlassButton";
import { updateMyProfile } from "@/lib/updateMyProfile";
import { tourStorageKey, type TourRole } from "@/lib/tour/steps";

/** Carte « Visite guidée » des pages Profil : relance le tutoriel de première visite depuis le tableau de bord. */
export default function ReplayTourCard({ role }: { role: TourRole }) {
  const [busy, setBusy] = useState(false);

  const replay = async () => {
    setBusy(true);
    try { localStorage.removeItem(tourStorageKey(role)); } catch {}
    await updateMyProfile({ tour_completed: false });
    // Rechargement complet : le tutoriel est décidé au chargement de l'espace.
    window.location.href = role === "parent" ? "/parent/dashboard" : "/child/dashboard";
  };

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
      <SectionTitle emblem="compass" divider>Visite guidée</SectionTitle>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-gray-800">Revoir le tutoriel</p>
          <p className="text-sm text-gray-500">
            {role === "child" ? "Refais le tour du site, étape par étape." : "Refaites le tour de votre espace, étape par étape."}
          </p>
        </div>
        <GlassButton onClick={replay} variant="outline" size="sm" disabled={busy} className="whitespace-nowrap">
          {busy ? "Un instant…" : "Relancer"}
        </GlassButton>
      </div>
    </div>
  );
}
