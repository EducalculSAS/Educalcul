"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Send, X } from "lucide-react";

type Msg = { from: "user" | "ai" | "cta"; text: string };
type ApiMsg = { role: "user" | "assistant"; content: string };
const INITIAL_MSG: Msg = { from: "ai", text: "Bonjour, je suis EpsiAI. Quel exercice te pose problème aujourd'hui ?" };

// Démo publique, anonyme, sans compte — pas de persistance (ni localStorage
// ni serveur) : la conversation ne vaut que pour la session en cours. Le
// vrai suivi de quota (`limitReached`) reste côté serveur (/api/epsi-demo).
function EpsiChat({ onClose, inline = false }: { onClose: () => void; inline?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  useEffect(() => {
    fetch("/api/epsi-demo").then(r => r.json()).then(data => {
      if (data.limitReached && !limitReached) { setLimitReached(true); setMessages(prev => prev.some(m => m.from === "cta") ? prev : [...prev, { from: "cta", text: "" }]); }
      else if (!data.limitReached && limitReached) { setLimitReached(false); setMessages(prev => prev.filter(m => m.from !== "cta")); }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ApiMsg[]>(messages.filter(m => m.from === "user" || m.from === "ai").map(m => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })));
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || typing || limitReached) return;
    setMessages(prev => [...prev, { from: "user", text: trimmed }]);
    historyRef.current = [...historyRef.current, { role: "user", content: trimmed }];
    setInput(""); setTyping(true);
    try {
      const res = await fetch("/api/epsi-demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: historyRef.current }) });
      const data = await res.json();
      if (res.status === 403) { setMessages(prev => prev.some(m => m.from === "cta") ? prev : [...prev, { from: "cta", text: "" }]); setTyping(false); return; }
      const aiText: string = data.reply || "Je n'ai pas pu te répondre, essaie à nouveau.";
      historyRef.current = [...historyRef.current, { role: "assistant", content: aiText }];
      if (data.limitReached) setLimitReached(true);
      setMessages(prev => { const next: Msg[] = [...prev, { from: "ai" as const, text: aiText }]; if (data.limitReached) next.push({ from: "cta", text: "" }); return next; });
    } catch { setMessages(prev => [...prev, { from: "ai", text: "Une erreur s'est produite. Vérifie ta connexion." }]); }
    finally { setTyping(false); }
  };
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
      style={{ background: "var(--greek-blue)", border: "1px solid rgba(197,161,72,0.25)", width: inline ? "100%" : 340, height: 480 }}>
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "rgba(197,161,72,0.15)", background: "rgba(255,255,255,0.03)" }}>
        <Image src="/logoAI.png" alt="EpsiAI" width={26} height={26} style={{ width: 26, height: 26 }} className="object-contain" />
        <div className="flex-1 min-w-0">
          <p className="font-[family-name:var(--font-display)] font-bold text-sm" style={{ color: "var(--greek-gold)" }}>EpsiAI</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>IA pédagogique · Aperçu</p>
        </div>
        <span className="w-2 h-2 rounded-full animate-pulse mr-1" style={{ background: "#34d399" }} />
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors"><X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.4)" }} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2.5" style={{ scrollbarWidth: "none" }}>
        {messages.filter(m => m.from !== "cta").map((msg, i) => (
          <div key={i} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
            {msg.from === "ai" && <Image src="/logoAI.png" alt="EpsiAI" width={20} height={20} style={{ width: 20, height: 20 }} className="object-contain mr-2 mt-1 flex-shrink-0" />}
            <div className="max-w-[82%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed"
              style={msg.from === "ai" ? { background: "rgba(255,255,255,0.07)", color: "rgba(240,237,232,0.85)", borderBottomLeftRadius: 4 } : { background: "var(--greek-gold)", color: "#fff", borderBottomRightRadius: 4 }}>
              {msg.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex items-center gap-2">
            <Image src="/logoAI.png" alt="" width={20} height={20} style={{ width: 20, height: 20 }} className="object-contain" />
            <div className="px-3.5 py-2.5 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
              <span className="flex gap-1 items-center h-3.5">{[0, 1, 2].map(j => <span key={j} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(197,161,72,0.7)", animationDelay: `${j * 150}ms` }} />)}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {limitReached ? (
        <div className="px-4 py-4 border-t flex-shrink-0 text-center" style={{ borderColor: "rgba(197,161,72,0.15)", background: "rgba(197,161,72,0.05)" }}>
          <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(240,237,232,0.6)" }}>
            Votre enfant veut continuer avec EpsiAI ?<br /><span style={{ color: "rgba(240,237,232,0.8)" }}>Créez un compte gratuit en 2 minutes.</span>
          </p>
          <Link href="/auth/inscription" className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-0.5 font-[family-name:var(--font-display)]" style={{ background: "var(--greek-gold)", color: "#fff" }}>
            Commencer gratuitement <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="px-3 py-3 border-t flex gap-2 flex-shrink-0" style={{ borderColor: "rgba(197,161,72,0.15)" }}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Pose ta question…" aria-label="Pose ta question" className="flex-1 rounded-xl px-3.5 py-2 text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(197,161,72,0.15)", color: "rgba(240,237,232,0.85)" }} />
          <button onClick={handleSend} disabled={!input.trim() || typing}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-40" style={{ background: "var(--greek-gold)" }}>
            <Send className="w-3.5 h-3.5" style={{ color: "#fff" }} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Démo interactive d'EpsiAI (page /offres) : seule partie de la section
 * "EpsiAI en vedette" qui a besoin d'être un client component. */
export default function EpsiChatDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 340 }}>
      {open ? <EpsiChat onClose={() => setOpen(false)} inline /> : (
        <div className="flex flex-col items-center gap-5">
          <div className="px-5 py-3 rounded-2xl text-sm text-center"
            style={{ background: "#fff", border: "1px solid rgba(197,161,72,0.2)", color: "var(--text-muted)" }}>
            <span style={{ color: "var(--greek-gold)", fontWeight: 600 }}>EpsiAI</span> est prête à vous aider.<br />
            <span className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.7 }}>Posez une vraie question de maths</span>
          </div>
          <button onClick={() => setOpen(true)}
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-110 active:scale-95"
            style={{ background: "var(--greek-blue)", border: "2px solid rgba(197,161,72,0.4)", boxShadow: "0 8px 32px rgba(15,30,58,0.25)" }}>
            <Image src="/logoAI.png" alt="EpsiAI" width={44} height={44} style={{ width: 44, height: 44 }} className="object-contain" />
          </button>
          <p className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>Cliquez pour ouvrir le chat</p>
        </div>
      )}
    </div>
  );
}
