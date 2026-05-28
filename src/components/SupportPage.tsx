"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MessageCircle, Plus, CheckCircle, Clock, AlertCircle, X, Send, ChevronDown, ChevronUp, Star, RotateCcw } from "lucide-react";
import Image from "next/image";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  "Ouvert":    { label: "Ouvert",    color: "bg-blue-100 text-blue-700",    icon: Clock },
  "En cours":  { label: "En cours",  color: "bg-orange-100 text-orange-700", icon: AlertCircle },
  "Répondu":   { label: "Répondu",   color: "bg-purple-100 text-purple-700", icon: CheckCircle },
  "Résolu":    { label: "Résolu",    color: "bg-green-100 text-green-700",   icon: CheckCircle },
  // legacy
  open:        { label: "Ouvert",    color: "bg-blue-100 text-blue-700",    icon: Clock },
  in_progress: { label: "En cours",  color: "bg-orange-100 text-orange-700", icon: AlertCircle },
  resolved:    { label: "Résolu",    color: "bg-green-100 text-green-700",   icon: CheckCircle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low:    { label: "Faible",  color: "bg-gray-100 text-gray-600" },
  normal: { label: "Normal",  color: "bg-blue-100 text-blue-700" },
  high:   { label: "Urgent",  color: "bg-red-100 text-red-700" },
};

const inputCls = "w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

// ── Support Chatbot (rule-based, no AI) ──────────────────────────────────────

interface BotMsg { from: "bot" | "user"; text: string }

const BOT_RULES: { patterns: RegExp[]; answer: string }[] = [
  {
    patterns: [/mot.de.passe|oubli|connexion|connect/i],
    answer: "Si vous avez oublié votre mot de passe, rendez-vous sur la page de connexion et cliquez sur « Mot de passe oublié ». Un lien de réinitialisation vous sera envoyé par e-mail.",
  },
  {
    patterns: [/abonnement|tarif|prix|paiement|facture|plan/i],
    answer: "Vous pouvez gérer votre abonnement depuis **Mes paramètres → Abonnement**. Pour toute question de facturation, ouvrez un ticket et notre équipe vous répondra sous 24h.",
  },
  {
    patterns: [/enfant|compte enfant|profil enfant|ajouter/i],
    answer: "Pour ajouter un profil enfant, allez dans **Mes enfants → Ajouter un enfant**. Chaque enfant dispose d'un identifiant unique pour se connecter.",
  },
  {
    patterns: [/exercice|quiz|cours|contenu|module/i],
    answer: "Les exercices, quiz et cours sont accessibles selon votre niveau d'abonnement. Si un contenu n'est pas disponible, vérifiez votre plan dans **Abonnements**.",
  },
  {
    patterns: [/bug|erreur|problème|plante|marche pas|fonctionne pas/i],
    answer: "Désolé pour ce problème ! Essayez d'abord de vider le cache de votre navigateur et de vous reconnecter. Si le problème persiste, ouvrez un ticket ci-dessus — notre équipe le traitera en priorité.",
  },
  {
    patterns: [/badge|récompense|trophée/i],
    answer: "Les badges sont attribués automatiquement selon vos progrès (connexions consécutives, exercices réussis, quiz complétés…). Consultez la page **Mes Trophées** pour les voir tous.",
  },
  {
    patterns: [/supprimer|annuler.*compte|désactiver/i],
    answer: "Pour supprimer ou désactiver votre compte, ouvrez un ticket avec l'objet « Suppression de compte ». Notre équipe traitera votre demande sous 48h.",
  },
  {
    patterns: [/délai|réponse|attente|rapide|urgent/i],
    answer: "Notre équipe répond aux tickets en général sous 24h (jours ouvrés). Pour les demandes urgentes, indiquez la priorité **Urgent** lors de la création du ticket.",
  },
];

const BOT_FALLBACK = "Je n'ai pas de réponse précise à cette question. N'hésitez pas à **ouvrir un ticket** ci-dessus — notre équipe vous répondra rapidement !";

const BOT_WELCOME: BotMsg = {
  from: "bot",
  text: "Bonjour ! Je suis **Athéna**, votre assistante support. Je peux répondre à vos questions fréquentes. Pour un suivi personnalisé, ouvrez un ticket avec le bouton ci-dessus.",
};

function SupportChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BotMsg[]>([BOT_WELCOME]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages, open]);

  const sendMessage = () => {
    const txt = input.trim();
    if (!txt) return;
    const userMsg: BotMsg = { from: "user", text: txt };
    const rule = BOT_RULES.find(r => r.patterns.some(p => p.test(txt)));
    const botMsg: BotMsg = { from: "bot", text: rule ? rule.answer : BOT_FALLBACK };
    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput("");
  };

  const renderBotText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((p, i) => i % 2 === 1 ? <strong key={i} className="font-bold">{p}</strong> : p);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Support Athéna"
        className="fixed bottom-6 right-4 md:right-6 z-50 w-14 h-14 rounded-full shadow-2xl bg-[var(--greek-blue)] hover:bg-blue-800 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:-translate-y-1 group"
      >
        {open ? <X className="w-6 h-6 text-white" /> : (
          <>
            <Star className="w-7 h-7 text-[var(--greek-gold)] fill-current" />
            <span className="absolute bottom-full right-0 mb-3 whitespace-nowrap bg-[var(--greek-blue)] text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest pointer-events-none">
              Aide rapide
            </span>
          </>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-4 md:right-6 z-50 w-[calc(100vw-2rem)] md:w-[350px] max-w-sm bg-white rounded-3xl shadow-2xl border border-[rgba(197,161,72,0.25)] flex flex-col overflow-hidden" style={{ height: 440 }}>
          {/* Header */}
          <div className="bg-[var(--greek-blue)] px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--greek-gold)] flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-[var(--greek-blue)] fill-current" />
              </div>
              <div>
                <p className="font-[family-name:var(--font-display)] font-bold text-white text-sm tracking-wider">ATHÉNA</p>
                <p className="text-white/50 text-[9px] font-black uppercase tracking-widest">Assistante Support</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setMessages([BOT_WELCOME])} className="text-white/50 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-all" title="Réinitialiser">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-white">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
                {msg.from === "bot" && (
                  <div className="w-6 h-6 rounded-lg bg-[var(--greek-gold)] flex items-center justify-center shrink-0 mt-0.5">
                    <Star className="w-3 h-3 text-[var(--greek-blue)] fill-current" />
                  </div>
                )}
                <div className={`max-w-[82%] text-sm px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                  msg.from === "user"
                    ? "bg-[var(--greek-blue)] text-white rounded-br-sm font-medium"
                    : "bg-[var(--greek-cream)] text-gray-700 rounded-bl-sm border border-[rgba(197,161,72,0.2)]"
                }`}>
                  {renderBotText(msg.text)}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {["Mot de passe oublié", "Gérer mon abonnement", "Ajouter un enfant", "Signaler un bug"].map(q => (
                <button key={q} onClick={() => { setInput(q); }}
                  className="text-[10px] bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] hover:border-[var(--greek-gold)] text-[var(--greek-blue)] font-bold px-2.5 py-1 rounded-full transition-all">
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-[rgba(197,161,72,0.15)] shrink-0">
            <div className="flex gap-2 items-center bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] focus-within:border-[var(--greek-gold)] rounded-2xl px-3 py-2 transition-all">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") sendMessage(); }}
                placeholder="Votre question…"
                className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none"
              />
              <button onClick={sendMessage} disabled={!input.trim()} className="w-8 h-8 bg-[var(--greek-blue)] text-white rounded-xl flex items-center justify-center hover:bg-blue-800 disabled:opacity-30 transition-all shrink-0">
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

export default function SupportPage({ role }: { role: "child" | "parent" }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", message: "", priority: "normal" });
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: u } = await supabase.from("users").select("first_name, last_name, email").eq("auth_id", user.id).maybeSingle();
      setUserInfo({ ...u, authId: user.id, email: u?.email || user.email });
      fetchTickets(user.id);
    })();
  }, []);

  const fetchTickets = async (userId: string) => {
    setLoading(true);
    const res = await fetch(`/api/support?userId=${userId}`);
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  };

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInfo) return;
    setSubmitting(true);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: userInfo.authId,
        userEmail: userInfo.email,
        userName: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim(),
        subject: form.subject,
        message: form.message,
        priority: form.priority,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setToast("Ticket envoyé ! Un admin vous répondra bientôt.");
      setTimeout(() => setToast(null), 4000);
      setShowForm(false);
      setForm({ subject: "", message: "", priority: "normal" });
      fetchTickets(userInfo.authId);
    } else {
      setToast(`Erreur : ${data.error || "Envoi impossible"}`);
      setTimeout(() => setToast(null), 5000);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 text-white ${toast.startsWith("Erreur") ? "bg-red-600" : "bg-green-600"}`}>
          <CheckCircle size={16} /> {toast}
        </div>
      )}

      {/* Hero */}
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-12 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="container mx-auto max-w-3xl relative z-10">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <MessageCircle className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            SUPPORT
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest">AIDE</span>
            <span>Contactez notre équipe, nous vous répondons rapidement.</span>
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 space-y-6">

        {/* Nouveau ticket */}
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
            <form onSubmit={submitTicket} className="space-y-4">
              <div>
                <label className={labelCls}>Sujet *</label>
                <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={inputCls} placeholder="Ex : Je n'arrive pas à accéder à mes exercices" required />
              </div>
              <div>
                <label className={labelCls}>Message *</label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} className={inputCls + " h-32 resize-none"} placeholder="Décrivez votre problème en détail..." required />
              </div>
              <div>
                <label className={labelCls}>Priorité</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={inputCls}>
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

        {/* Liste des tickets */}
        <div>
          <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-4">Mes tickets ({tickets.length})</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Chargement...</div>
          ) : tickets.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-10 text-center text-gray-400">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p>Aucun ticket pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(ticket => {
                const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const pr = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.normal;
                const StatusIcon = st.icon;
                const isExpanded = expanded.has(ticket.id);
                const replies = ticket.replies || [];
                return (
                  <div key={ticket.id} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
                    <button onClick={() => setExpanded(prev => { const next = new Set(prev); isExpanded ? next.delete(ticket.id) : next.add(ticket.id); return next; })}
                      className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                            <StatusIcon size={11} />{st.label}
                          </span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pr.color}`}>{pr.label}</span>
                          {replies.length > 0 && <span className="text-xs font-bold text-[var(--greek-blue)] bg-blue-50 px-2 py-0.5 rounded-full">{replies.length} réponse{replies.length > 1 ? "s" : ""}</span>}
                        </div>
                        <p className="font-bold text-gray-800 truncate">{ticket.subject}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(ticket.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0 mt-1" /> : <ChevronDown size={16} className="text-gray-400 shrink-0 mt-1" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-[rgba(197,161,72,0.25)] p-5 space-y-4">
                        {/* Message original */}
                        <div className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Votre message</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.message}</p>
                        </div>
                        {/* Réponses admin */}
                        {replies.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Réponses de l'équipe</p>
                            {replies.map((r: any) => (
                              <div key={r.id} className="bg-[var(--greek-blue)]/5 border border-[var(--greek-blue)]/10 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-[var(--greek-blue)]">{r.admin_name || "Support Educalcul"}</span>
                                  <span className="text-xs text-gray-400">{new Date(r.replied_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.reply_message}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {replies.length === 0 && ticket.status === "open" && (
                          <p className="text-xs text-gray-400 italic text-center py-2">En attente de réponse de notre équipe...</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SupportChatbot />
    </div>
  );
}
