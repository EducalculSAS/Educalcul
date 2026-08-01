"use client";

import { useState } from "react";

/** Item d'accordéon local (pas d'état partagé entre questions) pour la
 * mini-FAQ de /tarifs — isolé en client island, le texte reste défini et
 * rendu depuis la page serveur. */
export default function TarifsFaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(197,161,72,0.18)", background: "#fff" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-[rgba(197,161,72,0.03)]"
      >
        <span className="font-[family-name:var(--font-display)] font-semibold text-sm" style={{ color: "var(--greek-blue)" }}>{question}</span>
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-light transition-transform duration-300"
          style={{ background: "rgba(197,161,72,0.10)", color: "var(--greek-gold)", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        >+</span>
      </button>
      <div style={{ maxHeight: open ? "200px" : "0px", overflow: "hidden", transition: "max-height 0.3s ease" }}>
        <p className="px-6 pb-4 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{answer}</p>
      </div>
    </div>
  );
}
