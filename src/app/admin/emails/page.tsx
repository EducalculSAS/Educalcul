"use client";

import { useState, useEffect } from "react";
import PageLoader from "@/components/PageLoader";
import {
  Mail, Plus, Edit2, Trash2, Eye, Send, Loader2,
  CheckCircle, AlertCircle, Lock, Clock, Users, Calendar, X,
} from "lucide-react";
import { buildEmailHtml } from "@/lib/emailTemplates";
import { useConfirm } from "@/components/ConfirmDialog";

interface EmailTemplate {
  id: number;
  name: string;
  type: "system" | "campaign";
  key: string | null;
  subject: string;
  body: string;
  target: string;
  schedule: string | null;
  is_deletable: boolean;
  last_sent_at: string | null;
  sent_count: number;
}

interface SiteUser {
  id: number;
  auth_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

const TARGET_LABELS: Record<string, string> = {
  all: "Tous les parents",
  notif_weekly_reports: "Rapports hebdomadaires",
  notif_offers_news: "Offres et nouveautés",
  triggered: "Automatique",
  specific_user: "Utilisateur spécifique",
  custom_email: "Adresse personnalisée",
};

const SCHEDULE_OPTIONS = [
  { value: "", label: "Envoi manuel uniquement" },
  { value: "weekly", label: "Chaque semaine (lundi)" },
  { value: "monthly", label: "Chaque mois (1er)" },
];

export default function AdminEmailsPage() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [previewTmpl, setPreviewTmpl] = useState<EmailTemplate | null>(null);
  const [previewTab, setPreviewTab] = useState<"visual" | "html">("visual");
  const [editTmpl, setEditTmpl] = useState<EmailTemplate | null>(null);
  const [editTab, setEditTab] = useState<"content" | "html">("content");
  const [sendTmpl, setSendTmpl] = useState<EmailTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [siteUsers, setSiteUsers] = useState<SiteUser[]>([]);
  const [userSearch, setUserSearch] = useState("");

  // Forms
  const [editForm, setEditForm] = useState({ name: "", subject: "", body: "", target: "all", schedule: "" });
  const [sendForm, setSendForm] = useState({ target: "all", specificEmail: "", selectedUserId: "" });
  const [newForm, setNewForm] = useState({ name: "", subject: "", body: "", target: "all", schedule: "", specificEmail: "", selectedUserId: "" });

  // States
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchTemplates = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/email-templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
    fetch("/api/admin/users-list").then(r => r.json()).then(data => setSiteUsers(data || [])).catch(() => {});
  }, []);

  const handleEdit = (tmpl: EmailTemplate) => {
    setEditTmpl(tmpl);
    setEditTab("content");
    setEditForm({ name: tmpl.name, subject: tmpl.subject, body: tmpl.body, target: tmpl.target, schedule: tmpl.schedule || "" });
  };

  const handleSave = async () => {
    if (!editTmpl) return;
    setSaving(true);
    const res = await fetch("/api/admin/email-templates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editTmpl.id, ...editForm }),
    });
    setSaving(false);
    if (res.ok) { showToast("Template mis à jour"); setEditTmpl(null); fetchTemplates(); }
    else showToast("Erreur lors de la sauvegarde", false);
  };

  const handleCreate = async () => {
    setSaving(true);

    const isPersonal = newForm.target === "specific_user" || newForm.target === "custom_email";

    if (isPersonal) {
      // Mail perso → compose (ticket support) sans créer de template
      let toEmail = newForm.specificEmail;
      let toName = "";
      let userId: string | undefined;

      if (newForm.target === "specific_user" && newForm.selectedUserId) {
        const u = siteUsers.find(u => String(u.id) === newForm.selectedUserId);
        toEmail = u?.email || "";
        toName = [u?.first_name, u?.last_name].filter(Boolean).join(" ");
        userId = u?.auth_id;
      }

      const res = await fetch("/api/admin/support/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newForm.subject, message: newForm.body.replace(/<[^>]*>/g, ""), toEmail, toName, userId }),
      });
      setSaving(false);
      if (res.ok) {
        showToast("Message envoyé et ticket créé");
        setCreateOpen(false);
        setNewForm({ name: "", subject: "", body: "", target: "all", schedule: "", specificEmail: "", selectedUserId: "" });
        setUserSearch("");
      } else showToast("Erreur lors de l'envoi", false);
      return;
    }

    // Campagne classique → créer le template
    const res = await fetch("/api/admin/email-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newForm.name, subject: newForm.subject, body: newForm.body, target: newForm.target, schedule: newForm.schedule || null }),
    });
    setSaving(false);
    if (res.ok) {
      showToast("Template créé");
      setCreateOpen(false);
      setNewForm({ name: "", subject: "", body: "", target: "all", schedule: "", specificEmail: "", selectedUserId: "" });
      setUserSearch("");
      fetchTemplates();
    } else showToast("Erreur lors de la création", false);
  };

  const handleDelete = async (tmpl: EmailTemplate) => {
    if (!(await confirm(`Supprimer "${tmpl.name}" ?`))) return;
    const res = await fetch("/api/admin/email-templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tmpl.id }),
    });
    if (res.ok) { showToast("Template supprimé"); fetchTemplates(); }
    else showToast("Erreur lors de la suppression", false);
  };

  const handleSend = async () => {
    if (!sendTmpl) return;
    setSending(true);
    setSendResult(null);
    const res = await fetch("/api/admin/email-templates/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: sendTmpl.id,
        target: sendForm.target,
        selectedUserId: sendForm.selectedUserId || undefined,
        customEmail: sendForm.specificEmail || undefined,
      }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) setSendResult(data);
    else showToast(data.error || "Erreur d'envoi", false);
  };

  const systemTemplates = templates.filter(t => t.type === "system");
  const campaignTemplates = templates.filter(t => t.type === "campaign");

  const TemplateCard = ({ tmpl }: { tmpl: EmailTemplate }) => (
    <div className="bg-white rounded-xl border border-[rgba(197,161,72,0.25)] p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-[var(--greek-blue)] truncate">{tmpl.name}</h3>
            {!tmpl.is_deletable && (
              <span title="Template système" aria-label="Template système">
                <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{tmpl.subject}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
          tmpl.type === "system" ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"
        }`}>
          {tmpl.type === "system" ? "Système" : "Campagne"}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {TARGET_LABELS[tmpl.target] || tmpl.target}
        </span>
        {tmpl.schedule && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {SCHEDULE_OPTIONS.find(s => s.value === tmpl.schedule)?.label || tmpl.schedule}
          </span>
        )}
        {tmpl.sent_count > 0 && (
          <span className="flex items-center gap-1">
            <Send className="w-3.5 h-3.5" />
            {tmpl.sent_count} envoyé{tmpl.sent_count > 1 ? "s" : ""}
          </span>
        )}
        {tmpl.last_sent_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {new Date(tmpl.last_sent_at).toLocaleDateString("fr-FR")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setPreviewTmpl(tmpl)}
          title="Aperçu"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" /> Aperçu
        </button>
        <button
          onClick={() => handleEdit(tmpl)}
          title="Modifier"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--greek-blue)] border border-[rgba(58,110,165,0.3)] rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" /> Modifier
        </button>
        {tmpl.target !== "triggered" && (
          <button
            onClick={() => { setSendTmpl(tmpl); setSendForm({ target: tmpl.target, specificEmail: "", selectedUserId: "" }); setSendResult(null); }}
            title="Envoyer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--greek-blue)] rounded-lg hover:opacity-90 transition-all"
          >
            <Send className="w-3.5 h-3.5" /> Envoyer
          </button>
        )}
        {tmpl.is_deletable && (
          <button
            onClick={() => handleDelete(tmpl)}
            title="Supprimer"
            className="p-1.5 text-red-400 border border-red-100 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--greek-blue)] flex items-center gap-3">
            <Mail className="w-8 h-8 text-[var(--greek-gold)]" />
            Emails
          </h1>
          <p className="text-[var(--greek-bronze)] mt-0.5">Gérez les templates et envoyez des campagnes aux utilisateurs</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nouveau
        </button>
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <div className="space-y-8">
          {/* Emails système */}
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-400" /> Emails système
              <span className="text-sm font-normal text-gray-400">— Envoyés automatiquement, non supprimables</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {systemTemplates.map(t => <TemplateCard key={t.id} tmpl={t} />)}
            </div>
          </div>

          {/* Campagnes */}
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--greek-blue)] mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-[var(--greek-gold)]" /> Campagnes
              <span className="text-sm font-normal text-gray-400">— Envois manuels ou planifiés</span>
            </h2>
            {campaignTemplates.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                Aucune campagne. Créez votre premier template.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {campaignTemplates.map(t => <TemplateCard key={t.id} tmpl={t} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL APERÇU ── */}
      {previewTmpl && (() => {
        const origin = typeof window !== "undefined" ? window.location.origin : undefined;
        const previewHtml = buildEmailHtml({
          title: previewTmpl.subject,
          preheader: previewTmpl.subject,
          logoBaseUrl: origin,
          body: previewTmpl.body
            .replace(/\{\{firstName\}\}/g, "Marie")
            .replace(/\{\{name\}\}/g, "Marie Dupont")
            .replace(/\{\{newEmail\}\}/g, "marie.dupont@gmail.com")
            .replace(/\{\{method\}\}/g, "Google")
            .replace(/\{\{subject\}\}/g, "Question abonnement")
            .replace(/\{\{message\}\}/g, "Bonjour, j'ai une question sur mon abonnement...")
            .replace(/\{\{email\}\}/g, "marie@gmail.com")
            .replace(/\{\{reply\}\}/g, "Bonjour, merci pour votre message. Voici notre réponse..."),
        });
        return (
        <div className="fixed inset-0 z-[1060] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="font-bold text-[var(--greek-blue)]">{previewTmpl.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Sujet : {previewTmpl.subject}</p>
              </div>
              <button onClick={() => setPreviewTmpl(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden rounded-b-2xl">
              <iframe srcDoc={previewHtml} className="w-full h-full border-0" style={{ minHeight: "600px" }} title="Aperçu email" />
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── MODAL ÉDITION ── */}
      {editTmpl && (() => {
        const origin = typeof window !== "undefined" ? window.location.origin : undefined;
        const fullHtml = buildEmailHtml({
          title: editForm.subject,
          body: editForm.body,
          logoBaseUrl: origin,
        });
        return (
        <div className="fixed inset-0 z-[1060] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-[var(--greek-blue)]">{editTmpl.name}</h3>
              <div className="flex items-center gap-3">
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button onClick={() => setEditTab("content")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${editTab === "content" ? "bg-white shadow text-[var(--greek-blue)]" : "text-gray-400 hover:text-gray-600"}`}>
                    Contenu
                  </button>
                  <button onClick={() => setEditTab("html")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${editTab === "html" ? "bg-white shadow text-[var(--greek-blue)]" : "text-gray-400 hover:text-gray-600"}`}>
                    HTML complet
                  </button>
                </div>
                <button onClick={() => setEditTmpl(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {editTab === "content" ? (
              <div className="overflow-auto flex-1 p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Nom</label>
                  <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Sujet de l'email</label>
                  <input value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]" />
                </div>
                {editTmpl.type === "campaign" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Destinataires</label>
                      <select value={editForm.target} onChange={e => setEditForm({ ...editForm, target: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]">
                        <option value="all">Tous les parents</option>
                        <option value="notif_weekly_reports">Rapports hebdomadaires</option>
                        <option value="notif_offers_news">Offres et nouveautés</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Planification</label>
                      <select value={editForm.schedule} onChange={e => setEditForm({ ...editForm, schedule: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]">
                        {SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">
                    Corps HTML
                  </label>
                  <div className="text-xs text-gray-400 mb-2 font-mono bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    Variables : <span className="text-[var(--greek-blue)]">{`{{firstName}}`}</span> · <span className="text-[var(--greek-blue)]">{`{{name}}`}</span> · <span className="text-[var(--greek-blue)]">{`{{newEmail}}`}</span> · <span className="text-[var(--greek-blue)]">{`{{method}}`}</span> · <span className="text-[var(--greek-blue)]">{`{{subject}}`}</span> · <span className="text-[var(--greek-blue)]">{`{{message}}`}</span> · <span className="text-[var(--greek-blue)]">{`{{reply}}`}</span>
                  </div>
                  <textarea value={editForm.body} onChange={e => setEditForm({ ...editForm, body: e.target.value })}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono resize-y focus:outline-none focus:border-[var(--greek-blue)] leading-relaxed" />
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto bg-gray-950 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs text-gray-400">HTML complet généré — modifiez le corps dans l'onglet <strong className="text-gray-300">Contenu</strong> pour changer le rendu</p>
                </div>
                <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap break-all leading-relaxed select-all">{fullHtml}</pre>
              </div>
            )}

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setEditTmpl(null)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Annuler</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── MODAL ENVOI ── */}
      {sendTmpl && (
        <div className="fixed inset-0 z-[1060] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-[var(--greek-blue)]">Envoyer — {sendTmpl.name}</h3>
              <button onClick={() => setSendTmpl(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="p-6 space-y-4">
              {sendResult ? (
                <div className="text-center py-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="font-bold text-gray-800 text-lg">{sendResult.sent} email{sendResult.sent > 1 ? "s" : ""} envoyé{sendResult.sent > 1 ? "s" : ""}</p>
                  {sendResult.failed > 0 && <p className="text-sm text-red-500">{sendResult.failed} échec{sendResult.failed > 1 ? "s" : ""}</p>}
                  <p className="text-sm text-gray-400">{sendResult.total} destinataire{sendResult.total > 1 ? "s" : ""} au total</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold text-[var(--greek-blue)] mb-2">Destinataires</label>
                    <select value={sendForm.target} onChange={e => setSendForm({ ...sendForm, target: e.target.value, specificEmail: "", selectedUserId: "" })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]">
                      <option value="all">Tous les parents</option>
                      <option value="notif_weekly_reports">Rapports hebdomadaires activés</option>
                      <option value="notif_offers_news">Offres et nouveautés activées</option>
                      <option value="specific_user">Utilisateur du site</option>
                      <option value="custom_email">Adresse personnalisée</option>
                    </select>
                  </div>
                  {sendForm.target === "specific_user" && (
                    <div>
                      <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Rechercher par nom ou email..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)] mb-2" />
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl">
                        {siteUsers.filter(u =>
                          !userSearch || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
                        ).map(u => (
                          <button key={u.id} type="button"
                            onClick={() => setSendForm({ ...sendForm, selectedUserId: String(u.id) })}
                            className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 ${sendForm.selectedUserId === String(u.id) ? "bg-blue-50 text-[var(--greek-blue)]" : "text-gray-700"}`}>
                            <span className="font-medium">{u.first_name} {u.last_name}</span>
                            <span className="text-xs text-gray-400">{u.email}</span>
                          </button>
                        ))}
                      </div>
                      {sendForm.selectedUserId && (
                        <p className="text-xs text-green-600 mt-1">Sélectionné : {siteUsers.find(u => String(u.id) === sendForm.selectedUserId)?.email}</p>
                      )}
                    </div>
                  )}
                  {sendForm.target === "custom_email" && (
                    <div>
                      <label className="block text-sm font-bold text-[var(--greek-blue)] mb-2">Adresse email</label>
                      <input type="email" value={sendForm.specificEmail}
                        onChange={e => setSendForm({ ...sendForm, specificEmail: e.target.value })}
                        placeholder="n'importe-quel@email.com"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]" />
                    </div>
                  )}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
                    Cet email sera envoyé immédiatement. Cette action est irréversible.
                  </div>
                </>
              )}
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button onClick={() => setSendTmpl(null)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                {sendResult ? "Fermer" : "Annuler"}
              </button>
              {!sendResult && (
                <button onClick={handleSend} disabled={
                  sending ||
                  (sendForm.target === "specific_user" && !sendForm.selectedUserId) ||
                  (sendForm.target === "custom_email" && !sendForm.specificEmail)
                }
                  className="flex items-center gap-2 px-5 py-2 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 text-sm">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Envoi..." : "Envoyer"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CRÉATION ── */}
      {createOpen && (
        <div className="fixed inset-0 z-[1060] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-[var(--greek-blue)]">Nouveau</h3>
              <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="overflow-auto flex-1 p-6 space-y-4">
              {/* Nom uniquement pour les campagnes */}
              {!["specific_user","custom_email"].includes(newForm.target) && (
                <div>
                  <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Nom du template</label>
                  <input value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} placeholder="Ex: Newsletter de mai"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]" />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Sujet</label>
                <input value={newForm.subject} onChange={e => setNewForm({ ...newForm, subject: e.target.value })} placeholder="Sujet de l'email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]" />
              </div>

              {/* Destinataires */}
              <div>
                <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Destinataires</label>
                <select value={newForm.target} onChange={e => setNewForm({ ...newForm, target: e.target.value, selectedUserId: "", specificEmail: "" })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]">
                  <option value="all">Tous les parents</option>
                  <option value="notif_weekly_reports">Rapports hebdomadaires activés</option>
                  <option value="notif_offers_news">Offres et nouveautés activées</option>
                  <option value="specific_user">Utilisateur du site</option>
                  <option value="custom_email">Adresse personnalisée</option>
                </select>
              </div>

              {/* Sélecteur user ou email custom */}
              {newForm.target === "specific_user" && (
                <div>
                  <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Sélectionner un utilisateur</label>
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Rechercher par nom ou email..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)] mb-2" />
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl">
                    {siteUsers.filter(u =>
                      !userSearch || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase())
                    ).map(u => (
                      <button key={u.id} type="button"
                        onClick={() => setNewForm({ ...newForm, selectedUserId: String(u.id) })}
                        className={`w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-gray-50 transition-colors ${newForm.selectedUserId === String(u.id) ? "bg-blue-50 text-[var(--greek-blue)]" : "text-gray-700"}`}>
                        <span className="font-medium">{u.first_name} {u.last_name}</span>
                        <span className="text-xs text-gray-400">{u.email}</span>
                      </button>
                    ))}
                  </div>
                  {newForm.selectedUserId && (
                    <p className="text-xs text-green-600 mt-1">Sélectionné : {siteUsers.find(u => String(u.id) === newForm.selectedUserId)?.email}</p>
                  )}
                </div>
              )}
              {newForm.target === "custom_email" && (
                <div>
                  <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Adresse email</label>
                  <input type="email" value={newForm.specificEmail} onChange={e => setNewForm({ ...newForm, specificEmail: e.target.value })}
                    placeholder="n'importe-quel@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]" />
                </div>
              )}

              {/* Planification — seulement pour les envois groupés */}
              {!["specific_user", "custom_email"].includes(newForm.target) && (
                <div>
                  <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">Planification</label>
                  <select value={newForm.schedule} onChange={e => setNewForm({ ...newForm, schedule: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:border-[var(--greek-blue)]">
                    {SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[var(--greek-blue)] mb-1">
                  Contenu HTML
                </label>
                <div className="text-xs text-gray-400 mb-2 font-mono bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  Variables : <span className="text-[var(--greek-blue)]">{`{{firstName}}`}</span> · <span className="text-[var(--greek-blue)]">{`{{name}}`}</span> · <span className="text-[var(--greek-blue)]">{`{{email}}`}</span>
                </div>
                <textarea value={newForm.body} onChange={e => setNewForm({ ...newForm, body: e.target.value })}
                  rows={8} placeholder="<p>Bonjour {{firstName}},</p><p>...</p>"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono resize-y focus:outline-none focus:border-[var(--greek-blue)]" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Annuler</button>
              {(() => {
                const isPersonal = ["specific_user","custom_email"].includes(newForm.target);
                const disabled = saving || !newForm.subject || !newForm.body
                  || (isPersonal && newForm.target === "specific_user" && !newForm.selectedUserId)
                  || (isPersonal && newForm.target === "custom_email" && !newForm.specificEmail)
                  || (!isPersonal && !newForm.name);
                return (
                  <button onClick={handleCreate} disabled={disabled}
                    className={`flex items-center gap-2 px-5 py-2 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50 text-sm ${isPersonal ? "bg-[var(--greek-blue)]" : "bg-[var(--greek-gold)]"}`}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isPersonal ? <Send className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isPersonal ? "Envoyer le message" : "Créer le template"}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${
          toast.ok ? "bg-green-600" : "bg-red-600"
        }`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
