"use client";

import { useCallback, useEffect, useState } from "react";
import { Bug, CheckCircle2, ChevronDown, Globe, Loader2, RotateCcw, Server } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { useToast } from "@/components/Toast";

interface ErrorRow {
  id: number;
  source: "client" | "server";
  message: string;
  stack: string | null;
  url: string | null;
  user_agent: string | null;
  user_id: number | null;
  count: number;
  first_seen: string;
  last_seen: string;
  resolved: boolean;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * Journal d'erreurs du site (remplace Sentry) : chaque bug n'apparaît qu'une
 * fois avec son nombre d'occurrences. « Résolu » le range ; s'il revient, il
 * réapparaît ici et les admins sont de nouveau prévenus.
 */
export default function AdminErrorsClient() {
  const toast = useToast();
  const [tab, setTab] = useState("open");
  const [rows, setRows] = useState<ErrorRow[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/errors${tab === "resolved" ? "?resolved=1" : ""}`);
    const data = await res.json().catch(() => ({}));
    setRows(res.ok ? data.errors ?? [] : []);
  }, [tab]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/errors${tab === "resolved" ? "?resolved=1" : ""}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => { if (alive) setRows(ok ? data.errors ?? [] : []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [tab]);

  const setResolved = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true);
    const res = await fetch("/api/admin/errors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) return toast.error("Action impossible");
    toast.success(msg);
    await load();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={Bug}
        title="Erreurs du site"
        subtitle="Les plantages du serveur et des navigateurs, regroupés. Une nouvelle erreur vous est notifiée."
        actions={
          tab === "open" && rows && rows.length > 0 ? (
            <GlassButton size="sm" variant="navy" onClick={() => setResolved({ all: true }, "Tout est marqué résolu.")} disabled={busy}>
              <CheckCircle2 className="w-4 h-4" /> Tout marquer résolu
            </GlassButton>
          ) : undefined
        }
      />

      <GlassSegmentedControl size="sm" value={tab} onChange={(t) => { setRows(null); setTab(t); }} options={[{ id: "open", label: "À traiter" }, { id: "resolved", label: "Résolues" }]} />

      {rows === null ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[var(--greek-blue)]" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-[20px] border border-dashed border-[rgba(197,161,72,0.4)] p-10 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
          <p className="text-[var(--text-muted)]">{tab === "open" ? "Aucune erreur à traiter." : "Aucune erreur résolue."}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => {
            const open = expanded === e.id;
            const Icon = e.source === "server" ? Server : Globe;
            return (
              <li key={e.id} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.22)] shadow-sm">
                <div className="p-4 flex items-start gap-3">
                  <span className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${e.source === "server" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--greek-blue)] break-words">{e.message}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-3">
                      <span>{e.source === "server" ? "Serveur" : "Navigateur"}</span>
                      <span className="font-bold text-[var(--greek-blue)]">{e.count}×</span>
                      <span>dernière : {when(e.last_seen)}</span>
                      <span>première : {when(e.first_seen)}</span>
                      {e.url && <span className="font-mono truncate max-w-[18rem]">{e.url}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <GlassIconButton icon={ChevronDown} color="gray" size="sm" onClick={() => setExpanded(open ? null : e.id)} aria-label={open ? "Masquer le détail" : "Voir le détail"} />
                    {e.resolved ? (
                      <GlassIconButton icon={RotateCcw} color="navy" size="sm" onClick={() => setResolved({ id: e.id, resolved: false }, "Erreur rouverte.")} aria-label="Rouvrir" />
                    ) : (
                      <GlassIconButton icon={CheckCircle2} color="green" size="sm" onClick={() => setResolved({ id: e.id }, "Erreur marquée résolue.")} aria-label="Marquer résolu" />
                    )}
                  </div>
                </div>
                {open && (
                  <div className="px-4 pb-4 space-y-2">
                    {e.user_agent && <p className="text-xs text-[var(--text-muted)] break-words">Navigateur : {e.user_agent}</p>}
                    {e.user_id && <p className="text-xs text-[var(--text-muted)]">Utilisateur : <a className="underline" href={`/admin/users/detail?id=${e.user_id}`}>fiche n°{e.user_id}</a></p>}
                    <pre className="text-[11px] leading-relaxed bg-[#0f1e3a] text-white/85 rounded-xl p-3 overflow-x-auto max-h-72">{e.stack || "(pas de trace)"}</pre>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
