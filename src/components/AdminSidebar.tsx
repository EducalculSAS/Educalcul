"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Calculator,
  Trophy,
  FileText,
  LogOut,
  Menu,
  X,
  LifeBuoy,
  CreditCard,
  MessageSquare,
  User,
  Mail,
  Scale,
  GraduationCap,
  Calendar,
  History,
  Star,
  ScanSearch,
  ShieldCheck,
  Flag,
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { trackLogout } from "@/lib/trackLogout";
import { useRouter } from "next/navigation";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassButton from "@/components/ui/GlassButton";

// Un admin "support" (accès restreint) ne voit que ce qui touche à son
// travail quotidien — tickets, forum, son propre profil. Tout le reste
// (utilisateurs, contenu, argent, sécurité...) reste réservé au super admin,
// et est de toute façon rejeté côté serveur si jamais accédé directement.
const SUPPORT_VISIBLE = new Set(["/admin/dashboard", "/admin/support", "/admin/forum", "/admin/profile"]);

export default function AdminSidebar({ adminLevel = "super" }: { adminLevel?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const allMenuItems = [
    {
      name: "Tableau de bord",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    { name: "Utilisateurs", href: "/admin/users", icon: Users },
    { name: "Cours", href: "/admin/courses", icon: BookOpen },
    { name: "Exercices", href: "/admin/exercises", icon: Calculator },
    { name: "Quiz", href: "/admin/quizzes", icon: Trophy },
    { name: "Rapports", href: "/admin/reports", icon: FileText },
    { name: "Forum", href: "/admin/forum", icon: MessageSquare },
    { name: "Emails", href: "/admin/emails", icon: Mail },
    { name: "Support", href: "/admin/support", icon: LifeBuoy },
    { name: "Abonnements", href: "/admin/subscriptions", icon: CreditCard },
    { name: "Juridique", href: "/admin/juridique", icon: Scale },
    { name: "Programmes", href: "/admin/programmes", icon: GraduationCap },
    { name: "Calendrier", href: "/admin/calendar", icon: Calendar },
    { name: "Avis clients", href: "/admin/reviews", icon: Star },
    { name: "Liste d'attente", href: "/admin/landing", icon: Trophy },
    { name: "Journal d'audit", href: "/admin/audit-log", icon: History },
    { name: "Scanner IA", href: "/admin/scanner", icon: ScanSearch },
    { name: "Sécurité", href: "/admin/security", icon: ShieldCheck },
    { name: "Fonctionnalités", href: "/admin/feature-flags", icon: Flag },
    { name: "Profil", href: "/admin/profile", icon: User },
  ];

  const menuItems = adminLevel === "support"
    ? allMenuItems.filter((item) => SUPPORT_VISIBLE.has(item.href))
    : allMenuItems;

  const handleLogout = async () => {
    try { await trackLogout(); await supabase.auth.signOut(); } catch (e) { console.error(e); }
    localStorage.clear();
    router.push("/auth/connexion");
  };

  return (
    <>
      {/* Mobile Menu Button — même bouton pour ouvrir (survole le contenu,
          repli navy) et fermer (survole le bandeau "Admin Panel" du même
          bleu : sans le variant blanc ici, la croix devenait illisible
          navy-sur-navy). Décalé à droite du titre en position ouverte pour
          ne plus le recouvrir (sidebar toujours w-64, décalage fixe). */}
      <GlassIconButton
        icon={isOpen ? X : Menu}
        onClick={() => setIsOpen(!isOpen)}
        color={isOpen ? "white" : "navy"}
        aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
        className={`lg:hidden fixed z-[1050] top-3 ${isOpen ? "left-[204px]" : "left-4"}`}
      />

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[1040]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container — commence sous la navbar */}
      <div
        className={`fixed left-0 w-64 bg-[var(--greek-blue)] text-white z-[1040] transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          top: 0,
          height: "100dvh",
        }}
      >
        {/* Header sidebar */}
        <div className="px-6 py-4 border-b border-[rgba(197,161,72,0.25)] flex-shrink-0">
          <h1 className="text-xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-gold)]">
            Admin Panel
          </h1>
        </div>

        {/* Nav items — scroll indépendant */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <GlassButton
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                variant={isActive ? "gold" : "light"}
                rounded="xl"
                size="sm"
                fullWidth
                className={`justify-start text-sm ${isActive ? "font-bold" : ""}`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </GlassButton>
            );
          })}
        </nav>

        {/* Déconnexion — collé en bas */}
        <div className="flex-shrink-0 p-3 border-t border-[rgba(197,161,72,0.25)]">
          <GlassButton
            onClick={handleLogout}
            variant="danger"
            size="sm"
            rounded="xl"
            fullWidth
            className="justify-start"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span>Déconnexion</span>
          </GlassButton>
        </div>
      </div>
    </>
  );
}
