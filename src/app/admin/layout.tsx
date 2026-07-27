"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AppAdminLoader from "@/components/AppAdminLoader";
import AdminSidebar from "@/components/AdminSidebar";
import AdminTotpSetupModal from "@/components/admin/AdminTotpSetupModal";
import { CourseGenerationsProvider } from "@/contexts/CourseGenerationsContext";
import CourseGenerationsWidget from "@/components/admin/CourseGenerationsWidget";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/connexion");
        return;
      }

      // Check role in public.users
      const { data: userData, error } = await supabase
        .from("users")
        .select("role, status, ban_reason")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (error || !userData || userData.role !== "admin") {
        router.push("/dashboard");
        return;
      }

      if (userData.status === "inactive" || userData.ban_reason) {
        router.push("/auth/banned");
        return;
      }

      // TOTP confirmé mais pas encore vérifié sur cet appareil pour cette
      // session (ex: navigation directe/logo en plein flux de vérification) :
      // on bloque l'accès à TOUTE page /admin/* tant que ce n'est pas fait,
      // pas seulement la redirection post-login initiale.
      const totpRes = await fetch("/api/auth/2fa/totp/status", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const totpData = await totpRes.json();
      if (totpRes.ok && totpData.confirmed) {
        const token = window.localStorage.getItem("edu_2fa_token");
        if (!token) {
          router.push(`/auth/2fa-verify?redirect=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
      }

      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <AppAdminLoader />
      </div>
    );
  }

  return (
    <CourseGenerationsProvider>
      <div className="min-h-screen bg-[var(--greek-cream)] flex">
        <AdminTotpSetupModal />
        <AdminSidebar />
        <div className="flex-1 lg:ml-64 pt-14 lg:pt-6 px-4 md:px-6 lg:px-8 pb-8 transition-all duration-300 min-w-0 overflow-x-hidden">
          {children}
        </div>
        <CourseGenerationsWidget />
      </div>
    </CourseGenerationsProvider>
  );
}


