"use client";
import { HIGHLIGHT_CLASS } from "./caliaOutline";

export default function CaliaGlobalStyles() {
  return (
    <style jsx global>{`
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid var(--greek-gold);
      outline-offset: 6px;
      border-radius: 10px;
      background: rgba(197, 161, 72, 0.12);
      box-shadow: 0 0 0 10px rgba(197, 161, 72, 0.12), 0 8px 30px rgba(197, 161, 72, 0.25);
      transition: background 0.4s ease, box-shadow 0.4s ease, outline-color 0.4s ease;
      animation: calia-frame-in 0.45s ease;
    }
    @keyframes calia-frame-in {
      from { outline-color: transparent; box-shadow: 0 0 0 0 rgba(197, 161, 72, 0); }
    }
    .calia-word {
      display: inline;
      animation: calia-word-in 0.32s ease both;
    }
    @keyframes calia-word-in {
      from { opacity: 0; filter: blur(3px); }
      to { opacity: 1; filter: blur(0); }
    }
    .calia-alive {
      animation: calia-float 3.2s ease-in-out infinite;
    }
    @keyframes calia-float {
      0%, 100% { translate: 0 0; }
      50% { translate: 0 -5px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .calia-word, .calia-alive, .${HIGHLIGHT_CLASS} { animation: none; }
    }
    @keyframes calia-speak-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.06); }
    }
    .calia-board-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #dcb85f;
      margin: 4px 0 2px;
    }
    .calia-board-label-student {
      color: #7dd3fc;
    }
    .calia-board-student {
      border-left: 3px solid #7dd3fc;
      padding-left: 8px;
      margin: 2px 0 8px;
    }
  `}</style>
  );
}
