import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, Clock, MessageSquare, ShieldCheck } from "lucide-react";
import FadeInSection from "@/components/home/FadeInSection";
import ContactForm from "@/components/contact/ContactForm";
import { SUBJECTS } from "@/lib/contactSubjects";

const SYM = [
  { s: "∑", x: 6, y: 10, z: 96, d: 0, t: 7.2 },
  { s: "π", x: 87, y: 7, z: 72, d: 1.3, t: 8.5 },
  { s: "√", x: 12, y: 62, z: 58, d: 0.6, t: 9.1 },
  { s: "∫", x: 91, y: 48, z: 104, d: 2.1, t: 7.4 },
  { s: "Δ", x: 43, y: 14, z: 50, d: 0.9, t: 10.2 },
  { s: "∞", x: 65, y: 70, z: 66, d: 1.8, t: 8.0 },
  { s: "α", x: 2, y: 40, z: 44, d: 2.7, t: 9.3 },
  { s: "×", x: 76, y: 26, z: 54, d: 0.4, t: 7.8 },
  { s: "θ", x: 50, y: 78, z: 62, d: 2.0, t: 8.8 },
  { s: "β", x: 28, y: 53, z: 42, d: 3.3, t: 10.5 },
  { s: "≠", x: 58, y: 30, z: 46, d: 1.1, t: 9.7 },
  { s: "÷", x: 19, y: 84, z: 38, d: 2.9, t: 7.3 },
];

const INFO_ITEMS = [
  { icon: Mail, title: "Email", desc: "contact@educalcul.com" },
  { icon: Clock, title: "Réponse sous 24h", desc: "En semaine, jours ouvrés" },
  { icon: MessageSquare, title: "Support en français", desc: "Une équipe dédiée, basée en France" },
  { icon: ShieldCheck, title: "RGPD & confidentialité", desc: "Vos données ne sont jamais partagées" },
];

export default function Contact() {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <main className="flex-grow pt-[64px]">
        {/* HERO — split, panneau message à droite */}
        <section className="relative overflow-hidden bg-[var(--greek-blue)] text-white py-32">
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{ left: `${cfg.x}%`, top: `${cfg.y}%`, fontSize: `${cfg.z}px`, fontFamily: "Georgia,serif", color: "var(--greek-gold)", opacity: 0.1, animationDuration: `${cfg.t}s`, animationDelay: `${cfg.d}s` }}
            >{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "rgba(197,161,72,0.6)" }}>Support</p>
                <h1 className="font-[family-name:var(--font-display)] font-bold leading-tight mb-5 text-white"
                  style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)" }}>
                  Contactez-nous
                </h1>
                <p className="text-white/55 text-lg leading-relaxed">
                  Une équipe française à votre écoute — pour chaque question, grande ou petite.
                </p>
              </div>
              <div className="hidden md:flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Vous souhaitez nous parler de…</p>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.filter((s) => s !== "Autre").map((s, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(240,237,232,0.6)" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTENT */}
        <section className="py-20 bg-[var(--greek-cream)]">
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Info cards */}
              <div className="space-y-5">
                <h2 className="font-[family-name:var(--font-display)] font-bold text-xl text-[var(--greek-blue)] mb-6 uppercase tracking-wide">
                  Comment pouvons-nous vous aider ?
                </h2>
                {INFO_ITEMS.map((item, i) => (
                  <FadeInSection
                    key={i}
                    translateY={0}
                    delayMs={i * 80}
                    className="flex items-start gap-4 p-5 bg-white rounded-2xl"
                    style={{ border: "1px solid rgba(197,161,72,0.18)", boxShadow: "0 2px 12px rgba(15,30,58,0.04)" }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(197,161,72,0.10)", border: "1px solid rgba(197,161,72,0.2)" }}>
                      <item.icon className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />
                    </div>
                    <div>
                      <p className="font-[family-name:var(--font-display)] font-semibold text-sm" style={{ color: "var(--greek-blue)" }}>{item.title}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                    </div>
                  </FadeInSection>
                ))}
              </div>

              {/* Form */}
              <FadeInSection translateY={0} delayMs={100} className="lg:col-span-2">
                <ContactForm />
              </FadeInSection>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
