"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TrendingUp } from "lucide-react";

const BARS = [
  { label: "Fractions", pct: 87, color: "var(--greek-gold)" },
  { label: "Géométrie", pct: 64, color: "#60a5fa" },
  { label: "Algèbre", pct: 41, color: "#34d399" },
];

function useCountUp(target: number, duration: number, trigger: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start: number | null = null;
    let frame: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [trigger, target, duration]);
  return val;
}

/** Mini tableau de bord animé (barres + count-up) de la section "Suivi
 * Parents". Isolé en client island : les titres/texte autour restent rendus
 * côté serveur. */
export default function AnimatedStatsCard() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const pct0 = useCountUp(87, 1300, visible);
  const pct1 = useCountUp(64, 1100, visible);
  const pct2 = useCountUp(41, 900, visible);
  const pcts = [pct0, pct1, pct2];

  return (
    <div ref={ref} className="rounded-2xl p-5" style={{ background: "#0d1829", border: "1px solid rgba(197,161,72,0.12)" }}>
      <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: "rgba(197,161,72,0.1)" }}>
        <div>
          <p className="text-xs font-bold" style={{ color: "#f0ede8" }}>Emma · 5ème</p>
          <p className="text-xs" style={{ color: "rgba(240,237,232,0.3)" }}>Cette semaine</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "rgba(197,161,72,0.12)", color: "var(--greek-gold)" }}>
          <TrendingUp className="w-3 h-3" /> +12%
        </div>
      </div>

      {BARS.map((p, idx) => (
        <div key={p.label} className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-xs" style={{ color: "rgba(240,237,232,0.5)" }}>{p.label}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: p.color }}>
              {visible ? pcts[idx] : 0}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: visible ? `${p.pct}%` : "0%",
                background: p.color,
                opacity: 0.85,
                transition: visible ? "width 1400ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
                transitionDelay: visible ? "150ms" : "0ms",
              }}
            />
          </div>
        </div>
      ))}

      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t" style={{ borderColor: "rgba(197,161,72,0.08)" }}>
        <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-1" style={{ background: "rgba(255,255,255,0.04)", height: 64 }}>
          <div className="h-8 flex items-end justify-center pb-1">
            <span className="font-[family-name:var(--font-display)] font-bold text-base leading-none" style={{ color: "var(--greek-gold)" }}>12</span>
          </div>
          <span className="text-[10px] leading-none" style={{ color: "rgba(240,237,232,0.3)" }}>Badges</span>
        </div>

        <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-1" style={{ background: "rgba(255,255,255,0.04)", height: 64 }}>
          <div className="h-8 flex items-end justify-center">
            <div className="relative w-10 h-10" style={{ marginBottom: -4 }}>
              <Image src="/Streaks.gif" alt="streak" fill className="object-contain" unoptimized />
              <span
                className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-display)] font-bold z-10"
                style={{ color: "#fff", fontSize: 11, textShadow: "0 1px 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.8)", paddingTop: 10 }}
              >
                7
              </span>
            </div>
          </div>
          <span className="text-[10px] leading-none" style={{ color: "rgba(240,237,232,0.3)" }}>Streak</span>
        </div>

        <div className="flex flex-col items-center justify-between rounded-xl py-2.5 px-1" style={{ background: "rgba(255,255,255,0.04)", height: 64 }}>
          <div className="h-8 flex items-end justify-center pb-1">
            <span className="font-[family-name:var(--font-display)] font-bold text-base leading-none" style={{ color: "var(--greek-gold)" }}>340</span>
          </div>
          <span className="text-[10px] leading-none" style={{ color: "rgba(240,237,232,0.3)" }}>XP</span>
        </div>
      </div>
    </div>
  );
}
