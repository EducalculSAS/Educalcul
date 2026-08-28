"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getMyProfile } from "@/lib/updateMyProfile";
import ChildOnboarding from "./ChildOnboarding";

export default function ChildOnboardingWrapper() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const data = await getMyProfile<any>();
      if (!data) return;
      if (data.status === "inactive" || data.ban_reason) {
        router.push("/auth/banned");
        return;
      }
      if (!data.onboarding_completed) {
        setUserData(data);
        setShow(true);
      }
    })();
  }, [router]);

  if (!show || !userData) return null;

  return (
    <ChildOnboarding
      firstName={userData.first_name || ""}
      authId={userData.auth_id}
      gradeLevel={userData.grade_level || "6eme"}
      onComplete={() => setShow(false)}
    />
  );
}
