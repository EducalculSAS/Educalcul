"use client";

import { useEffect, useRef, useState } from "react";
import { Type } from "lucide-react";
import GlassSwitch from "@/components/ui/GlassSwitch";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { applyA11y, DEFAULT_A11Y, readA11y, saveA11y, type A11yPrefs } from "@/lib/a11y";

/** Réglages de confort de lecture : police pour la dyslexie, taille du texte, espacement. */
export function A11yControls() {
  const [prefs, setPrefs] = useState<A11yPrefs>(DEFAULT_A11Y);
  useEffect(() => setPrefs(readA11y()), []);
  const update = (patch: Partial<A11yPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    saveA11y(next);
  };
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-gray-800">Police pour la dyslexie</p>
          <p className="text-gray-500">Lettres plus lourdes en bas, plus faciles à distinguer.</p>
        </div>
        <GlassSwitch checked={prefs.dyslexia} label="Police pour la dyslexie" onChange={(dyslexia) => update({ dyslexia })} />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-gray-800">Espacement aéré</p>
          <p className="text-gray-500">Plus d&apos;espace entre les lettres, les mots et les lignes.</p>
        </div>
        <GlassSwitch checked={prefs.spacing} label="Espacement aéré" onChange={(spacing) => update({ spacing })} />
      </div>
      <div>
        <p className="font-medium text-gray-800 mb-2">Taille du texte</p>
        <GlassSegmentedControl
          size="sm"
          options={[
            { id: "0", label: "Normal" },
            { id: "1", label: "Grand" },
            { id: "2", label: "Très grand" },
          ]}
          value={String(prefs.size)}
          onChange={(id) => update({ size: Number(id) as 0 | 1 | 2 })}
        />
      </div>
      <p className="text-xs text-gray-400">Ces réglages sont gardés sur cet appareil. Le bouton « Écouter » lit les énoncés à voix haute.</p>
    </div>
  );
}

/** Carte pour la page profil. */
export function AccessibilityCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
      <h2 className="text-xl font-bold text-[var(--greek-blue)] mb-6 pb-2 border-b border-[rgba(197,161,72,0.25)] flex items-center">
        <Type className="w-5 h-5 mr-2" />
        Confort de lecture
      </h2>
      <A11yControls />
    </div>
  );
}

/** Petit bouton « Aa » toujours à portée, pour régler le confort de lecture sans quitter l'exercice. */
export default function AccessibilityButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => applyA11y(readA11y()), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="fixed left-3 bottom-3 z-40 no-print">
      {open && (
        <div className="mb-2 w-[300px] max-w-[calc(100vw-1.5rem)] glass-panel backdrop-blur-[32px] backdrop-saturate-[1.4] rounded-3xl p-4">
          <p className="font-bold text-[var(--greek-blue)] mb-3">Confort de lecture</p>
          <A11yControls />
        </div>
      )}
      <GlassIconButton icon={Type} onClick={() => setOpen((v) => !v)} color="navy" size="md" aria-label="Confort de lecture : police, taille, espacement" />
    </div>
  );
}
