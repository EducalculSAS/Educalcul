import Navbar from "@/components/Navbar";
import { ReactNode } from "react";
import { AITutorProvider } from "@/contexts/AITutorContext";
import AITutor from "@/components/child/AITutor";
import PresenceTracker from "@/components/child/PresenceTracker";
import AdminMessages from "@/components/AdminMessages";
import ChildOnboardingWrapper from "@/components/onboarding/ChildOnboardingWrapper";
import ChildGradeChoiceModal from "@/components/child/ChildGradeChoiceModal";
import { isFeatureEnabled } from "@/lib/featureFlags";

export default async function ChildLayout({ children }: { children: ReactNode }) {
  // Bulle Calia masquée si l'admin a coupé l'assistante (cache de 10 s).
  const caliaOn = await isFeatureEnabled("calia_chat");
  return (
    <AITutorProvider>
      <Navbar />
      <PresenceTracker />
      <AdminMessages />
      <ChildOnboardingWrapper />
      <ChildGradeChoiceModal />
      <main className="pt-[64px] min-h-screen bg-[var(--greek-cream)]">
        {children}
      </main>
      {caliaOn && <AITutor />}
    </AITutorProvider>
  );
}
