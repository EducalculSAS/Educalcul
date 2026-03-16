"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Navbar";

import MathLoader from "@/components/MathLoader";

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/connexion");
        return;
      }

      // Verify role
      const { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", session.user.id)
        .maybeSingle();

      if (error || !userData || userData.role !== "parent") {
        // If not parent, redirect or show error (could be child trying to access parent area)
        router.push("/dashboard"); // Generic redirect
        return;
      }

      setUser(userData);
      setLoading(false);
    };

    checkUser();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <MathLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen relative bg-[var(--greek-cream)]/30">
      <Navbar />

      <div className="flex flex-grow pt-[64px] relative z-10">
        {/* Main Content */}
        <main className="flex-grow p-4 md:p-8 container mx-auto max-w-7xl">
          {children}
        </main>
      </div>
    </div>
  );
}
