"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    const go = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/auth/connexion");
        return;
      }

      const { data: user, error } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        router.replace("/auth/connexion");
        return;
      }

      if (user?.role === "parent") {
        router.replace("/parent/dashboard");
        return;
      }

      if (user?.role === "child") {
        router.replace("/child/dashboard");
        return;
      }

      if (user?.role === "admin") {
        router.replace("/admin/dashboard");
        return;
      }

      router.replace("/auth/connexion");
    };

    go();
  }, [router]);

  return null;
}