"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/auth/connexion");
        return;
      }

      // Fetch role from public.users table
      const { data: user, error } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        return;
      }

      if (!user) {
        console.warn("User profile not found");
        return;
      }

      if (user.role === "child") {
        router.push("/child/profile");
      } else if (user.role === "parent") {
        router.push("/parent/profile");
      } else {
        router.push("/dashboard"); // Fallback
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
      <div className="text-[var(--greek-blue)] text-xl font-bold animate-pulse">
        Redirection vers votre profil...
      </div>
    </div>
  );
}
