"use client";

import { useFeatures } from "@/lib/useFeatures";
import Link from "@/components/AppLink";
import Image from "next/image";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { loadSupabase, useSupabaseWhenSession } from "@/lib/supabaseLazy";
import { getMyProfile } from "@/lib/updateMyProfile";
import { trackLogout } from "@/lib/trackLogout";
import { getDashboardPath } from "@/lib/authRedirect";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import { Menu, X, LogOut } from "lucide-react";

/** Menu public, par groupes, dans l'ordre d'une visite. Le pied de page suit le même ordre (Footer.tsx). */
const PUBLIC_MENU: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Découvrir", links: [
    { href: "/", label: "Accueil" },
    { href: "/offres", label: "Offres" },
    { href: "/calia-tuteur-ia-maths", label: "Calia" },
    { href: "/programmes", label: "Programmes" },
    { href: "/tarifs", label: "Tarifs" },
  ] },
  { title: "Educalcul", links: [
    { href: "/methode-pedagogique", label: "Méthode pédagogique" },
    { href: "/a-propos", label: "À propos" },
  ] },
  { title: "Aide", links: [
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
  ] },
];

// La cloche n'existe que pour un compte connecté : chargée à part, jamais pour un visiteur.
const NotificationBell = dynamic(() => import("@/components/NotificationBell"), { ssr: false });

// Pages "app" où on affiche le menu connecté
const APP_PREFIXES = ["/parent", "/child", "/admin", "/dashboard"];

/** Lien du menu déroulant en pilule verre liquide — texte seul, centré,
 * sans distinction dorée pour la page active (juste le reflet blanc au
 * survol commun à tous les boutons verre liquide). */
function DropdownLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <GlassButton
      href={href}
      onClick={onClick}
      variant="light"
      size="sm"
      fullWidth
      className="font-[family-name:var(--font-display)]"
    >
      {children}
    </GlassButton>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  // Liens vers une fonctionnalité coupée par l'admin : masqués.
  const features = useFeatures();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Sur les pages publiques, on n'affiche PAS le menu connecté
  const isAppPage = APP_PREFIXES.some((p) => pathname?.startsWith(p));

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isOpen) return;
      if (navRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const supabase = useSupabaseWhenSession();
  useEffect(() => {
    const fetchUserData = async () => {
      const userData = await getMyProfile<{ role?: string; first_name?: string }>();
      setUserRole(userData?.role || null);
      setFirstName(userData?.first_name || null);
    };

    // Visiteur sans session : menu public, sans charger le client de connexion.
    if (!supabase) return;

    // Vérification initiale : getUser() authentifie l'identité auprès de Supabase Auth.
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser || null);
      if (authUser) fetchUserData();
    });

    // onAuthStateChange signale le changement, puis getUser() revalide l'identité
    // avant qu'elle soit utilisée pour charger un rôle ou prendre une décision UI.
    // INITIAL_SESSION (session retrouvée depuis le cookie au chargement) n'est
    // plus ignoré : le getUser() ci-dessus peut en théorie s'exécuter avant que
    // le cookie soit lu par le client, et rien ne corrigeait alors l'état.
    //
    // TOKEN_REFRESHED est en revanche bien ignoré : un jeton rafraîchi ne
    // change ni l'identité ni le rôle, refetch le profil pour rien. Sur
    // /auth/2fa-verify (avant que l'admin ait saisi son code), getMyProfile()
    // renvoie 401 par design (pas encore de cookie 2FA) — le filet de
    // supabaseClient.ts réagit à ce 401 par un refreshSession() silencieux,
    // qui émet justement un TOKEN_REFRESHED : sans ce filtre, ça rappelait
    // fetchUserData() en boucle (401 → refresh → TOKEN_REFRESHED → refetch →
    // 401 → …), jusqu'à épuiser les jetons de rafraîchissement et déconnecter
    // l'admin pour de vrai (constaté en prod : renvoi en boucle vers /auth/connexion).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED") return;
      void supabase.auth.getUser().then(({ data: { user: authUser } }) => {
        setUser(authUser || null);
        if (authUser) {
          fetchUserData();
        } else {
          setUserRole(null);
          setFirstName(null);
        }
      });
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      await trackLogout();
      await (await loadSupabase()).auth.signOut();
    } catch (e) {
      console.error(e);
    }
    localStorage.clear();
    setUser(null);
    setUserRole(null);
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- déconnexion : rechargement complet pour repartir d'un état vide
    window.location.href = "/";
  };

  const getRoleDisplayName = () => {
    if (userRole === "parent") return "Espace Parent";
    if (userRole === "child") return "Espace Enfant";
    return "Mon Compte";
  };

  const getDashboardLink = () => {
    if (!user || !userRole || !firstName) return "/";
    return getDashboardPath(userRole);
  };

  const getProfileLink = () => {
    if (userRole === "parent") return "/parent/profile";
    if (userRole === "child") return "/child/profile";
    if (userRole === "admin") return "/admin/profile";
    // Rôle pas encore résolu (fetchUserData en cours) : ce lien est rendu
    // avant même de savoir qui est connecté, donc Next.js le préfetch dès
    // le montage. Un repli sur "/admin/profile" faisait précharger cette
    // page à chaque connexion parent/enfant le temps de la résolution du
    // rôle (vu en prod : /admin/profile prefetché depuis /child/dashboard).
    return null;
  };

  return (
    <nav
      ref={navRef}
      className="navbar liquid-glass backdrop-blur-[20px] backdrop-saturate-[1.8] fixed left-0 right-0 z-[1030] h-[64px] min-h-[64px] px-6 overflow-visible"
      style={{
        borderBottom: "none",
        // Décalée sous la bannière d'impersonation quand elle est affichée
        // (voir ImpersonationBanner.tsx) — sinon la bannière, en z-index plus
        // haut, cachait entièrement la navbar (logo, menu injoignables).
        top: "var(--imp-banner-h, 0px)",
      }}
    >
      <div className="container mx-auto flex items-center justify-between h-full max-w-7xl">
        {/* Brand */}
        <Link
          href={getDashboardLink()}
          className="flex items-center gap-2 no-underline flex-shrink-0"
        >
          <Image
            src="/logo.png"
            alt="Educalcul"
            width={70}
            height={40}
            className="h-10 w-auto object-contain"
            priority
          />
        </Link>

        {/* Cloche + burger */}
        <div className="flex items-center gap-2">
          {user && firstName && isAppPage && <NotificationBell />}
          {/* data-tour : cible du tutoriel guidé (« ouvrez le menu »). */}
          <span data-tour="nav-menu" className="inline-flex rounded-full">
            <GlassIconButton
              icon={isOpen ? X : Menu}
              color="white"
              aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setIsOpen(!isOpen)}
            />
          </span>
        </div>

        {/* Dropdown Menu */}
        <div
          data-glass-bounds
          className={`absolute top-[64px] right-0 w-full sm:w-72 flex flex-col z-[1040] transition-all duration-300 ease-in-out origin-top overflow-y-auto overscroll-contain max-h-[calc(100dvh-64px)] border border-white/10 ${isOpen ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0 pointer-events-none"}`}
          style={{
            // Fond plein (pas de flou/transparence) — cohérent avec le
            // bandeau navbar lui-même, plutôt qu'un panneau translucide qui
            // laissait deviner le contenu défilant derrière.
            background: "var(--greek-blue)",
            boxShadow: "none",
            border: "none",
            borderTopLeftRadius: "0",
            borderBottomLeftRadius: "1.75rem",
            borderTopRightRadius: "0",
            borderBottomRightRadius: "0",
          }}
        >
          {/* Navigation Links — toujours visibles sur pages publiques */}
          {(!user || !isAppPage) && (
            // Menu public rangé dans l'ordre d'une visite : découvrir le produit, puis qui nous sommes, puis l'aide.
            <div className="flex flex-col p-4 gap-4">
              {PUBLIC_MENU.map((group) => (
                <div key={group.title} className="flex flex-col gap-2">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-center font-[family-name:var(--font-display)]" style={{ color: "rgba(197,161,72,0.8)" }}>
                    {group.title}
                  </p>
                  {group.links.map((l) => (
                    <DropdownLink key={l.href} href={l.href} onClick={() => setIsOpen(false)}>{l.label}</DropdownLink>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          {(!user || !isAppPage) && (
            <div
              className="h-px mx-4"
              style={{ background: "rgba(197,161,72,0.2)" }}
            ></div>
          )}

          {/* Auth Section */}
          <div className="flex flex-col p-4 gap-2">
            {!user || !isAppPage ? (
              <>
                <DropdownLink href="/auth/connexion" onClick={() => setIsOpen(false)}>
                  Connexion
                </DropdownLink>
                <div className="mt-2">
                  <GlassButton
                    href="/auth/inscription"
                    onClick={() => setIsOpen(false)}
                    variant="gold"
                    fullWidth
                    size="sm"
                    className="justify-center text-sm font-bold"
                  >
                    S&apos;inscrire
                  </GlassButton>
                </div>
              </>
            ) : user && isAppPage ? (
              <>
                <div
                  className="px-4 py-3 mb-1 text-xs font-bold tracking-widest uppercase text-center border-b font-[family-name:var(--font-display)]"
                  style={{
                    color: "var(--greek-gold)",
                    borderColor: "rgba(197,161,72,0.2)",
                  }}
                >
                  {firstName
                    ? `${firstName} - ${getRoleDisplayName()}`
                    : getRoleDisplayName()}
                </div>
                <DropdownLink href={getDashboardLink()} onClick={() => setIsOpen(false)}>
                  Tableau de bord
                </DropdownLink>
                {userRole === "parent" && (
                  <>
                    <DropdownLink href="/parent/children" onClick={() => setIsOpen(false)}>
                      Mes Enfants
                    </DropdownLink>
                    {features.isOn("payments") && (
                      <DropdownLink href="/parent/subscription" onClick={() => setIsOpen(false)}>
                        Abonnements
                      </DropdownLink>
                    )}
                    {features.isOn("forum") && (
                      <DropdownLink href="/parent/forum" onClick={() => setIsOpen(false)}>
                        Forum
                      </DropdownLink>
                    )}
                    {features.isOn("support_tickets") && (
                      <DropdownLink href="/parent/support" onClick={() => setIsOpen(false)}>
                        Support
                      </DropdownLink>
                    )}
                  </>
                )}
                {userRole === "child" && (
                  <>
                    {features.isOn("courses") && (
                      <DropdownLink href="/child/cours" onClick={() => setIsOpen(false)}>
                        Mes Cours
                      </DropdownLink>
                    )}
                    {features.isOn("exercises") && (
                      <DropdownLink href="/child/exercises" onClick={() => setIsOpen(false)}>
                        Exercices
                      </DropdownLink>
                    )}
                    {features.isOn("quizzes") && (
                      <DropdownLink href="/child/quiz" onClick={() => setIsOpen(false)}>
                        Quiz
                      </DropdownLink>
                    )}
                    {features.isOn("minigames") && (
                      <DropdownLink href="/child/minigames" onClick={() => setIsOpen(false)}>
                        Mini-jeux
                      </DropdownLink>
                    )}
                    {features.isOn("badges") && (
                      <DropdownLink href="/child/badges" onClick={() => setIsOpen(false)}>
                        Mes Trophées
                      </DropdownLink>
                    )}
                    {features.isOn("forum") && (
                      <DropdownLink href="/child/forum" onClick={() => setIsOpen(false)}>
                        Forum
                      </DropdownLink>
                    )}
                    {features.isOn("support_tickets") && (
                      <DropdownLink href="/child/support" onClick={() => setIsOpen(false)}>
                        Support
                      </DropdownLink>
                    )}
                  </>
                )}
                {getProfileLink() && (
                  <DropdownLink href={getProfileLink()!} onClick={() => setIsOpen(false)}>
                    Profil
                  </DropdownLink>
                )}
                <div className="pt-2">
                  <GlassButton
                    onClick={() => {
                      handleSignOut();
                      setIsOpen(false);
                    }}
                    variant="danger"
                    size="sm"
                    fullWidth
                    className="font-[family-name:var(--font-display)]"
                  >
                    <LogOut className="w-4 h-4" /> Déconnexion
                  </GlassButton>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
