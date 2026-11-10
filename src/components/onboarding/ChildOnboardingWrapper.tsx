"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";
import ChildOnboarding from "./ChildOnboarding";
import GuidedTour from "@/components/tour/GuidedTour";

/** Colonnes du profil lues ici (la route renvoie la ligne utilisateur). */
interface ChildProfile { first_name?: string | null; auth_id: string; grade_level?: string | null; status?: string; ban_reason?: string | null; onboarding_completed?: boolean | null; tour_completed?: boolean | null; role?: string }

export default function ChildOnboardingWrapper() {
  const router = useRouter();
  const [userData, setUserData] = useState<ChildProfile | null>(null);
  const [show, setShow] = useState(false);
  // Visite guidée : après l'accueil et le mini-test, ou directement si seul le tutoriel reste à faire.
  const [tour, setTour] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const data = await getMyProfile<ChildProfile>();
      if (!data) return;
      if (data.status === "inactive" || data.ban_reason) {
        router.push("/auth/banned");
        return;
      }
      if (data.role && data.role !== "child") return; // un admin qui consulte l'espace élève
      if (!data.onboarding_completed) {
        setUserData(data);
        setShow(true);
      }
      if (!data.tour_completed) setTour(true);
    })();
  }, [router]);

  if (!show || !userData) return tour ? <GuidedTour role="child" /> : null;

  return (
    <ChildOnboarding
      firstName={userData.first_name || ""}
      authId={userData.auth_id}
      gradeLevel={userData.grade_level || "6eme"}
      onComplete={() => setShow(false)}
    />
  );
}
