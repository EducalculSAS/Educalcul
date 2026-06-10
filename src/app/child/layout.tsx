import Navbar from "@/components/Navbar";
import { ReactNode } from "react";
import { AITutorProvider } from "@/contexts/AITutorContext";
import AITutor from "@/components/child/AITutor";
import PresenceTracker from "@/components/child/PresenceTracker";
import AdminMessages from "@/components/AdminMessages";
import ChildOnboardingWrapper from "@/components/onboarding/ChildOnboardingWrapper";

export default function ChildLayout({ children }: { children: ReactNode }) {
  return (
    <AITutorProvider>
      <Navbar />
      <PresenceTracker />
      <AdminMessages />
      <ChildOnboardingWrapper />
      <main className="pt-[64px] min-h-screen bg-[var(--greek-cream)]">
        {children}
      </main>
      <AITutor />
    </AITutorProvider>
  );
}
