"use client";

import Link from "next/link";
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
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { trackLogout } from "@/lib/trackLogout";
import { useRouter } from "next/navigation";

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
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
    { name: "Profil", href: "/admin/profile", icon: User },
  ];

  const handleLogout = async () => {
    try { await trackLogout(); await supabase.auth.signOut(); } catch (e) { console.error(e); }
    localStorage.clear();
    router.push("/auth/connexion");
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed z-[1050] p-2 bg-[var(--greek-blue)] text-white rounded-md shadow-lg"
        style={{ top: 12, left: 16 }}
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

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
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                  isActive
                    ? "bg-[var(--greek-gold)] text-[var(--greek-blue)] font-bold shadow-md"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Déconnexion — collé en bas */}
        <div className="flex-shrink-0 p-3 border-t border-[rgba(197,161,72,0.25)]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all duration-200 text-sm"
          >
            <LogOut size={18} className="flex-shrink-0" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
}
