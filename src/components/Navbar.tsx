"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User as SupabaseUser } from "@supabase/supabase-js";
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

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

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
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        const { data: userData } = await supabase
          .from("users")
          .select("role, first_name")
          .eq("auth_id", session.user.id)
          .maybeSingle();
        setUserRole(userData?.role || null);
        setFirstName(userData?.first_name || null);
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("role, first_name")
            .eq("auth_id", session.user.id)
            .maybeSingle();
          setUserRole(userData?.role || null);
          setFirstName(userData?.first_name || null);
        } else {
          setUserRole(null);
          setFirstName(null);
        }
      });

      return () => subscription.unsubscribe();
    };

    getUser();
  }, []);

  const handleSignOut = async () => {
    try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
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
    if (!user) return "/";
    if (userRole === "parent") return "/parent/dashboard";
    if (userRole === "child") return "/child/dashboard";
    return "/dashboard";
  };

  const getProfileLink = () => {
    if (userRole === "parent") return "/parent/profile";
    if (userRole === "child") return "/child/profile";
    return "/admin/profile";
  };

  return (
    <nav ref={navRef} className="navbar fixed top-0 left-0 right-0 z-[1030] bg-[var(--greek-blue)] h-[64px] min-h-[64px] px-4 shadow-md">
      <div className="container mx-auto flex items-center justify-between h-full max-w-7xl">
        {/* Brand */}
        <Link
          href={getDashboardLink()}
          className="navbar-brand flex items-center text-[var(--greek-cream)] hover:text-white transition-colors gap-2 font-[family-name:var(--font-display)] font-bold text-xl no-underline"
        >
          <img src="/logo.png" alt="logo" className="w-9 h-9 relative -top-0.5" />
          <span>Educalcul</span>
        </Link>

        {/* Menu Toggle (Always visible) */}
        <button
          className="p-2 text-[var(--greek-cream)] hover:text-[var(--greek-gold)] transition-colors flex items-center gap-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Right-aligned Dropdown Menu */}
        <div
          className={`absolute top-[64px] right-0 w-full sm:w-80 bg-[var(--greek-blue)] border-b sm:border-l sm:border-b border-[var(--greek-gold)] shadow-xl flex flex-col z-[1040] transition-all duration-300 ease-in-out origin-top ${isOpen
            ? "scale-y-100 opacity-100"
            : "scale-y-0 opacity-0 pointer-events-none"
            }`}
        >
          {/* Navigation Links */}
          {!user && (
            <div className="flex flex-col p-4 gap-2">
              <Link
                href="/offres"
                className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1"
                onClick={() => setIsOpen(false)}
              >
                Offres
              </Link>
              <Link
                href="/tarifs"
                className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1"
                onClick={() => setIsOpen(false)}
              >
                Tarifs
              </Link>
              <Link
                href="/faq"
                className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1"
                onClick={() => setIsOpen(false)}
              >
                FAQ
              </Link>
              <Link
                href="/contact"
                className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1"
                onClick={() => setIsOpen(false)}
              >
                Contact
              </Link>
            </div>
          )}

          {/* Divider */}
          {!user && (
            <div className="h-px bg-[var(--greek-gold)] opacity-30 mx-4"></div>
          )}

          {/* Auth Section */}
          <div className="flex flex-col p-4 gap-2">
            {!user ? (
              <>
                <Link
                  href="/auth/connexion"
                  className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  <User className="w-4 h-4" /> Connexion
                </Link>
                <Link
                  href="/auth/inscription"
                  className="btn-primary-greek text-center block w-full mt-2 hover:translate-y-[-1px]"
                  onClick={() => setIsOpen(false)}
                >
                  Inscription
                </Link>
              </>
            ) : (
              <>
                <div className="px-4 py-2 mb-2 text-[var(--greek-gold)] font-bold border-b border-[var(--greek-gold)]/20">
                  {firstName
                    ? `${firstName} - ${getRoleDisplayName()}`
                    : getRoleDisplayName()}
                </div>
                <Link
                  href={getDashboardLink()}
                  className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  <LayoutDashboard className="w-4 h-4" /> Tableau de bord
                </Link>
                {userRole === "parent" && (
                  <>
                    <Link
                      href="/parent/children"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <Users className="w-4 h-4" /> Mes Enfants
                    </Link>
                    <Link
                      href="/parent/subscription"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <CreditCard className="w-4 h-4" /> Abonnements
                    </Link>
                    <Link
                      href="/parent/forum"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <MessageSquare className="w-4 h-4" /> Forum
                    </Link>
                    <Link
                      href="/parent/support"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
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
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <BookOpen className="w-4 h-4" /> Mes Cours
                    </Link>
                    <Link
                      href="/child/exercises"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <Brain className="w-4 h-4" /> Exercices
                    </Link>
                    <Link
                      href="/child/quiz"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <Trophy className="w-4 h-4" /> Quiz & Défis
                    </Link>
                    <Link
                      href="/child/badges"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <Trophy className="w-4 h-4" /> Mes Trophées
                    </Link>
                    <Link
                      href="/child/forum"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <MessageSquare className="w-4 h-4" /> Forum
                    </Link>
                    <Link
                      href="/child/support"
                      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 flex items-center gap-2"
                      onClick={() => setIsOpen(false)}
                    >
                      <HelpCircle className="w-4 h-4" /> Support
                    </Link>
                  </>
                )}
                <Link
                  href={getProfileLink()}
                  className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md hover:bg-[rgba(197,161,72,0.1)] transition-colors flex items-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  <Settings className="w-4 h-4" /> Profil
                </Link>
                <button
                  onClick={() => {
                    handleSignOut();
                    setIsOpen(false);
                  }}
                  className="text-[var(--greek-cream)] hover:text-[var(--greek-terracotta)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md hover:bg-[rgba(226,114,91,0.1)] transition-colors text-left w-full flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Déconnexion
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
