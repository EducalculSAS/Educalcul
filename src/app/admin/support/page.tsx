"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Archive,
  CheckCircle,
  Clock,
  MessageSquare,
  AlertCircle,
  Trash2,
  RefreshCcw,
  ArrowLeft,
  Send,
  User,
  Tag,
  Mail,
} from "lucide-react";

type Ticket = {
  id: number;
  user_id: string;
  user_email: string;
  user_name?: string; // Might need to fetch or is it in the ticket? PHP logic implies user info might be joined or stored.
  // Checking PHP: It uses user_id to maybe fetch info?
  // Wait, PHP code: $user_name_for_email = trim($_POST['user_name_for_email'] ?? 'Utilisateur');
  // The ticket table has 'user_email' usually? Or it joins with users table?
  // Let's check the API response or table structure.
  // The PHP code does `SELECT * FROM support_tickets`.
  // I should check if support_tickets has user_name/email.
  // Assuming it does or I'll handle it.
  subject: string;
  message: string;
  status: "Ouvert" | "En cours" | "Répondu" | "Résolu";
  priority: "normal" | "high";
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  archived_at?: string;
};

type TicketReply = {
  id: number;
  ticket_id: number;
  admin_name: string;
  reply_message: string;
  replied_at: string;
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"active" | "archived">("active");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchTickets();
  }, [viewMode]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/support/tickets?view_mode=${viewMode}`
      );
      if (!res.ok) throw new Error("Erreur lors du chargement des tickets");
      const data = await res.json();
      setTickets(data);
    } catch (error: unknown) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur est survenue";
      showNotification("error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`);
      if (!res.ok) throw new Error("Erreur lors du chargement du ticket");
      const data = await res.json();
      setSelectedTicket(data.ticket);
      setReplies(data.replies);
    } catch (error: unknown) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur est survenue";
      showNotification("error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticket: Ticket) => {
    fetchTicketDetails(ticket.id);
  };

  const handleBackToList = () => {
    setSelectedTicket(null);
    setReplies([]);
    fetchTickets(); // Refresh list to update statuses
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handlePurge = async () => {
    if (
      !confirm(
        "Voulez-vous vraiment supprimer définitivement tous les tickets archivés ?"
      )
    )
      return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/support/purge", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur lors de la purge");

      const data = await res.json();
      showNotification(
        "success",
        `Purge terminée : ${data.deletedCount} tickets supprimés.`
      );
      fetchTickets();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur est survenue";
      showNotification("error", errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    setReplyLoading(true);
    try {
      const res = await fetch(
        `/api/admin/support/tickets/${selectedTicket.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: replyMessage,
            user_email: selectedTicket.user_email,
            user_name: selectedTicket.user_name || "Visiteur",
            subject: selectedTicket.subject,
            is_public: !selectedTicket.user_id, // ticket public = pas d'user_id
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi");

      showNotification("success", "Réponse envoyée avec succès");
      setReplyMessage("");
      fetchTicketDetails(selectedTicket.id); // Refresh details
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Une erreur est survenue";
      showNotification("error", errorMessage);
    } finally {
      setReplyLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/support/tickets/${selectedTicket.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "change_status", status: newStatus }),
        }
      );
      if (!res.ok) throw new Error("Erreur lors du changement de statut");

      showNotification("success", `Statut mis à jour : ${newStatus}`);

      // Auto-archive quand "Répondu"
      if (newStatus === "Répondu") {
        await fetch(`/api/admin/support/tickets/${selectedTicket.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        });
        showNotification("success", "Ticket marqué comme répondu et archivé.");
        handleBackToList();
      } else {
        fetchTicketDetails(selectedTicket.id);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      showNotification("error", errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async (archive: boolean) => {
    if (!selectedTicket) return;
    setActionLoading(true);
    try {
      const action = archive ? "archive" : "restore";
      const res = await fetch(
        `/api/admin/support/tickets/${selectedTicket.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (!res.ok)
        throw new Error(
          `Erreur lors de ${archive ? "l'archivage" : "la restauration"}`
        );

      showNotification("success", `Ticket ${archive ? "archivé" : "restauré"}`);
      if (archive) {
        handleBackToList(); // Go back to list as it disappears from active view
      } else {
        fetchTicketDetails(selectedTicket.id);
      }
    } catch (error: any) {
      showNotification("error", error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !selectedTicket ||
      !confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement ce ticket et ses réponses ?"
      )
    )
      return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/admin/support/tickets/${selectedTicket.id}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) throw new Error("Erreur lors de la suppression");

      showNotification("success", "Ticket supprimé définitivement");
      handleBackToList();
    } catch (error: any) {
      showNotification("error", error.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Helpers for UI
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      Ouvert: "bg-red-100 text-red-800 border-red-200",
      "En cours": "bg-yellow-100 text-yellow-800 border-yellow-200",
      Répondu: "bg-blue-100 text-blue-800 border-blue-200",
      Résolu: "bg-green-100 text-green-800 border-green-200",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-semibold border ${
          styles[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === "high") {
      return (
        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200 flex items-center gap-1">
          <AlertCircle size={10} /> Prioritaire
        </span>
      );
    }
    return null;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <Mail className="text-[var(--greek-gold)]" size={32} />
              Support & Tickets
            </h1>
            <p className="text-[var(--greek-bronze)] text-lg">
              Gérez les demandes de support et les tickets utilisateurs
            </p>
          </div>

          {/* Tabs */}
          {!selectedTicket && (
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-50 rounded-xl p-1 border border-[var(--greek-gold)]/20">
                <button
                  onClick={() => setViewMode("active")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === "active"
                      ? "bg-white text-[var(--greek-blue)] shadow-sm border border-[var(--greek-gold)]/15"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Inbox size={16} className="inline mr-2" />
                  Tickets Actifs
                </button>
                <button
                  onClick={() => setViewMode("archived")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    viewMode === "archived"
                      ? "bg-white text-[var(--greek-blue)] shadow-sm border border-[var(--greek-gold)]/15"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Archive size={16} className="inline mr-2" />
                  Archives
                </button>
              </div>

              {viewMode === "archived" && (
                <button
                  onClick={handlePurge}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors text-sm font-medium border border-red-200 flex items-center gap-2 shadow-sm"
                >
                  <Trash2 size={16} />
                  Purger anciens
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={`p-4 rounded-[20px] border flex items-center gap-3 shadow-sm ${
            notification.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {notification.type === "success" ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          {notification.message}
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/20 overflow-hidden min-h-[500px]">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--greek-blue)]"></div>
          </div>
        ) : selectedTicket ? (
          // DETAIL VIEW
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-4 border-b border-[var(--greek-gold)]/15 flex items-center justify-between bg-gray-50">
              <button
                onClick={handleBackToList}
                className="flex items-center text-gray-600 hover:text-[var(--greek-blue)] transition-colors"
              >
                <ArrowLeft size={18} className="mr-2" />
                Retour à la liste
              </button>
              <div className="flex items-center gap-2">
                {selectedTicket.is_archived ? (
                  <>
                    <button
                      onClick={() => handleArchive(false)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium border border-blue-200"
                    >
                      <RefreshCcw size={14} className="inline mr-1" /> Restaurer
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors text-sm font-medium border border-red-200"
                    >
                      <Trash2 size={14} className="inline mr-1" /> Supprimer
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleStatusChange("Résolu")}
                      disabled={
                        actionLoading || selectedTicket.status === "Résolu"
                      }
                      className="px-3 py-1.5 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors text-sm font-medium border border-green-200 disabled:opacity-50"
                    >
                      <CheckCircle size={14} className="inline mr-1" /> Marquer
                      Résolu
                    </button>
                    <button
                      onClick={() => handleArchive(true)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium border border-[var(--greek-gold)]/20"
                    >
                      <Archive size={14} className="inline mr-1" /> Archiver
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Ticket Info */}
              <div className="bg-white p-6 rounded-[20px] border border-[var(--greek-gold)]/20 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {selectedTicket.subject}
                  </h2>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-xl">
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span className="font-semibold">Utilisateur:</span>{" "}
                    {selectedTicket.user_name || "Inconnu"} ({selectedTicket.user_email})
                    {!selectedTicket.user_id && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">Contact public</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span className="font-semibold">Créé le:</span>{" "}
                    {new Date(selectedTicket.created_at).toLocaleString(
                      "fr-FR"
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag size={16} />
                    <span className="font-semibold">ID:</span> #
                    {selectedTicket.id}
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span className="font-semibold">Assigné à:</span>{" "}
                    {selectedTicket.assigned_to || "Non assigné"}
                  </div>
                </div>

                <div className="prose max-w-none text-gray-800 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                  <p className="whitespace-pre-wrap">
                    {selectedTicket.message}
                  </p>
                </div>
              </div>

              {/* Replies */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-[var(--greek-blue)] flex items-center gap-2">
                  <MessageSquare size={18} />
                  Historique de la conversation
                </h3>

                {replies.length === 0 ? (
                  <p className="text-gray-500 italic text-center py-4">
                    Aucune réponse pour le moment.
                  </p>
                ) : (
                  replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="bg-gray-50 p-4 rounded-[20px] border border-[var(--greek-gold)]/15 ml-8 relative"
                    >
                      <div className="absolute top-4 -left-3 w-6 h-6 bg-[var(--greek-gold)] rounded-full border-4 border-white flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-[var(--greek-blue)]">
                          {reply.admin_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(reply.replied_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <div className="text-gray-700 whitespace-pre-wrap">
                        {reply.reply_message}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Form */}
              {!selectedTicket.is_archived && (
                <div className="mt-8 bg-white p-6 rounded-[20px] border border-[var(--greek-gold)]/20 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Répondre
                  </h3>
                  <form onSubmit={handleReply}>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      className="w-full p-4 border border-[var(--greek-gold)]/30 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent min-h-[150px]"
                      placeholder="Écrivez votre réponse ici..."
                      required
                    ></textarea>
                    <div className="mt-4 flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        <span className="font-semibold text-yellow-600">
                          <AlertCircle size={14} className="inline mr-1" />
                          Note:
                        </span>
                        Une réponse marquera automatiquement le ticket comme
                        "Répondu".
                      </div>
                      <button
                        type="submit"
                        disabled={replyLoading || !replyMessage.trim()}
                        className="px-6 py-2 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-900/10"
                      >
                        {replyLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Send size={18} />
                        )}
                        Envoyer la réponse
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : (
          // LIST VIEW
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-[var(--greek-gold)]/20">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Sujet
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      <Inbox size={48} className="mx-auto mb-3 text-gray-300" />
                      Aucun ticket {viewMode === "active"
                        ? "actif"
                        : "archivé"}{" "}
                      trouvé.
                    </td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                      onClick={() => handleTicketClick(ticket)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">
                          {ticket.subject}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          #{ticket.id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-gray-700">
                            {ticket.user_name || "Utilisateur"}
                          </div>
                          {!ticket.user_id && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">Public</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ticket.user_email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(ticket.updated_at).toLocaleDateString(
                          "fr-FR",
                          { day: "2-digit", month: "short", year: "numeric" }
                        )}
                        <div className="text-xs text-gray-400">
                          {new Date(ticket.updated_at).toLocaleTimeString(
                            "fr-FR",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-[var(--greek-blue)] hover:text-blue-800 font-medium text-sm">
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
