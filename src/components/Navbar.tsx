"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { trackLogout } from "@/lib/trackLogout";
import { getDashboardPath } from "@/lib/authRedirect";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import NotificationBell from "@/components/NotificationBell";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import {
  Menu,
  X,
  LogOut,
  User,
  LayoutDashboard,
  Settings,
  Users,
  CreditCard,
  BookOpen,
  Trophy,
  Brain,
  MessageSquare,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

// Pages "app" où on affiche le menu connecté
const APP_PREFIXES = ["/parent", "/child", "/admin", "/dashboard"];

/** Lien du menu déroulant en pilule verre liquide — même traitement que les
 * items du menu admin (AdminSidebar) : "gold" sur la page active, "light"
 * discret sinon, plutôt qu'un simple texte. */
function DropdownLink({
  href,
  icon: Icon,
  active,
  onClick,
  children,
}: {
  href: string;
  icon?: LucideIcon;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <GlassButton
      href={href}
      onClick={onClick}
      variant={active ? "gold" : "light"}
      size="sm"
      fullWidth
      className={`font-[family-name:var(--font-display)] ${active ? "font-bold" : ""}`}
      style={
        active
          ? { background: "var(--greek-gold)", color: "var(--greek-blue)", borderColor: "rgba(197,161,72,0.5)" }
          : { background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.08)" }
      }
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </GlassButton>
  );
}

export default function Navbar() {
  const pathname = usePathname();
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

  useEffect(() => {
    const fetchUserData = async (authId: string) => {
      const { data: userData } = await supabase
        .from("users")
        .select("role, first_name")
        .eq("auth_id", authId)
        .maybeSingle();
      setUserRole(userData?.role || null);
      setFirstName(userData?.first_name || null);
    };

    // Vérification initiale : getUser() authentifie l'identité auprès de Supabase Auth.
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      setUser(authUser || null);
      if (authUser) fetchUserData(authUser.id);
    });

    // onAuthStateChange signale le changement, puis getUser() revalide l'identité
    // avant qu'elle soit utilisée pour charger un rôle ou prendre une décision UI.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      void supabase.auth.getUser().then(({ data: { user: authUser } }) => {
        setUser(authUser || null);
        if (authUser) {
          fetchUserData(authUser.id);
        } else {
          setUserRole(null);
          setFirstName(null);
        }
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await trackLogout();
      await supabase.auth.signOut();
    } catch (e) {
      console.error(e);
    }
    localStorage.clear();
    setUser(null);
    setUserRole(null);
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
          <GlassIconButton
            icon={isOpen ? X : Menu}
            color="white"
            aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setIsOpen(!isOpen)}
          />
        </div>

        {/* Dropdown Menu */}
        <div
          data-glass-bounds
          className={`absolute top-[64px] right-0 w-full sm:w-72 flex flex-col z-[1040] transition-all duration-300 ease-in-out origin-top overflow-hidden border border-white/10 ${isOpen ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0 pointer-events-none"}`}
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
            <div className="flex flex-col p-4 gap-2">
              <DropdownLink href="/" active={pathname === "/"} onClick={() => setIsOpen(false)}>Accueil</DropdownLink>
              <DropdownLink href="/offres" active={pathname?.startsWith("/offres") ?? false} onClick={() => setIsOpen(false)}>Offres</DropdownLink>
              <DropdownLink href="/tarifs" active={pathname?.startsWith("/tarifs") ?? false} onClick={() => setIsOpen(false)}>Tarifs</DropdownLink>
              <DropdownLink href="/faq" active={pathname?.startsWith("/faq") ?? false} onClick={() => setIsOpen(false)}>FAQ</DropdownLink>
              <DropdownLink href="/contact" active={pathname?.startsWith("/contact") ?? false} onClick={() => setIsOpen(false)}>Contact</DropdownLink>
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
                <DropdownLink href="/auth/connexion" icon={User} active={pathname?.startsWith("/auth/connexion") ?? false} onClick={() => setIsOpen(false)}>
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
                  className="px-4 py-3 mb-1 text-xs font-bold tracking-widest uppercase border-b font-[family-name:var(--font-display)]"
                  style={{
                    color: "var(--greek-gold)",
                    borderColor: "rgba(197,161,72,0.2)",
                  }}
                >
                  {firstName
                    ? `${firstName} - ${getRoleDisplayName()}`
                    : getRoleDisplayName()}
                </div>
                <DropdownLink href={getDashboardLink()} icon={LayoutDashboard} active={pathname === getDashboardLink()} onClick={() => setIsOpen(false)}>
                  Tableau de bord
                </DropdownLink>
                {userRole === "parent" && (
                  <>
                    <DropdownLink href="/parent/children" icon={Users} active={pathname?.startsWith("/parent/children") ?? false} onClick={() => setIsOpen(false)}>
                      Mes Enfants
                    </DropdownLink>
                    <DropdownLink href="/parent/subscription" icon={CreditCard} active={pathname?.startsWith("/parent/subscription") ?? false} onClick={() => setIsOpen(false)}>
                      Abonnements
                    </DropdownLink>
                    <DropdownLink href="/parent/forum" icon={MessageSquare} active={pathname?.startsWith("/parent/forum") ?? false} onClick={() => setIsOpen(false)}>
                      Forum
                    </DropdownLink>
                    <DropdownLink href="/parent/support" icon={HelpCircle} active={pathname?.startsWith("/parent/support") ?? false} onClick={() => setIsOpen(false)}>
                      Support
                    </DropdownLink>
                  </>
                )}
                {userRole === "child" && (
                  <>
                    <DropdownLink href="/child/cours" icon={BookOpen} active={pathname?.startsWith("/child/cours") ?? false} onClick={() => setIsOpen(false)}>
                      Mes Cours
                    </DropdownLink>
                    <DropdownLink href="/child/exercises" icon={Brain} active={pathname?.startsWith("/child/exercises") ?? false} onClick={() => setIsOpen(false)}>
                      Exercices
                    </DropdownLink>
                    <DropdownLink href="/child/quiz" icon={Trophy} active={pathname?.startsWith("/child/quiz") ?? false} onClick={() => setIsOpen(false)}>
                      Quiz & Défis
                    </DropdownLink>
                    <DropdownLink href="/child/badges" icon={Trophy} active={pathname?.startsWith("/child/badges") ?? false} onClick={() => setIsOpen(false)}>
                      Mes Trophées
                    </DropdownLink>
                    <DropdownLink href="/child/forum" icon={MessageSquare} active={pathname?.startsWith("/child/forum") ?? false} onClick={() => setIsOpen(false)}>
                      Forum
                    </DropdownLink>
                    <DropdownLink href="/child/support" icon={HelpCircle} active={pathname?.startsWith("/child/support") ?? false} onClick={() => setIsOpen(false)}>
                      Support
                    </DropdownLink>
                  </>
                )}
                {getProfileLink() && (
                  <DropdownLink href={getProfileLink()!} icon={Settings} active={pathname?.startsWith(getProfileLink()!) ?? false} onClick={() => setIsOpen(false)}>
                    Profil
                  </DropdownLink>
                )}
                <div className="px-4 pt-2 pb-1">
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
