"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import {
  BookOpen, Trophy, Users, ShieldCheck,
  BarChart3, Wifi, MessageSquare, ArrowRight, Send, X,
} from "lucide-react";
import Image from "next/image";

/* ─── Features ─── */
const FEATURES = [
  {
    icon: <BookOpen className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />,
    title: "Cours alignés sur le programme",
    desc: "Des leçons progressives du CP à la Terminale, conçues par des enseignants et conformes au programme officiel. Chaque chapitre est découpé en étapes claires avec des exemples concrets.",
    badge: "CP → Terminale",
    ai: false,
  },
  {
    icon: null,
    title: "EpsiAI, IA pédagogique",
    desc: "Notre assistante intelligente guide l'élève sans jamais donner la réponse directement. Elle pose des questions, donne des indices et explique les erreurs pour développer la réflexion autonome.",
    badge: "IA bienveillante",
    ai: true,
  },
  {
    icon: <Trophy className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />,
    title: "Progression gamifiée",
    desc: "XP, badges, niveaux et défis hebdomadaires transforment l'apprentissage en aventure. Les enfants progressent naturellement, motivés par des objectifs atteignables.",
    badge: "Motivant",
    ai: false,
  },
  {
    icon: <BarChart3 className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />,
    title: "Suivi et rapports détaillés",
    desc: "Le tableau de bord parent affiche en temps réel les progrès, les exercices réalisés, les points forts et les axes d'amélioration. Un rapport hebdomadaire est envoyé par email.",
    badge: "Transparence totale",
    ai: false,
  },
  {
    icon: <Users className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />,
    title: "Plusieurs enfants, un seul abonnement",
    desc: "Gérez jusqu'à 6 enfants depuis un seul espace parent. Chacun dispose de son propre profil, son niveau, ses cours et sa progression.",
    badge: "Multi-enfants",
    ai: false,
  },
  {
    icon: <MessageSquare className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />,
    title: "Forum communautaire sécurisé",
    desc: "Un espace d'échange modéré où les élèves peuvent poser des questions et s'entraider. Tous les contenus sont vérifiés pour garantir un environnement sain.",
    badge: "Sécurisé",
    ai: false,
  },
  {
    icon: <ShieldCheck className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />,
    title: "Environnement 100% sécurisé",
    desc: "Aucune publicité, aucune distraction, aucun contenu inapproprié. La plateforme est conforme au RGPD et pensée pour les enfants de 6 à 18 ans.",
    badge: "RGPD · Sans pub",
    ai: false,
  },
  {
    icon: <Wifi className="w-5 h-5" style={{ color: "var(--greek-gold)" }} />,
    title: "Accès multi-appareils",
    desc: "Ordinateur, tablette, smartphone. La plateforme s'adapte à tous les écrans. Certaines formules incluent un accès hors-ligne.",
    badge: "Partout",
    ai: false,
  },
];

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

/* ─── Chatbot ─── */
type Msg = { from: "user" | "ai" | "cta"; text: string };
type ApiMsg = { role: "user" | "assistant"; content: string };

const INITIAL_MSG: Msg = {
  from: "ai",
  text: "Bonjour, je suis EpsiAI. Quel exercice te pose problème aujourd'hui ?",
};

const STORAGE_MSGS = "epsi_demo_msgs";

function loadSavedMessages(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_MSGS);
    if (raw) return JSON.parse(raw) as Msg[];
  } catch { /* */ }
  return [INITIAL_MSG];
}

function EpsiChat({ onClose, inline = false }: { onClose: () => void; inline?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>(() =>
    typeof window !== "undefined" ? loadSavedMessages() : [INITIAL_MSG]
  );
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [limitReached, setLimitReached] = useState(() =>
    typeof window !== "undefined" ? loadSavedMessages().some(m => m.from === "cta") : false
  );

  // Sync avec le serveur au montage pour éviter les incohérences localStorage
  useEffect(() => {
    fetch("/api/epsi-demo").then(r => r.json()).then(data => {
      if (data.limitReached && !limitReached) {
        setLimitReached(true);
        setMessages(prev => prev.some(m => m.from === "cta") ? prev : [...prev, { from: "cta", text: "" }]);
      } else if (!data.limitReached && limitReached) {
        // Le localStorage avait un faux état bloqué, on le corrige
        setLimitReached(false);
        setMessages(prev => prev.filter(m => m.from !== "cta"));
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ApiMsg[]>(
    messages.filter(m => m.from === "user" || m.from === "ai").map(m => ({
      role: m.from === "user" ? "user" : "assistant",
      content: m.text,
    }))
  );

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || typing || limitReached) return;
    setMessages(prev => [...prev, { from: "user", text: trimmed }]);
    historyRef.current = [...historyRef.current, { role: "user", content: trimmed }];
    setInput("");
    setTyping(true);
    try {
      const res = await fetch("/api/epsi-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyRef.current }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setMessages(prev => prev.some(m => m.from === "cta") ? prev : [...prev, { from: "cta", text: "" }]);
        setTyping(false);
        return;
      }
      const aiText: string = data.reply || "Je n'ai pas pu te repondre, essaie a nouveau.";
      historyRef.current = [...historyRef.current, { role: "assistant", content: aiText }];
      if (data.limitReached) setLimitReached(true);
      setMessages(prev => {
        const next: Msg[] = [...prev, { from: "ai" as const, text: aiText }];
        if (data.limitReached) next.push({ from: "cta", text: "" });
        return next;
      });
    } catch {
      setMessages(prev => [...prev, { from: "ai", text: "Une erreur s'est produite. Verifie ta connexion et reessaie." }]);
    } finally {
      setTyping(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem(STORAGE_MSGS, JSON.stringify(messages));
    }
  }, [messages]);

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: "#0d1829", border: "1px solid rgba(197,161,72,0.25)", width: inline ? "100%" : 340, height: 480 }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "rgba(197,161,72,0.15)", background: "rgba(255,255,255,0.03)" }}>
        <Image src="/logoAI.png" alt="EpsiAI" width={26} height={26} style={{ width: 26, height: 26 }} className="object-contain" />
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-display)] font-bold text-sm" style={{ color: "var(--greek-gold)" }}>EpsiAI</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>IA pédagogique · Aperçu</p>
        </div>
        <span className="w-2 h-2 rounded-full animate-pulse mr-1" style={{ background: "#34d399" }} />
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5" style={{ scrollbarWidth: "none" }}>
        {messages.filter(m => m.from !== "cta").map((msg, i) => (
            <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
              {msg.from === "ai" && (
                <Image src="/logoAI.png" alt="" width={20} height={20} style={{ width: 20, height: 20 }} className="object-contain mr-2 mt-1 flex-shrink-0" />
              )}
              <div
                className="max-w-[82%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed"
                style={msg.from === "ai"
                  ? { background: "rgba(255,255,255,0.07)", color: "rgba(240,237,232,0.85)", borderBottomLeftRadius: 4 }
                  : { background: "var(--greek-gold)", color: "#fff", borderBottomRightRadius: 4 }
                }
              >
                {msg.text}
              </div>
            </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2">
            <Image src="/logoAI.png" alt="" width={20} height={20} style={{ width: 20, height: 20 }} className="object-contain" />
            <div className="px-3.5 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
              <span className="flex gap-1 items-center h-3.5">
                {[0, 1, 2].map(j => (
                  <span key={j} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(197,161,72,0.7)", animationDelay: `${j * 150}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input OU CTA — toujours collé en bas */}
      {limitReached ? (
        <div className="px-4 py-4 border-t flex-shrink-0 text-center" style={{ borderColor: "rgba(197,161,72,0.15)", background: "rgba(197,161,72,0.05)" }}>
          <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(240,237,232,0.6)" }}>
            Votre enfant veut continuer avec EpsiAI ?<br />
            <span style={{ color: "rgba(240,237,232,0.8)" }}>Créez un compte gratuit en 2 minutes.</span>
          </p>
          <Link
            href="/auth/inscription"
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 font-[family-name:var(--font-display)]"
            style={{ background: "var(--greek-gold)", color: "#fff" }}
          >
            Commencer gratuitement <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="px-3 py-3 border-t flex gap-2 flex-shrink-0" style={{ borderColor: "rgba(197,161,72,0.15)" }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Pose ta question…"
            className="flex-1 rounded-xl px-3.5 py-2 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(197,161,72,0.15)", color: "rgba(240,237,232,0.85)" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || typing}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40"
            style={{ background: "var(--greek-gold)" }}
          >
            <Send className="w-3.5 h-3.5" style={{ color: "#fff" }} />
          </button>
        </div>
      )}
    </div>
  );
}


/* ─── Demo widget (bulle dans la section) ─── */
function EpsiDemoWidget() {
  const [open, setOpen] = useState(false);

  const handleClose = () => setOpen(false);

  return (
    <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 340 }}>
      {open
        ? <EpsiChat onClose={handleClose} inline />
        : (
          <div className="flex flex-col items-center gap-5">
            <div className="px-5 py-3 rounded-2xl text-sm text-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(197,161,72,0.2)", color: "rgba(240,237,232,0.7)" }}>
              <span style={{ color: "var(--greek-gold)", fontWeight: 600 }}>EpsiAI</span> est prête à vous aider.<br />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Posez une vraie question de maths</span>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 hover:scale-110 active:scale-95"
              style={{ background: "var(--greek-blue)", border: "2px solid rgba(197,161,72,0.4)", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
            >
              <Image src="/logoAI.png" alt="EpsiAI" width={44} height={44} style={{ width: 44, height: 44 }} className="object-contain" />
            </button>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Cliquez pour ouvrir le chat</p>
          </div>
        )
      }
    </div>
  );
}

/* ─── Page ─── */
export default function Offres() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.08 }
    );
    if (gridRef.current) obs.observe(gridRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--greek-blue)" }}>
      <Navbar />
      <main className="flex-grow pt-[64px]">

        {/* HERO */}
        <section className="relative overflow-hidden py-28 text-center" style={{ background: "var(--greek-blue)" }}>
          {SYM.map((cfg, i) => (
            <span key={i} className="absolute font-bold animate-float-symbol select-none pointer-events-none"
              style={{ left:`${cfg.x}%`, top:`${cfg.y}%`, fontSize:`${cfg.z}px`, fontFamily:"Georgia,serif", color:"var(--greek-gold)", opacity:0.13, animationDuration:`${cfg.t}s`, animationDelay:`${cfg.d}s` }}
            >{cfg.s}</span>
          ))}
          <div className="relative container mx-auto px-6 max-w-3xl">
            <h1 className="font-[family-name:var(--font-display)] text-5xl md:text-6xl font-bold mb-5 text-white">
              Nos Offres
            </h1>
            <p className="text-lg max-w-xl mx-auto leading-relaxed mb-10" style={{ color: "rgba(255,255,255,0.55)" }}>
              Tout ce dont votre enfant a besoin pour progresser en maths,<br className="hidden md:block" />
              du CP à la Terminale, dans un environnement sécurisé et motivant.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link
                href="/tarifs"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg font-[family-name:var(--font-display)]"
                style={{ background: "var(--greek-gold)", color: "#fff", boxShadow: "0 8px 32px rgba(197,161,72,0.32)" }}
              >
                Voir les tarifs <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/auth/inscription"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 hover:-translate-y-0.5 font-[family-name:var(--font-display)]"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}
              >
                Commencer gratuitement
              </Link>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-24" style={{ background: "var(--greek-cream)" }}>
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="text-center mb-16">
              <h2 className="font-[family-name:var(--font-display)] font-bold text-4xl mb-4" style={{ color: "var(--greek-blue)" }}>
                Une plateforme complète
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: "rgba(15,30,58,0.5)" }}>
                Chaque fonctionnalité est pensée pour un objectif précis : apprendre mieux, plus vite et durablement.
              </p>
            </div>

            <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {FEATURES.map((f, i) => (
                <div
                  key={i}
                  className="group rounded-2xl p-6 border transition-all duration-500"
                  style={{
                    background: "white",
                    borderColor: "rgba(15,30,58,0.08)",
                    boxShadow: "0 2px 12px rgba(15,30,58,0.04)",
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0)" : "translateY(24px)",
                    transitionDelay: `${i * 60}ms`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: "rgba(197,161,72,0.1)", border: "1px solid rgba(197,161,72,0.2)" }}>
                      {f.ai
                        ? <Image src="/logoAI.png" alt="EpsiAI" width={24} height={24} style={{ width: 24, height: 24 }} className="object-contain" />
                        : f.icon
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-[family-name:var(--font-display)] font-bold text-sm" style={{ color: "var(--greek-blue)" }}>{f.title}</h3>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "rgba(15,30,58,0.55)" }}>{f.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DEMO EPSI */}
        <section className="py-24" style={{ background: "var(--greek-blue)" }}>
          <div className="container mx-auto px-6 max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="font-[family-name:var(--font-display)] font-bold text-4xl text-white mb-5">
                  Une IA qui enseigne,<br />
                  <span style={{ color: "var(--greek-gold)" }}>pas qui donne les réponses.</span>
                </h2>
                <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>
                  EpsiAI utilise la méthode socratique : plutôt que de corriger, elle questionne. L'élève arrive lui-même à la solution, ce qui ancre vraiment la compréhension.
                </p>
                <ul className="flex flex-col gap-4">
                  {["Détecte les lacunes en temps réel", "Adapte le niveau de la question", "Encourage sans jamais juger", "Disponible 24h/24, 7j/7"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: "rgba(197,161,72,0.15)", color: "var(--greek-gold)" }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <EpsiDemoWidget />
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
