"use client";

import { useVisiblePolling } from "@/lib/useVisiblePolling";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

import {
  Users, Search, Plus, Trash2, CheckCircle, XCircle,
  Loader2, Shield, User as UserIcon, Baby, Globe, MapPin,
  Eye, EyeOff, Ban, Download, FileText, Table,
} from "lucide-react";
import { useRouter } from "next/navigation";
import PageLoader from "@/components/PageLoader";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GradePromotionPanel from "@/components/admin/GradePromotionPanel";
import PlacementQuizPanel from "@/components/admin/PlacementQuizPanel";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { getAdminCache, setAdminCache, invalidateAdminCache } from "@/lib/adminCache";

interface User {
  id: string;
  auth_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "admin" | "parent" | "child";
  status: "active" | "inactive" | "pending";
  created_at: string;
  grade_level?: string;
  child_age?: number;
  avatar?: string;
  equipped_border?: string | null;
  last_login_ip?: string;
  last_login_city?: string;
  last_login_country?: string;
  last_logout_ip?: string;
  last_logout_city?: string;
  last_logout_country?: string;
  last_logout_at?: string;
  latitude?: number;
  longitude?: number;
  last_active_at?: string;
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

const roleBadge = (role: string) => {
  if (role === "admin") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700"><Shield className="w-3 h-3" />Admin</span>;
  if (role === "parent") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700"><UserIcon className="w-3 h-3" />Parent</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><Baby className="w-3 h-3" />Élève</span>;
};

const statusBadge = (status: string) => {
  if (status === "active") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" />Actif</span>;
  if (status === "inactive") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700"><XCircle className="w-3 h-3" />Inactif</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700"><Loader2 className="w-3 h-3" />En attente</span>;
};

const isOnline = (u: User) =>
  !!u.last_active_at && Date.now() - new Date(u.last_active_at).getTime() < ONLINE_THRESHOLD_MS;

const inputCls = "w-full px-4 py-2.5 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

// ─── Export helpers ──────────────────────────────────────────────────────────

interface LoginEvent {
  id: number;
  logged_at: string;
  ip?: string;
  city?: string;
  country?: string;
  device_type?: string;
  user_agent?: string;
  latitude?: number;
  longitude?: number;
  logged_out_at?: string;
  logout_ip?: string;
  logout_city?: string;
  logout_country?: string;
}

async function fetchLoginHistory(userId: string): Promise<LoginEvent[]> {
  try {
    const r = await fetch(`/api/admin/user-login-history?user_id=${userId}`);
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

function buildCSV(users: User[], loginHistory?: LoginEvent[]): string {
  const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const d = (v: any) => v ? new Date(v).toLocaleString("fr-FR") : "";

  if (users.length === 1 && loginHistory) {
    // Fiche détaillée d'un seul utilisateur avec historique complet
    const u = users[0];
    const summaryHeaders = ["ID", "Prénom", "Nom", "Email", "Rôle", "Statut", "Niveau", "Dernière activité", "Inscription", "Connexions totales"];
    const summaryRow = [u.id, u.first_name, u.last_name, u.email, u.role, u.status, u.grade_level || "", d(u.last_active_at), d(u.created_at), loginHistory.length];

    const separator = [""];
    const historyTitle = ["=== HISTORIQUE DES CONNEXIONS ==="];
    const histHeaders = ["N°", "Date & heure", "IP", "Ville", "Pays", "Type d'appareil", "User Agent", "Latitude", "Longitude"];
    const histRows = loginHistory.map((h, i) => [
      i + 1, d(h.logged_at), h.ip || "", h.city || "", h.country || "",
      h.device_type || "", h.user_agent || "",
      h.latitude?.toFixed(5) || "", h.longitude?.toFixed(5) || "",
    ]);

    return "﻿" + [summaryHeaders, summaryRow, separator, historyTitle, histHeaders, ...histRows]
      .map(r => r.map(q).join(";")).join("\r\n");
  }

  // Export liste multi-users
  const headers = ["ID", "Prénom", "Nom", "Email", "Rôle", "Statut", "Niveau", "Ville", "Pays", "IP", "IP déconnexion", "Dernière activité", "Inscription", "Localisation (IP)"];
  const rows = users.map(u => [
    u.id, u.first_name, u.last_name, u.email, u.role, u.status,
    u.grade_level || "", u.last_login_city || "", u.last_login_country || "",
    u.last_login_ip || "", u.last_logout_ip || "", d(u.last_active_at), d(u.created_at),
    u.latitude && u.longitude ? `${u.latitude?.toFixed(5)}, ${u.longitude?.toFixed(5)}` : "",
  ]);
  return "﻿" + [headers, ...rows].map(r => r.map(q).join(";")).join("\r\n");
}

function downloadCSV(users: User[], filename: string, loginHistory?: LoginEvent[]) {
  const blob = new Blob([buildCSV(users, loginHistory)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Échappe toute valeur avant interpolation HTML : ces données (nom, ville,
// pays...) sont saisies par des utilisateurs non-admin et sont injectées via
// document.write dans une fenêtre de même origine que l'admin — sans
// échappement, un utilisateur pourrait exécuter du script dans ce contexte.
function esc(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c] as string));
}

function buildPDF(users: User[], title: string, loginHistory?: LoginEvent[]): string {
  const NAVY = "#1a3a5c", GOLD = "#c5a148";
  const d = (v: any) => v ? esc(new Date(v).toLocaleString("fr-FR")) : "-";
  const single = users.length === 1;
  const u = users[0];

  const historySection = single && loginHistory && loginHistory.length > 0 ? `
    <div class="bar"></div>
    <h2 class="section-title">Historique des connexions (${loginHistory.length})</h2>
    <table class="main-table">
      <thead><tr>
        <th>#</th><th>Date & heure</th><th>IP</th><th>Ville</th><th>Pays</th><th>Appareil</th><th>GPS</th>
      </tr></thead>
      <tbody>
        ${loginHistory.map((h, i) => `<tr>
          <td style="color:#888">${loginHistory.length - i}</td>
          <td>${d(h.logged_at)}</td>
          <td style="font-family:monospace;font-size:10px">${esc(h.ip) || "-"}</td>
          <td>${esc(h.city) || "-"}</td>
          <td>${esc(h.country) || "-"}</td>
          <td>${esc(h.device_type) || "-"}</td>
          <td style="font-size:10px">${h.latitude ? `${h.latitude.toFixed(4)}, ${h.longitude?.toFixed(4)}` : "-"}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : single && loginHistory?.length === 0 ? `
    <div class="bar"></div>
    <p style="color:#aaa;font-size:11px;text-align:center;padding:12px">Aucun historique de connexion enregistré</p>` : "";

  const tableRows = single ? `
    <table class="info-table">
      ${[
        ["ID interne", u.id],
        ["Email", u.email],
        ["Rôle", u.role],
        ["Statut", u.status],
        ["Niveau", u.grade_level || "-"],
        ["Dernière ville connue", u.last_login_city || "-"],
        ["Dernier pays connu", u.last_login_country || "-"],
        ["Dernière IP connue", u.last_login_ip || "-"],
        ["IP déconnexion", u.last_logout_ip || "-"],
        ["Dernière activité", d(u.last_active_at)],
        ["Inscription", d(u.created_at)],
        ["Total connexions", loginHistory ? String(loginHistory.length) : "-"],
        ["Localisation (IP)", u.latitude && u.longitude ? `${u.latitude?.toFixed(5)}, ${u.longitude?.toFixed(5)}` : "-"],
      ].map(([k, v]) => `<tr><td class="label">${esc(k)}</td><td class="value">${esc(v) || "-"}</td></tr>`).join("")}
    </table>
    ${historySection}` : `
    <table class="main-table">
      <thead><tr>
        <th>Nom</th><th>Email</th><th>Rôle</th><th>Statut</th><th>Ville</th><th>Inscription</th>
      </tr></thead>
      <tbody>
        ${users.map(u => `<tr>
          <td>${esc(u.first_name)} ${esc(u.last_name)}</td>
          <td>${esc(u.email)}</td>
          <td>${esc(u.role)}</td>
          <td>${esc(u.status)}</td>
          <td>${esc(u.last_login_city) || "-"}</td>
          <td>${d(u.created_at)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;font-size:12px;color:#222;background:#fff}
    .page{max-width:900px;margin:0 auto;padding:24px}
    .header{background:${NAVY};color:#fff;padding:24px 32px;border-radius:10px;margin-bottom:20px;display:flex;align-items:center;gap:16px}
    .header img{height:40px;width:auto;flex-shrink:0}
    .brand{font-family:'Cinzel',serif;font-size:10px;color:${GOLD};letter-spacing:5px;text-transform:uppercase;margin-bottom:4px}
    .header-title{font-family:'Cinzel',serif;font-size:20px;font-weight:700}
    .header-sub{color:rgba(255,255,255,0.6);font-size:11px;margin-top:3px}
    .section-title{font-family:'Cinzel',serif;font-size:13px;font-weight:600;color:${NAVY};margin-bottom:10px;letter-spacing:.05em}
    .info-table{width:100%;border-collapse:collapse;background:#fafaf8;border:1px solid rgba(197,161,72,0.2);border-radius:8px;overflow:hidden;margin-bottom:6px}
    .info-table tr:not(:last-child) td{border-bottom:1px solid rgba(197,161,72,0.1)}
    .info-table td{padding:7px 14px;vertical-align:top}
    .info-table td.label{color:#888;width:38%;font-weight:500}
    .info-table td.value{font-weight:500;color:#222}
    .main-table{width:100%;border-collapse:collapse;font-size:11px}
    .main-table thead tr{background:${NAVY};color:#fff}
    .main-table th{padding:8px 10px;text-align:left;font-family:'Cinzel',serif;font-size:9px;letter-spacing:.08em;font-weight:600}
    .main-table tbody tr:nth-child(even){background:#f8f6f0}
    .main-table td{padding:6px 10px;border-bottom:1px solid rgba(197,161,72,0.08)}
    .bar{height:2px;background:linear-gradient(90deg,${NAVY},${GOLD},${NAVY});margin:16px 0}
    .footer{text-align:center;color:#aaa;font-size:10px;margin-top:20px;padding-top:14px;border-top:1px solid rgba(197,161,72,0.2)}
    .footer strong{font-family:'Cinzel',serif;color:${GOLD};font-size:12px;display:block;margin-bottom:3px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.main-table{page-break-inside:auto}tr{page-break-inside:avoid}}
  </style></head><body>
  <div class="page">
    <div class="header">
      <img src="/logo.png" alt="Educalcul"/>
      <div>
        <div class="brand">EDUCALCUL</div>
        <div class="header-title">${esc(title)}</div>
        <div class="header-sub">${single ? `${esc(u.first_name)} ${esc(u.last_name)} : ${esc(u.email)}` : `${users.length} utilisateurs : ${new Date().toLocaleDateString("fr-FR")}`}</div>
      </div>
    </div>
    <div class="bar"></div>
    ${tableRows}
    <div class="footer">
      <strong>EDUCALCUL</strong>
      Généré le ${new Date().toLocaleString("fr-FR")} : Usage interne confidentiel
    </div>
  </div>
</body></html>`;
}

function openPDF(users: User[], title: string, loginHistory?: LoginEvent[]) {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(buildPDF(users, title, loginHistory));
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ users, title, onClose }: { users: User[]; title: string; onClose: () => void }) {
  const isSingle = users.length === 1;
  const [loginHistory, setLoginHistory] = useState<LoginEvent[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const filename = isSingle
    ? `user_${users[0].first_name}_${users[0].last_name}_${new Date().toISOString().slice(0, 10)}`
    : `educalcul_users_${new Date().toISOString().slice(0, 10)}`;

  useEffect(() => {
    if (!isSingle) return;
    setLoadingHistory(true);
    fetchLoginHistory(users[0].id).then(h => {
      setLoginHistory(h);
      setLoadingHistory(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 modal-overlay">
      <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="border-b border-[rgba(197,161,72,0.25)] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Exporter</h2>
          <GlassCloseButton onClick={onClose} />
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">{title}</p>
            {isSingle && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                {loadingHistory ? (
                  <><Loader2 size={11} className="animate-spin" /> Chargement historique…</>
                ) : (
                  <>{loginHistory?.length ?? 0} connexion{(loginHistory?.length ?? 0) > 1 ? "s" : ""}</>
                )}
              </span>
            )}
          </div>
          <button
            disabled={isSingle && loadingHistory}
            onClick={() => { downloadCSV(users, `${filename}.csv`, loginHistory ?? undefined); onClose(); }}
            className="w-full flex items-center gap-3 px-5 py-3.5 border border-[rgba(197,161,72,0.3)] rounded-xl hover:bg-green-50 hover:border-green-200 transition-colors text-left disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <Table size={18} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-800">Fichier CSV</p>
              <p className="text-xs text-gray-400">{isSingle ? "Profil + historique complet des connexions" : "Compatible Excel, Google Sheets"}</p>
            </div>
          </button>
          <button
            disabled={isSingle && loadingHistory}
            onClick={() => { openPDF(users, title, loginHistory ?? undefined); onClose(); }}
            className="w-full flex items-center gap-3 px-5 py-3.5 border border-[rgba(197,161,72,0.3)] rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors text-left disabled:opacity-50"
          >
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-800">Fichier PDF</p>
              <p className="text-xs text-gray-400">{isSingle ? "Fiche + tableau des connexions" : "Mise en page Educalcul avec logo"}</p>
            </div>
          </button>
          <button
            disabled={isSingle && loadingHistory}
            onClick={() => {
              downloadCSV(users, `${filename}.csv`, loginHistory ?? undefined);
              setTimeout(() => openPDF(users, title, loginHistory ?? undefined), 300);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-5 py-3.5 bg-[var(--greek-blue)] rounded-xl hover:bg-blue-900 transition-colors text-left disabled:opacity-50"
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
  );
}

/** Gestion des utilisateurs : la liste initiale (non filtrée) arrive déjà
 * chargée du serveur ; changer de filtre rôle/statut, le rafraîchissement
 * silencieux toutes les 30s, et toutes les mutations restent des
 * allers-retours client, comme avant. */
type PlanOption = { id: number; name: string; price: string | number; billing_interval: string };

const BILLING_INTERVAL_LABEL: Record<string, string> = {
  month: "mois",
  quarter: "trimestre",
  semester: "semestre",
  year: "an",
  one_time: "à vie",
};

export default function AdminUsersClient({
  initialUsers,
  plans = [],
}: {
  initialUsers: User[];
  plans?: PlanOption[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentAuthId, setCurrentAuthId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const isFirstRender = useRef(true);

  const UserMap = useMemo(() => dynamic(
    () => import("@/components/admin/UserMap"),
    { ssr: false, loading: () => <div className="h-full w-full bg-gray-50 animate-pulse flex items-center justify-center text-gray-400 text-sm">Chargement de la carte...</div> }
  ), []);

  // ── Modal states ──────────────────────────────────────────────────────────
  // Export
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportTarget, setExportTarget] = useState<User[] | null>(null);

  // Create
  const [showFormModal, setShowFormModal] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", role: "parent", status: "active", gradeLevel: SCHOOL_LEVELS[0].value, username: "", subscriptionPlanId: "", billingMode: "offert" });
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Ban
  const [showBanModal, setShowBanModal] = useState(false);
  const [banTarget, setBanTarget] = useState<User | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDays, setBanDays] = useState<number | null>(null);

  // Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, statusFilter]);

  // Statut « en ligne » : toutes les 60 s (onglet visible), on ne recharge que
  // les comptes actifs dans les 15 dernières minutes et on les fusionne — avant,
  // TOUTE la liste était retéléchargée toutes les 30 s.
  const refreshPresence = useCallback(async () => {
    const res = await fetch("/api/admin/users?recent=1").catch(() => null);
    if (!res?.ok) return;
    const recent = await res.json().catch(() => []);
    if (!Array.isArray(recent) || recent.length === 0) return;
    const byId = new Map(recent.map((u: User) => [u.id, u]));
    setUsers((prev) => prev.map((u) => (byId.has(u.id) ? { ...u, ...byId.get(u.id) } : u)));
  }, []);
  useVisiblePolling(refreshPresence, 60000);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentAuthId(user.id);
        await fetch("/api/admin/activity-ping", { method: "POST" });
      } catch {}
    })();
  }, []);

  const fetchUsers = async (silent = false) => {
    const cacheKey = `users:${roleFilter}:${statusFilter}`;
    const cached = getAdminCache<any[]>(cacheKey);
    if (!silent) {
      if (cached) { setUsers(cached); setLoading(false); }
      else setLoading(true);
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { if (!silent && !cached) setLoading(false); return; }
    let url = `/api/admin/users?userId=${session.user.id}`;
    if (roleFilter !== "all") url += `&role=${roleFilter}`;
    if (statusFilter !== "all") url += `&status=${statusFilter}`;
    const res = await fetch(url);
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setUsers(list);
    setAdminCache(cacheKey, list);
    if (!silent) setLoading(false);
  };

  const filteredUsers = users.filter(u => {
    const s = searchTerm.toLowerCase();
    return (u.first_name?.toLowerCase() || "").includes(s) || (u.last_name?.toLowerCase() || "").includes(s) || (u.email?.toLowerCase() || "").includes(s);
  });

  const onlineCount = users.filter(u => isOnline(u) && u.auth_id !== currentAuthId).length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: any = { userId: currentAuthId, firstName: form.firstName, lastName: form.lastName, email: form.email, role: form.role, status: form.status, gradeLevel: form.gradeLevel, password: form.password };
      if (form.role === "child") body.username = form.username;
      if (form.subscriptionPlanId) {
        body.subscriptionPlanId = form.subscriptionPlanId;
        body.billingMode = form.billingMode;
      }
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur");
      setShowFormModal(false);
      invalidateAdminCache("users:");
      fetchUsers();
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  };

  const handleBanConfirm = async () => {
    if (!banTarget) return;
    setSubmitting(true);
    const isBanned = banTarget.status === "inactive";
    await fetch(`/api/admin/user-detail?id=${banTarget.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: isBanned ? "unban" : "ban", payload: { reason: banReason, banDays } }),
    });
    setShowBanModal(false);
    setBanReason("");
    setBanDays(null);
    setBanTarget(null);
    setSubmitting(false);
    invalidateAdminCache("users:");
    fetchUsers(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    const res = await fetch(`/api/admin/users?auth_id=${deleteTarget.auth_id}&userId=${currentAuthId}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(users.filter(u => u.id !== deleteTarget.id));
      const json = await res.json().catch(() => null);
      if (json?.warning) alert(json.warning);
    }
    invalidateAdminCache("users:");
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setSubmitting(false);
  };

  // Positions approximatives basées sur l'IP de connexion
  const mapUsers = users.filter(u => u.latitude && u.longitude).map(u => ({
    id: u.id, name: `${u.first_name} ${u.last_name}`, email: u.email,
    status: u.status, lat: u.latitude!, lng: u.longitude!, role: u.role,
    city: u.last_login_city, lastActive: u.last_active_at, isOnline: isOnline(u),
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Users}
        title="Gestion des Utilisateurs"
        subtitle="Gérez les comptes parents, élèves et administrateurs"
        actions={
          <>
            <GlassButton
              size="sm"
              variant="outline"
              onClick={() => { setExportTarget(filteredUsers); setShowExportModal(true); }}
            >
              <Download size={16} />
              <span className="hidden sm:inline">Exporter</span>
            </GlassButton>
            <GlassButton
              size="sm"
              variant="navy"
              onClick={() => { setForm({ firstName: "", lastName: "", email: "", password: "", role: "parent", status: "active", gradeLevel: SCHOOL_LEVELS[0].value, username: "", subscriptionPlanId: "", billingMode: "offert" }); setShowFormModal(true); }}
            >
              <Plus size={18} /> <span className="hidden sm:inline">Nouvel Utilisateur</span><span className="sm:hidden">Nouveau</span>
            </GlassButton>
          </>
        }
      />

      <GradePromotionPanel />
      <PlacementQuizPanel />

      {/* Map */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-4 sm:p-6 relative z-0 overflow-hidden">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4 relative z-10">
          <h2 className="text-lg font-bold text-[var(--greek-blue)] flex items-center gap-2">
            <Globe className="text-[var(--greek-gold)]" size={20} />Carte des Connexions
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1 rounded-full border border-green-100">
              <span className="relative flex h-2 w-2">
                {onlineCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />}
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs font-bold text-green-700">{onlineCount} en ligne</span>
            </div>
            <span className="text-xs text-gray-400 hidden sm:inline">Actif dans les 5 dernières minutes</span>
          </div>
        </div>
        <div className="w-full overflow-hidden rounded-xl" style={{ height: "clamp(220px, 50vw, 400px)" }}>
          <UserMap users={mapUsers} />
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] space-y-4">
        <div className="flex flex-col md:flex-row gap-4 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Rechercher par nom, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20">
              <option value="all">Tous les rôles</option>
              <option value="admin">Admin</option><option value="parent">Parent</option><option value="child">Élève</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-4 py-2 bg-gray-50 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20">
              <option value="all">Tous les statuts</option>
              <option value="active">Actif</option><option value="inactive">Inactif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-[rgba(197,161,72,0.25)]">
              <tr>
                {["Utilisateur", "Email", "Rôle", "Statut", "Dernière activité", "Actions"].map(h => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${h === "Actions" ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="py-12"><PageLoader /></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">Aucun utilisateur trouvé</td></tr>
              ) : filteredUsers.map(user => {
                const online = isOnline(user);
                return (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <AvatarWithBorder
                          avatar={user.avatar}
                          equippedBorder={user.equipped_border}
                          name={`${user.first_name ?? ""} ${user.last_name ?? ""}`}
                          size="sm"
                          online={online}
                          label=""
                        />
                        <div>
                          <div className="font-semibold text-gray-800">{user.first_name} {user.last_name}</div>
                          {user.last_login_city && <div className="text-xs text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{user.last_login_city}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500">{user.email}</td>
                    <td className="px-5 py-4">{roleBadge(user.role)}</td>
                    <td className="px-5 py-4">{statusBadge(user.status)}</td>
                    <td className="px-5 py-4 text-xs text-gray-400">
                      {user.last_active_at ? online
                        ? <span className="text-green-600 font-semibold">En ligne</span>
                        : new Date(user.last_active_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "Jamais"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <GlassIconButton
                          icon={Eye}
                          color="navy"
                          size="sm"
                          onClick={() => router.push(`/admin/users/detail?id=${user.id}`)}
                          aria-label="Voir le profil"
                        />
                        <GlassIconButton
                          icon={Download}
                          color="gold"
                          size="sm"
                          onClick={() => { setExportTarget([user]); setShowExportModal(true); }}
                          aria-label="Exporter"
                        />
                        <GlassIconButton
                          icon={Ban}
                          color={user.status === "inactive" ? "green" : "orange"}
                          size="sm"
                          onClick={() => { setBanTarget(user); setBanReason(""); setShowBanModal(true); }}
                          aria-label={user.status === "inactive" ? "Réactiver" : "Bannir"}
                        />
                        <GlassIconButton
                          icon={Trash2}
                          color="red"
                          size="sm"
                          onClick={() => { setDeleteTarget(user); setShowDeleteModal(true); }}
                          aria-label="Supprimer"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: Export ── */}
      {showExportModal && exportTarget && (
        <ExportModal
          users={exportTarget}
          title={exportTarget.length === 1
            ? `Profil de ${exportTarget[0].first_name} ${exportTarget[0].last_name}`
            : `${exportTarget.length} utilisateurs sélectionnés`}
          onClose={() => { setShowExportModal(false); setExportTarget(null); }}
        />
      )}

      {/* ── MODAL: Créer utilisateur ── */}
      {showFormModal && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 modal-overlay">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="sticky top-0 bg-white border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">Nouvel utilisateur</h2>
              <GlassCloseButton onClick={() => setShowFormModal(false)} />
            </div>
            <form onSubmit={handleFormSubmit} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Prénom</label><input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Nom</label><input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={inputCls} /></div>
              </div>
              <div><label className={labelCls}>Email</label><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Mot de passe *</label>
                <div className="relative">
                  <input
                    type={showFormPassword ? "text" : "password"}
                    required
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className={inputCls + " font-mono pr-10"}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2">
                    <GlassIconButton
                      icon={showFormPassword ? EyeOff : Eye}
                      color="navy"
                      size="sm"
                      onClick={() => setShowFormPassword(v => !v)}
                      aria-label={showFormPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    />
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>Rôle</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={inputCls}>
                    <option value="parent">Parent</option><option value="child">Élève</option><option value="admin">Admin</option>
                  </select>
                </div>
                <div><label className={labelCls}>Statut</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    <option value="active">Actif</option><option value="inactive">Inactif</option>
                  </select>
                </div>
              </div>
              {form.role === "child" && (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Nom d'utilisateur (élève)</label>
                    <input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inputCls} placeholder="ex: leo_dupont" />
                  </div>
                  <div><label className={labelCls}>Niveau scolaire</label>
                    <select required value={form.gradeLevel} onChange={e => setForm({ ...form, gradeLevel: e.target.value })} className={inputCls}>
                      {SCHOOL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {form.role !== "admin" && plans.length > 0 && (
                <div className="rounded-xl border border-[rgba(197,161,72,0.25)] bg-[rgba(197,161,72,0.06)] p-4 space-y-3">
                  <div>
                    <label className={labelCls}>Abonnement</label>
                    <select
                      value={form.subscriptionPlanId}
                      onChange={e => setForm({ ...form, subscriptionPlanId: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">Aucun (plan gratuit)</option>
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} : {Number(p.price).toFixed(2)} € / {BILLING_INTERVAL_LABEL[p.billing_interval] || p.billing_interval}
                        </option>
                      ))}
                    </select>
                    {form.role === "child" && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        Un élève sans parent utilise son propre abonnement : ce choix lui donne l'accès directement.
                      </p>
                    )}
                  </div>

                  {form.subscriptionPlanId && (
                    <div>
                      <label className={labelCls}>Facturation</label>
                      <div className="flex flex-col gap-2 mt-1">
                        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name="billingMode"
                            value="offert"
                            checked={form.billingMode === "offert"}
                            onChange={e => setForm({ ...form, billingMode: e.target.value })}
                            className="mt-1"
                          />
                          <span>
                            <strong>Offert</strong>, accès immédiat, aucun paiement demandé.
                          </span>
                        </label>
                        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name="billingMode"
                            value="stripe"
                            checked={form.billingMode === "stripe"}
                            onChange={e => setForm({ ...form, billingMode: e.target.value })}
                            className="mt-1"
                          />
                          <span>
                            <strong>Doit payer</strong>, le compte démarre en gratuit et devra souscrire lui-même.
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setShowFormModal(false)}>Annuler</GlassButton>
                <GlassButton
                  size="sm"
                  variant="navy"
                  disabled={submitting}
                  onClick={() => handleFormSubmit({ preventDefault: () => {} } as unknown as React.FormEvent)}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}Créer
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Ban / Unban ── */}
      {showBanModal && banTarget && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 modal-overlay">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className={`text-xl font-bold font-[family-name:var(--font-display)] ${banTarget.status === "inactive" ? "text-green-600" : "text-orange-500"}`}>
                {banTarget.status === "inactive" ? "Réactiver le compte" : "Bannir l'utilisateur"}
              </h2>
              <GlassCloseButton onClick={() => setShowBanModal(false)} />
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600">
                {banTarget.status === "inactive"
                  ? `Réactiver le compte de ${banTarget.first_name} ${banTarget.last_name} ?`
                  : `Suspendre le compte de ${banTarget.first_name} ${banTarget.last_name}. L'utilisateur recevra une notification.`}
              </p>
              {banTarget.status === "active" && (
                <>
                  <div>
                    <label className={labelCls}>Durée du bannissement</label>
                    <select value={banDays || ""} onChange={e => setBanDays(e.target.value ? parseInt(e.target.value) : null)} className={inputCls}>
                      <option value="">Permanente</option>
                      <option value="1">1 jour</option>
                      <option value="7">7 jours</option>
                      <option value="30">30 jours</option>
                      <option value="90">90 jours</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Raison (optionnel)</label>
                    <textarea value={banReason} onChange={e => setBanReason(e.target.value)} className={inputCls + " h-20 resize-none"} placeholder="Expliquez la raison..." />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => { setShowBanModal(false); setBanReason(""); setBanDays(null); }}>Annuler</GlassButton>
                <GlassButton
                  size="sm"
                  variant={banTarget.status === "inactive" ? "outline" : "danger"}
                  disabled={submitting}
                  onClick={handleBanConfirm}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Ban size={15} />{banTarget.status === "inactive" ? "Réactiver" : "Bannir"}
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Supprimer ── */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 z-[1060] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 modal-overlay">
          <div className="bg-white/90 backdrop-blur-[24px] backdrop-saturate-[1.4] rounded-2xl shadow-2xl w-full max-w-md">
            <div className="border-b border-[rgba(197,161,72,0.25)] px-8 py-5 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-xl font-bold text-red-600 font-[family-name:var(--font-display)]">Supprimer le compte</h2>
              <GlassCloseButton onClick={() => setShowDeleteModal(false)} />
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm text-gray-600">
                Supprimer définitivement le compte de <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong> ({deleteTarget.email}) ?
                <br /><span className="text-red-500 font-medium">Cette action est irréversible.</span>
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <GlassButton size="sm" variant="ghost" onClick={() => setShowDeleteModal(false)}>Annuler</GlassButton>
                <GlassButton size="sm" variant="danger" disabled={submitting} onClick={handleDeleteConfirm}>
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}<Trash2 size={15} /> Supprimer définitivement
                </GlassButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
