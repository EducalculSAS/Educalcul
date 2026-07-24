"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MessageCircle, Plus, CheckCircle, Clock, AlertCircle, X, Send, ChevronDown, ChevronUp } from "lucide-react";

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
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);

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

  const handleReply = async (ticketId: number) => {
    const msg = replyText[ticketId]?.trim();
    if (!msg || !userInfo) return;
    setSending(ticketId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSending(null); return; }
    const res = await fetch("/api/parent/support/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ ticketId, message: msg }),
    });
    if (res.ok) { setReplyText(prev => ({ ...prev, [ticketId]: "" })); fetchTickets(userInfo.authId); }
    setSending(null);
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
                        {/* Réponses */}
                        {replies.length > 0 && (
                          <div className="space-y-3">
                            {replies.map((r: any) => (
                              <div key={r.id} className={`flex ${r.is_admin ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-[85%] rounded-xl p-4 ${r.is_admin ? "bg-[var(--greek-blue)]/5 border border-[var(--greek-blue)]/10" : "bg-[var(--greek-blue)] text-white"}`}>
                                  <div className="flex items-center justify-between gap-3 mb-2">
                                    <span className={`text-xs font-bold ${r.is_admin ? "text-[var(--greek-blue)]" : "text-white/80"}`}>{r.is_admin ? (r.admin_name || "Support Educalcul") : "Vous"}</span>
                                    <span className={`text-xs ${r.is_admin ? "text-gray-400" : "text-white/60"}`}>{new Date(r.replied_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                  </div>
                                  <p className={`text-sm whitespace-pre-wrap ${r.is_admin ? "text-gray-700" : "text-white"}`}>{r.reply_message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {replies.length === 0 && (ticket.status === "open" || ticket.status === "Ouvert") && (
                          <p className="text-xs text-gray-400 italic text-center py-2">En attente de réponse de notre équipe...</p>
                        )}

                        {/* Répondre */}
                        {ticket.status !== "Résolu" && ticket.status !== "resolved" && (
                          <div className="flex gap-2 items-end pt-2 border-t border-gray-100">
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
                              <Send className="w-5 h-5" />
                            </button>
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
      </div>
    </div>
  );
}
