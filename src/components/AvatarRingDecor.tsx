/**
 * Cadres d'avatar « jeu » : un cadre ÉPAIS en relief (contour sombre, matière, liseré clair, éclat qui fait le tour) avec, selon le
 * niveau, son motif accroché au cadre : médaille, couronne de lauriers, cristal + diamant, couronne, vigne et cœurs, flammes, ailes
 * et couronne, étincelles, étoiles, écu. Tout est dessiné en SVG dans un repère 100 × 100 qui recouvre l'avatar, animé en CSS
 * (globals.css, classes `rf-*`). Composant sans état ni effet : utilisable dans un Server Component.
 */
import type { ReactNode } from "react";
import FlameRing from "@/components/FlameRing";
import { pointAt } from "@/lib/ringPath";

type Pal = { dark: string; mid: string; light: string };
const PAL: Record<string, Pal> = {
  bronze: { dark: "#5b2a08", mid: "#c8782c", light: "#f6c08a" },
  silver: { dark: "#3f4959", mid: "#aab4c4", light: "#f2f5fa" },
  gold: { dark: "#8a5a00", mid: "#f5b81c", light: "#fff2a8" },
  diamond: { dark: "#0b5f8a", mid: "#3bb8f0", light: "#d9f5ff" },
  premium: { dark: "#5b1a8c", mid: "#b05cf0", light: "#f2cdff" },
  famille: { dark: "#1d6b2a", mid: "#5cc45a", light: "#cbf7bb" },
  flamme: { dark: "#a32400", mid: "#ff7a1a", light: "#ffd493" },
  pro: { dark: "#8a5a00", mid: "#f5b81c", light: "#fff2a8" },
  elite: { dark: "#3a1a78", mid: "#8a4bf0", light: "#dcbcff" },
  mathador: { dark: "#12408f", mid: "#3a8cf0", light: "#c4e2ff" },
  admin: { dark: "#0b5e57", mid: "#2cc4b4", light: "#c4f7f0" },
};

/** Étincelle à 4 branches qui scintille. */
function Spark({ x, y, r = 1, d = 0, fill = "#fff" }: { x: number; y: number; r?: number; d?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${r})`}>
      <path className="rf-twinkle" style={{ animationDelay: `${-d}s` }} d="M0 -6 L1.4 -1.4 L6 0 L1.4 1.4 L0 6 L-1.4 1.4 L-6 0 L-1.4 -1.4Z" fill={fill} />
    </g>
  );
}

/** Étoile à 5 branches en relief. */
function Star5({ x, y, s = 1, p, d = 0 }: { x: number; y: number; s?: number; p: Pal; d?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path className="rf-pulse" style={{ animationDelay: `${-d}s` }} d="M0 -10 L2.9 -3.1 L9.5 -3.1 L4.2 1.2 L6 8.1 L0 4.2 L-6 8.1 L-4.2 1.2 L-9.5 -3.1 L-2.9 -3.1Z" fill={p.mid} stroke={p.dark} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M0 -6.5 L1.7 -2 L5.4 -2 L2.5 0.6 L3.4 4.2 L0 2.2Z" fill={p.light} fillOpacity=".7" />
    </g>
  );
}

function Medal({ x, y, p }: { x: number; y: number; p: Pal }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="9.5" fill={p.dark} />
      <circle r="8" fill={p.mid} />
      <circle r="6.2" fill="none" stroke={p.light} strokeWidth=".9" strokeOpacity=".8" />
      <g transform="scale(.62)"><path d="M0 -10 L2.9 -3.1 L9.5 -3.1 L4.2 1.2 L6 8.1 L0 4.2 L-6 8.1 L-4.2 1.2 L-9.5 -3.1 L-2.9 -3.1Z" fill={p.light} stroke={p.dark} strokeWidth="1.2" strokeLinejoin="round" /></g>
    </g>
  );
}

function Crown({ x, y, s, jewels }: { x: number; y: number; s: number; jewels: [string, string, string] }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="rf-pulse">
        <path d="M-17 6 C-17 -3 -15 -12 -13 -14 L-7 -5 L0 -17 L7 -5 L13 -14 C15 -12 17 -3 17 6Z" fill="url(#rg-gl)" stroke="#8a5a00" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M-17 6 H17 V11 C10 13 -10 13 -17 11Z" fill="url(#rg-gl)" stroke="#8a5a00" strokeWidth="1.2" />
        <path d="M-12 1 C-5 -4 5 -4 12 1" fill="none" stroke="#fff7cc" strokeWidth=".9" strokeOpacity=".85" />
        <circle cx="-13" cy="-14" r="2.2" fill={jewels[0]} stroke="#fff" strokeWidth=".5" /><circle cx="0" cy="-17" r="2.6" fill={jewels[1]} stroke="#fff" strokeWidth=".5" /><circle cx="13" cy="-14" r="2.2" fill={jewels[2]} stroke="#fff" strokeWidth=".5" />
        <circle cx="0" cy="8.6" r="1.8" fill="#fff" /><circle cx="-8" cy="8.4" r="1.3" fill="#a7f3d0" /><circle cx="8" cy="8.4" r="1.3" fill="#a7f3d0" />
      </g>
    </g>
  );
}

const DEFS: ReactNode = (
  <defs>
    <linearGradient id="rg-dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e0fbff" /><stop offset=".5" stopColor="#3bb8f0" /><stop offset="1" stopColor="#0b5f8a" /></linearGradient>
    <linearGradient id="rg-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3a3" /><stop offset=".5" stopColor="#f5c518" /><stop offset="1" stopColor="#a16207" /></linearGradient>
  </defs>
);

/** Cadre épais en relief : contour sombre, matière, liseré clair, et un éclat qui fait le tour. `facets` = cristal (segments clairs). */
function Frame({ p, w, r, facets = false }: { p: Pal; w: number; r: number; facets?: boolean }) {
  const o = w / 2, size = 100 - w;
  const rect = { x: o, y: o, width: size, height: size, rx: r, fill: "none" as const };
  const inner = w * 0.2;
  return (
    <g>
      <rect {...rect} stroke={p.dark} strokeWidth={w} />
      <rect {...rect} stroke={p.mid} strokeWidth={w * 0.7} />
      {facets && <rect {...rect} pathLength={100} stroke={p.light} strokeWidth={w * 0.7} strokeDasharray="2.2 2.2" strokeOpacity=".55" />}
      <rect x={o + inner} y={o + inner} width={size - 2 * inner} height={size - 2 * inner} rx={Math.max(1, r - inner)} fill="none" stroke={p.light} strokeWidth={w * 0.14} strokeOpacity=".8" />
      {p !== PAL.gold && p !== PAL.pro && <rect x={o + inner * 2.2} y={o + inner * 2.2} width={size - 4.4 * inner} height={size - 4.4 * inner} rx={Math.max(1, r - inner * 2.2)} fill="none" stroke="#d9b95a" strokeWidth={w * 0.1} strokeOpacity=".9" />}
      <rect {...rect} pathLength={100} className="rf-shine" stroke="#fff" strokeWidth={w * 0.3} strokeLinecap="round" strokeDasharray="4 96" strokeOpacity=".95" />
    </g>
  );
}

export default function AvatarRingDecor({ ringKey, w, r, compact = false }: { ringKey: string; w: number; r: number; compact?: boolean }) {
  const p = PAL[ringKey];
  if (!p) return null;
  const rOut = r + w / 2; // rayon du bord extérieur du cadre
  const corner = w / 2 + r * (1 - Math.SQRT1_2); // coin du cadre (rivets)
  let behind: ReactNode = null; // dessiné AVANT le cadre (le cadre le recouvre à la base)
  let front: ReactNode = null; // dessiné APRÈS le cadre
  if (!compact) {
    switch (ringKey) {
      case "bronze":
      case "silver":
        front = (
          <>
            {[[corner, corner], [100 - corner, corner], [corner, 100 - corner]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={w * 0.2} fill={p.light} stroke={p.dark} strokeWidth=".8" />)}
            <Medal x={88} y={88} p={p} />
          </>
        );
        break;
      case "gold":
        behind = (
          <>
            {Array.from({ length: 34 }, (_, i) => (i + 0.5) / 34).filter((t) => t < 0.07 || t > 0.18).map((t, i) => {
              const q = pointAt(t, 1.5, rOut);
              return <ellipse key={i} rx="3.3" ry="6.6" transform={`translate(${(q.x + q.nx * 2).toFixed(1)} ${(q.y + q.ny * 2).toFixed(1)}) rotate(${q.ang + (i % 2 ? 36 : -36)})`} fill="url(#rg-gl)" stroke="#8a5a00" strokeWidth=".9" />;
            })}
          </>
        );
        front = (<><Star5 x={50} y={2} s={1.25} p={p} /><Star5 x={50} y={99} s={1.05} p={p} d={0.7} /></>);
        break;
      case "diamond":
        front = (
          <>
            <g transform="translate(50 -2) scale(1)">
              <g className="rf-gem">
                <path d="M-13 -9 H13 L20 -1 L0 20 L-20 -1 Z" fill="url(#rg-dg)" stroke="#0b5f8a" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M-20 -1 H20 M-13 -9 L-8 -1 L0 20 M13 -9 L8 -1 L0 20 M-8 -1 L-3 -9 M8 -1 L3 -9" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="1" strokeLinejoin="round" />
                <path d="M-13 -9 L-8 -1 L-3 -9Z M13 -9 L8 -1 L3 -9Z" fill="#fff" fillOpacity=".6" />
              </g>
            </g>
            <Spark x={96} y={14} r={1} d={0.4} fill="#e0fbff" /><Spark x={4} y={80} r={0.9} d={1} fill="#e0fbff" /><Spark x={92} y={92} r={0.8} d={0.8} fill="#e0fbff" />
          </>
        );
        break;
      case "premium":
        front = (<><Crown x={50} y={4} s={1.1} jewels={["#f0abfc", "#a855f7", "#f0abfc"]} /><Star5 x={90} y={92} s={0.9} p={PAL.gold} d={0.5} /></>);
        break;
      case "famille":
        behind = (
          <>
            {Array.from({ length: 26 }, (_, i) => pointAt((i + 0.5) / 26, 1.5, rOut)).map((q, i) => (
              <ellipse key={i} rx="2.6" ry="5" transform={`translate(${(q.x + q.nx * 1.5).toFixed(1)} ${(q.y + q.ny * 1.5).toFixed(1)}) rotate(${q.ang + (i % 2 ? 40 : -40)})`} fill={i % 3 === 0 ? "#8be072" : "#4fb84e"} stroke="#1d6b2a" strokeWidth=".8" />
            ))}
          </>
        );
        front = (
          <>
            {([[90, 8, 1.5], [8, 90, 1.1]] as const).map(([x, y, sc], i) => (
              <g key={i} transform={`translate(${x} ${y}) scale(${sc})`}><path className="rf-beat" style={{ animationDelay: `${-i * 0.5}s` }} d="M0 7 C-10 -1 -7 -10 0 -4.5 C7 -10 10 -1 0 7Z" fill="#ff7aa8" stroke="#b02a5a" strokeWidth="1.2" /></g>
            ))}
          </>
        );
        break;
      case "flamme":
        behind = <FlameRing w={w} r={r} />;
        break;
      case "pro": {
        const feathers = [[-84, 22], [-70, 30], [-56, 36], [-42, 40], [-28, 41], [-14, 38], [0, 33], [14, 26], [28, 19]];
        const wing = (
          <g className="rf-wing">
            {feathers.map(([ang, L], i) => (
              <g key={i} transform={`translate(5 46) rotate(${ang})`}>
                <path d={`M0 0 C${-L * 0.2} ${-7} ${-L * 0.7} ${-7.5} ${-L} -0.6 C${-L * 0.7} 3.4 ${-L * 0.25} 5 0 0Z`} fill="url(#rg-gl)" stroke="#8a5a00" strokeWidth=".8" strokeLinejoin="round" />
                <path d={`M-3 0 L${-L * 0.92} -0.4`} stroke="#fff7cc" strokeWidth=".6" strokeOpacity=".85" strokeLinecap="round" />
              </g>
            ))}
          </g>
        );
        behind = (<>{wing}<g transform="translate(100 0) scale(-1 1)">{wing}</g></>);
        front = (
          <>
            <Crown x={50} y={4} s={1.15} jewels={["#ef4444", "#38bdf8", "#ef4444"]} />
            <Spark x={14} y={2} r={0.9} d={0.2} fill="#fff7cc" /><Spark x={86} y={2} r={0.9} d={0.9} fill="#fff7cc" />
            <Spark x={-30} y={30} r={0.8} d={0.5} fill="#fff7cc" /><Spark x={130} y={30} r={0.8} d={1.3} fill="#fff7cc" />
          </>
        );
        break;
      }
      case "elite":
        front = (
          <>
            {([[4, 4, 1.7], [96, 4, 1.4], [4, 96, 1.2], [96, 96, 1.7], [50, 1, 1], [1, 50, 0.9], [99, 50, 0.9]] as const).map(([x, y, sc], i) => <Spark key={i} x={x} y={y} r={sc} d={i * 0.3} fill="#fff" />)}
            <Star5 x={50} y={99} s={1.1} p={PAL.gold} />
          </>
        );
        break;
      case "mathador":
        front = (
          <>
            {Array.from({ length: 8 }, (_, i) => pointAt((i + 0.5) / 8, 0.5, rOut)).map((q, i) => (
              <Star5 key={i} x={q.x + q.nx * 1} y={q.y + q.ny * 1} s={i % 2 ? 0.7 : 1} p={{ dark: "#12408f", mid: "#cfe8ff", light: "#fff" }} d={i * 0.25} />
            ))}
          </>
        );
        break;
      case "admin":
        front = (
          <>
            <g transform="translate(50 98) scale(1.25)">
              <g className="rf-pulse">
                <path d="M0 -10 L11 -7 V2 C11 8 5.5 12 0 15 C-5.5 12 -11 8 -11 2 V-7Z" fill={p.mid} stroke={p.dark} strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M0 -6 L7 -4 V2 C7 5 4 8 0 10 C-4 8 -7 5 -7 2 V-4Z" fill={p.light} fillOpacity=".75" />
                <path d="M-3 0 L-0.5 2.8 L3.6 -2" fill="none" stroke={p.dark} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>
            <g transform="translate(92 8) scale(.7)"><path d="M-8 -6 H8 L13 0 L0 14 L-13 0Z" fill="url(#rg-dg)" stroke="#0b5f8a" strokeWidth="1.6" strokeLinejoin="round" /></g>
          </>
        );
        break;
    }
  }
  return (
    <svg className="rf-decor" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {DEFS}
      {behind}
      <Frame p={p} w={w} r={r} facets={ringKey === "diamond"} />
      {front}
    </svg>
  );
}
