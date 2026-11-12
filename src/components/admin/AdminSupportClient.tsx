"use client";

import Emblem3D from "@/components/Emblem3D";
import LoaderDots from "@/components/LoaderDots";
import { useState, useEffect, useRef } from "react";
import PageLoader from "@/components/PageLoader";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
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
import { useConfirm } from "@/components/ConfirmDialog";
import GlassButton from "@/components/ui/GlassButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { errMessage } from "@/lib/safeError";

type Ticket = {
  id: number;
  user_id: string;
  user_email: string;
  user_name?: string;
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

/** Tickets support : la liste des tickets actifs arrive déjà chargée du
 * serveur ; basculer sur les archives, ouvrir un ticket, et toutes les
 * mutations (réponse, statut, archivage, suppression) restent des
 * allers-retours client, comme avant. */
export default function AdminSupportClient({ initialTickets }: { initialTickets: Ticket[] }) {
  const confirm = useConfirm();
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [loading, setLoading] = useState(false);
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
  const isFirstRender = useRef(true);


  async function fetchTickets() {
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
  }

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

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

  function showNotification(type: "success" | "error", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }

  const handlePurge = async () => {
    if (
      !(await confirm(
        "Voulez-vous vraiment supprimer définitivement tous les tickets archivés ?"
      ))
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

  const handleReply = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    } catch (error: unknown) {
      showNotification("error", errMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !selectedTicket ||
      !(await confirm(
        "Êtes-vous sûr de vouloir supprimer définitivement ce ticket et ses réponses ?"
      ))
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
    } catch (error: unknown) {
      showNotification("error", errMessage(error));
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
    <div className="space-y-6">
      <AdminPageHeader
        icon={Mail}
        title="Support & Tickets"
        subtitle="Gérez les demandes de support et les tickets utilisateurs"
        actions={
          !selectedTicket && (
            <>
              <GlassSegmentedControl
                size="sm"
                options={[
                  { id: "active", label: (<span className="flex items-center gap-1.5"><Inbox size={16} /> Tickets Actifs</span>) },
                  { id: "archived", label: (<span className="flex items-center gap-1.5"><Archive size={16} /> Archives</span>) },
                ]}
                value={viewMode}
                onChange={(v) => setViewMode(v as "active" | "archived")}
              />

              {viewMode === "archived" && (
                <GlassButton size="sm" variant="danger" disabled={actionLoading} onClick={handlePurge}>
                  <Trash2 size={16} />
                  Purger anciens
                </GlassButton>
              )}
            </>
          )
        }
      />

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
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden min-h-[500px]">
        {loading ? (
          <PageLoader />
        ) : selectedTicket ? (
          // DETAIL VIEW
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-4 border-b border-[rgba(197,161,72,0.25)] flex items-center justify-between bg-gray-50">
              <GlassButton size="sm" variant="ghost" onClick={handleBackToList}>
                <ArrowLeft size={18} /> Retour à la liste
              </GlassButton>
              <div className="flex items-center gap-2">
                {selectedTicket.is_archived ? (
                  <>
                    <GlassButton size="sm" variant="outline" disabled={actionLoading} onClick={() => handleArchive(false)}>
                      <RefreshCcw size={14} /> Restaurer
                    </GlassButton>
                    <GlassButton size="sm" variant="danger" disabled={actionLoading} onClick={handleDelete}>
                      <Trash2 size={14} /> Supprimer
                    </GlassButton>
                  </>
                ) : (
                  <>
                    <GlassButton
                      size="sm"
                      variant="outline"
                      disabled={actionLoading || selectedTicket.status === "Résolu"}
                      onClick={() => handleStatusChange("Résolu")}
                    >
                      <CheckCircle size={14} /> Marquer Résolu
                    </GlassButton>
                    <GlassButton size="sm" variant="ghost" disabled={actionLoading} onClick={() => handleArchive(true)}>
                      <Archive size={14} /> Archiver
                    </GlassButton>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Ticket Info */}
              <div className="bg-white p-6 rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm">
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
                    , { timeZone: "Europe/Paris" })}
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
                      className="bg-gray-50 p-4 rounded-[20px] border border-[rgba(197,161,72,0.25)] ml-8 relative"
                    >
                      <div className="absolute top-4 -left-3 w-6 h-6 bg-[var(--greek-gold)] rounded-full border-4 border-white flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-[var(--greek-blue)]">
                          {reply.admin_name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(reply.replied_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
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
                <div className="mt-8 bg-white p-6 rounded-[20px] border border-[rgba(197,161,72,0.25)] shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Répondre
                  </h3>
                  <form onSubmit={handleReply}>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      aria-label="Réponse au ticket"
                      className="w-full p-4 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent min-h-[150px]"
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
                        &quot;Répondu&quot;.
                      </div>
                      <GlassButton
                        size="sm"
                        variant="navy"
                        disabled={replyLoading || !replyMessage.trim()}
                        onClick={() => handleReply()}
                      >
                        {replyLoading ? (
                          <LoaderDots />
                        ) : (
                          <Send size={18} />
                        )}
                        Envoyer la réponse
                      </GlassButton>
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
              <thead className="bg-gray-50 border-b border-[rgba(197,161,72,0.25)]">
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
                      <Emblem3D kind="inbox" size={72} className="mx-auto mb-3" />
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
                          { timeZone: "Europe/Paris", day: "2-digit", month: "short", year: "numeric" }
                        )}
                        <div className="text-xs text-gray-400">
                          {new Date(ticket.updated_at).toLocaleTimeString(
                            "fr-FR",
                            { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <GlassButton size="sm" variant="ghost" onClick={() => handleTicketClick(ticket)}>
                          Voir
                        </GlassButton>
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
