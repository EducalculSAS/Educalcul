"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { trackLogout } from "@/lib/trackLogout";
import { getDashboardPath } from "@/lib/authRedirect";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import NotificationBell from "@/components/NotificationBell";
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
} from "lucide-react";

// Pages "app" où on affiche le menu connecté
const APP_PREFIXES = ["/parent", "/child", "/admin", "/dashboard"];

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Sur les pages publiques, on n'affiche PAS le menu connecté
  const isAppPage = APP_PREFIXES.some(p => pathname?.startsWith(p));

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

    // Vérification initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) fetchUserData(session.user.id);
    });

    // Écoute des changements (login/logout) — cleanup correctement retourné au useEffect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return; // déjà géré par getSession ci-dessus
      setUser(session?.user || null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setUserRole(null);
        setFirstName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await trackLogout();
      await supabase.auth.signOut();
    } catch (e) { console.error(e); }
    const cookieConsent = localStorage.getItem("cookie_consent");
    localStorage.clear();
    if (cookieConsent) localStorage.setItem("cookie_consent", cookieConsent);
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
    <nav ref={navRef} className="navbar fixed top-0 left-0 right-0 z-[1030] h-[64px] min-h-[64px] px-6 shadow-md" style={{background:"var(--greek-blue)",borderBottom:"1px solid rgba(197,161,72,0.12)"}}>
      <div className="container mx-auto flex items-center justify-between h-full max-w-7xl">
        {/* Brand */}
        <Link href={getDashboardLink()} className="flex items-center gap-2 no-underline flex-shrink-0">
          <Image src="/logo.png" alt="Educalcul" width={70} height={40} className="h-10 w-auto object-contain" priority />
        </Link>

        {/* Cloche + burger */}
        <div className="flex items-center gap-2">
          {user && firstName && isAppPage && <NotificationBell />}
          <button
            className="p-2 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95"
            style={{color:"rgba(255,255,255,0.7)"}}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Dropdown Menu */}
        <div
          className={`absolute top-[64px] right-0 w-full sm:w-72 flex flex-col z-[1040] transition-all duration-300 ease-in-out origin-top ${isOpen ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0 pointer-events-none"}`}
          style={{background:"var(--greek-blue)",borderBottom:"1px solid rgba(197,161,72,0.15)",boxShadow:"0 20px 40px rgba(0,0,0,0.3)"}}
        >
          {/* Navigation Links — toujours visibles sur pages publiques */}
          {(!user || !isAppPage) && (
            <div className="flex flex-col p-4 gap-2">
              <Link
                href="/"
                className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                onClick={() => setIsOpen(false)}
              >
                Accueil
              </Link>
              <Link
                href="/offres"
                className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                onClick={() => setIsOpen(false)}
              >
                Offres
              </Link>
              <Link
                href="/tarifs"
                className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                onClick={() => setIsOpen(false)}
              >
                Tarifs
              </Link>
              <Link
                href="/faq"
                className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                onClick={() => setIsOpen(false)}
              >
                FAQ
              </Link>
              <Link
                href="/contact"
                className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                onClick={() => setIsOpen(false)}
              >
                Contact
              </Link>
            </div>
          )}

          {/* Divider */}
          {(!user || !isAppPage) && (
            <div className="h-px mx-4" style={{background:"rgba(197,161,72,0.2)"}}></div>
          )}

          {/* Auth Section */}
          <div className="flex flex-col p-4 gap-2">
            {!user || !isAppPage ? (
              <>
                <Link
                  href="/auth/connexion"
                  className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                  onClick={() => setIsOpen(false)}
                >
                  <User className="w-4 h-4" /> Connexion
                </Link>
                <Link
                  href="/auth/inscription"
                  className="text-center block w-full mt-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all hover:opacity-90 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{background:"var(--greek-gold)",color:"#fff"}}
                  onClick={() => setIsOpen(false)}
                >
                  S'inscrire
                </Link>
              </>
            ) : user && isAppPage ? (
              <>
                <div className="px-4 py-3 mb-1 text-xs font-bold tracking-widest uppercase border-b font-[family-name:var(--font-display)]" style={{color:"var(--greek-gold)",borderColor:"rgba(197,161,72,0.2)"}}>
                  {firstName
                    ? `${firstName} - ${getRoleDisplayName()}`
                    : getRoleDisplayName()}
                </div>
                <Link
                  href={getDashboardLink()}
                  className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                  onClick={() => setIsOpen(false)}
                >
                  <LayoutDashboard className="w-4 h-4" /> Tableau de bord
                </Link>
                {userRole === "parent" && (
                  <>
                    <Link
                      href="/parent/children"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <Users className="w-4 h-4" /> Mes Enfants
                    </Link>
                    <Link
                      href="/parent/subscription"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <CreditCard className="w-4 h-4" /> Abonnements
                    </Link>
                    <Link
                      href="/parent/forum"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <MessageSquare className="w-4 h-4" /> Forum
                    </Link>
                    <Link
                      href="/parent/support"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <HelpCircle className="w-4 h-4" /> Support
                    </Link>
                  </>
                )}
                {userRole === "child" && (
                  <>
                    <Link
                      href="/child/cours"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <BookOpen className="w-4 h-4" /> Mes Cours
                    </Link>
                    <Link
                      href="/child/exercises"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <Brain className="w-4 h-4" /> Exercices
                    </Link>
                    <Link
                      href="/child/quiz"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <Trophy className="w-4 h-4" /> Quiz & Défis
                    </Link>
                    <Link
                      href="/child/badges"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <Trophy className="w-4 h-4" /> Mes Trophées
                    </Link>
                    <Link
                      href="/child/forum"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <MessageSquare className="w-4 h-4" /> Forum
                    </Link>
                    <Link
                      href="/child/support"
                      className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                      onClick={() => setIsOpen(false)}
                    >
                      <HelpCircle className="w-4 h-4" /> Support
                    </Link>
                  </>
                )}
                {getProfileLink() && (
                  <Link
                    href={getProfileLink()!}
                    className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 hover:translate-x-1 hover:text-white flex items-center gap-2 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.7)"}}
                    onClick={() => setIsOpen(false)}
                  >
                    <Settings className="w-4 h-4" /> Profil
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsOpen(false);
                  }}
                  className="py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 text-left w-full flex items-center gap-2 hover:translate-x-1 hover:text-red-400 font-[family-name:var(--font-display)]" style={{color:"rgba(255,255,255,0.5)"}}
                >
                  <LogOut className="w-4 h-4" /> Déconnexion
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
