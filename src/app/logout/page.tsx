"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import AppAdminLoader from "@/components/AppAdminLoader";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const handleLogout = async () => {
      await supabase.auth.signOut();
      router.push("/");
      router.refresh(); // Force refresh to update server components/navbar state if needed
    };

    handleLogout();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--greek-cream)]">
      <AppAdminLoader />
    </div>
  );
}


