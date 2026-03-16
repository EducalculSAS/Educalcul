"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Search,
  Filter,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageCircle,
  Clock,
  User,
  Lock,
  Unlock,
  Pin,
  Ban,
  Plus,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";

interface ForumPost {
  id: number;
  content: string;
  user_id?: number;
  user_email: string;
  created_at: string;
}

interface ForumTopic {
  id: number;
  title: string;
  content: string;
  category: string;
  user_id?: number;
  user_email: string; // Joined from users table
  created_at: string;
  posts_count: number;
  posts?: ForumPost[];
  is_pinned?: boolean;
  is_locked?: boolean;
}

export default function AdminForumPage() {
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<ForumTopic | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // New Topic State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTopic, setNewTopic] = useState({
    title: "",
    content: "",
    category: "Général",
    is_pinned: false,
    is_locked: false,
  });

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/forum/topics");
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to fetch topics");
      }
      const data = await res.json();
      setTopics(data);
    } catch (error: any) {
      console.error(error);
      showNotification("error", `Erreur: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = async (topic: ForumTopic) => {
    setSelectedTopic(topic);
    try {
      const res = await fetch(`/api/admin/forum/topics/${topic.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTopic(data);
      }
    } catch (error) {
      console.error("Failed to fetch topic details", error);
    }
  };

  const handleDeleteTopic = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce sujet ?")) return;

    try {
      const res = await fetch(`/api/admin/forum/topics/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete topic");

      setTopics(topics.filter((t) => t.id !== id));
      if (selectedTopic?.id === id) setSelectedTopic(null);
      showNotification("success", "Sujet supprimé avec succès");
    } catch (error) {
      console.error(error);
      showNotification("error", "Erreur lors de la suppression");
    }
  };

  const handleBanUser = async (userId: number, email: string) => {
    const reason = prompt(
      `Voulez-vous vraiment bannir l'utilisateur ${email} ?\nMotif du bannissement :`
    );
    if (reason === null) return; // Cancelled

    try {
      const { error } = await supabase
        .from("users")
        .update({
          is_banned: true,
          banned_at: new Date().toISOString(),
          banned_reason: reason || "Non spécifié",
        })
        .eq("id", userId);

      if (error) throw error;
      showNotification("success", `Utilisateur ${email} banni avec succès.`);
    } catch (error: any) {
      console.error("Error banning user:", error);
      showNotification(
        "error",
        "Erreur lors du bannissement de l'utilisateur."
      );
    }
  };

  const handleTogglePin = async (topic: ForumTopic) => {
    try {
      const { error } = await supabase
        .from("forum_topics")
        .update({ is_pinned: !topic.is_pinned })
        .eq("id", topic.id);

      if (error) throw error;

      const updatedTopic = { ...topic, is_pinned: !topic.is_pinned };
      setTopics(topics.map((t) => (t.id === topic.id ? updatedTopic : t)));
      if (selectedTopic?.id === topic.id) setSelectedTopic(updatedTopic);
      showNotification(
        "success",
        `Sujet ${updatedTopic.is_pinned ? "épinglé" : "désépinglé"}`
      );
    } catch (error: any) {
      console.error(error);
      showNotification("error", "Erreur lors de la modification");
    }
  };

  const handleToggleLock = async (topic: ForumTopic) => {
    try {
      const { error } = await supabase
        .from("forum_topics")
        .update({ is_locked: !topic.is_locked })
        .eq("id", topic.id);

      if (error) throw error;

      const updatedTopic = { ...topic, is_locked: !topic.is_locked };
      setTopics(topics.map((t) => (t.id === topic.id ? updatedTopic : t)));
      if (selectedTopic?.id === topic.id) setSelectedTopic(updatedTopic);
      showNotification(
        "success",
        `Sujet ${updatedTopic.is_locked ? "verrouillé" : "déverrouillé"}`
      );
    } catch (error: any) {
      console.error(error);
      showNotification("error", "Erreur lors de la modification");
    }
  };

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const res = await fetch("/api/admin/forum/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTopic.title,
          content: newTopic.content,
          category: newTopic.category,
          is_pinned: newTopic.is_pinned,
          is_locked: newTopic.is_locked,
          user_auth_id: user?.id,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create topic");
      }

      const data = await res.json();

      // Add to list (needs formatting to match ForumTopic interface)
      const formattedTopic: ForumTopic = {
        ...data,
        user_email: user?.email || "Admin",
        category: newTopic.category,
        posts_count: 1,
        content: newTopic.content,
      };

      setTopics([formattedTopic, ...topics]);
      setIsCreateModalOpen(false);
      setNewTopic({
        title: "",
        content: "",
        category: "Général",
        is_pinned: false,
        is_locked: false,
      });
      showNotification("success", "Sujet créé avec succès");
    } catch (error: any) {
      console.error(error);
      showNotification("error", `Erreur: ${error.message}`);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopic || !replyMessage.trim()) return;

    setReplyLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const res = await fetch(
        `/api/admin/forum/topics/${selectedTopic.id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: replyMessage,
            user_id: user?.id,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to post reply");

      setReplyMessage("");
      showNotification("success", "Réponse envoyée avec succès");

      // Refresh details to see new post
      const detailRes = await fetch(
        `/api/admin/forum/topics/${selectedTopic.id}`
      );
      if (detailRes.ok) {
        const data = await detailRes.json();
        setSelectedTopic(data);

        // Also update the list count if needed (optional)
        setTopics((prev) =>
          prev.map((t) =>
            t.id === selectedTopic.id
              ? { ...t, posts_count: t.posts_count + 1 }
              : t
          )
        );
      }
    } catch (error) {
      console.error(error);
      showNotification("error", "Erreur lors de l'envoi de la réponse");
    } finally {
      setReplyLoading(false);
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const filteredTopics = topics.filter(
    (topic) =>
      topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      topic.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="flex justify-between items-start relative z-10">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <MessageSquare className="text-[var(--greek-gold)]" size={32} />
              Gestion du Forum
            </h1>
            <p className="text-[var(--greek-bronze)] text-lg">
              Modérez les discussions, bannissez les utilisateurs et gérez les
              sujets.
            </p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--greek-blue)] text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm font-medium"
          >
            <Plus size={20} />
            Nouveau Sujet
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-slide-up ${
            notification.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Topics List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Rechercher un sujet..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 shadow-sm"
            />
          </div>

          <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  Chargement...
                </div>
              ) : filteredTopics.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  Aucun sujet trouvé
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredTopics.map((topic) => (
                    <div
                      key={topic.id}
                      onClick={() => handleTopicSelect(topic)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedTopic?.id === topic.id
                          ? "bg-blue-50 border-l-4 border-[var(--greek-blue)]"
                          : ""
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-gray-800 line-clamp-1 flex-1">
                          {topic.title}
                        </h3>
                        <div className="flex gap-1">
                          {topic.is_pinned && (
                            <Pin
                              size={14}
                              className="text-[var(--greek-gold)]"
                            />
                          )}
                          {topic.is_locked && (
                            <Lock size={14} className="text-red-400" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-2">
                        {topic.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {topic.user_email || "Anonyme"}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={12} />
                          {topic.posts_count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Topic Detail & Reply */}
        <div className="lg:col-span-2">
          {selectedTopic ? (
            <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[700px]">
              {/* Topic Header */}
              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-2">
                    {selectedTopic.title}
                    {selectedTopic.is_pinned && (
                      <Pin size={20} className="text-[var(--greek-gold)]" />
                    )}
                    {selectedTopic.is_locked && (
                      <Lock size={20} className="text-red-400" />
                    )}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTogglePin(selectedTopic)}
                      className={`p-2 rounded-lg transition-colors ${
                        selectedTopic.is_pinned
                          ? "bg-yellow-100 text-yellow-600"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                      title={
                        selectedTopic.is_pinned ? "Désépingler" : "Épingler"
                      }
                    >
                      <Pin size={20} />
                    </button>
                    <button
                      onClick={() => handleToggleLock(selectedTopic)}
                      className={`p-2 rounded-lg transition-colors ${
                        selectedTopic.is_locked
                          ? "bg-red-100 text-red-600"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                      title={
                        selectedTopic.is_locked
                          ? "Déverrouiller"
                          : "Verrouiller"
                      }
                    >
                      {selectedTopic.is_locked ? (
                        <Lock size={20} />
                      ) : (
                        <Unlock size={20} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteTopic(selectedTopic.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer le sujet"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                  <span className="flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-gray-200">
                    <User size={14} /> {selectedTopic.user_email}
                    {selectedTopic.user_id && (
                      <button
                        onClick={() =>
                          handleBanUser(
                            selectedTopic.user_id!,
                            selectedTopic.user_email
                          )
                        }
                        className="ml-2 text-red-500 hover:text-red-700"
                        title="Bannir l'utilisateur"
                      >
                        <Ban size={14} />
                      </button>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {new Date(selectedTopic.created_at).toLocaleString(
                      "fr-FR",
                      {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {selectedTopic.category || "Général"}
                  </span>
                </div>
              </div>

              {/* Original Post Content */}
              <div className="p-6 border-b border-gray-100 overflow-y-auto flex-1">
                <div className="prose max-w-none text-gray-700">
                  <p>{selectedTopic.content}</p>
                </div>

                {/* Replies List */}
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
                    Réponses
                  </h3>
                  {selectedTopic.posts && selectedTopic.posts.length > 0 ? (
                    <div className="space-y-6">
                      {selectedTopic.posts.map((post) => (
                        <div
                          key={post.id}
                          className="bg-gray-50 rounded-xl p-4 border border-gray-100"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-bold text-sm text-[var(--greek-blue)] flex items-center gap-2">
                              <User size={14} />
                              {post.user_email === "Admin"
                                ? "Administrateur"
                                : post.user_email}
                              {post.user_id && (
                                <button
                                  onClick={() =>
                                    handleBanUser(
                                      post.user_id!,
                                      post.user_email
                                    )
                                  }
                                  className="ml-2 text-red-500 hover:text-red-700"
                                  title="Bannir l'utilisateur"
                                >
                                  <Ban size={14} />
                                </button>
                              )}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(post.created_at).toLocaleString(
                                "fr-FR",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </div>
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">
                            {post.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 italic py-4">
                      Aucune réponse pour le moment.
                    </div>
                  )}
                </div>
              </div>

              {/* Reply Box */}
              <div className="p-6 bg-gray-50 border-t border-gray-100">
                <form onSubmit={handleReply}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Répondre en tant qu'administrateur
                    </label>
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Votre réponse..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 min-h-[100px] resize-none"
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={replyLoading}
                      className="px-6 py-2 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
                    >
                      {replyLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Envoi...
                        </>
                      ) : (
                        <>
                          <MessageSquare size={18} />
                          Répondre
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[20px] shadow-sm border border-gray-100 h-[400px] flex flex-col items-center justify-center text-gray-400">
              <MessageSquare size={48} className="mb-4 opacity-20" />
              <p>Sélectionnez un sujet pour voir les détails</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Topic Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--greek-blue)]">
                Nouveau Sujet
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleCreateTopic} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre
                </label>
                <input
                  type="text"
                  required
                  value={newTopic.title}
                  onChange={(e) =>
                    setNewTopic({ ...newTopic, title: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={newTopic.category}
                  onChange={(e) =>
                    setNewTopic({ ...newTopic, category: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                >
                  <option value="Général">Général</option>
                  <option value="Entraide">Entraide</option>
                  <option value="Annonces">Annonces</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenu
                </label>
                <textarea
                  required
                  value={newTopic.content}
                  onChange={(e) =>
                    setNewTopic({ ...newTopic, content: e.target.value })
                  }
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20 resize-none"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTopic.is_pinned}
                    onChange={(e) =>
                      setNewTopic({ ...newTopic, is_pinned: e.target.checked })
                    }
                    className="rounded text-[var(--greek-blue)] focus:ring-[var(--greek-blue)]"
                  />
                  <span className="text-sm text-gray-700">Épingler</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newTopic.is_locked}
                    onChange={(e) =>
                      setNewTopic({ ...newTopic, is_locked: e.target.checked })
                    }
                    className="rounded text-[var(--greek-blue)] focus:ring-[var(--greek-blue)]"
                  />
                  <span className="text-sm text-gray-700">Verrouiller</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
