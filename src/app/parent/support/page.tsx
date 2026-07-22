"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MessageSquare, Send, Loader2, ChevronDown, ChevronUp, Mail, Star, X, RotateCcw } from "lucide-react";

interface Reply {
  id: number;
  reply_message: string;
  is_admin: boolean;
  author_name: string | null;
  replied_at: string;
}

interface Ticket {
  id: number;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  replies: Reply[];
}

// ── Support Chatbot ───────────────────────────────────────────────────────────
interface BotMsg { from: "bot" | "user"; text: string }

const BOT_RULES: { patterns: RegExp[]; answer: string }[] = [
  { patterns: [/mot.de.passe|oubli|connexion|connect/i], answer: "Si vous avez oublié votre mot de passe, rendez-vous sur la page de connexion et cliquez sur « Mot de passe oublié ». Un lien de réinitialisation vous sera envoyé par e-mail." },
  { patterns: [/abonnement|tarif|prix|paiement|facture|plan/i], answer: "Vous pouvez gérer votre abonnement depuis **Mes paramètres → Abonnement**. Pour toute question de facturation, notre équipe peut vous aider via un ticket." },
  { patterns: [/enfant|compte enfant|profil enfant|ajouter/i], answer: "Pour ajouter un profil enfant, allez dans **Mes enfants → Ajouter un enfant**. Chaque enfant dispose d'un identifiant unique pour se connecter." },
  { patterns: [/exercice|quiz|cours|contenu|module/i], answer: "Les exercices, quiz et cours sont accessibles selon votre niveau d'abonnement. Si un contenu n'est pas disponible, vérifiez votre plan dans **Abonnements**." },
  { patterns: [/bug|erreur|problème|plante|marche pas|fonctionne pas/i], answer: "Désolé pour ce problème ! Essayez d'abord de vider le cache de votre navigateur et de vous reconnecter. Si le problème persiste, l'équipe peut vous aider." },
  { patterns: [/badge|récompense|trophée/i], answer: "Les badges sont attribués automatiquement selon les progrès (connexions consécutives, exercices réussis…). La page **Mes Trophées** les liste tous." },
  { patterns: [/supprimer|annuler.*compte|désactiver/i], answer: "Pour supprimer ou désactiver votre compte, contactez notre équipe avec l'objet « Suppression de compte ». Votre demande sera traitée sous 48h." },
  { patterns: [/délai|réponse|attente|rapide|urgent/i], answer: "Notre équipe répond généralement sous 24h (jours ouvrés). Pour les demandes urgentes, précisez-le dans votre message." },
];

const BOT_FALLBACK = "Je n'ai pas de réponse précise à cette question. Notre équipe sera ravie de vous aider via un message !";

const BOT_WELCOME: BotMsg = { from: "bot", text: "Bonjour ! Je suis **Epsi**, votre assistante support. Posez-moi votre question ou choisissez un sujet ci-dessous." };

function SupportChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BotMsg[]>([BOT_WELCOME]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages, open]);

  const sendMessage = (text?: string) => {
    const txt = (text || input).trim();
    if (!txt) return;
    const rule = BOT_RULES.find(r => r.patterns.some(p => p.test(txt)));
    setMessages(prev => [...prev, { from: "user", text: txt }, { from: "bot", text: rule ? rule.answer : BOT_FALLBACK }]);
    setInput("");
  };

  const renderBotText = (text: string) => text.split(/\*\*(.*?)\*\*/g).map((p, i) => i % 2 === 1 ? <strong key={i} className="font-bold">{p}</strong> : p);

  return (
    <>
      <button onClick={() => setOpen(v => !v)} aria-label="Support Epsi"
        className="fixed bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full shadow-2xl bg-[var(--greek-blue)] hover:bg-blue-800 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-1 group">
        {open ? <X className="w-6 h-6 text-white" /> : (
          <>
            <Star className="w-7 h-7 text-[var(--greek-gold)] fill-current" />
            <span className="absolute bottom-full right-0 mb-3 whitespace-nowrap bg-[var(--greek-blue)] text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none">Aide rapide</span>
          </>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[350px] max-w-sm bg-white rounded-3xl shadow-2xl border border-[rgba(197,161,72,0.25)] flex flex-col overflow-hidden" style={{ height: 440 }}>
          <div className="bg-[var(--greek-blue)] px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--greek-gold)] flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-[var(--greek-blue)] fill-current" />
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] font-bold text-white text-sm tracking-wider">EPSI</p>
                <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">Assistante Support</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setMessages([BOT_WELCOME])} className="text-white/50 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-all"><RotateCcw className="w-3.5 h-3.5" /></button>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-all"><X className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-white">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                {msg.from === "bot" && <div className="w-6 h-6 rounded-lg bg-[var(--greek-gold)] flex items-center justify-center shrink-0 mt-0.5"><Star className="w-3 h-3 text-[var(--greek-blue)] fill-current" /></div>}
                <div className={`max-w-[82%] text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed ${msg.from === "user" ? "bg-[var(--greek-blue)] text-white rounded-br-sm font-medium" : "bg-[var(--greek-cream)] text-gray-700 rounded-bl-sm border border-[rgba(197,161,72,0.2)]"}`}>
                  {renderBotText(msg.text)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {["Mot de passe oublié", "Gérer mon abonnement", "Ajouter un enfant", "Signaler un bug"].map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="text-[10px] bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] hover:border-[var(--greek-gold)] text-[var(--greek-blue)] font-bold px-2.5 py-1 rounded-full transition-all">{q}</button>
              ))}
            </div>
          )}

          <div className="px-4 pb-4 pt-2 border-t border-[rgba(197,161,72,0.15)] shrink-0">
            <div className="flex gap-2 items-center bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] focus-within:border-[var(--greek-gold)] rounded-2xl px-3 py-2 transition-all">
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Votre question…" className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none" />
              <button onClick={() => sendMessage()} disabled={!input.trim()} className="w-8 h-8 bg-[var(--greek-blue)] text-white rounded-xl flex items-center justify-center hover:bg-blue-800 disabled:opacity-30 transition-all shrink-0">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ParentSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTicketIds, setOpenTicketIds] = useState<Set<number>>(new Set());
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchTickets = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch("/api/parent/support/tickets", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const toggleTicket = (id: number) => {
    setOpenTicketIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleReply = async (ticketId: number) => {
    const msg = replyText[ticketId]?.trim();
    if (!msg) return;
    setSending(ticketId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSending(null); return; }
    const res = await fetch("/api/parent/support/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ticketId, message: msg }),
    });
    if (res.ok) { setReplyText(prev => ({ ...prev, [ticketId]: "" })); fetchTickets(); }
    setSending(null);
  };

  const statusColor = (s: string) => {
    if (s === "Résolu") return "bg-green-100 text-green-700";
    if (s === "En attente") return "bg-amber-100 text-amber-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="max-w-3xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <MessageSquare className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            MES MESSAGES
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">SUPPORT</span>
            <span>Vos échanges avec l'équipe Educalcul</span>
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" /></div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-12 text-center shadow-sm">
            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400 font-medium">Aucun message pour le moment</p>
            <p className="text-gray-300 text-sm mt-1">L'équipe Educalcul vous contactera ici si besoin</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map(ticket => {
              const isOpen = openTicketIds.has(ticket.id);
              const allReplies = (ticket.replies || []).sort((a, b) =>
                new Date(a.replied_at).getTime() - new Date(b.replied_at).getTime()
              );
              return (
                <div key={ticket.id} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
                  <button onClick={() => toggleTicket(ticket.id)}
                    className="w-full px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-bold text-[var(--greek-blue)] truncate">{ticket.subject}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColor(ticket.status)}`}>{ticket.status}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {allReplies.length > 0
                          ? `${allReplies.length} message${allReplies.length > 1 ? "s" : ""} · ${new Date(ticket.updated_at).toLocaleDateString("fr-FR")}`
                          : `Ouvert le ${new Date(ticket.created_at).toLocaleDateString("fr-FR")}`}
                      </p>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0 ml-3" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0 ml-3" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100">
                      <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
                        <div className="flex justify-start">
                          <div className="max-w-[80%] bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-2xl rounded-tl-sm px-4 py-3">
                            <p className="text-xs font-semibold text-[var(--greek-gold)] mb-1">Equipe Educalcul</p>
                            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                              {ticket.message.replace("[Message de l'équipe Educalcul]\n\n", "")}
                            </p>
                            <p className="text-xs text-gray-400 mt-1.5">
                              {new Date(ticket.created_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>

                        {allReplies.map(reply => (
                          <div key={reply.id} className={`flex ${reply.is_admin ? "justify-start" : "justify-end"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${reply.is_admin ? "bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-tl-sm" : "bg-[var(--greek-blue)] text-white rounded-tr-sm"}`}>
                              {reply.is_admin && <p className="text-xs font-semibold text-[var(--greek-gold)] mb-1">{reply.author_name || "Equipe Educalcul"}</p>}
                              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${reply.is_admin ? "text-gray-700" : "text-white"}`}>{reply.reply_message}</p>
                              <p className={`text-xs mt-1.5 ${reply.is_admin ? "text-gray-400" : "text-white/50 text-right"}`}>
                                {new Date(reply.replied_at).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={bottomRef} />
                      </div>

                      {ticket.status !== "Résolu" ? (
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                          <div className="flex gap-3 items-end">
                            <textarea
                              value={replyText[ticket.id] || ""}
                              onChange={e => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(ticket.id); } }}
                              placeholder="Votre réponse..."
                              rows={2}
                              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:border-[var(--greek-blue)] bg-white"
                            />
                            <button onClick={() => handleReply(ticket.id)}
                              disabled={sending === ticket.id || !replyText[ticket.id]?.trim()}
                              className="p-3 bg-[var(--greek-blue)] text-white rounded-xl hover:opacity-90 disabled:opacity-40 shrink-0">
                              {sending === ticket.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="px-6 py-3 bg-green-50 border-t border-green-100 text-center text-sm text-green-600 font-medium">
                          Ticket résolu
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SupportChatbot />
    </div>
  );
}
