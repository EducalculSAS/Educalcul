"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, BookOpen, ExternalLink } from "lucide-react";
import { PROGRAMMES_NATIONAUX, type ProgrammeEntry } from "@/lib/programmes-nationaux";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { DbProgrammePdf } from "@/lib/programmePdfs";
import { GOTO_LEVEL_EVENT } from "./LevelPicker";
import { getClientCookie } from "@/lib/clientCookie";

const LEVEL_GROUPS = [
  {
    label: "Primaire",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.2)",
    levels: ["cp", "ce1", "ce2", "cm1", "cm2"],
  },
  {
    label: "Collège",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.08)",
    border: "rgba(96,165,250,0.2)",
    levels: ["6eme", "5eme", "4eme", "3eme"],
  },
  {
    label: "Lycée : 2nde",
    color: "var(--greek-gold)",
    bg: "rgba(197,161,72,0.08)",
    border: "rgba(197,161,72,0.2)",
    levels: ["2nde"],
  },
  {
    label: "Lycée : Première",
    color: "var(--greek-gold)",
    bg: "rgba(197,161,72,0.08)",
    border: "rgba(197,161,72,0.2)",
    levels: ["1ere-generale", "1ere-generale-maths"],
  },
  {
    label: "Lycée : Terminale",
    color: "#f472b6",
    bg: "rgba(244,114,182,0.08)",
    border: "rgba(244,114,182,0.2)",
    levels: ["terminale-generale", "terminale-generale-maths", "terminale-generale-expertes", "terminale-generale-complementaires"],
  },
];

const PDF_LINKS: Record<string, { label: string; url: string }[]> = {
  cp: [{ label: "Programme Cycle 2 (CP-CE1-CE2)", url: "https://eduscol.education.gouv.fr/document/17415/download" }],
  ce1: [{ label: "Programme Cycle 2 (CP-CE1-CE2)", url: "https://eduscol.education.gouv.fr/document/17415/download" }],
  ce2: [{ label: "Programme Cycle 2 (CP-CE1-CE2)", url: "https://eduscol.education.gouv.fr/document/17415/download" }],
  cm1: [{ label: "Programme Cycle 3 (CM1-CM2-6e)", url: "https://eduscol.education.gouv.fr/document/17416/download" }],
  cm2: [{ label: "Programme Cycle 3 (CM1-CM2-6e)", url: "https://eduscol.education.gouv.fr/document/17416/download" }],
  "6eme": [{ label: "Programme Cycle 3 (CM1-CM2-6e)", url: "https://eduscol.education.gouv.fr/document/17416/download" }],
  "5eme": [{ label: "Programme Cycle 4 (5e-4e-3e)", url: "https://eduscol.education.gouv.fr/document/17418/download" }],
  "4eme": [{ label: "Programme Cycle 4 (5e-4e-3e)", url: "https://eduscol.education.gouv.fr/document/17418/download" }],
  "3eme": [{ label: "Programme Cycle 4 (5e-4e-3e)", url: "https://eduscol.education.gouv.fr/document/17418/download" }],
  "2nde": [{ label: "Programme Seconde GT", url: "https://eduscol.education.gouv.fr/document/18358/download" }],
  "1ere-generale-maths": [{ label: "Programme Première : Mathématiques (spé)", url: "https://eduscol.education.gouv.fr/document/18360/download" }],
  "1ere-generale": [{ label: "Programme Première Générale", url: "https://eduscol.education.gouv.fr/document/18360/download" }],
  "terminale-generale-maths": [{ label: "Programme Terminale : Mathématiques (spé)", url: "https://eduscol.education.gouv.fr/document/18361/download" }],
  "terminale-generale-expertes": [{ label: "Programme Terminale : Mathématiques expertes", url: "https://eduscol.education.gouv.fr/document/18362/download" }],
};

function renderNotion(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { throwOnError: false, displayMode: false });
    } catch {
      return math;
    }
  });
}

function LevelCard({ prog, color, isOpen, onToggle, dbPdf, isMine }: { prog: ProgrammeEntry; color: string; isOpen: boolean; onToggle: () => void; dbPdf?: DbProgrammePdf; isMine?: boolean }) {
  const pdfs = PDF_LINKS[prog.level] || [];
  return (
    <div
      className="rounded-2xl border transition-all duration-200"
      style={{ background: "#fff", borderColor: isOpen || isMine ? color : "var(--greek-border)", boxShadow: isMine ? `0 0 0 2px ${color}33` : undefined }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="font-[family-name:var(--font-display)] font-bold text-base" style={{ color: "var(--greek-blue)" }}>
            {prog.label}
          </span>
          {isMine && (
            <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: `${color}1a`, color }}>
              Mon niveau
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className="transition-transform duration-200 flex-shrink-0"
          style={{ color: "var(--text-muted)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {isOpen && (
        <div className="px-6 pb-6 border-t" style={{ borderColor: "var(--greek-border)" }}>
          <div className="pt-5 space-y-4">
            {prog.themes.map((theme) => (
              <div key={theme.titre}>
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color }}>
                  {theme.titre}
                </p>
                <ul className="space-y-1">
                  {theme.notions.map((n) => (
                    <li key={n} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                      <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span dangerouslySetInnerHTML={{ __html: renderNotion(n) }} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {(pdfs.length > 0 || dbPdf) && (
              <div className="pt-4 border-t space-y-2" style={{ borderColor: "var(--greek-border)" }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                  Programme officiel
                </p>
                {pdfs.map((pdf) => (
                  <a
                    key={pdf.url}
                    href={dbPdf?.file_url || pdf.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:opacity-80 mr-2"
                    style={{ background: "rgba(197,161,72,0.1)", color: "var(--greek-blue)", border: "1px solid rgba(197,161,72,0.25)" }}
                  >
                    <BookOpen size={14} />
                    {pdf.label}
                    <ExternalLink size={12} style={{ color: "var(--text-muted)" }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ScrollRevealGroup({ children, className }: { children: (visible: boolean) => ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} data-visible={visible}>
      {children(visible)}
    </div>
  );
}

/** Liste des programmes par cycle (accordéon). Isolée en client island ;
 * reçoit les changements de "mon niveau" via un évènement DOM émis par
 * LevelPicker (autre island, rendu dans le hero) plutôt qu'un état React
 * partagé — les deux composants vivent dans des sections serveur séparées. */
export default function LevelGroupsList({ dbPdfs }: { dbPdfs: Record<string, DbProgrammePdf> }) {
  const [openLevel, setOpenLevel] = useState<string | null>(null);
  const [myLevel, setMyLevel] = useState<string>("");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const stored = getClientCookie("programmes-my-level");
    if (stored) setMyLevel(stored);

    const onGoto = (e: Event) => {
      const level = (e as CustomEvent<string>).detail;
      if (!level) return;
      setMyLevel(level);
      setOpenLevel(level);
      setTimeout(() => {
        cardRefs.current[level]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    };
    window.addEventListener(GOTO_LEVEL_EVENT, onGoto);
    return () => window.removeEventListener(GOTO_LEVEL_EVENT, onGoto);
  }, []);

  return (
    <>
      {LEVEL_GROUPS.map((group) => {
        const progs = PROGRAMMES_NATIONAUX.filter((p) => group.levels.includes(p.level));
        if (!progs.length) return null;
        return (
          <ScrollRevealGroup key={group.label}>
            {(visible: boolean) => (
              <>
                <div
                  className="flex items-center gap-3 mb-5"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(16px)",
                    transition: "opacity 0.4s 0ms, transform 0.4s 0ms",
                  }}
                >
                  <div className="h-px flex-1" style={{ background: "var(--greek-border)" }} />
                  <span className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                    style={{ background: group.bg, color: group.color, border: `1px solid ${group.border}` }}>
                    {group.label}
                  </span>
                  <div className="h-px flex-1" style={{ background: "var(--greek-border)" }} />
                </div>
                <div className="space-y-2">
                  {progs.map((prog, pi) => (
                    <div
                      key={prog.level}
                      ref={(el) => { cardRefs.current[prog.level] = el; }}
                      style={{
                        opacity: visible ? 1 : 0,
                        transform: visible ? "translateY(0)" : "translateY(16px)",
                        transition: `opacity 0.4s ${50 + pi * 55}ms, transform 0.4s ${50 + pi * 55}ms`,
                      }}
                    >
                      <LevelCard
                        prog={prog}
                        color={group.color}
                        isOpen={openLevel === prog.level}
                        onToggle={() => setOpenLevel(openLevel === prog.level ? null : prog.level)}
                        dbPdf={dbPdfs[prog.level]}
                        isMine={myLevel === prog.level}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </ScrollRevealGroup>
        );
      })}
    </>
  );
}
