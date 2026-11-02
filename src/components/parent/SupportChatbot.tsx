"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Send, RotateCcw, X } from "lucide-react";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassButton from "@/components/ui/GlassButton";

interface BotMsg { from: "bot" | "user"; text: string }

const BOT_WELCOME: BotMsg = { from: "bot", text: "Bonjour ! Je suis **Calia**, votre assistante d'aide rapide. Posez-moi votre question ou choisissez un sujet ci-dessous." };

/** Chatbot flottant d'aide rapide (IA Mistral) : autonome, sans dépendance
 * aux données de la page. */
export default function SupportChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BotMsg[]>([BOT_WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages, open]);

  const sendMessage = async (text?: string) => {
    const txt = (text || input).trim();
    if (!txt || sending) return;
    const history = [...messages, { from: "user" as const, text: txt }];
    setMessages(history);
    setInput("");
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/parent/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { from: "bot", text: data.message || "Désolée, je n'ai pas pu répondre. Notre équipe peut vous aider via un ticket." }]);
    } catch {
      setMessages((prev) => [...prev, { from: "bot", text: "Désolée, une erreur est survenue. Notre équipe peut vous aider via un ticket." }]);
    } finally {
      setSending(false);
    }
  };

  const renderBotText = (text: string) => text.split(/\*\*(.*?)\*\*/g).map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-black" style={{ color: "var(--greek-gold)" }}>{p}</strong> : p));

  return (
    <>
      {/* Zoom sur l'enveloppe, verre (flou) sur le bouton : Safari coupe le flou d'un élément dont le transform change. */}
      <span className="fixed bottom-6 right-4 md:right-6 z-50 transition-all duration-300 hover:scale-110 hover:-translate-y-1">
        <button onClick={() => setOpen((v) => !v)} aria-label="Ouvrir Calia"
          className="liquid-glass-btn calia-glass calia-glass-ring backdrop-blur-[32px] backdrop-saturate-[1.4] w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center">
          {open ? <X className="w-6 h-6" style={{ color: "rgba(240,237,232,0.85)" }} /> : (
            <Image src="/logoAI.png" alt="Calia" width={30} height={30} className="object-contain w-6 h-6 md:w-[30px] md:h-[30px]" />
          )}
        </button>
      </span>

      {open && (
        <div className="calia-glass backdrop-blur-[32px] backdrop-saturate-[1.4] fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[350px] max-w-sm rounded-3xl flex flex-col overflow-hidden"
          style={{ height: "min(440px, calc(100dvh - 8rem))" }}>
          <div className="flex items-center gap-3 px-4 py-3.5 shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)" }}>
            <Image src="/logoAI.png" alt="Calia" width={28} height={28} className="object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-[family-name:var(--font-display)] font-bold text-sm" style={{ color: "var(--greek-gold)" }}>Calia</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>Assistante IA</p>
            </div>
            <GlassIconButton icon={RotateCcw} onClick={() => setMessages([BOT_WELCOME])} color="white" size="sm" aria-label="Nouvelle conversation" />
            <GlassCloseButton onClick={() => setOpen(false)} variant="dark" size="sm" aria-label="Fermer le chat" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                {msg.from === "bot" && <Image src="/logoAI.png" alt="" width={20} height={20} className="object-contain flex-shrink-0 mt-1" />}
                <div className={`max-w-[82%] text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed ${msg.from === "user" ? "calia-glass-gold" : "calia-glass-soft"}`}
                  style={msg.from === "user"
                    ? { color: "var(--greek-blue)", borderBottomRightRadius: 4 }
                    : { color: "rgba(240,237,232,0.9)", borderBottomLeftRadius: 4 }}>
                  {renderBotText(msg.text)}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2">
                <Image src="/logoAI.png" alt="" width={20} height={20} className="object-contain flex-shrink-0" />
                <div className="calia-glass-soft px-3.5 py-2.5 rounded-2xl">
                  <span className="flex gap-1 items-center h-3.5">
                    {[0, 1, 2].map((j) => <span key={j} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(197,161,72,0.7)", animationDelay: `${j * 150}ms` }} />)}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {["Mot de passe oublié", "Gérer mon abonnement", "Ajouter un enfant", "Signaler un bug"].map((q) => (
                <GlassButton key={q} onClick={() => sendMessage(q)} variant="light" size="sm" className="text-[10px] font-black">
                  {q}
                </GlassButton>
              ))}
            </div>
          )}

          <div className="px-3 py-3 shrink-0 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              disabled={sending}
              placeholder="Votre question…" aria-label="Votre question" className="calia-glass-soft flex-1 min-w-0 rounded-2xl px-3.5 py-2 text-sm outline-none disabled:opacity-50 placeholder:text-white/55 focus:border-[rgba(222,188,104,0.65)] transition-colors"
              style={{ color: "rgba(240,237,232,0.92)" }} />
            <GlassIconButton icon={Send} onClick={() => sendMessage()} disabled={!input.trim() || sending} color="gold" aria-label="Envoyer" />
          </div>
        </div>
      )}
    </>
  );
}
