"use client";

import { useEffect, useRef, useState } from "react";
import { Type } from "lucide-react";
import GlassSwitch from "@/components/ui/GlassSwitch";
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
        <div className="flex gap-2" role="group" aria-label="Taille du texte">
          {([["Normal", 0], ["Grand", 1], ["Très grand", 2]] as const).map(([label, size]) => (
            <button
              key={size}
              type="button"
              onClick={() => update({ size })}
              className={`flex-1 rounded-xl border px-3 py-2 font-semibold transition-colors ${prefs.size === size ? "bg-[var(--greek-blue)] text-white border-[var(--greek-blue)]" : "bg-white text-gray-600 border-gray-200 hover:border-[var(--greek-gold)]"}`}
              style={{ fontSize: size === 0 ? 14 : size === 1 ? 16 : 18 }}
            >
              {label}
            </button>
          ))}
        </div>
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
        <div className="mb-2 w-[300px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[rgba(197,161,72,0.35)] bg-white shadow-xl p-4">
          <p className="font-bold text-[var(--greek-blue)] mb-3">Confort de lecture</p>
          <A11yControls />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Confort de lecture : police, taille, espacement"
        aria-expanded={open}
        className="w-10 h-10 rounded-full bg-white/90 border border-[rgba(197,161,72,0.4)] shadow-md text-[var(--greek-blue)] font-bold text-sm hover:bg-[var(--greek-gold)]/20 transition-colors"
      >
        Aa
      </button>
    </div>
  );
}
