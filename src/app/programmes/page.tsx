"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { ChevronDown, BookOpen, ExternalLink, ArrowRight, GraduationCap } from "lucide-react";
import { PROGRAMMES_NATIONAUX, ProgrammeEntry } from "@/lib/programmes-nationaux";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { supabase } from "@/lib/supabaseClient";
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
    levels: ["1ere-generale", "1ere-generale-maths"],
  },
  {
    label: "Lycée — Terminale",
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
  "1ere-generale-maths": [{ label: "Programme Première — Mathématiques (spé)", url: "https://eduscol.education.gouv.fr/document/18360/download" }],
  "1ere-generale": [{ label: "Programme Première Générale", url: "https://eduscol.education.gouv.fr/document/18360/download" }],
  "terminale-generale-maths": [{ label: "Programme Terminale — Mathématiques (spé)", url: "https://eduscol.education.gouv.fr/document/18361/download" }],
  "terminale-generale-expertes": [{ label: "Programme Terminale — Mathématiques expertes", url: "https://eduscol.education.gouv.fr/document/18362/download" }],
};

interface DbPdf {
  file_url: string;
  file_name: string;
}

function LevelCard({ prog, color, isOpen, onToggle, dbPdf, isMine }: { prog: ProgrammeEntry; color: string; isOpen: boolean; onToggle: () => void; dbPdf?: DbPdf; isMine?: boolean }) {
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

function ScrollRevealGroup({ children, className }: { children: ((visible: boolean) => React.ReactNode) | React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < window.innerHeight) { setVisible(true); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} data-visible={visible}>
      {typeof children === "function" ? (children as (v: boolean) => React.ReactNode)(visible) : children}
    </div>
  );
}

export default function ProgrammesPage() {
  const [openLevel, setOpenLevel] = useState<string | null>(null);
  const [dbPdfs, setDbPdfs] = useState<Record<string, DbPdf>>({});
  const [myLevel, setMyLevel] = useState<string>("");
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
            };
          }
        }
        setDbPdfs(map);
      })
      .catch(() => {});
  }, []);

  // Détermine le niveau de l'utilisateur (profil connecté > préférence sauvegardée)
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem("programmes-my-level");
      if (stored) {
        setMyLevel(stored);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("grade_level")
            .eq("auth_id", session.user.id)
            .maybeSingle();
          if (userData?.grade_level) setMyLevel(userData.grade_level);
        }
      } catch {}
    };
    init();
  }, []);

  const goToLevel = (level: string) => {
    setMyLevel(level);
    localStorage.setItem("programmes-my-level", level);
    setOpenLevel(level);
    setTimeout(() => {
      cardRefs.current[level]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-cream)" }}>
      <Navbar />

      {/* Hero — avec barre de progression niveaux */}
      <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white pt-[calc(var(--nav-h)+4rem)] pb-20 text-center">
        {SYM.map((cfg, i) => (
          <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
            style={{ left:`${cfg.x}%`, top:`${cfg.y}%`, fontSize:`${cfg.z}px`, fontFamily:"Georgia,serif", color:"var(--greek-gold)", opacity:0.1, animationDuration:`${cfg.t}s`, animationDelay:`${cfg.d}s` }}
          >{cfg.s}</span>
        ))}
        <div className="relative container mx-auto px-6 max-w-3xl">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl font-bold mb-4">
            Programmes officiels
          </h1>
          <p className="text-white/55 text-lg max-w-xl mx-auto leading-relaxed mb-10">
            Du CP à la Terminale — aligné sur l&apos;Éducation Nationale, par niveau et filière.
          </p>

          {/* Sélecteur de niveau */}
          <div className="flex items-center justify-center gap-3 mb-10 flex-wrap">
            <label htmlFor="my-level" className="flex items-center gap-2 text-sm font-semibold text-white/70 font-[family-name:var(--font-display)]">
              <GraduationCap size={18} style={{ color: "var(--greek-gold)" }} />
              Mon niveau
            </label>
            <select
              id="my-level"
              value={myLevel}
              onChange={(e) => goToLevel(e.target.value)}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[var(--greek-gold)]/50"
              style={{ colorScheme: "dark" }}
            >
              <option value="" disabled>Choisir mon niveau...</option>
              {SCHOOL_LEVELS.map((l) => (
                <option key={l.value} value={l.value} style={{ color: "#1a1008" }}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Contenu programmes */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-12">
          {/* Logos officiels + texte */}
          <ScrollRevealGroup>
            {(v: boolean) => (
          <div className="flex flex-col items-center text-center gap-5"
            style={{ opacity: v ? 1 : 0, transform: v ? "translateY(0)" : "translateY(24px)", transition: "opacity 0.6s, transform 0.6s" }}>
            <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
              <Image src="/logo-men.svg" alt="Ministère de l'Éducation Nationale" width={180} height={180} className="w-auto object-contain flex-shrink-0" style={{ height: 180 }} unoptimized />
              <div className="hidden sm:block w-px h-12" style={{ background: "var(--greek-border)" }} />
              <Image src="/eduscol.svg" alt="Eduscol" width={110} height={36} className="h-9 w-auto object-contain" unoptimized />
            </div>
            <div className="max-w-xl">
              <p className="font-bold text-base leading-relaxed" style={{ fontFamily: "var(--font-display)", color: "var(--greek-blue)" }}>
                Programmes 100 % conformes aux référentiels officiels
              </p>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Tous les contenus d'Educalcul sont élaborés en stricte conformité avec les programmes publiés par le Ministère de l'Éducation Nationale et référencés sur Éduscol.
              </p>
            </div>
          </div>
            )}
          </ScrollRevealGroup>
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
