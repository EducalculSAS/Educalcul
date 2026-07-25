"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { MessageSquare, Send, Loader2, ChevronDown, ChevronUp, Mail, X, RotateCcw, Plus } from "lucide-react";

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

// ── Support Chatbot (assistant IA réel — Mistral, cf. /api/parent/support-chat) ──
interface BotMsg { from: "bot" | "user"; text: string }

const BOT_WELCOME: BotMsg = { from: "bot", text: "Bonjour ! Je suis **Epsi**, votre assistante d'aide rapide. Posez-moi votre question ou choisissez un sujet ci-dessous." };

function SupportChatbot() {
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
          messages: history.map(m => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { from: "bot", text: data.message || "Désolée, je n'ai pas pu répondre. Notre équipe peut vous aider via un ticket." }]);
    } catch {
      setMessages(prev => [...prev, { from: "bot", text: "Désolée, une erreur est survenue. Notre équipe peut vous aider via un ticket." }]);
    } finally {
      setSending(false);
    }
  };

  const renderBotText = (text: string) => text.split(/\*\*(.*?)\*\*/g).map((p, i) => i % 2 === 1 ? <strong key={i} className="font-black" style={{ color: "var(--greek-gold)" }}>{p}</strong> : p);

  return (
    <>
      {/* ── Floating button — même DA que le tuteur Epsi (enfant) ── */}
      <button onClick={() => setOpen(v => !v)} aria-label="Ouvrir Epsi"
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
            <button onClick={() => setMessages([BOT_WELCOME])} className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(255,255,255,0.4)" }} title="Nouvelle conversation">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg transition-colors" style={{ color: "rgba(255,255,255,0.4)" }} title="Fermer">
              <X className="w-4 h-4" />
            </button>
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
                    {[0, 1, 2].map(j => <span key={j} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "rgba(197,161,72,0.7)", animationDelay: `${j * 150}ms` }} />)}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {["Mot de passe oublié", "Gérer mon abonnement", "Ajouter un enfant", "Signaler un bug"].map(q => (
                <button key={q} onClick={() => sendMessage(q)} className="text-[10px] font-black px-3 py-1.5 rounded-full transition-all"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(197,161,72,0.2)", color: "rgba(197,161,72,0.8)" }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="px-3 py-3 shrink-0 flex gap-2" style={{ borderTop: "1px solid rgba(197,161,72,0.15)" }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
              disabled={sending}
              placeholder="Votre question…" className="flex-1 rounded-xl px-3.5 py-2 text-sm outline-none disabled:opacity-50"
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

// ─────────────────────────────────────────────────────────────────────────────

const inputCls = "w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

export default function ParentSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTicketIds, setOpenTicketIds] = useState<Set<number>>(new Set());
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Nouveau ticket
  const [showForm, setShowForm] = useState(false);
  const [newForm, setNewForm] = useState({ subject: "", message: "", priority: "normal" });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const submitNewTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!session || !user) { setSubmitting(false); return; }
    const { data: profile } = await supabase.from("users").select("first_name, last_name, email").eq("auth_id", user.id).maybeSingle();
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        userEmail: profile?.email || user.email,
        userName: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
        subject: newForm.subject,
        message: newForm.message,
        priority: newForm.priority,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setToast("Ticket envoyé ! Un admin vous répondra bientôt.");
      setShowForm(false);
      setNewForm({ subject: "", message: "", priority: "normal" });
      fetchTickets();
    } else {
      setToast(`Erreur : ${data.error || "Envoi impossible"}`);
    }
    setSubmitting(false);
    setTimeout(() => setToast(null), 4000);
  };

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
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${toast.startsWith("Erreur") ? "bg-red-600" : "bg-green-600"}`}>
          {toast}
        </div>
      )}

      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="max-w-3xl mx-auto relative z-10">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <MessageSquare className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            SUPPORT
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">MES MESSAGES</span>
            <span>Vos échanges avec l'équipe Educalcul</span>
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-12 space-y-6">
        {!showForm ? (
          <button onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--greek-blue)] text-white rounded-2xl font-bold hover:bg-blue-800 transition-colors shadow-sm">
            <Plus size={18} /> Nouveau ticket
          </button>
        ) : (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Nouveau ticket</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={16} /></button>
            </div>
            <form onSubmit={submitNewTicket} className="space-y-4">
              <div>
                <label className={labelCls}>Sujet *</label>
                <input value={newForm.subject} onChange={e => setNewForm({ ...newForm, subject: e.target.value })} className={inputCls} placeholder="Ex : Je n'arrive pas à accéder à mon abonnement" required />
              </div>
              <div>
                <label className={labelCls}>Message *</label>
                <textarea value={newForm.message} onChange={e => setNewForm({ ...newForm, message: e.target.value })} className={inputCls + " h-32 resize-none"} placeholder="Décrivez votre problème en détail..." required />
              </div>
              <div>
                <label className={labelCls}>Priorité</label>
                <select value={newForm.priority} onChange={e => setNewForm({ ...newForm, priority: e.target.value })} className={inputCls}>
                  <option value="low">Faible — pas urgent</option>
                  <option value="normal">Normal</option>
                  <option value="high">Urgent</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-semibold text-sm transition-colors">Annuler</button>
                <button type="submit" disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 bg-[var(--greek-blue)] text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors disabled:opacity-50">
                  {submitting ? "Envoi..." : <><Send size={14} /> Envoyer</>}
                </button>
              </div>
            </form>
          </div>
        )}

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
