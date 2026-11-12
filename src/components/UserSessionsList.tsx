"use client";

import SectionTitle from "@/components/SectionTitle";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Smartphone, X } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";

interface Session {
  id: string;
  created_at: string;
  updated_at: string | null;
  user_agent: string | null;
  label: string | null;
  is_current: boolean;
}

/** "Sur quels appareils suis-je connecté ?" + déconnexion à distance — pour
 * tout compte (parent, enfant), pas seulement les admins (qui ont déjà
 * l'équivalent via les appareils de confiance 2FA). */
export default function UserSessionsList() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const res = await fetch("/api/user/sessions", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) setSessions(data.sessions);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Un même appareil peut avoir laissé plusieurs lignes (navigation privée, cookies effacés, application installée) :
  // on n'en montre qu'une, la plus récente, et la retirer retire toutes ses lignes.
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = `${s.label || ""}|${s.user_agent || ""}`;
    groups.set(key, [...(groups.get(key) || []), s]);
  }
  const devices = [...groups.values()].map((list) => ({ ...list[0], is_current: list.some((x) => x.is_current), ids: list.map((x) => x.id) }));

  const revoke = async (ids: string[]) => {
    setRevoking(ids[0]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const done = await Promise.all(ids.map((id) => fetch(`/api/user/sessions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } }).then((r) => (r.ok ? id : null)).catch(() => null)));
      setSessions((s) => s.filter((x) => !done.includes(x.id)));
    } finally {
      setRevoking(null);
    }
  };

  // Rien à gérer : pas de carte vide « Aucune session active ».
  if (loading || sessions.length === 0) return null;

  return (
    <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
      <SectionTitle emblem="lock">Appareils connectés</SectionTitle>
      {(
        <div className="space-y-2">
          {devices.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <Smartphone className="w-4 h-4 shrink-0 text-gray-400" />
                {s.label || "Appareil inconnu"}
                {s.is_current && <span className="text-xs font-semibold text-green-600">(cet appareil)</span>}
                <span className="text-gray-400">
, actif le {new Date(s.updated_at || s.created_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
                </span>
              </span>
              {!s.is_current && (
                <GlassIconButton icon={X} color="red" size="sm" onClick={() => revoke(s.ids)} disabled={revoking === s.id} loading={revoking === s.id} aria-label="Déconnecter cet appareil" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
