/**
 * Décors vectoriels des contours d'avatar : chaque niveau a SON motif (vraies flammes, vrais diamants taillés, couronne de lauriers,
 * croissant de lune, rivets forgés, éclairs, cœurs, couronne, galaxie, symboles de calcul, écu), dessinés en SVG et animés en CSS
 * (globals.css, classes `rf-*`). Composant sans état ni effet : utilisable dans un Server Component.
 * Le dessin est fait dans un repère 100 × 100 qui recouvre l'avatar ; les motifs débordent volontairement du cadre.
 */
import type { ReactNode } from "react";

/** Flamme en trois couches (mêmes silhouettes que la flamme de série), plantée par sa base en (x, y). */
function Flame({ x, y, s, rot = 0, d = 0, hot = false }: { x: number; y: number; s: number; rot?: number; d?: number; hot?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-50 -114)`}>
      <g className="rf-flick" style={{ animationDelay: `${-d}s` }}>
        <path d="M50 6 C57 26 82 42 82 74 C82 98 68 114 50 114 C32 114 18 98 18 74 C18 56 28 46 34 32 C38 44 42 48 45 44 C49 36 46 18 50 6 Z" fill="url(#rg-fo)" />
        <path d="M50 40 C55 56 70 64 70 84 C70 100 61 110 50 110 C39 110 30 100 30 84 C30 72 37 66 40 56 C43 64 46 66 48 62 C51 56 49 48 50 40 Z" fill="url(#rg-fm)" />
        <path d="M50 72 C53 82 61 88 61 98 C61 106 56 110 50 110 C44 110 39 106 39 98 C39 90 44 86 46 80 C48 84 49 84 50 80 C51 77 50 75 50 72 Z" fill={hot ? "#fff" : "url(#rg-fc)"} />
      </g>
    </g>
  );
}

function Star({ x, y, r = 1, d = 0, fill = "#fff" }: { x: number; y: number; r?: number; d?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${r})`}>
      <path className="rf-twinkle" style={{ animationDelay: `${-d}s` }} d="M0 -6 L1.4 -1.4 L6 0 L1.4 1.4 L0 6 L-1.4 1.4 L-6 0 L-1.4 -1.4Z" fill={fill} />
    </g>
  );
}

function Gem({ x, y, s, rot = 0, d = 0 }: { x: number; y: number; s: number; rot?: number; d?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-20 -17)`}>
      <g className="rf-gem" style={{ animationDelay: `${-d}s` }}>
        <path d="M10 0 H30 L40 10 L20 34 L0 10 Z" fill="url(#rg-dg)" stroke="#0e7490" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M0 10 H40 M10 0 L14 10 L20 34 M30 0 L26 10 L20 34 M14 10 L20 0 L26 10" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1" strokeLinejoin="round" />
        <path d="M10 0 L14 10 L20 0Z M30 0 L26 10 L20 0Z" fill="#fff" fillOpacity=".55" />
        <path className="rf-glint" d="M20 0 L24 10 L20 34 L16 10Z" fill="#fff" />
      </g>
    </g>
  );
}

function Leaf({ x, y, rot }: { x: number; y: number; rot: number }) {
  return <ellipse cx={x} cy={y} rx="2.4" ry="5.6" transform={`rotate(${rot} ${x} ${y})`} fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".4" />;
}

function Heart({ x, d, c }: { x: number; d: number; c: string }) {
  return (
    <g transform={`translate(${x} 98)`}>
      <path className="rf-heart" style={{ animationDelay: `${-d}s` }} d="M0 6 C-9 -1 -6 -9 0 -4 C6 -9 9 -1 0 6Z" fill={c} />
    </g>
  );
}

function Bolt({ x, y, rot, d }: { x: number; y: number; rot: number; d: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path className="rf-bolt" style={{ animationDelay: `${-d}s` }} d="M0 0 L-5 9 L-1 9 L-4 18 L5 6 L1 6 Z" fill="#f5d0fe" stroke="#a855f7" strokeWidth="1" strokeLinejoin="round" />
    </g>
  );
}

function Rivet({ x, y, d = 0 }: { x: number; y: number; d?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="3.1" fill="url(#rg-br)" stroke="#5b2a08" strokeWidth=".6" />
      <circle className="rf-ember-pulse" style={{ animationDelay: `${-d}s` }} cx={x - 0.8} cy={y - 0.8} r="0.9" fill="#ffe3c2" />
    </g>
  );
}

const DEFS: ReactNode = (
  <defs>
    <linearGradient id="rg-fo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff8a00" /><stop offset="1" stopColor="#ff3d00" /></linearGradient>
    <linearGradient id="rg-fm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd23f" /><stop offset="1" stopColor="#ff9c00" /></linearGradient>
    <linearGradient id="rg-fc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbe0" /><stop offset="1" stopColor="#ffe27a" /></linearGradient>
    <linearGradient id="rg-dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e0fbff" /><stop offset=".5" stopColor="#22d3ee" /><stop offset="1" stopColor="#0e7490" /></linearGradient>
    <linearGradient id="rg-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff3a3" /><stop offset=".5" stopColor="#f5c518" /><stop offset="1" stopColor="#a16207" /></linearGradient>
    <linearGradient id="rg-sv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#c5cedb" /><stop offset="1" stopColor="#7b8798" /></linearGradient>
    <radialGradient id="rg-br" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#f3c9a0" /><stop offset=".55" stopColor="#cd7f32" /><stop offset="1" stopColor="#6b3208" /></radialGradient>
    <linearGradient id="rg-sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffd700" /><stop offset=".5" stopColor="#ff6b6b" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
  </defs>
);

export default function AvatarRingDecor({ ringKey }: { ringKey: string }) {
  let body: ReactNode = null;
  switch (ringKey) {
    case "flamme":
      body = (
        <>
          <Flame x={4} y={78} s={0.13} rot={-78} d={0.3} />
          <Flame x={3} y={52} s={0.17} rot={-72} d={0.1} />
          <Flame x={8} y={26} s={0.17} rot={-38} d={0.5} />
          <Flame x={26} y={10} s={0.2} rot={-14} d={0.2} />
          <Flame x={50} y={9} s={0.3} d={0} hot />
          <Flame x={74} y={10} s={0.2} rot={14} d={0.6} />
          <Flame x={92} y={26} s={0.17} rot={38} d={0.4} />
          <Flame x={97} y={52} s={0.17} rot={72} d={0.7} />
          <Flame x={96} y={78} s={0.13} rot={78} d={0.15} />
          {[20, 44, 62, 82].map((x, i) => <circle key={x} className="rf-ember" style={{ animationDelay: `${-i * 0.55}s` }} cx={x} cy={4} r={1.1} fill="#ffd23f" />)}
        </>
      );
      break;
    case "diamond":
      body = (
        <>
          <Gem x={50} y={-1} s={0.72} d={0} />
          <Gem x={6} y={14} s={0.42} rot={-28} d={0.8} />
          <Gem x={94} y={14} s={0.42} rot={28} d={1.4} />
          <Gem x={5} y={88} s={0.3} rot={-14} d={0.4} />
          <Gem x={95} y={88} s={0.3} rot={14} d={1} />
          <Star x={96} y={50} r={1.1} d={0} />
          <Star x={3} y={52} r={0.9} d={0.9} />
          <Star x={50} y={101} r={1} d={0.5} />
        </>
      );
      break;
    case "gold":
      body = (
        <>
          {[[4, 82, -28], [1.5, 70, -12], [0.5, 58, 0], [0.8, 46, 8], [2, 34, 22], [5, 23, 36]].map(([x, y, r], i) => <Leaf key={i} x={x} y={y} rot={r} />)}
          {[[96, 82, 28], [98.5, 70, 12], [99.5, 58, 0], [99.2, 46, -8], [98, 34, -22], [95, 23, -36]].map(([x, y, r], i) => <Leaf key={i} x={x} y={y} rot={r} />)}
          <g transform="translate(50 1)"><path className="rf-pulse" d="M0 -8 L2.4 -2.6 L8 -2.2 L3.8 1.6 L5 7.4 L0 4.4 L-5 7.4 L-3.8 1.6 L-8 -2.2 L-2.4 -2.6Z" fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".5" /></g>
          <Star x={14} y={5} r={0.8} d={0.3} fill="#fff3a3" />
          <Star x={87} y={6} r={0.8} d={1} fill="#fff3a3" />
        </>
      );
      break;
    case "silver":
      body = (
        <>
          <g transform="translate(88 7) rotate(18)"><path className="rf-pulse" d="M0 -9 A9 9 0 1 0 9 0 A7 7 0 1 1 0 -9Z" fill="url(#rg-sv)" stroke="#7b8798" strokeWidth=".5" /></g>
          <Star x={10} y={9} r={0.9} d={0} fill="#fff" />
          <Star x={97} y={42} r={0.7} d={0.7} fill="#e8eef6" />
          <Star x={4} y={64} r={0.8} d={1.2} fill="#fff" />
          <Star x={80} y={98} r={0.9} d={0.4} fill="#e8eef6" />
          <Star x={28} y={99} r={0.6} d={1.6} fill="#fff" />
        </>
      );
      break;
    case "bronze":
      body = (
        <>
          {[[10, 8], [50, 2], [90, 8], [98, 50], [90, 92], [50, 98], [10, 92], [2, 50]].map(([x, y], i) => <Rivet key={i} x={x} y={y} d={i * 0.4} />)}
        </>
      );
      break;
    case "premium":
      body = (
        <>
          <Bolt x={93} y={6} rot={12} d={0} />
          <Bolt x={6} y={72} rot={-168} d={0.7} />
          <Bolt x={4} y={14} rot={-24} d={1.3} />
          <Bolt x={97} y={64} rot={160} d={0.35} />
          <Star x={50} y={1} r={0.9} d={0.2} fill="#f5d0fe" />
        </>
      );
      break;
    case "famille":
      body = (
        <>
          <Heart x={16} d={0} c="#f9a8d4" />
          <Heart x={50} d={1.1} c="#5eead4" />
          <Heart x={84} d={2.2} c="#fda4af" />
          <Heart x={33} d={1.7} c="#99f6e4" />
          <Heart x={68} d={0.6} c="#f9a8d4" />
        </>
      );
      break;
    case "pro":
      body = (
        <>
          <g transform="translate(50 3)">
            <path d="M-15 7 L-13 -8 L-6.5 -1 L0 -12 L6.5 -1 L13 -8 L15 7 Z" fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".7" strokeLinejoin="round" />
            <path d="M-15 7 H15 V11 H-15Z" fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".7" />
            <circle cx="-13" cy="-8" r="1.7" fill="#ef4444" /><circle cx="0" cy="-12" r="2" fill="#38bdf8" /><circle cx="13" cy="-8" r="1.7" fill="#ef4444" />
            <circle cx="0" cy="9" r="1.3" fill="#fff" />
          </g>
          <Star x={30} y={5} r={0.8} d={0.4} fill="#fef3c7" />
          <Star x={71} y={5} r={0.8} d={1.1} fill="#fef3c7" />
        </>
      );
      break;
    case "elite":
      body = (
        <>
          <g className="rf-orbit">
            <circle cx="50" cy="50" r="57" fill="none" stroke="url(#rg-sh)" strokeWidth=".6" strokeOpacity=".55" strokeDasharray="2 5" />
            <circle cx="50" cy="-7" r="3" fill="#22d3ee" /><circle cx="50" cy="-7" r="5.5" fill="#22d3ee" fillOpacity=".25" />
          </g>
          <g className="rf-orbit rf-orbit-rev">
            <circle cx="50" cy="50" r="52" fill="none" stroke="#a78bfa" strokeWidth=".5" strokeOpacity=".4" />
            <circle cx="102" cy="50" r="2.2" fill="#c4b5fd" />
          </g>
          <Star x={8} y={8} r={0.8} d={0} fill="#c4b5fd" />
          <Star x={95} y={12} r={1} d={0.6} fill="#67e8f9" />
          <Star x={3} y={60} r={0.7} d={1.1} fill="#e0e7ff" />
          <Star x={97} y={80} r={0.8} d={0.3} fill="#c4b5fd" />
          <Star x={40} y={99} r={0.7} d={1.5} fill="#67e8f9" />
        </>
      );
      break;
    case "mathador":
      body = (
        <>
          {[["+", 5, 10, 0], ["×", 95, 10, 0.6], ["÷", 5, 96, 1.2], ["−", 95, 96, 1.8]].map(([g, x, y, d]) => (
            <text key={g as string} className="rf-glyph" style={{ animationDelay: `${-(d as number)}s` }} x={x as number} y={y as number} textAnchor="middle" fontSize="15" fontWeight="800" fill="#818cf8" stroke="#312e81" strokeWidth=".6">{g as string}</text>
          ))}
          <Star x={50} y={1} r={0.8} d={0.3} fill="#c7d2fe" />
        </>
      );
      break;
    case "admin":
      body = (
        <>
          <g transform="translate(50 3)"><path className="rf-pulse" d="M0 -10 L9 -7 V1 C9 7 4.5 10 0 12.5 C-4.5 10 -9 7 -9 1 V-7 Z" fill="url(#rg-sh)" stroke="#fff" strokeWidth=".9" strokeLinejoin="round" /><path d="M0 -5 L1.6 -1.4 L5.2 -1.2 L2.4 1.1 L3.3 4.6 L0 2.6 L-3.3 4.6 L-2.4 1.1 L-5.2 -1.2 L-1.6 -1.4Z" fill="#fff" /></g>
          <Star x={14} y={6} r={0.8} d={0} fill="#ffd700" />
          <Star x={87} y={6} r={0.8} d={0.8} fill="#4ecdc4" />
          <Star x={97} y={60} r={0.7} d={1.4} fill="#ff6b6b" />
          <Star x={3} y={60} r={0.7} d={0.5} fill="#8b5cf6" />
        </>
      );
      break;
    default:
      return null;
  }
  return (
    <svg className="rf-decor" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {DEFS}
      {body}
    </svg>
  );
}
