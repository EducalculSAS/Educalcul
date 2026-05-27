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
  Settings,
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
} from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
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
    { name: "Profil", href: "/admin/profile", icon: User },
    { name: "Paramètres", href: "/admin/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    try { await supabase.auth.signOut(); } catch (e) { console.error(e); }
    localStorage.clear();
    router.push("/auth/connexion");
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-[var(--greek-blue)] text-white rounded-md shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-[var(--greek-blue)] text-white z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-[rgba(197,161,72,0.25)]">
          <h1 className="text-2xl font-bold font-[family-name:var(--font-display)] text-[var(--greek-gold)]">
            EduCalcul
            <span className="block text-sm text-white/70 font-sans mt-1">
              Admin Panel
            </span>
          </h1>
        </div>

        <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100vh-140px)]">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname?.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-[var(--greek-gold)] text-[var(--greek-blue)] font-bold shadow-md"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-[rgba(197,161,72,0.25)] bg-[var(--greek-blue)]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all duration-200"
          >
            <LogOut size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </>
  );
}
