"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { UserCog } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import { useToast } from "@/components/Toast";

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
  const pathname = usePathname();
  const { error: toastError } = useToast();
  const [state, setState] = useState<ImpersonationState | null>(null);
  const [ending, setEnding] = useState(false);

  // Revérifié à chaque navigation (pas juste au montage) — sinon la bannière
  // reste affichée à tort tant que le layout racine ne remonte pas (ex: après
  // une impersonation terminée côté serveur mais dont l'état client était
  // resté figé sur l'ancienne réponse "active").
  useEffect(() => {
    fetch("/api/admin/impersonate/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setState(d?.active ? { targetId: d.targetId, targetName: d.targetName, returnTo: d.returnTo } : null);
      })
      .catch(() => {});
  }, [pathname]);

  // La navbar publique (fixed top-0) se retrouvait cachée derrière cette
  // bannière (elle aussi fixed top-0, z-index plus haut) : on expose sa
  // hauteur via une variable CSS globale que Navbar.tsx lit pour se décaler
  // vers le bas quand la bannière est affichée — jamais l'inverse (rien ne
  // doit couvrir "Quitter" en pleine impersonation).
  useEffect(() => {
    document.documentElement.style.setProperty("--imp-banner-h", state ? "40px" : "0px");
    return () => {
      document.documentElement.style.setProperty("--imp-banner-h", "0px");
    };
  }, [state]);

  if (!state) return null;

  const endImpersonation = async () => {
    setEnding(true);
    try {
      const res = await fetch("/api/admin/impersonate/end", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.access_token || !data?.refresh_token) {
        // Ne JAMAIS naviguer vers l'admin sans avoir restauré la session
        // admin : la session active reste alors celle de la cible (parent/
        // enfant), et toute page /admin/* rebondirait vers /dashboard ou
        // /auth/connexion — exactement le "ça me renvoie à connexion"
        // rapporté. On reste sur place et on prévient plutôt que de
        // continuer dans un état cassé.
        toastError(data?.error || "Impossible de revenir à ta session admin, réessaie.");
        setEnding(false);
        return;
      }
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setSessionError) {
        toastError("Impossible de restaurer ta session admin, réessaie ou reconnecte-toi.");
        setEnding(false);
        return;
      }
      // Chargement complet de la page admin : une seule navigation (avant : router.push PUIS router.refresh, soit deux
      // rendus serveur dont un de la page du parent avec la session admin, d'où l'attente).
      window.location.replace(data.returnTo || state.returnTo || "/admin/users");
    } catch {
      toastError("Impossible de revenir à ta session admin, réessaie.");
      setEnding(false);
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] h-10 bg-amber-500 text-white text-sm font-semibold px-4 flex items-center justify-center gap-3 shadow-md">
      <UserCog className="w-4 h-4 shrink-0" />
      <span>Connecté en tant que {state.targetName} (mode admin)</span>
      <GlassButton
        onClick={endImpersonation}
        disabled={ending}
        variant="light"
        size="sm"
      >
        {ending ? "Retour..." : "Quitter"}
      </GlassButton>
    </div>
  );
}
