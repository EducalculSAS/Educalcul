"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, BookOpen, ExternalLink, ArrowRight, FileText } from "lucide-react";
import { PROGRAMMES_NATIONAUX, ProgrammeEntry } from "@/lib/programmes-nationaux";
import katex from "katex";
import "katex/dist/katex.min.css";

const SYM = [
  { s: "∑", x: 6,  y: 10, z: 96,  d: 0,   t: 7.2  },
  { s: "π", x: 87, y: 7,  z: 72,  d: 1.3, t: 8.5  },
  { s: "√", x: 12, y: 62, z: 58,  d: 0.6, t: 9.1  },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4  },
  { s: "Δ", x: 43, y: 14, z: 50,  d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66,  d: 1.8, t: 8.0  },
  { s: "α", x: 2,  y: 40, z: 44,  d: 2.7, t: 9.3  },
  { s: "×", x: 76, y: 26, z: 54,  d: 0.4, t: 7.8  },
];

function renderNotion(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { throwOnError: false, displayMode: false });
    } catch {
      return math;
    }
  });
}

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
    label: "Lycée — 2nde",
    color: "var(--greek-gold)",
    bg: "rgba(197,161,72,0.08)",
    border: "rgba(197,161,72,0.2)",
    levels: ["2nde"],
  },
  {
    label: "Lycée — Première",
    color: "var(--greek-gold)",
    bg: "rgba(197,161,72,0.08)",
    border: "rgba(197,161,72,0.2)",
    levels: ["1ere-generale", "1ere-generale-maths", "1ere-sti2d", "1ere-stmg", "1ere-st2s", "1ere-stl", "1ere-std2a", "1ere-sthr"],
  },
  {
    label: "Lycée — Terminale",
    color: "#f472b6",
    bg: "rgba(244,114,182,0.08)",
    border: "rgba(244,114,182,0.2)",
    levels: ["terminale-generale", "terminale-generale-maths", "terminale-generale-expertes", "terminale-generale-complementaires", "terminale-sti2d", "terminale-stmg", "terminale-st2s", "terminale-stl"],
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
  "1ere-generale-maths": [{ label: "Programme Première — Mathématiques (spé)", url: "https://eduscol.education.gouv.fr/document/18360/download" }],
  "1ere-generale": [{ label: "Programme Première Générale", url: "https://eduscol.education.gouv.fr/document/18360/download" }],
  "1ere-sti2d": [{ label: "Programme STI2D Première", url: "https://eduscol.education.gouv.fr/document/18363/download" }],
  "1ere-stmg": [{ label: "Programme STMG Première", url: "https://eduscol.education.gouv.fr/document/18364/download" }],
  "terminale-generale-maths": [{ label: "Programme Terminale — Mathématiques (spé)", url: "https://eduscol.education.gouv.fr/document/18361/download" }],
  "terminale-generale-expertes": [{ label: "Programme Terminale — Mathématiques expertes", url: "https://eduscol.education.gouv.fr/document/18362/download" }],
};

interface DbPdf {
  file_url: string;
  file_name: string;
  custom_content: string;
}

function LevelCard({ prog, color, isOpen, onToggle, dbPdf }: { prog: ProgrammeEntry; color: string; isOpen: boolean; onToggle: () => void; dbPdf?: DbPdf }) {
  const pdfs = PDF_LINKS[prog.level] || [];
  return (
    <div
      className="rounded-2xl border transition-all duration-200"
      style={{ background: "#fff", borderColor: isOpen ? color : "var(--greek-border)" }}
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
                    href={pdf.url}
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
                {dbPdf && (
                  <a
                    href={dbPdf.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors hover:opacity-80 mt-2"
                    style={{ background: "rgba(34,197,94,0.1)", color: "var(--greek-blue)", border: "1px solid rgba(34,197,94,0.25)" }}
                  >
                    <FileText size={14} />
                    PDF téléchargé par l&apos;admin
                    <ExternalLink size={12} style={{ color: "var(--text-muted)" }} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProgrammesPage() {
  const [openLevel, setOpenLevel] = useState<string | null>("2nde");
  const [visible, setVisible] = useState(false);
  const [dbPdfs, setDbPdfs] = useState<Record<string, DbPdf>>({});
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.05 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    fetch("/api/programmes")
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, DbPdf> = {};
        for (const row of (j.data || [])) {
          if (row?.level) {
            map[row.level] = {
              file_url: row.file_url,
              file_name: row.file_name,
              custom_content: row.custom_content || "",
            };
          }
        }
        setDbPdfs(map);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-cream)" }}>
      <Navbar />

      {/* Hero — match FAQ style */}
      <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white pt-[calc(var(--nav-h)+4rem)] pb-24 text-center">
        {SYM.map((cfg, i) => (
          <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
            style={{ left:`${cfg.x}%`, top:`${cfg.y}%`, fontSize:`${cfg.z}px`, fontFamily:"Georgia,serif", color:"var(--greek-gold)", opacity:0.13, animationDuration:`${cfg.t}s`, animationDelay:`${cfg.d}s` }}
          >{cfg.s}</span>
        ))}
        <div className="relative container mx-auto px-6 max-w-3xl">
          <div className="flex items-center justify-center gap-6 mb-8 flex-wrap">
            <Image src="/logo-men.svg" alt="Ministère de l'Éducation Nationale" width={96} height={48} className="h-12 w-auto object-contain" style={{ filter: "brightness(10)" }} unoptimized />
            <div className="w-px h-10" style={{ background: "rgba(255,255,255,0.2)" }} />
            <Image src="/eduscol.svg" alt="Eduscol" width={80} height={32} className="h-8 w-auto object-contain" style={{ filter: "brightness(10)" }} unoptimized />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl font-bold mb-5">
            Programmes officiels
          </h1>
          <p className="text-white/60 text-lg max-w-xl mx-auto leading-relaxed">
            Du CP à la Terminale — aligné sur l&apos;Éducation Nationale, par niveau et filière.
          </p>
        </div>
      </section>

      {/* Contenu programmes */}
      <section className="py-16 px-6" ref={ref}>
        <div className="max-w-3xl mx-auto space-y-12">
          {LEVEL_GROUPS.map((group, gi) => {
            const progs = PROGRAMMES_NATIONAUX.filter((p) => group.levels.includes(p.level));
            if (!progs.length) return null;
            return (
              <div
                key={group.label}
                className="transition-all duration-700"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translateY(0)" : "translateY(24px)",
                  transitionDelay: `${gi * 80}ms`,
                }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-px flex-1" style={{ background: "var(--greek-border)" }} />
                  <span
                    className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                    style={{ background: group.bg, color: group.color, border: `1px solid ${group.border}` }}
                  >
                    {group.label}
                  </span>
                  <div className="h-px flex-1" style={{ background: "var(--greek-border)" }} />
                </div>

                <div className="space-y-2">
                  {progs.map((prog) => (
                    <LevelCard
                      key={prog.level}
                      prog={prog}
                      color={group.color}
                      isOpen={openLevel === prog.level}
                      onToggle={() => setOpenLevel(openLevel === prog.level ? null : prog.level)}
                      dbPdf={dbPdfs[prog.level]}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6" style={{ background: "var(--greek-blue)" }}>
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl mb-4" style={{ color: "#f0ede8" }}>
            Prêt à commencer ?
          </h2>
          <p className="text-sm mb-8" style={{ color: "rgba(240,237,232,0.45)" }}>
            Inscrivez-vous en 2 minutes et accédez à tous les contenus alignés sur ces programmes.
          </p>
          <Link
            href="/auth/inscription"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
            style={{ background: "var(--greek-gold)", color: "#fff", boxShadow: "0 8px 28px rgba(197,161,72,0.3)" }}
          >
            Commencer gratuitement <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
