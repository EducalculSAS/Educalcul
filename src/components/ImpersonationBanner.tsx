"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { UserCog } from "lucide-react";

const ORIGIN_KEY = "edu_impersonation_origin";
const STATE_KEY = "edu_impersonating";

interface ImpersonationState {
  targetId: number;
  targetName: string;
  returnTo: string;
}

/** Bannière fixe visible sur tout le site tant qu'un admin est "connecté en
 * tant que" un autre compte — permet de revenir à sa propre session en un
 * clic. Vit dans le layout racine car la cible peut naviguer n'importe où
 * (dashboard parent, enfant...), pas seulement dans /admin. */
export default function ImpersonationBanner() {
  const router = useRouter();
  const [state, setState] = useState<ImpersonationState | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  if (!state) return null;

  const endImpersonation = async () => {
    setEnding(true);
    try {
      const originRaw = sessionStorage.getItem(ORIGIN_KEY);
      if (originRaw) {
        const origin = JSON.parse(originRaw);
        await supabase.auth.setSession({ access_token: origin.access_token, refresh_token: origin.refresh_token });
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetch("/api/admin/impersonate/end", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ targetUserId: state.targetId, targetName: state.targetName }),
        });
      }
      sessionStorage.removeItem(ORIGIN_KEY);
      sessionStorage.removeItem(STATE_KEY);
      router.push(state.returnTo || "/admin/users");
      router.refresh();
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-amber-500 text-white text-sm font-semibold px-4 py-2 flex items-center justify-center gap-3 shadow-md">
      <UserCog className="w-4 h-4 shrink-0" />
      <span>Connecté en tant que {state.targetName} (mode admin)</span>
      <button
        onClick={endImpersonation}
        disabled={ending}
        className="underline hover:no-underline disabled:opacity-60"
      >
        {ending ? "Retour..." : "Quitter"}
      </button>
    </div>
  );
}
