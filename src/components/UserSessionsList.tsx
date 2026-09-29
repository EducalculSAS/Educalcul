"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Smartphone, Loader2, X } from "lucide-react";

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

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/user/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setSessions((s) => s.filter((x) => x.id !== id));
    } finally {
      setRevoking(null);
    }
  };

  if (loading) return null;

  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Appareils connectés</p>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune session active.</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <Smartphone className="w-4 h-4 shrink-0 text-gray-400" />
                {s.label || "Appareil inconnu"}
                {s.is_current && <span className="text-xs font-semibold text-green-600">(cet appareil)</span>}
                <span className="text-gray-400">
, actif le {new Date(s.updated_at || s.created_at).toLocaleDateString("fr-FR")}
                </span>
              </span>
              {!s.is_current && (
                <button
                  onClick={() => revoke(s.id)}
                  disabled={revoking === s.id}
                  className="text-gray-400 hover:text-red-600 transition-colors shrink-0"
                  title="Déconnecter cet appareil"
                  aria-label="Déconnecter cet appareil"
                >
                  {revoking === s.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <X className="w-4 h-4" aria-hidden="true" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
