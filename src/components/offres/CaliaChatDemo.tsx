"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowRight, Send } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassIconButton from "@/components/ui/GlassIconButton";

/** Mêmes raccourcis que dans l'espace élève (AITutor). */
const QUICK_SUGGESTIONS = ["Je ne comprends pas", "Donne-moi un indice"];

type Msg = { from: "user" | "ai" | "cta"; text: string };
type ApiMsg = { role: "user" | "assistant"; content: string };
const INITIAL_MSG: Msg = {
  from: "ai",
  text: "Bonjour, je suis Calia. Quel exercice te pose problème aujourd'hui ?",
};

// Démo publique, anonyme, sans compte — pas de persistance (ni localStorage
// ni serveur) : la conversation ne vaut que pour la session en cours. Le
// vrai suivi de quota (`limitReached`) reste côté serveur (/api/calia-demo).
function CaliaChat({
  onClose,
  inline = false,
}: {
  onClose: () => void;
  inline?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  useEffect(() => {
    fetch("/api/calia-demo")
      .then((r) => r.json())
      .then((data) => {
        if (data.limitReached && !limitReached) {
          setLimitReached(true);
          setMessages((prev) =>
            prev.some((m) => m.from === "cta")
              ? prev
              : [...prev, { from: "cta", text: "" }],
          );
        } else if (!data.limitReached && limitReached) {
          setLimitReached(false);
          setMessages((prev) => prev.filter((m) => m.from !== "cta"));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<ApiMsg[]>(
    messages
      .filter((m) => m.from === "user" || m.from === "ai")
      .map((m) => ({
        role: m.from === "user" ? "user" : "assistant",
        content: m.text,
      })),
  );
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || typing || limitReached) return;
    setMessages((prev) => [...prev, { from: "user", text: trimmed }]);
    historyRef.current = [
      ...historyRef.current,
      { role: "user", content: trimmed },
    ];
    setInput("");
    setTyping(true);
    try {
      const res = await fetch("/api/calia-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyRef.current }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setMessages((prev) =>
          prev.some((m) => m.from === "cta")
            ? prev
            : [...prev, { from: "cta", text: "" }],
        );
        setTyping(false);
        return;
      }
      const aiText: string =
        data.reply || "Je n'ai pas pu te répondre, essaie à nouveau.";
      historyRef.current = [
        ...historyRef.current,
        { role: "assistant", content: aiText },
      ];
      if (data.limitReached) setLimitReached(true);
      setMessages((prev) => {
        const next: Msg[] = [...prev, { from: "ai" as const, text: aiText }];
        if (data.limitReached) next.push({ from: "cta", text: "" });
        return next;
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          from: "ai",
          text: "Une erreur s'est produite. Vérifie ta connexion.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };
  // On fait défiler la liste des messages, jamais la page : `scrollIntoView` remontait toute la page à l'ouverture,
  // et l'en-tête de la discussion passait sous la barre du haut.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  return (
    <div
      className="calia-glass backdrop-blur-[32px] backdrop-saturate-[1.4] flex flex-col rounded-3xl overflow-hidden max-w-full"
      style={{
        width: inline ? "100%" : 340,
        height: "min(500px, calc(100dvh - 9rem))",
      }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{
          borderColor: "rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <Image
          src="/logoAI.png"
          alt="Calia"
          width={28}
          height={28}
          style={{ width: 28, height: 28 }}
          className="object-contain flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p
            className="font-[family-name:var(--font-display)] font-bold text-sm"
            style={{ color: "var(--greek-gold)" }}
          >
            Calia
          </p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
            Tutrice IA · Maths
          </p>
        </div>
        <GlassCloseButton onClick={onClose} variant="dark" size="sm" />
      </div>
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 flex flex-col gap-2.5"
        style={{ scrollbarWidth: "none" }}
      >
        {messages
          .filter((m) => m.from !== "cta")
          .map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.from === "ai" && (
                <Image
                  src="/logoAI.png"
                  alt="Calia"
                  width={20}
                  height={20}
                  style={{ width: 20, height: 20 }}
                  className="object-contain mr-2 mt-1 flex-shrink-0"
                />
              )}
              <div
                className={`max-w-[82%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${msg.from === "ai" ? "calia-glass-soft" : "calia-glass-gold"}`}
                style={
                  msg.from === "ai"
                    ? { color: "rgba(240,237,232,0.9)", borderBottomLeftRadius: 4 }
                    : { color: "var(--greek-blue)", borderBottomRightRadius: 4 }
                }
              >
                {msg.text}
              </div>
            </div>
          ))}
        {typing && (
          <div className="flex items-center gap-2">
            <Image
              src="/logoAI.png"
              alt=""
              width={20}
              height={20}
              style={{ width: 20, height: 20 }}
              className="object-contain"
            />
            <div className="calia-glass-soft px-3.5 py-2.5 rounded-2xl">
              <span className="flex gap-1 items-center h-3.5">
                {[0, 1, 2].map((j) => (
                  <span
                    key={j}
                    className="w-1.5 h-1.5 rounded-full animate-typing-dot"
                    style={{
                      background: "rgba(197,161,72,0.7)",
                      animationDelay: `${j * 150}ms`,
                    }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>
      {messages.length <= 2 && !limitReached && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5 flex-shrink-0">
          {QUICK_SUGGESTIONS.map((q) => (
            <GlassButton key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} variant="light" size="sm" className="text-[10px]">
              {q}
            </GlassButton>
          ))}
        </div>
      )}
      {limitReached ? (
        <div
          className="px-4 py-4 border-t flex-shrink-0 text-center"
          style={{
            borderColor: "rgba(255,255,255,0.12)",
            background: "rgba(222,188,104,0.08)",
          }}
        >
          <p
            className="text-xs leading-relaxed mb-3"
            style={{ color: "rgba(240,237,232,0.6)" }}
          >
            Votre enfant veut continuer avec Calia ?<br />
            <span style={{ color: "rgba(240,237,232,0.8)" }}>
              Créez un compte gratuit en 2 minutes.
            </span>
          </p>
          <GlassButton
            href="/auth/inscription"
            variant="gold"
            size="sm"
            className="font-[family-name:var(--font-display)] text-xs font-bold"
          >
            <span className="inline-flex items-center gap-1.5">
              Commencer gratuitement <ArrowRight className="w-3 h-3" />
            </span>
          </GlassButton>
        </div>
      ) : (
        <div
          className="px-3 py-3 border-t flex gap-2 flex-shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.12)" }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Pose ta question…"
            aria-label="Pose ta question"
            className="calia-glass-soft flex-1 min-w-0 rounded-2xl px-3.5 py-2 text-sm outline-none placeholder:text-white/55 focus:border-[rgba(222,188,104,0.65)] transition-colors"
            style={{ color: "rgba(240,237,232,0.92)" }}
          />
          <GlassIconButton icon={Send} onClick={handleSend} disabled={!input.trim() || typing} color="gold" size="md" aria-label="Envoyer le message" />
        </div>
      )}
    </div>
  );
}

/** Démo interactive d'Calia (page /offres) : seule partie de la section
 * "Calia en vedette" qui a besoin d'être un client component. */
export default function CaliaChatDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="flex flex-col items-center justify-center gap-4"
      style={{ minHeight: 340 }}
    >
      {open ? (
        <CaliaChat onClose={() => setOpen(false)} inline />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div
            className="calia-glass-light backdrop-blur-[32px] backdrop-saturate-[1.4] px-5 py-3 rounded-2xl text-sm text-center"
            style={{ color: "var(--text-muted)" }}
          >
            <span style={{ color: "var(--greek-gold-text)", fontWeight: 600 }}>
              Calia
            </span>{" "}
            est prête à vous aider.
            <br />
            <span
              className="text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Posez une vraie question de maths
            </span>
          </div>
          {/* La même bulle que dans l'espace élève, en plus grand. */}
          <span className="inline-flex transition-transform duration-300 hover:scale-110 hover:-translate-y-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Ouvrir Calia"
              className="liquid-glass-btn calia-glass calia-glass-ring backdrop-blur-[32px] backdrop-saturate-[1.4] relative w-20 h-20 rounded-full flex items-center justify-center"
            >
              <span className="absolute inset-0 rounded-full border-2 border-[var(--greek-gold)] animate-ping opacity-50 pointer-events-none" />
              <Image src="/logoAI.png" alt="" width={44} height={44} style={{ width: 44, height: 44 }} className="object-contain" />
            </button>
          </span>
          <p
            className="text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            Cliquez pour ouvrir le chat
          </p>
        </div>
      )}
    </div>
  );
}
