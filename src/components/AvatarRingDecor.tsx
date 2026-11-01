/**
 * Décors vectoriels des contours d'avatar : chaque niveau a SON motif, répété TOUT AUTOUR du cadre (mur de flammes, rangée de diamants
 * taillés, couronne de lauriers, chaîne d'argent, engrenage de bronze, arcs électriques, cœurs, pointes de couronne, galaxie, symboles,
 * étoiles arc-en-ciel), dessinés en SVG et animés en CSS
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


type P = { x: number; y: number; nx: number; ny: number; ang: number };

/** `n` points régulièrement répartis sur le contour (carré aux coins arrondis, sens horaire) avec la normale sortante. */
function perimeter(n: number, inset = 3, r = 28): P[] {
  const a = inset, b = 100 - inset, side = b - a - 2 * r, arc = (Math.PI / 2) * r, L = 4 * side + 4 * arc;
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) / n) * L;
    let x = 0, y = 0, nx = 0, ny = 0;
    const seg = (len: number) => { if (d <= len) return true; d -= len; return false; };
    const arcAt = (cx: number, cy: number, from: number) => { const f = from + (d / arc) * (Math.PI / 2); nx = Math.cos(f); ny = Math.sin(f); x = cx + r * nx; y = cy + r * ny; };
    if (seg(side)) { x = a + r + d; y = a; ny = -1; }
    else if (seg(arc)) arcAt(b - r, a + r, -Math.PI / 2);
    else if (seg(side)) { x = b; y = a + r + d; nx = 1; }
    else if (seg(arc)) arcAt(b - r, b - r, 0);
    else if (seg(side)) { x = b - r - d; y = b; ny = 1; }
    else if (seg(arc)) arcAt(a + r, b - r, Math.PI / 2);
    else if (seg(side)) { x = a; y = b - r - d; nx = -1; }
    else arcAt(a + r, a + r, Math.PI);
    out.push({ x, y, nx, ny, ang: (Math.atan2(ny, nx) * 180) / Math.PI });
  }
  return out;
}
const rnd = (i: number, k = 1) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
const at = (p: P, out = 0) => `translate(${(p.x + p.nx * out).toFixed(2)} ${(p.y + p.ny * out).toFixed(2)})`;

export default function AvatarRingDecor({ ringKey }: { ringKey: string }) {
  let body: ReactNode = null;
  switch (ringKey) {
    case "flamme":
      body = (
        <>
          {perimeter(36, 4).map((p, i) => <Flame key={`b${i}`} x={p.x + p.nx * 1} y={p.y + p.ny * 1} s={0.08 + rnd(i, 2) * 0.03} rot={p.ang + 90 + (rnd(i, 3) - 0.5) * 24} d={rnd(i, 4) * 1.2} />)}
          {perimeter(32, 3).map((p, i) => <Flame key={`f${i}`} x={p.x + p.nx * 0.5} y={p.y + p.ny * 0.5} s={0.11 + rnd(i, 5) * 0.06} rot={p.ang + 90 + (rnd(i, 6) - 0.5) * 18} d={rnd(i, 7) * 1.2} hot={i % 5 === 0} />)}
          {perimeter(12, 3).map((p, i) => <circle key={i} className="rf-ember" style={{ animationDelay: `${-rnd(i, 8) * 1.8}s` }} cx={p.x + p.nx * 9} cy={p.y + p.ny * 9} r={0.9} fill="#ffd23f" />)}
        </>
      );
      break;
    case "diamond":
      body = (
        <>
          {perimeter(20, 3.5).map((p, i) => (
            <g key={i} transform={`${at(p, 2)} rotate(${p.ang + 90}) scale(0.4) translate(-20 -26)`}>
              <g className="rf-gem" style={{ animationDelay: `${-((i * 0.29) % 3.2)}s` }}>
                <path d="M10 0 H30 L40 10 L20 34 L0 10 Z" fill="url(#rg-dg)" stroke="#0e7490" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M0 10 H40 M10 0 L14 10 L20 34 M30 0 L26 10 L20 34 M14 10 L20 0 L26 10" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="1.1" strokeLinejoin="round" />
                <path d="M10 0 L14 10 L20 0Z M30 0 L26 10 L20 0Z" fill="#fff" fillOpacity=".55" />
              </g>
            </g>
          ))}
          {perimeter(8, 3).map((p, i) => <Star key={i} x={p.x + p.nx * 9} y={p.y + p.ny * 9} r={0.8 + rnd(i, 1) * 0.5} d={rnd(i, 2) * 1.8} />)}
        </>
      );
      break;
    case "gold":
      body = (
        <>
          {perimeter(52, 3.5).map((p, i) => (
            <ellipse key={i} cx={0} cy={0} rx="2.3" ry="5.2" transform={`${at(p, i % 2 ? 3 : -0.5)} rotate(${p.ang + (i % 2 ? 32 : -32)})`} fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".45" />
          ))}
          {perimeter(4, 3.5).map((p, i) => <g key={i} transform={at(p, 8)}><path className="rf-pulse" d="M0 -6 L1.8 -2 L6 -1.6 L2.9 1.2 L3.7 5.5 L0 3.3 L-3.7 5.5 L-2.9 1.2 L-6 -1.6 L-1.8 -2Z" fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".4" /></g>)}
        </>
      );
      break;
    case "silver":
      body = (
        <>
          {perimeter(34, 3.5).map((p, i) => (
            <g key={i} transform={`${at(p, 1.2)} rotate(${p.ang + 90})`}>
              <ellipse rx={i % 2 ? 1.5 : 3.8} ry={i % 2 ? 3.8 : 1.9} fill="none" stroke="#6b7686" strokeWidth="1.5" />
              <ellipse rx={i % 2 ? 1.5 : 3.8} ry={i % 2 ? 3.8 : 1.9} fill="none" stroke="url(#rg-sv)" strokeWidth=".8" />
            </g>
          ))}
          {perimeter(7, 3).map((p, i) => <Star key={i} x={p.x + p.nx * 8} y={p.y + p.ny * 8} r={0.7 + rnd(i, 1) * 0.4} d={rnd(i, 2) * 1.8} fill="#fff" />)}
        </>
      );
      break;
    case "bronze":
      body = (
        <>
          {perimeter(30, 3.5).map((p, i) => (
            <g key={i} transform={`${at(p, 1.2)} rotate(${p.ang + 90})`}>
              <rect x="-2.4" y="-5.2" width="4.8" height="6" rx="1" fill="url(#rg-br)" stroke="#5b2a08" strokeWidth=".55" />
              {i % 3 === 0 && <circle className="rf-ember-pulse" style={{ animationDelay: `${-i * 0.2}s` }} cx="0" cy="-3" r="0.9" fill="#ffe3c2" />}
            </g>
          ))}
        </>
      );
      break;
    case "premium": {
      const pts = perimeter(110, 3);
      const d = pts.map((p, i) => { const o = i % 2 ? 3.2 : -0.6; return `${i ? "L" : "M"}${(p.x + p.nx * o).toFixed(1)} ${(p.y + p.ny * o).toFixed(1)}`; }).join(" ") + "Z";
      body = (
        <>
          <path className="rf-arc" d={d} fill="none" stroke="#f5d0fe" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
          <path className="rf-arc" style={{ animationDelay: "-0.7s" }} d={d} fill="none" stroke="#a855f7" strokeWidth="1.8" strokeOpacity=".7" strokeLinejoin="round" />
          {perimeter(14, 3).map((p, i) => {
            const L = 6 + rnd(i, 1) * 6, k = (rnd(i, 2) - 0.5) * 5;
            return <path key={i} className="rf-bolt" style={{ animationDelay: `${-rnd(i, 3) * 1.6}s` }} d={`M${p.x.toFixed(1)} ${p.y.toFixed(1)} l${(p.nx * L * 0.5 + k).toFixed(1)} ${(p.ny * L * 0.5).toFixed(1)} l${(-k * 1.4).toFixed(1)} ${(p.ny * 1.5).toFixed(1)} l${(p.nx * L * 0.5 + k * 0.4).toFixed(1)} ${(p.ny * L * 0.6).toFixed(1)}`} fill="none" stroke="#fbeaff" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />;
          })}
        </>
      );
      break;
    }
    case "famille":
      body = (
        <>
          {perimeter(24, 3.5).map((p, i) => (
            <g key={i} transform={`${at(p, 3)} rotate(${p.ang + 90}) scale(.6)`}>
              <path className="rf-beat" style={{ animationDelay: `${-i * 0.12}s` }} d="M0 6 C-9 -1 -6 -9 0 -4 C6 -9 9 -1 0 6Z" fill={["#f9a8d4", "#5eead4", "#fda4af", "#99f6e4"][i % 4]} stroke="#fff" strokeOpacity=".7" strokeWidth=".8" />
            </g>
          ))}
        </>
      );
      break;
    case "pro":
      body = (
        <>
          {perimeter(24, 3.5).map((p, i) => {
            const h = i % 2 ? 7 : 11;
            return (
              <g key={i} transform={`${at(p, 0.5)} rotate(${p.ang + 90})`}>
                <path d={`M-3.4 0 L0 ${-h} L3.4 0 Z`} fill="url(#rg-gl)" stroke="#a16207" strokeWidth=".5" strokeLinejoin="round" />
                <circle className="rf-pulse" style={{ animationDelay: `${-i * 0.15}s` }} cx="0" cy={-h} r="1.25" fill={["#ef4444", "#38bdf8", "#fff"][i % 3]} />
              </g>
            );
          })}
        </>
      );
      break;
    case "elite":
      body = (
        <>
          <g className="rf-orbit">
            <circle cx="50" cy="50" r="58" fill="none" stroke="url(#rg-sh)" strokeWidth=".6" strokeOpacity=".5" strokeDasharray="2 5" />
            <circle cx="50" cy="-8" r="3" fill="#22d3ee" /><circle cx="50" cy="-8" r="5.5" fill="#22d3ee" fillOpacity=".25" />
          </g>
          <g className="rf-orbit rf-orbit-rev"><circle cx="50" cy="50" r="53" fill="none" stroke="#a78bfa" strokeWidth=".5" strokeOpacity=".4" /><circle cx="103" cy="50" r="2.2" fill="#c4b5fd" /></g>
          {perimeter(70, 3).map((p, i) => <Star key={i} x={p.x + p.nx * (1 + rnd(i, 1) * 9)} y={p.y + p.ny * (1 + rnd(i, 1) * 9)} r={0.28 + rnd(i, 2) * 0.55} d={rnd(i, 3) * 1.8} fill={["#fff", "#c4b5fd", "#67e8f9", "#e0e7ff"][i % 4]} />)}
        </>
      );
      break;
    case "mathador":
      body = (
        <>
          {perimeter(20, 3).map((p, i) => (
            <text key={i} className="rf-glyph" style={{ animationDelay: `${-i * 0.18}s` }} x={p.x + p.nx * 6} y={p.y + p.ny * 6 + 3} textAnchor="middle" fontSize="9" fontWeight="800" fill="#818cf8" stroke="#312e81" strokeWidth=".4">{["+", "×", "÷", "−"][i % 4]}</text>
          ))}
        </>
      );
      break;
    case "admin":
      body = (
        <g className="rf-hue">
          {perimeter(30, 3.5).map((p, i) => (
            <g key={i} transform={at(p, 3)}>
              <path className="rf-twinkle" style={{ animationDelay: `${-i * 0.11}s` }} d="M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3Z" fill={`hsl(${(i * 360) / 30} 95% 62%)`} stroke="#fff" strokeWidth=".4" />
            </g>
          ))}
        </g>
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
