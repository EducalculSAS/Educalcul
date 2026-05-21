"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getServerGeo } from "@/lib/geoLocation";

import Navbar from "@/components/Navbar";
import AdminMessages from "@/components/AdminMessages";

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
        router.push("/dashboard");
        return;
      }

      // Vérif ban — redirige même si déjà connecté
      if (userData.status === "inactive" || userData.ban_reason) {
        router.push("/auth/banned");
        return;
      }

      setUser(userData);
      setLoading(false);

      // Track presence: update last_active_at + geo if missing
      const now = new Date().toISOString();
      const today = new Date().toISOString().split("T")[0];
      const updates: any = { last_active_at: now };

      // Track login streak
      if (!userData.last_login_date || userData.last_login_date !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        updates.last_login_date = today;
        updates.login_count = (userData.login_count || 0) + 1;
        updates.login_streak = userData.last_login_date === yesterday ? (userData.login_streak || 0) + 1 : 1;
      }

      if (!userData.latitude) {
        const geo = await getServerGeo();
        if (geo) {
          updates.latitude = geo.latitude;
          updates.longitude = geo.longitude;
          if (geo.city)    updates.last_login_city    = geo.city;
          if (geo.country) updates.last_login_country = geo.country;
        }
      }

      await supabase.from("users").update(updates).eq("auth_id", session.user.id);
    };

    checkUser();

    // Refresh last_active_at every 2 minutes
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("users").update({ last_active_at: new Date().toISOString() }).eq("auth_id", session.user.id);
      }
    }, 120000);

    return () => clearInterval(interval);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--greek-cream)]">
        <MathLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <Navbar />
      <AdminMessages />
      <main className="pt-[64px]">
        {children}
      </main>
    </div>
  );
}
