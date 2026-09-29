import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import FadeInSection from "@/components/home/FadeInSection";
import LevelPicker from "@/components/programmes/LevelPicker";
import LevelGroupsList from "@/components/programmes/LevelGroupsList";
import { fetchProgrammePdfs } from "@/lib/programmePdfs";
import GlassButton from "@/components/ui/GlassButton";

// Page publique quasi-statique (PDFs édités en admin) : ISR au lieu d'un
// aller-retour Supabase à chaque visite.
export const revalidate = 300;

const SYM = [
  { s: "∑", x: 6, y: 10, z: 96, d: 0, t: 7.2 },
  { s: "π", x: 87, y: 7, z: 72, d: 1.3, t: 8.5 },
  { s: "√", x: 12, y: 62, z: 58, d: 0.6, t: 9.1 },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4 },
  { s: "Δ", x: 43, y: 14, z: 50, d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66, d: 1.8, t: 8.0 },
  { s: "α", x: 2, y: 40, z: 44, d: 2.7, t: 9.3 },
  { s: "×", x: 76, y: 26, z: 54, d: 0.4, t: 7.8 },
];

export default async function ProgrammesPage() {
  const dbPdfs = await fetchProgrammePdfs();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-cream)" }}>
      <Navbar />

      {/* Hero — avec barre de progression niveaux */}
      <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white pt-[calc(var(--nav-h)+4rem)] pb-20 text-center">
        {SYM.map((cfg, i) => (
          <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
            style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, fontSize: `${cfg.z}px`, fontFamily: "Georgia,serif", color: "var(--greek-gold)", opacity: 0.1, animationDuration: `${cfg.t}s`, animationDelay: `${cfg.d}s` }}
          >{cfg.s}</span>
        ))}
        <div className="relative container mx-auto px-6 max-w-3xl">
          <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-5xl font-bold mb-4">
            Programmes officiels
          </h1>
          <p className="text-white/55 text-lg max-w-xl mx-auto leading-relaxed mb-10">
            Du CP à la Terminale, aligné sur l&apos;Éducation Nationale, par niveau et filière.
          </p>

          <LevelPicker />
        </div>
      </section>

      {/* Contenu programmes */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-12">
          {/* Logos officiels + texte */}
          <FadeInSection translateY={24} durationMs={600} className="flex flex-col items-center text-center gap-5">
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
          </FadeInSection>

          <LevelGroupsList dbPdfs={dbPdfs} />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6" style={{ background: "var(--greek-blue)" }}>
        <div className="max-w-xl mx-auto text-center">
          <h2 className="font-[family-name:var(--font-display)] font-bold text-2xl mb-4 text-white">
            Prêt à commencer ?
          </h2>
          <p className="text-sm mb-8 text-white/45">
            Inscrivez-vous en 2 minutes et accédez à tous les contenus alignés sur ces programmes.
          </p>
          <GlassButton href="/auth/inscription" variant="gold">
            Commencer gratuitement <ArrowRight size={16} />
          </GlassButton>
        </div>
      </section>

      <Footer />
    </div>
  );
}
