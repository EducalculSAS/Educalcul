"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { UserCog } from "lucide-react";

interface ImpersonationState {
  targetId: number;
  targetName: string;
  returnTo: string;
}

/** Bannière fixe visible sur tout le site tant qu'un admin est "connecté en
 * tant que" un autre compte — permet de revenir à sa propre session en un
 * clic. Vit dans le layout racine car la cible peut naviguer n'importe où
 * (dashboard parent, enfant...), pas seulement dans /admin. L'état
 * d'impersonation (et le refresh_token d'origine) vit côté serveur, référencé
 * par un cookie httpOnly : rien en sessionStorage. */
export default function ImpersonationBanner() {
  const router = useRouter();
  const [state, setState] = useState<ImpersonationState | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    fetch("/api/admin/impersonate/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.active) setState({ targetId: d.targetId, targetName: d.targetName, returnTo: d.returnTo });
      })
      .catch(() => {});
  }, []);

  if (!state) return null;

  const endImpersonation = async () => {
    setEnding(true);
    try {
      const res = await fetch("/api/admin/impersonate/end", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.access_token && data?.refresh_token) {
        await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      }
      router.push(data?.returnTo || state.returnTo || "/admin/users");
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
