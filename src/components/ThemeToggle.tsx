"use client";

import { useState } from "react";
import { Moon } from "lucide-react";
import GlassSwitch from "@/components/ui/GlassSwitch";
import { applyTheme, readStoredTheme } from "@/lib/theme";

/** Carte « Apparence » des pages Profil : interrupteur du mode sombre, mémorisé sur le compte. */
export default function ThemeToggle() {
  const [dark, setDark] = useState(() => (typeof window === "undefined" ? false : readStoredTheme() === "dark"));

  const change = (next: boolean) => {
    setDark(next);
    const theme = next ? "dark" : "light";
    applyTheme(theme);
    void fetch("/api/user/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme_preference: theme }) });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
      <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
        <Moon className="w-5 h-5 mr-2" />
        Apparence
      </h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-800">Mode sombre</p>
          <p className="text-sm text-gray-500">Un affichage reposant pour le soir, mémorisé sur votre compte</p>
        </div>
        <GlassSwitch checked={dark} label="Mode sombre" onChange={change} />
      </div>
    </div>
  );
}
