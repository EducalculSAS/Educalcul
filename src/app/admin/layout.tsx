"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import MathLoader from "@/components/MathLoader";
import AdminSidebar from "@/components/AdminSidebar";

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
        .select("role")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (error || !userData || userData.role !== "admin") {
        console.warn("Access denied: User is not admin");
        router.push("/dashboard"); // Redirect to generic dashboard
        return;
      }

      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <MathLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] flex">
      <AdminSidebar />
      <div className="flex-1 lg:ml-64 p-8 transition-all duration-300">
        {children}
      </div>
    </div>
  );
}
