"use client";

import { avatarUrl } from "@/lib/avatarUrl";

interface Props {
  avatar?: string | null;
  equippedBorder?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  bgClass?: string;
  className?: string;
  circular?: boolean;
}

// Avatar pixel size
const AV = { sm: 36, md: 44, lg: 60, xl: 84 };
// Gap between avatar edge and decorations
const GAP = { sm: 5, md: 6, lg: 8, xl: 10 };
// Decoration item size
const ITEM = { sm: 6, md: 8, lg: 10, xl: 14 };

// Compute positions on a circle
function ring(n: number, radius: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a), a };
  });
}

// SVG shape renderers
function Ingot(x: number, y: number, s: number, angle: number) {
  const w = s * 2, h = s;
  return (
    <g key={`ingot-${x}-${y}`} transform={`translate(${x},${y}) rotate(${(angle * 180) / Math.PI + 90})`}>
      <defs>
        <linearGradient id={`ig${x|0}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffde7" />
          <stop offset="40%" stopColor="#ffd700" />
          <stop offset="100%" stopColor="#a07800" />
        </linearGradient>
      </defs>
      <rect x={-w/2} y={-h/2} width={w} height={h} rx={1.5}
        fill={`url(#ig${x|0})`} stroke="#b8860b" strokeWidth={0.5} />
    </g>
  );
}

function DiamondShape(x: number, y: number, s: number) {
  const pts = `0,${-s} ${s},0 0,${s} ${-s},0`;
  return (
    <g key={`dia-${x}-${y}`} transform={`translate(${x},${y})`}>
      <defs>
        <linearGradient id={`dg${x|0}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0f7fa" />
          <stop offset="40%" stopColor="#4dd0e1" />
          <stop offset="100%" stopColor="#006064" />
        </linearGradient>
      </defs>
      <polygon points={pts} fill={`url(#dg${x|0})`} stroke="#00bcd4" strokeWidth={0.5} />
    </g>
  );
}

function Coin(x: number, y: number, s: number) {
  return (
    <g key={`coin-${x}-${y}`} transform={`translate(${x},${y})`}>
      <circle r={s} fill="#cd7f32" stroke="#8b4513" strokeWidth={0.5} />
      <circle r={s * 0.6} fill="none" stroke="#e8a060" strokeWidth={0.5} />
    </g>
  );
}

function StarShape(x: number, y: number, s: number, color: string) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * i) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? s : s * 0.45;
    return `${r * Math.cos(a)},${r * Math.sin(a)}`;
  }).join(" ");
  return (
    <polygon key={`star-${x}-${y}`} transform={`translate(${x},${y})`}
      points={pts} fill={color} stroke={color} strokeWidth={0.3}
      filter={`drop-shadow(0 0 2px ${color}88)`} />
  );
}

function HeartShape(x: number, y: number, s: number, color: string) {
  const k = s * 0.9;
  const d = `M0,${k*0.3} C${-k},${-k*0.3} ${-k*1.3},${k*0.8} 0,${k*1.2} C${k*1.3},${k*0.8} ${k},${-k*0.3} 0,${k*0.3}`;
  return <path key={`heart-${x}-${y}`} transform={`translate(${x},${y})`} d={d} fill={color} />;
}

function CrownShape(x: number, y: number, s: number, color: string) {
  const w = s * 2, h = s * 1.4;
  const pts = `${-w/2},${h/2} ${-w/2},${-h*0.1} ${-w*0.25},${-h/2} 0,${0} ${w*0.25},${-h/2} ${w/2},${-h*0.1} ${w/2},${h/2}`;
  return (
    <g key={`crown-${x}-${y}`} transform={`translate(${x},${y})`}>
      <polygon points={pts} fill={color} stroke="#a0700080" strokeWidth={0.5} />
      <circle cx={0} cy={0} r={s*0.25} fill="#fff9" />
      <circle cx={-w*0.28} cy={-h*0.4} r={s*0.18} fill="#fff8" />
      <circle cx={w*0.28} cy={-h*0.4} r={s*0.18} fill="#fff8" />
    </g>
  );
}

function GemShape(x: number, y: number, s: number, color: string) {
  const top = `0,${-s}`;
  const mid = [-s*0.8, -s*1, s*0.8, -s*1, s, 0, s*0.8, s*0.9, -s*0.8, s*0.9, -s, 0]
    .reduce((a, v, i) => a + (i % 2 === 0 ? `${v},` : `${v} `), "");
  return (
    <g key={`gem-${x}-${y}`} transform={`translate(${x},${y})`}>
      <defs>
        <linearGradient id={`gem${x|0}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.7} />
          <stop offset="100%" stopColor={color} />
        </linearGradient>
      </defs>
      <polygon points={`0,${-s} ${s*0.7},${-s*0.3} ${s*0.5},${s*0.8} ${-s*0.5},${s*0.8} ${-s*0.7},${-s*0.3}`}
        fill={`url(#gem${x|0})`} stroke={color} strokeWidth={0.5} />
    </g>
  );
}

function FireParticle(x: number, y: number, s: number, a: number, idx: number) {
  const deg = (a * 180) / Math.PI + 90;
  const colors = [["#ff4400","#ff8800"],["#ff6600","#ffbb00"],["#ff2200","#ff6600"],["#ff8800","#ffdd00"]];
  const [c1, c2] = colors[idx % colors.length];
  const id = `fp${idx}${(x*10)|0}`;
  return (
    <g key={`fire-${x}-${y}`} transform={`translate(${x},${y}) rotate(${deg})`}>
      <defs>
        <radialGradient id={id} cx="50%" cy="80%" r="60%">
          <stop offset="0%" stopColor={c2} stopOpacity={1} />
          <stop offset="60%" stopColor={c1} stopOpacity={0.8} />
          <stop offset="100%" stopColor={c1} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* Base large */}
      <ellipse rx={s * 0.55} ry={s * 0.45} cy={s * 0.2} fill={`url(#${id})`} />
      {/* Pointe de flamme */}
      <ellipse rx={s * 0.3} ry={s * 0.7} cy={-s * 0.2} fill={c1} opacity={0.7} />
      {/* Coeur brillant */}
      <ellipse rx={s * 0.15} ry={s * 0.35} cy={-s * 0.1} fill={c2} opacity={0.9} />
    </g>
  );
}

// ── Border config ──────────────────────────────────────────────────
interface Conf {
  stroke: string;
  strokeW?: number;
  glow?: string;
  rectAnimCls?: string; // CSS class applied to the outline rect only
  decos: (positions: {x:number,y:number,a:number}[], s: number) => React.ReactNode[];
}

const BORDERS: Record<string, Conf> = {
  none: { stroke: "none", decos: () => [] },

  bronze: {
    stroke: "#cd7f32", strokeW: 1.5, rectAnimCls: "border-anim-bronze",
    decos: (pos, s) => pos.map(p => Coin(p.x, p.y, s * 0.8)),
  },

  silver: {
    stroke: "#b0b8c8", strokeW: 1.5, rectAnimCls: "border-anim-silver",
    decos: (pos, s) => pos.map(p => StarShape(p.x, p.y, s, "#c8d0e0")),
  },

  gold: {
    stroke: "#ffd700", strokeW: 2, rectAnimCls: "border-anim-gold",
    decos: (pos, s) => pos.map(p => Ingot(p.x, p.y, s * 0.8, p.a)),
  },

  diamond: {
    stroke: "#22d3ee", strokeW: 2, rectAnimCls: "border-anim-diamond",
    decos: (pos, s) => pos.map(p => DiamondShape(p.x, p.y, s * 0.85)),
  },

  premium: {
    stroke: "#a855f7", strokeW: 2, rectAnimCls: "border-anim-premium",
    decos: (pos, s) => pos.map((p, i) =>
      StarShape(p.x, p.y, s, i % 2 === 0 ? "#a855f7" : "#e879f9")),
  },

  famille: {
    stroke: "#14b8a6", strokeW: 2,
    decos: (pos, s) => pos.map((p, i) =>
      HeartShape(p.x, p.y, s * 0.8, i % 2 === 0 ? "#14b8a6" : "#2dd4bf")),
  },

  flamme: {
    stroke: "#f97316", strokeW: 2.5, rectAnimCls: "border-anim-flame",
    decos: (pos, s) => pos.map((p, i) => FireParticle(p.x, p.y, s, p.a, i)),
  },

  pro: {
    stroke: "#f59e0b", strokeW: 2, rectAnimCls: "border-anim-pro",
    decos: (pos, s) => pos.map((p, i) =>
      CrownShape(p.x, p.y, s * 0.75, i % 2 === 0 ? "#f59e0b" : "#fbbf24")),
  },

  elite: {
    stroke: "#f43f5e", strokeW: 2, rectAnimCls: "border-anim-elite",
    decos: (pos, s) => {
      const c = ["#f43f5e","#f97316","#eab308","#22c55e","#06b6d4","#8b5cf6","#ec4899","#f43f5e"];
      return pos.map((p, i) => GemShape(p.x, p.y, s * 0.85, c[i % c.length]));
    },
  },
};

export default function AvatarWithBorder({
  avatar, equippedBorder, name, size = "sm",
  bgClass = "", className = "", circular = false,
}: Props) {
  const key = equippedBorder || "none";
  const conf = BORDERS[key] ?? BORDERS.none;
  const url = avatarUrl(avatar);
  const initial = (name || "?").charAt(0).toUpperCase();
  const av = AV[size];
  const gap = GAP[size];
  const itemSz = ITEM[size];
  const hasDeco = conf.decos !== BORDERS.none.decos;
  const orbit = av / 2 + gap + itemSz;
  const total = hasDeco ? av + (orbit - av / 2) * 2 : av + 6;
  const cx = total / 2;
  const cy = total / 2;
  const r = { sm: 8, md: 10, lg: 13, xl: 18 }[size]!;

  const n = { sm: 6, md: 7, lg: 8, xl: 10 }[size]!;
  const positions = ring(n, orbit);
  const decos = conf.decos(positions, itemSz);

  const svgStroke = conf.stroke !== "none" ? conf.stroke : "none";
  const sw = conf.strokeW ?? 1.5;
  const rectAnim = conf.rectAnimCls || "";
  const clipR = circular ? av / 2 : r;

  return (
    <div
      className={`shrink-0 ${(conf as any).animCls || ""} ${className}`}
      style={{ display: "inline-block", lineHeight: 0 }}
    >
      <svg
        width={total}
        height={total}
        viewBox={`0 0 ${total} ${total}`}
        overflow="visible"
        style={{ filter: conf.glow }}
      >
        <defs>
          <clipPath id={`av-clip-${key}-${size}`}>
            {circular
              ? <circle cx={cx} cy={cy} r={av/2} />
              : <rect x={cx - av/2} y={cy - av/2} width={av} height={av} rx={r} ry={r} />}
          </clipPath>
        </defs>

        {/* Decorative elements */}
        <g transform={`translate(${cx},${cy})`}>
          {decos}
        </g>

        {/* Avatar background */}
        <rect
          x={cx - av/2} y={cy - av/2} width={av} height={av} rx={r}
          fill={bgClass === "transparent" ? "transparent" : bgClass.includes("#") ? bgClass : "#3a6ea520"}
        />

        {/* Avatar image or initial */}
        {url ? (
          <image
            href={url}
            x={cx - av/2} y={cy - av/2}
            width={av} height={av}
            clipPath={`url(#av-clip-${key}-${size})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <text
            x={cx} y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={av * 0.4}
            fontWeight="bold"
            fill="white"
            clipPath={`url(#av-clip-${key}-${size})`}
          >
            {initial}
          </text>
        )}

        {/* Outline — animated per grade */}
        {svgStroke !== "none" && (circular ? (
          <circle
            cx={cx} cy={cy} r={av/2 + sw/2}
            fill="none" stroke={svgStroke} strokeWidth={sw}
            className={rectAnim}
          />
        ) : (
          <rect
            x={cx - av/2 - sw/2} y={cy - av/2 - sw/2}
            width={av + sw} height={av + sw}
            rx={r + 1} ry={r + 1}
            fill="none" stroke={svgStroke} strokeWidth={sw}
            className={rectAnim}
          />
        ))}
      </svg>
    </div>
  );
}
