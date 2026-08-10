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

// Border config — animated outline only, no decorative shapes
interface Conf {
  stroke: string;
  strokeW?: number;
  rectAnimCls?: string;
}

const BORDERS: Record<string, Conf> = {
  none:    { stroke: "none" },
  bronze:  { stroke: "#cd7f32", strokeW: 2,   rectAnimCls: "border-anim-bronze"  },
  silver:  { stroke: "#b0b8c8", strokeW: 2,   rectAnimCls: "border-anim-silver"  },
  gold:    { stroke: "#ffd700", strokeW: 2.5, rectAnimCls: "border-anim-gold"    },
  diamond: { stroke: "#22d3ee", strokeW: 2.5, rectAnimCls: "border-anim-diamond" },
  premium: { stroke: "#a855f7", strokeW: 2.5, rectAnimCls: "border-anim-premium" },
  famille: { stroke: "#14b8a6", strokeW: 2.5 },
  flamme:  { stroke: "#f97316", strokeW: 3,   rectAnimCls: "border-anim-flame"   },
  pro:     { stroke: "#f59e0b", strokeW: 2.5, rectAnimCls: "border-anim-pro"     },
  elite:   { stroke: "#7c3aed", strokeW: 3,   rectAnimCls: "border-anim-elite"   },
  admin:   { stroke: "#ff6b6b", strokeW: 3,   rectAnimCls: "border-anim-admin"   },
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
  const sw = conf.strokeW ?? 2;
  const hasBorder = conf.stroke !== "none";
  const total = av + (hasBorder ? sw * 2 + 2 : 0);
  const cx = total / 2;
  const cy = total / 2;
  const r = { sm: 8, md: 10, lg: 13, xl: 18 }[size]!;
  const clipR = circular ? av / 2 : r;

  return (
    <div
      className={`shrink-0 ${className}`}
      style={{ display: "inline-block", lineHeight: 0 }}
    >
      <svg
        width={total}
        height={total}
        viewBox={`0 0 ${total} ${total}`}
        overflow="visible"
        role="img"
        aria-label={name || "Avatar"}
      >
        <defs>
          <clipPath id={`av-clip-${key}-${size}-${(av)}`}>
            {circular
              ? <circle cx={cx} cy={cy} r={av / 2} />
              : <rect x={cx - av / 2} y={cy - av / 2} width={av} height={av} rx={clipR} ry={clipR} />}
          </clipPath>
        </defs>

        {/* Avatar background */}
        <rect
          x={cx - av / 2} y={cy - av / 2} width={av} height={av} rx={r}
          fill={bgClass === "transparent" ? "transparent" : bgClass.includes("#") ? bgClass : "#3a6ea520"}
        />

        {/* Avatar image or initial */}
        {url ? (
          <image
            href={url}
            x={cx - av / 2} y={cy - av / 2}
            width={av} height={av}
            clipPath={`url(#av-clip-${key}-${size}-${av})`}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <text
            x={cx} y={cy}
            textAnchor="middle" dominantBaseline="central"
            fontSize={av * 0.4} fontWeight="bold" fill="white"
            clipPath={`url(#av-clip-${key}-${size}-${av})`}
          >
            {initial}
          </text>
        )}

        {/* Animated outline */}
        {hasBorder && (circular ? (
          <circle
            cx={cx} cy={cy} r={av / 2 + sw / 2 + 1}
            fill="none" stroke={conf.stroke} strokeWidth={sw}
            className={conf.rectAnimCls ?? ""}
          />
        ) : (
          <rect
            x={cx - av / 2 - sw / 2 - 1} y={cy - av / 2 - sw / 2 - 1}
            width={av + sw + 2} height={av + sw + 2}
            rx={r + 2} ry={r + 2}
            fill="none" stroke={conf.stroke} strokeWidth={sw}
            className={conf.rectAnimCls ?? ""}
          />
        ))}
      </svg>
    </div>
  );
}
