"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import type { LegalPageData, LegalSection } from "@/components/LegalPageRenderer";
import {
  Globe, Server, Shield, Lock, Cookie, BookOpen, AlertTriangle,
  FileText, Mail, Scale, RefreshCw, User, Clock, Target, Share2,
  Database, CheckCircle, CreditCard, X,
} from "lucide-react";

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  Globe, Server, Shield, Lock, Cookie, BookOpen, AlertTriangle,
  FileText, Mail, Scale, RefreshCw, User, Clock, Target, Share2,
  Database, CheckCircle, CreditCard, X,
};

// ── Floating symbols ──────────────────────────────────────────────────────────
const SYM = [
  { s: "∑", x: 6,  y: 10, z: 96,  d: 0,   t: 7.2  },
  { s: "π", x: 87, y: 7,  z: 72,  d: 1.3, t: 8.5  },
  { s: "√", x: 12, y: 62, z: 58,  d: 0.6, t: 9.1  },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4  },
  { s: "Δ", x: 43, y: 14, z: 50,  d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66,  d: 1.8, t: 8.0  },
  { s: "α", x: 2,  y: 40, z: 44,  d: 2.7, t: 9.3  },
  { s: "×", x: 76, y: 26, z: 54,  d: 0.4, t: 7.8  },
  { s: "θ", x: 50, y: 78, z: 62,  d: 2.0, t: 8.8  },
  { s: "β", x: 28, y: 53, z: 42,  d: 3.3, t: 10.5 },
  { s: "≠", x: 58, y: 30, z: 46,  d: 1.1, t: 9.7  },
  { s: "÷", x: 19, y: 84, z: 38,  d: 2.9, t: 7.3  },
];

// ── Content parser ────────────────────────────────────────────────────────────
function parseBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-[var(--text-dark)]">{part}</strong>
      : part
  );
}

function parseContent(content: string): React.ReactNode {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Info block
    if (line.trim() === "[info]") {
      const infoLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "[/info]") {
        infoLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <div key={`info-${i}`} className="rounded-xl p-4 space-y-1"
          style={{ background: "rgba(197,161,72,0.06)", border: "1px solid rgba(197,161,72,0.18)" }}>
          {infoLines.filter(l => l.trim()).map((l, j) => (
            <p key={j} className="text-sm text-[var(--text-muted)]">{parseBold(l)}</p>
          ))}
        </div>
      );
    }
    // Subtitle
    else if (line.startsWith("## ")) {
      nodes.push(
        <h3 key={`sub-${i}`} className="font-[family-name:var(--font-display)] font-semibold text-[var(--greek-blue)] text-base mt-6 mb-2">
          {line.slice(3)}
        </h3>
      );
    }
    // List
    else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul key={`list-${i}`} className="space-y-2 ml-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-[var(--text-muted)]">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--greek-gold)" }} />
              <span>{parseBold(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }
    // Paragraph
    else if (line.trim() !== "") {
      nodes.push(
        <p key={`p-${i}`} className="text-sm text-[var(--text-muted)] leading-relaxed">
          {parseBold(line)}
        </p>
      );
    }

    i++;
  }

  return <>{nodes}</>;
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ section }: { section: LegalSection }) {
  const Icon = ICON_MAP[section.icon] ?? FileText;
  return (
    <div id={section.id} className="bg-white rounded-2xl p-8 scroll-mt-32" style={{ border: "1px solid #e5e7eb" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(197,161,72,0.10)" }}>
          <Icon className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />
        </div>
        <h2 className="font-[family-name:var(--font-display)] font-bold text-lg text-[var(--greek-blue)]">
          {section.title}
        </h2>
      </div>
      <div className="space-y-4">
        {parseContent(section.content)}
      </div>
    </div>
  );
}

// ── Main renderer ─────────────────────────────────────────────────────────────
export default function LegalPageView({ data }: { data: LegalPageData | null }) {
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    } catch { return iso; }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow pt-[64px]">

        {/* HERO */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-24 text-center">
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{ left:`${cfg.x}%`, top:`${cfg.y}%`, fontSize:`${cfg.z}px`, fontFamily:"Georgia,serif", color:"var(--greek-gold)", opacity:0.13, animationDuration:`${cfg.t}s`, animationDelay:`${cfg.d}s` }}
            >{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-3xl">
            <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl font-bold mb-5">{data?.title}</h1>
            <p className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">{data?.subtitle}</p>
            {data?.updated_at && (
              <p className="text-white/35 text-xs mt-4">Dernière mise à jour : {formatDate(data.updated_at)}</p>
            )}
          </div>
        </section>

        {/* STICKY NAV */}
        {data && (
          <div className="sticky top-[64px] z-30 bg-[var(--greek-cream)] border-b border-gray-200"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            <div className="container mx-auto px-6 max-w-4xl">
              <nav className="flex flex-wrap gap-1 py-3">
                {data.sections.map(({ id, icon, title }) => {
                  const Icon = ICON_MAP[icon] ?? FileText;
                  return (
                    <a key={id} href={`#${id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--greek-blue)] hover:bg-white transition-all"
                      style={{ textDecoration: "none" }}>
                      <Icon className="w-3 h-3 flex-shrink-0" style={{ color: "var(--greek-gold)" }} />
                      {title}
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* CONTENT */}
        <section className="py-16 bg-[var(--greek-cream)]">
          <div className="container mx-auto px-6 max-w-4xl space-y-6">
            {data ? (
              data.sections.map((section) => (
                <Section key={section.id} section={section} />
              ))
            ) : (
              <div className="text-center py-20 text-[var(--text-muted)]">Page introuvable.</div>
            )}
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
