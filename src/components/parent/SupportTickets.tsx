"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Send, Loader2, ChevronDown, ChevronUp, Mail, X, Plus } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

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

const inputCls = "w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

/** Liste des tickets + formulaire de création + réponse : mutations pures,
 * isolées en client island. Les tickets initiaux arrivent déjà chargés du
 * serveur. */
export default function SupportTickets({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [openTicketIds, setOpenTicketIds] = useState<Set<number>>(new Set());
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
  };

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
    setOpenTicketIds((prev) => {
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
    if (res.ok) { setReplyText((prev) => ({ ...prev, [ticketId]: "" })); fetchTickets(); }
    setSending(null);
  };

  const statusColor = (s: string) => {
    if (s === "Résolu") return "bg-green-100 text-green-700";
    if (s === "En attente") return "bg-amber-100 text-amber-700";
    return "bg-blue-100 text-blue-700";
  };

  return (
    <>
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[60] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white ${toast.startsWith("Erreur") ? "bg-red-600" : "bg-green-600"}`}>
          {toast}
        </div>
      )}

      {!showForm ? (
        <GlassButton onClick={() => setShowForm(true)} variant="navy" fullWidth>
          <Plus size={18} aria-hidden="true" /> Nouveau ticket
        </GlassButton>
      ) : (
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Nouveau ticket</h2>
            <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" aria-label="Fermer"><X size={16} /></button>
          </div>
          <form onSubmit={submitNewTicket} className="space-y-4">
            <div>
              <label className={labelCls}>Sujet *</label>
              <input value={newForm.subject} onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })} className={inputCls} placeholder="Ex : Je n'arrive pas à accéder à mon abonnement" required />
            </div>
            <div>
              <label className={labelCls}>Message *</label>
              <textarea value={newForm.message} onChange={(e) => setNewForm({ ...newForm, message: e.target.value })} className={inputCls + " h-32 resize-none"} placeholder="Décrivez votre problème en détail..." required />
            </div>
            <div>
              <label className={labelCls}>Priorité</label>
              <select value={newForm.priority} onChange={(e) => setNewForm({ ...newForm, priority: e.target.value })} className={inputCls}>
                <option value="low">Faible — pas urgent</option>
                <option value="normal">Normal</option>
                <option value="high">Urgent</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <GlassButton onClick={() => setShowForm(false)} variant="ghost" size="sm">Annuler</GlassButton>
              <button type="submit" disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 bg-[var(--greek-blue)] text-white rounded-xl font-bold text-sm hover:bg-blue-800 transition-colors disabled:opacity-50">
                {submitting ? "Envoi..." : <><Send size={14} /> Envoyer</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] p-12 text-center shadow-sm">
          <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" aria-hidden="true" />
          <p className="text-gray-400 font-medium">Aucun message pour le moment</p>
          <p className="text-gray-300 text-sm mt-1">L'équipe Educalcul vous contactera ici si besoin</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const isOpen = openTicketIds.has(ticket.id);
            const allReplies = (ticket.replies || []).sort((a, b) => new Date(a.replied_at).getTime() - new Date(b.replied_at).getTime());
            return (
              <div key={ticket.id} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
                <button onClick={() => toggleTicket(ticket.id)} className="w-full px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition-colors text-left">
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

                      {allReplies.map((reply) => (
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
                            onChange={(e) => setReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(ticket.id); } }}
                            placeholder="Votre réponse..."
                            rows={2}
                            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:border-[var(--greek-blue)] bg-white"
                          />
                          <button onClick={() => handleReply(ticket.id)} disabled={sending === ticket.id || !replyText[ticket.id]?.trim()}
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
    </>
  );
}
