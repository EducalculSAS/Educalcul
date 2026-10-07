"use client";

import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { speakableText } from "@/lib/speech";

/** Une seule lecture à la fois sur la page : lancer une nouvelle lecture arrête la précédente. */
let stopCurrent: (() => void) | null = null;

/**
 * « Écouter » : lit l'énoncé à voix haute avec la synthèse vocale du navigateur (gratuite, instantanée, hors ligne).
 * Les formules sont dites en français (« trois sur quatre », « x au carré »). Rien ne s'affiche si le navigateur n'a pas
 * de synthèse vocale.
 */
export default function ReadAloudButton({ text, className = "", label = "Écouter" }: { text: string; className?: string; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => stopRef.current();
  }, []);

  if (!supported) return null;

  const stop = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    if (stopCurrent === stopRef.current) stopCurrent = null;
  };
  stopRef.current = stop;

  const start = () => {
    const spoken = speakableText(text);
    if (!spoken) return;
    stopCurrent?.();
    window.speechSynthesis.cancel();
    // Un énoncé long est lu par phrases : certains navigateurs coupent les très longs textes.
    const sentences = spoken.match(/[^.!?;]+[.!?;]*/g) ?? [spoken];
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang === "fr-FR" && /natural|online|google|premium/i.test(v.name)) ?? voices.find((v) => v.lang?.toLowerCase().startsWith("fr"));
    sentences.forEach((sentence, i) => {
      const u = new SpeechSynthesisUtterance(sentence.trim());
      u.lang = "fr-FR";
      u.rate = 0.95;
      if (voice) u.voice = voice;
      if (i === sentences.length - 1) {
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
      }
      window.speechSynthesis.speak(u);
    });
    stopCurrent = stop;
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={speaking ? stop : start}
      aria-label={speaking ? "Arrêter la lecture" : `${label} l'énoncé`}
      title={speaking ? "Arrêter la lecture" : `${label} l'énoncé`}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[rgba(197,161,72,0.4)] bg-white/70 px-2.5 py-1 text-xs font-semibold text-[var(--greek-blue)] hover:bg-[var(--greek-gold)]/15 transition-colors ${className}`}
    >
      {speaking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
      {speaking ? "Stop" : label}
    </button>
  );
}
