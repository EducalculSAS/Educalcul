"use client";

import type { LucideIcon } from "lucide-react";
import PageHero from "@/components/PageHero";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";
import { MessageCircle, Plus, CheckCircle, Clock, AlertCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useAITutor } from "@/contexts/AITutorContext";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";

/** Réponse à un ticket (de l'équipe ou de l'utilisateur). */
interface SupportReply { id: number | string; is_admin?: boolean; admin_name?: string; color?: string; label?: string; replied_at?: string | null; reply_message?: string }
/** Ticket renvoyé par /api/support. */
interface SupportTicket { id: number; subject: string; message: string; priority?: string; status: string; created_at: string; replies?: SupportReply[] }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
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
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", message: "", priority: "normal" });
  const [userInfo, setUserInfo] = useState<{ authId: string; email?: string; first_name?: string; last_name?: string } | null>(null);
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);
  const { setPageContext, clearContext } = useAITutor();

  // Bascule le widget Calia global (bas droite) en "mode support" — plus de
  // tuteur maths, mêmes limites/textes que le bot support parent — uniquement
  // pendant qu'on est sur cette page.
  useEffect(() => {
    if (role !== "child") return;
    setPageContext({ page: "support" });
    return () => clearContext();
  }, [role, setPageContext, clearContext]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const u = await getMyProfile<{ first_name?: string; last_name?: string; email?: string }>();
      setUserInfo({ ...u, authId: user.id, email: u?.email || user.email });
      fetchTickets(user.id);
    })();
  }, []);

  async function fetchTickets(userId: string) {
    setLoading(true);
    const res = await fetch(`/api/support?userId=${userId}`);
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  }

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
      <PageHero
        icon={MessageCircle}
        title="Support"
        badge="Aide"
        subtitle={role === "child" ? "Écris à l'équipe, on te répond rapidement." : "Contactez notre équipe, nous vous répondons rapidement."}
        width="4xl"
      />

      <div className="container mx-auto max-w-3xl px-4 space-y-6">

        {/* Nouveau ticket */}
        {!showForm ? (
          <GlassButton onClick={() => setShowForm(true)} variant="navy" fullWidth className="font-bold">
            <Plus size={18} /> Nouveau ticket
          </GlassButton>
        ) : (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Nouveau ticket</h2>
              <GlassCloseButton onClick={() => setShowForm(false)} variant="light" size="sm" />
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
                  <option value="low">Faible, pas urgent</option>
                  <option value="normal">Normal</option>
                  <option value="high">Urgent</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <GlassButton onClick={() => setShowForm(false)} variant="ghost" size="sm">Annuler</GlassButton>
                <GlassButton
                  type="submit"
                  variant="navy"
                  size="sm"
                  disabled={submitting}
                >
                  {submitting ? "Envoi..." : <><Send size={14} /> Envoyer</>}
                </GlassButton>
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
                const pr = PRIORITY_CONFIG[ticket.priority ?? "normal"] || PRIORITY_CONFIG.normal;
                const StatusIcon = st.icon;
                const isExpanded = expanded.has(ticket.id);
                const replies = ticket.replies || [];
                return (
                  <div key={ticket.id} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
                    <button onClick={() => setExpanded(prev => { const next = new Set(prev); if (isExpanded) next.delete(ticket.id); else next.add(ticket.id); return next; })}
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
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(ticket.created_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" })}</p>
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
                            {replies.map((r) => (
                              <div key={r.id} className={`flex ${r.is_admin ? "justify-start" : "justify-end"}`}>
                                <div className={`max-w-[85%] rounded-xl p-4 ${r.is_admin ? "bg-[var(--greek-blue)]/5 border border-[var(--greek-blue)]/10" : "bg-[var(--greek-blue)] text-white"}`}>
                                  <div className="flex items-center justify-between gap-3 mb-2">
                                    <span className={`text-xs font-bold ${r.is_admin ? "text-[var(--greek-blue)]" : "text-white/80"}`}>{r.is_admin ? (r.admin_name || "Support Educalcul") : "Vous"}</span>
                                    <span className={`text-xs ${r.is_admin ? "text-gray-400" : "text-white/60"}`}>{(r.replied_at ? new Date(r.replied_at) : new Date()).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
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
                            <GlassIconButton
                              icon={Send}
                              onClick={() => handleReply(ticket.id)}
                              disabled={!replyText[ticket.id]?.trim()}
                              loading={sending === ticket.id}
                              color="navy"
                              aria-label="Envoyer la réponse"
                            />
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
