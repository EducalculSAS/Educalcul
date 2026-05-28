"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Shield, Baby, MapPin,
  Trophy, Ban, MessageCircle,
  KeyRound, Trash2, CheckCircle, AlertTriangle, Send, X, Loader2,
  Clock, Edit, Bell, CreditCard, Save, User as UserIcon, Download, FileText, Table,
} from "lucide-react";
import { avatarUrl } from "@/lib/avatarUrl";
import PageLoader from "@/components/PageLoader";

const roleBadge = (r: string) => {
  if (r === "admin") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700"><Shield className="w-3 h-3" />Admin</span>;
  if (r === "parent") return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><UserIcon className="w-3 h-3" />Parent</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><Baby className="w-3 h-3" />Élève</span>;
};

const inputCls = "w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

// ─── Export helpers ────────────────────────────────────────────────────────

function exportCSV(data: any) {
  const { user, stats, subscription, children, badges, notifications, login_history } = data;
  const BOM = "﻿";
  const sep = ";";
  const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const d = (v: any) => v ? new Date(v).toLocaleString("fr-FR") : "";
  const history: any[] = login_history ?? [];

  const rows: string[][] = [
    ["=== INFORMATIONS GÉNÉRALES ==="],
    ["ID", user.id],
    ["Prénom", user.first_name ?? ""],
    ["Nom", user.last_name ?? ""],
    ["Email", user.email ?? ""],
    ["Rôle", user.role ?? ""],
    ["Statut", user.status ?? ""],
    ["Niveau scolaire", user.grade_level ?? ""],
    ["Date d'inscription", d(user.created_at)],
    ["Dernière activité", d(user.last_active_at)],
    [],
    ["=== CONNEXION & APPAREIL ==="],
    ["Nombre de connexions", user.login_count ?? 0],
    ["Série de connexions", user.login_streak ?? 0],
    ["Dernière IP", user.last_login_ip ?? ""],
    ["Dernière ville", user.last_login_city ?? ""],
    ["Dernier pays", user.last_login_country ?? ""],
    ["Type d'appareil", user.device_type ?? ""],
    ["User Agent", user.user_agent ?? ""],
    ["Localisation GPS", user.location_precise ? `${user.latitude}, ${user.longitude}` : "Non autorisée"],
    [],
    ["=== HISTORIQUE COMPLET DES CONNEXIONS ==="],
    ...(history.length > 0
      ? [
          ["N°", "Date & heure", "IP", "Ville", "Pays", "Type d'appareil", "User Agent", "Latitude", "Longitude"],
          ...history.map((h: any, i: number) => [
            i + 1,
            d(h.logged_at),
            h.ip ?? "",
            h.city ?? "",
            h.country ?? "",
            h.device_type ?? "",
            h.user_agent ?? "",
            h.latitude?.toFixed(5) ?? "",
            h.longitude?.toFixed(5) ?? "",
          ]),
        ]
      : [["Aucune connexion enregistrée"]]),
    [],
    ["=== STATISTIQUES D'UTILISATION ==="],
    ["Tentatives d'exercices", stats.exercise_attempts],
    ["Tentatives de quiz", stats.quiz_attempts],
    ["Cours suivis", stats.course_progress],
    ["Sujets de forum", stats.forum_posts ?? 0],
    ["Commentaires forum", stats.forum_comments ?? 0],
    [],
    ["=== ABONNEMENT ==="],
    ["Plan", subscription?.plan?.name ?? "Aucun"],
    ["Prix", subscription?.plan?.price ? `${subscription.plan.price}€/mois` : ""],
    ["Statut abonnement", subscription?.status ?? ""],
    ["Début période", d(subscription?.current_period_start)],
    ["Fin période", d(subscription?.current_period_end)],
    [],
    ["=== BADGES ==="],
    ["Badges obtenus", badges.map((b: any) => b.badge?.name).filter(Boolean).join(", ")],
    [],
    ["=== ENFANTS LIÉS ==="],
    ...(children.length > 0
      ? [["Prénom", "Nom", "Niveau"], ...children.map((c: any) => [c.first_name ?? "", c.last_name ?? "", c.grade_level ?? ""])]
      : [["Aucun enfant lié"]]),
    [],
    ["=== HISTORIQUE DES ACTIONS ADMIN ==="],
    ...(notifications.length > 0
      ? [["Date", "Type", "Titre", "Contenu"], ...notifications.map((n: any) => [d(n.created_at), n.type, n.title, n.content])]
      : [["Aucune action"]]),
  ];

  const csv = BOM + rows.map(row => row.map(q).join(sep)).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `user_${user.first_name}_${user.last_name}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(data: any) {
  const { user, stats, subscription, children, badges, notifications, forum_posts, forum_comments, login_history } = data;
  const history: any[] = login_history ?? [];
  const d = (v: any) => v ? new Date(v).toLocaleString("fr-FR") : "—";

  const section = (title: string, rows: [string, string][]) => `
    <div class="section">
      <h2>${title}</h2>
      <table>
        ${rows.map(([k, v]) => `<tr><td class="label">${k}</td><td class="value">${v || "—"}</td></tr>`).join("")}
      </table>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Profil — ${user.first_name} ${user.last_name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #222; font-size: 12px; }
    .page { max-width: 800px; margin: 0 auto; padding: 20px; }

    /* Header */
    .header { background: #1a3a5c; color: #fff; padding: 28px 32px; border-radius: 12px; margin-bottom: 24px; display: flex; align-items: center; gap: 20px; }
    .logo-wrap { flex-shrink: 0; }
    .logo-wrap img { height: 48px; width: auto; }
    .header-info { flex: 1; }
    .header-title { font-family: 'Cinzel', serif; font-size: 22px; font-weight: 700; color: #fff; }
    .header-sub { color: rgba(255,255,255,0.65); font-size: 12px; margin-top: 4px; }
    .header-meta { margin-top: 10px; display: flex; gap: 12px; flex-wrap: wrap; }
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; }
    .badge-parent { background: #dbeafe; color: #1d4ed8; }
    .badge-child { background: #dcfce7; color: #166534; }
    .badge-admin { background: #f3e8ff; color: #7e22ce; }
    .badge-active { background: #d1fae5; color: #065f46; }
    .badge-inactive { background: #fee2e2; color: #991b1b; }
    .divider { border: none; border-top: 2px solid #c5a148; opacity: 0.3; margin: 0 0 20px; }
    .brand { font-family: 'Cinzel', serif; font-size: 11px; color: #c5a148; letter-spacing: 0.12em; font-weight: 600; }

    /* Stats grid */
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: #f8f6f0; border: 1px solid #e8dfc8; border-radius: 10px; padding: 14px 16px; text-align: center; }
    .stat-num { font-family: 'Cinzel', serif; font-size: 24px; font-weight: 700; color: #1a3a5c; }
    .stat-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 3px; font-weight: 600; }

    /* Sections */
    .section { background: #fafaf8; border: 1px solid rgba(197,161,72,0.2); border-radius: 10px; padding: 16px 20px; margin-bottom: 16px; break-inside: avoid; }
    .section h2 { font-family: 'Cinzel', serif; font-size: 12px; font-weight: 600; color: #1a3a5c; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(197,161,72,0.25); }
    table { width: 100%; border-collapse: collapse; }
    tr:not(:last-child) td { border-bottom: 1px solid rgba(197,161,72,0.1); }
    td { padding: 5px 0; vertical-align: top; }
    td.label { color: #888; width: 42%; font-weight: 500; }
    td.value { color: #222; font-weight: 500; word-break: break-word; }

    /* Badges */
    .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .badge-item { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; border-radius: 20px; padding: 3px 10px; font-size: 10px; font-weight: 700; }

    /* Notifs */
    .notif { padding: 8px 12px; border-radius: 8px; margin-bottom: 8px; font-size: 11px; }
    .notif-ban { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
    .notif-warning { background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; }
    .notif-message { background: #eff6ff; border: 1px solid #93c5fd; color: #1e40af; }
    .notif-info { background: #f0fdf4; border: 1px solid #86efac; color: #166534; }
    .notif-date { opacity: 0.6; font-size: 10px; float: right; }

    /* Footer */
    .footer { text-align: center; margin-top: 28px; padding-top: 16px; border-top: 1px solid rgba(197,161,72,0.2); color: #aaa; font-size: 10px; }
    .footer .brand { font-size: 14px; display: block; margin-bottom: 4px; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="logo-wrap"><img src="/logo.png" alt="Educalcul" /></div>
    <div class="header-info">
      <div class="brand">EDUCALCUL — Fiche Utilisateur</div>
      <div class="header-title">${user.first_name ?? ""} ${user.last_name ?? ""}</div>
      <div class="header-sub">${user.email ?? ""}</div>
      <div class="header-meta">
        <span class="badge badge-${user.role}">${user.role === "parent" ? "Parent" : user.role === "child" ? "Élève" : "Admin"}</span>
        <span class="badge badge-${user.status === "active" ? "active" : "inactive"}">${user.status === "active" ? "Actif" : "Inactif"}</span>
        ${user.grade_level ? `<span class="badge badge-active">${user.grade_level}</span>` : ""}
      </div>
    </div>
  </div>

  <!-- Stats -->
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-num">${stats.exercise_attempts}</div><div class="stat-label">Exercices</div></div>
    <div class="stat-card"><div class="stat-num">${stats.quiz_attempts}</div><div class="stat-label">Quiz</div></div>
    <div class="stat-card"><div class="stat-num">${stats.course_progress}</div><div class="stat-label">Cours suivis</div></div>
  </div>

  ${section("Informations générales", [
    ["ID interne", user.id],
    ["Inscrit le", d(user.created_at)],
    ["Dernière activité", d(user.last_active_at)],
  ])}

  ${section("Connexion & Appareil", [
    ["Nombre de connexions", String(user.login_count ?? 0)],
    ["Série de connexions (jours)", String(user.login_streak ?? 0)],
    ["Dernière IP connue", user.last_login_ip ?? ""],
    ["Dernière ville connue", user.last_login_city ?? ""],
    ["Dernier pays connu", user.last_login_country ?? ""],
    ["Type d'appareil", user.device_type ?? ""],
    ["Localisation GPS", user.location_precise ? `${user.latitude?.toFixed(5)}, ${user.longitude?.toFixed(5)}` : "Non autorisée"],
  ])}

  ${history.length > 0 ? `
  <div class="section" style="break-inside:auto">
    <h2>Historique des connexions (${history.length})</h2>
    <table style="font-size:10px">
      <thead>
        <tr style="background:#1a3a5c;color:#fff">
          <th style="padding:5px 8px;text-align:left;font-family:Cinzel,serif;font-size:8px;letter-spacing:.06em">#</th>
          <th style="padding:5px 8px;text-align:left;font-family:Cinzel,serif;font-size:8px;letter-spacing:.06em">Date & heure</th>
          <th style="padding:5px 8px;text-align:left;font-family:Cinzel,serif;font-size:8px;letter-spacing:.06em">IP</th>
          <th style="padding:5px 8px;text-align:left;font-family:Cinzel,serif;font-size:8px;letter-spacing:.06em">Ville</th>
          <th style="padding:5px 8px;text-align:left;font-family:Cinzel,serif;font-size:8px;letter-spacing:.06em">Pays</th>
          <th style="padding:5px 8px;text-align:left;font-family:Cinzel,serif;font-size:8px;letter-spacing:.06em">Appareil</th>
          <th style="padding:5px 8px;text-align:left;font-family:Cinzel,serif;font-size:8px;letter-spacing:.06em">GPS</th>
        </tr>
      </thead>
      <tbody>
        ${history.map((h: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f8f6f0"}">
          <td style="padding:5px 8px;color:#aaa">${history.length - i}</td>
          <td style="padding:5px 8px">${d(h.logged_at)}</td>
          <td style="padding:5px 8px;font-family:monospace;font-size:9px">${h.ip || "—"}</td>
          <td style="padding:5px 8px">${h.city || "—"}</td>
          <td style="padding:5px 8px">${h.country || "—"}</td>
          <td style="padding:5px 8px">${h.device_type || "—"}</td>
          <td style="padding:5px 8px;font-size:9px">${h.latitude ? `${h.latitude.toFixed(3)}, ${h.longitude?.toFixed(3)}` : "—"}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>` : `
  <div class="section">
    <h2>Historique des connexions</h2>
    <p style="color:#aaa;font-size:11px;text-align:center;padding:8px">Aucune connexion enregistrée</p>
  </div>`}

  ${section("Abonnement", [
    ["Plan", subscription?.plan?.name ?? "Aucun"],
    ["Tarif", subscription?.plan?.price ? `${subscription.plan.price}€/mois` : ""],
    ["Statut", subscription?.status ?? ""],
    ["Début de période", d(subscription?.current_period_start)],
    ["Fin de période", d(subscription?.current_period_end)],
  ])}

  ${badges.length > 0 ? `
  <div class="section">
    <h2>Badges & Trophées</h2>
    <div class="badges">
      ${badges.map((b: any) => `<span class="badge-item">${b.badge?.name ?? ""}</span>`).join("")}
    </div>
  </div>` : ""}

  ${children.length > 0 ? section("Enfants liés", children.map((c: any) => [`${c.first_name} ${c.last_name}`, c.grade_level ?? ""])) : ""}

  ${forum_posts?.length > 0 || forum_comments?.length > 0 ? `
  <div class="section">
    <h2>Activité Forum</h2>
    <table>
      <tr><td class="label">Sujets créés</td><td class="value">${forum_posts?.length ?? 0}</td></tr>
      <tr><td class="label">Commentaires</td><td class="value">${forum_comments?.length ?? 0}</td></tr>
      ${forum_posts?.slice(0, 3).map((p: any) => `<tr><td class="label" style="opacity:.6;padding-left:8px">• ${new Date(p.created_at).toLocaleDateString("fr-FR")}</td><td class="value">${p.title}</td></tr>`).join("") ?? ""}
    </table>
  </div>` : ""}

  ${notifications.length > 0 ? `
  <div class="section">
    <h2>Historique des actions admin</h2>
    ${notifications.slice(0, 10).map((n: any) => `
    <div class="notif notif-${n.type || "message"}">
      <span class="notif-date">${new Date(n.created_at).toLocaleDateString("fr-FR")}</span>
      <strong>${n.title}</strong><br/><span style="opacity:.8">${n.content}</span>
    </div>`).join("")}
  </div>` : ""}

  <div class="footer">
    <span class="brand">EDUCALCUL</span>
    Document généré le ${new Date().toLocaleString("fr-FR")} — Usage interne confidentiel
  </div>
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ───────────────────────────────────────────────────────────────────────────

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [showExportModal, setShowExportModal] = useState(false);

  // Message modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [msgForm, setMsgForm] = useState({ title: "", content: "", type: "message" });

  // Ban modal
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");

  useEffect(() => { fetchUser(); }, [id]);

  const fetchUser = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/user-detail?id=${id}`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setEditForm({
        first_name: d.user.first_name || "",
        last_name: d.user.last_name || "",
        email: d.user.email || "",
        role: d.user.role || "parent",
        status: d.user.status || "active",
        grade_level: d.user.grade_level || "",
      });
    }
    setLoading(false);
  };

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const doAction = async (actionName: string, payload?: any) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user-detail?id=${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, payload }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast("success", "Action effectuée");
      fetchUser();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const saveEdit = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/user-detail?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("success", "Profil mis à jour");
      setEditMode(false);
      fetchUser();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async () => {
    await doAction("ban", { reason: banReason });
    setShowBanModal(false);
    setBanReason("");
  };

  const handleSendMessage = async () => {
    await doAction("send_message", msgForm);
    setShowMessageModal(false);
    setMsgForm({ title: "", content: "", type: "message" });
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer définitivement ce compte ? Cette action est irréversible.")) return;
    setActionLoading(true);
    const res = await fetch(`/api/admin/users?auth_id=${data.user.auth_id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/users");
    else showToast("error", "Erreur lors de la suppression");
    setActionLoading(false);
  };

  if (loading) return <PageLoader className="h-64" />;
  if (!data) return <div className="p-6 text-red-500">Utilisateur introuvable.</div>;

  const { user, stats, subscription, children, recent_activity, notifications, badges } = data;
  const isBanned = user.status === "inactive";
  const img = avatarUrl(user.avatar);
  const initials = `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/admin/users")} className="p-2 text-[var(--greek-blue)] hover:bg-blue-50 rounded-xl transition-colors shrink-0">
              <ArrowLeft size={20} />
            </button>
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-[var(--greek-blue)]/10 text-[var(--greek-blue)] font-bold text-2xl flex items-center justify-center overflow-hidden">
                {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : initials}
              </div>
              {isBanned && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><Ban className="w-3 h-3 text-white" /></div>}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                  {user.first_name} {user.last_name}
                </h1>
                {roleBadge(user.role)}
                {isBanned && <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1"><Ban className="w-3 h-3" />Banni</span>}
              </div>
              <p className="text-gray-500 text-sm mt-0.5">{user.email}</p>
              {user.last_login_city && <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{user.last_login_city}, {user.last_login_country}</p>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[rgba(197,161,72,0.4)] text-[var(--greek-gold)] rounded-xl text-sm font-semibold hover:bg-amber-50 transition-colors"
            >
              <Download size={15} /> Exporter
            </button>

            {editMode ? (
              <>
                <button onClick={saveEdit} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50">
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
                </button>
                <button onClick={() => { setEditMode(false); }} className="flex items-center gap-2 px-4 py-2 border border-[rgba(197,161,72,0.25)] text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                  <X size={15} /> Annuler
                </button>
              </>
            ) : (
              <button onClick={() => setEditMode(true)} className="flex items-center gap-2 px-4 py-2 border border-[var(--greek-blue)] text-[var(--greek-blue)] rounded-xl text-sm font-semibold hover:bg-blue-50 transition-colors">
                <Edit size={15} /> Modifier
              </button>
            )}
            <button onClick={() => setShowMessageModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--greek-blue)] text-white rounded-xl text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm">
              <MessageCircle size={15} /> Message
            </button>
            {isBanned ? (
              <button onClick={() => doAction("unban")} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50">
                <CheckCircle size={15} /> Réactiver
              </button>
            ) : (
              <button onClick={() => setShowBanModal(true)} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50">
                <Ban size={15} /> Bannir
              </button>
            )}
            <button onClick={() => doAction("reset_password")} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 border border-[rgba(197,161,72,0.25)] text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
              <KeyRound size={15} /> Reset MDP
            </button>
            <button onClick={handleDelete} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 text-red-500 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors">
              <Trash2 size={15} /> Supprimer
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5">

          {/* Edit form or info display */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              {editMode ? "Modifier le profil" : "Informations"}
            </h2>
            {editMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Prénom</label>
                    <input value={editForm.first_name} onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Nom</label>
                    <input value={editForm.last_name} onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Rôle</label>
                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={inputCls}>
                      <option value="parent">Parent</option>
                      <option value="child">Élève</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Statut</label>
                    <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={inputCls}>
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                    </select>
                  </div>
                </div>
                {(editForm.role === "child") && (
                  <div>
                    <label className={labelCls}>Niveau</label>
                    <input value={editForm.grade_level} onChange={e => setEditForm({ ...editForm, grade_level: e.target.value })} className={inputCls} placeholder="6eme, 5eme..." />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <Row label="Inscrit le" value={new Date(user.created_at).toLocaleDateString("fr-FR")} />
                {user.last_active_at && <Row label="Dernière activité" value={new Date(user.last_active_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} />}
                {user.grade_level && <Row label="Niveau" value={user.grade_level} />}
                {user.last_login_ip && <Row label="IP" value={user.last_login_ip} mono />}
                {user.last_login_country && <Row label="Pays" value={`${user.last_login_city || ""} ${user.last_login_country}`} />}
              </div>
            )}
          </div>

          {/* Subscription — masqué pour les admins */}
          {user.role !== "admin" && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" />Abonnement</h2>
              {subscription ? (
                <div>
                  <p className="font-bold text-[var(--greek-blue)]">{subscription.plan?.name}</p>
                  <p className="text-xs text-gray-400">{subscription.plan?.price}€ / mois</p>
                </div>
              ) : <p className="text-sm text-gray-400 italic">Aucun abonnement actif</p>}
            </div>
          )}

          {/* Children */}
          {user.role === "parent" && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Enfants ({children.length})</h2>
              {children.length > 0 ? children.map((c: any) => (
                <button key={c.id} onClick={() => router.push(`/admin/users/${c.id}`)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left mb-1">
                  <div className="w-8 h-8 rounded-lg bg-green-100 text-green-700 font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                    {avatarUrl(c.avatar) ? <img src={avatarUrl(c.avatar)!} className="w-full h-full object-cover" alt="" /> : (c.first_name?.[0] || "?")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{c.first_name} {c.last_name}</p>
                    <p className="text-xs text-gray-400">{c.grade_level}</p>
                  </div>
                </button>
              )) : <p className="text-sm text-gray-400 italic">Aucun enfant lié</p>}
            </div>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Trophy className="w-4 h-4" />Badges</h2>
              <div className="flex flex-wrap gap-2">
                {badges.map((b: any, i: number) => (
                  <span key={i} className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">{b.badge?.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-5">

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Exercices", value: stats.exercise_attempts, color: "bg-orange-50 text-orange-600" },
              { label: "Quiz", value: stats.quiz_attempts, color: "bg-blue-50 text-blue-600" },
              { label: "Cours suivis", value: stats.course_progress, color: "bg-teal-50 text-teal-600" },
              { label: "Sujets forum", value: stats.forum_posts, color: "bg-purple-50 text-purple-600" },
              { label: "Commentaires", value: stats.forum_comments, color: "bg-pink-50 text-pink-600" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4">
                <p className={`text-2xl font-bold mb-1 ${s.color.split(" ")[1]}`}>{s.value}</p>
                <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Admin notifications history */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Bell className="w-4 h-4" />Historique des actions</h2>
            {notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((n: any) => {
                  const c: any = { ban: "bg-red-50 text-red-700 border-red-100", warning: "bg-orange-50 text-orange-700 border-orange-100", message: "bg-blue-50 text-blue-700 border-blue-100", info: "bg-green-50 text-green-700 border-green-100" };
                  return (
                    <div key={n.id} className={`p-3 rounded-xl border text-sm ${c[n.type] || c.message}`}>
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-semibold">{n.title}</p>
                        <span className="text-xs opacity-60 shrink-0">{new Date(n.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <p className="opacity-75 mt-0.5 text-xs">{n.content}</p>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-gray-400 italic">Aucune action enregistrée</p>}
          </div>

          {/* Recent activity */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Clock className="w-4 h-4" />Activité récente</h2>
            {recent_activity.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {recent_activity.map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--greek-blue)] shrink-0" />
                    <span className="text-gray-600 flex-1">{a.exercise?.title || "Exercice"}</span>
                    <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 italic">Aucune activité enregistrée</p>}
          </div>
        </div>
      </div>

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Exporter</h2>
              <button onClick={() => setShowExportModal(false)} className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-500 mb-4">Profil de {user.first_name} {user.last_name}</p>
              <button
                onClick={() => { exportCSV(data); setShowExportModal(false); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 border border-[rgba(197,161,72,0.3)] rounded-xl hover:bg-green-50 hover:border-green-200 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <Table size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-800">Fichier CSV</p>
                  <p className="text-xs text-gray-400">Compatible Excel, Google Sheets</p>
                </div>
              </button>
              <button
                onClick={() => { exportPDF(data); setShowExportModal(false); }}
                className="w-full flex items-center gap-3 px-5 py-3.5 border border-[rgba(197,161,72,0.3)] rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-800">Fichier PDF</p>
                  <p className="text-xs text-gray-400">Mise en page Educalcul avec logo</p>
                </div>
              </button>
              <button
                onClick={() => {
                  exportCSV(data);
                  setTimeout(() => exportPDF(data), 300);
                  setShowExportModal(false);
                }}
                className="w-full flex items-center gap-3 px-5 py-3.5 bg-[var(--greek-blue)] rounded-xl hover:bg-blue-900 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Download size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">Télécharger les deux</p>
                  <p className="text-xs text-white/60">CSV + PDF en une seule fois</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send message modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Envoyer un message</h2>
              <button onClick={() => setShowMessageModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <div>
                <label className={labelCls}>Type</label>
                <select value={msgForm.type} onChange={e => setMsgForm({ ...msgForm, type: e.target.value })} className={inputCls}>
                  <option value="message">Message</option>
                  <option value="warning">Avertissement</option>
                  <option value="info">Information</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Titre *</label>
                <input value={msgForm.title} onChange={e => setMsgForm({ ...msgForm, title: e.target.value })} className={inputCls} placeholder="Objet du message" />
              </div>
              <div>
                <label className={labelCls}>Message *</label>
                <textarea value={msgForm.content} onChange={e => setMsgForm({ ...msgForm, content: e.target.value })} className={inputCls + " h-28 resize-none"} placeholder="Contenu du message..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowMessageModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button onClick={handleSendMessage} disabled={!msgForm.title || !msgForm.content || actionLoading} className="flex items-center gap-2 px-7 py-2.5 bg-[var(--greek-blue)] text-white font-bold rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50">
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-red-600 font-[family-name:var(--font-display)]">Bannir l'utilisateur</h2>
              <button onClick={() => setShowBanModal(false)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600">Le compte sera suspendu et l'utilisateur recevra une notification.</p>
              <div>
                <label className={labelCls}>Raison (optionnel)</label>
                <textarea value={banReason} onChange={e => setBanReason(e.target.value)} className={inputCls + " h-24 resize-none"} placeholder="Expliquez la raison..." />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowBanModal(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                <button onClick={handleBan} disabled={actionLoading} className="flex items-center gap-2 px-7 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50">
                  {actionLoading ? <Loader2 size={15} className="animate-spin" /> : <Ban size={15} />} Bannir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`font-semibold text-gray-700 text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
