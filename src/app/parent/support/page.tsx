"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { MessageSquare, Send, Loader2, ChevronDown, ChevronUp, Mail } from "lucide-react";

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

export default function ParentSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTicketId, setOpenTicketId] = useState<number | null>(null);
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

  useEffect(() => {
    if (openTicketId) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [openTicketId, tickets]);

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
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-10 px-4 rounded-b-[40px] shadow-lg mb-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-[family-name:var(--font-display)] font-bold flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-[var(--greek-gold)]" />
            Mes messages
          </h1>
          <p className="mt-2 opacity-75 text-sm">Vos échanges avec l'équipe Educalcul</p>
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
              const isOpen = openTicketId === ticket.id;
              const allReplies = (ticket.replies || []).sort((a, b) =>
                new Date(a.replied_at).getTime() - new Date(b.replied_at).getTime()
              );
              return (
                <div key={ticket.id} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpenTicketId(isOpen ? null : ticket.id)}
                    className="w-full px-6 py-4 flex items-start justify-between hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-bold text-[var(--greek-blue)] truncate">{ticket.subject}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
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
                        {/* Message initial admin */}
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
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              reply.is_admin
                                ? "bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] rounded-tl-sm"
                                : "bg-[var(--greek-blue)] text-white rounded-tr-sm"
                            }`}>
                              {reply.is_admin && <p className="text-xs font-semibold text-[var(--greek-gold)] mb-1">{reply.author_name || "Equipe Educalcul"}</p>}
                              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${reply.is_admin ? "text-gray-700" : "text-white"}`}>
                                {reply.reply_message}
                              </p>
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
    </div>
  );
}
