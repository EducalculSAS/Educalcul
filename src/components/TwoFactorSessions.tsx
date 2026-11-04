"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Smartphone, X } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";

interface Session {
  id: number;
  created_at: string;
  expires_at: string;
  user_agent: string | null;
}

function summarizeUA(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  if (/iphone|ipad/i.test(ua)) return "iPhone / iPad";
  if (/android/i.test(ua)) return "Android";
  if (/macintosh/i.test(ua)) return "Mac";
  if (/windows/i.test(ua)) return "Windows";
  return "Ordinateur";
}

/** Liste des appareils "de confiance" (sessions 2FA actives) — utilisée dans les profils. */
export default function TwoFactorSessions() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [revoking, setRevoking] = useState<number | null>(null);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    const res = await fetch("/api/auth/2fa/sessions", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (res.ok) setSessions(data.sessions);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const revoke = async (id: number) => {
    setRevoking(id);
    try {
      const res = await fetch(`/api/auth/2fa/sessions?id=${id}`, { method: "DELETE" });
      if (res.ok) setSessions(s => s.filter(x => x.id !== id));
    } finally {
      setRevoking(null);
    }
  };

  if (loading || sessions.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-[rgba(197,161,72,0.15)]">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Appareils de confiance</p>
      <div className="space-y-2">
        {sessions.map(s => (
          <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-200">
            <span className="flex items-center gap-2 text-sm text-gray-600">
              <Smartphone className="w-4 h-4 shrink-0 text-gray-400" />
              {summarizeUA(s.user_agent)}, depuis le {new Date(s.created_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
            </span>
            <GlassIconButton icon={X} color="red" size="sm" onClick={() => revoke(s.id)} disabled={revoking === s.id} loading={revoking === s.id} aria-label="Révoquer cet appareil" />
          </div>
        ))}
      </div>
    </div>
  );
}
