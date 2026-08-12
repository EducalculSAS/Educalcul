"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { Send, RotateCcw, X } from "lucide-react";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

interface BotMsg { from: "bot" | "user"; text: string }

const BOT_WELCOME: BotMsg = { from: "bot", text: "Bonjour ! Je suis **Epsi**, votre assistante d'aide rapide. Posez-moi votre question ou choisissez un sujet ci-dessous." };

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
      <button onClick={() => setOpen((v) => !v)} aria-label="Ouvrir Epsi"
        className="fixed bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-1"
        style={{ background: "#0d1829", border: "1.5px solid rgba(197,161,72,0.45)" }}>
        {open ? <X className="w-6 h-6" style={{ color: "rgba(240,237,232,0.8)" }} /> : (
          <Image src="/logoAI.png" alt="Epsi" width={30} height={30} className="object-contain" />
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[350px] max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: 440, background: "#0d1829", border: "1px solid rgba(197,161,72,0.25)" }}>
          <div className="flex items-center gap-3 px-4 py-3.5 shrink-0" style={{ borderBottom: "1px solid rgba(197,161,72,0.15)", background: "rgba(255,255,255,0.03)" }}>
            <Image src="/logoAI.png" alt="Epsi" width={28} height={28} className="object-contain flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-[family-name:var(--font-display)] font-bold text-sm" style={{ color: "var(--greek-gold)" }}>Epsi</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Assistante IA</p>
            </div>
            <button onClick={() => setMessages([BOT_WELCOME])} className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(255,255,255,0.4)" }} title="Nouvelle conversation" aria-label="Nouvelle conversation">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <GlassCloseButton onClick={() => setOpen(false)} variant="dark" size="sm" aria-label="Fermer le chat" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "none" }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                {msg.from === "bot" && <Image src="/logoAI.png" alt="" width={20} height={20} className="object-contain flex-shrink-0 mt-1" />}
                <div className="max-w-[82%] text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed"
                  style={msg.from === "user"
                    ? { background: "var(--greek-gold)", color: "#fff", borderBottomRightRadius: 4 }
                    : { background: "rgba(255,255,255,0.07)", color: "rgba(240,237,232,0.85)", borderBottomLeftRadius: 4 }}>
                  {renderBotText(msg.text)}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2">
                <Image src="/logoAI.png" alt="" width={20} height={20} className="object-contain flex-shrink-0" />
                <div className="px-3.5 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
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
                <button key={q} onClick={() => sendMessage(q)} className="text-[10px] font-black px-3 py-1.5 rounded-full transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(197,161,72,0.2)", color: "rgba(197,161,72,0.8)" }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="px-3 py-3 shrink-0 flex gap-2" style={{ borderTop: "1px solid rgba(197,161,72,0.15)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              disabled={sending}
              placeholder="Votre question…" aria-label="Votre question" className="flex-1 rounded-xl px-3.5 py-2 text-sm outline-none disabled:opacity-50"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(197,161,72,0.15)", color: "rgba(240,237,232,0.85)" }} />
            <button onClick={() => sendMessage()} disabled={!input.trim() || sending}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ background: "var(--greek-gold)" }}>
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
