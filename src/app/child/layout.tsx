import Navbar from "@/components/Navbar";
import { ReactNode } from "react";
import { Moon } from "lucide-react";
import { AITutorProvider } from "@/contexts/AITutorContext";
import AITutor from "@/components/child/AITutor";
import PresenceTracker from "@/components/child/PresenceTracker";
import AdminMessages from "@/components/AdminMessages";
import ChildOnboardingWrapper from "@/components/onboarding/ChildOnboardingWrapper";
import ChildGradeChoiceModal from "@/components/child/ChildGradeChoiceModal";
import QuietGuard from "@/components/child/QuietGuard";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { getServerUser } from "@/lib/supabase/server";
import { getChildPrefs, isQuietNow } from "@/lib/studentStats";

export default async function ChildLayout({ children }: { children: ReactNode }) {
  // Bulle Calia masquée si l'admin a coupé l'assistante (cache de 10 s).
  const caliaOn = await isFeatureEnabled("calia_chat");
  // Plage de repos fixée par le parent (ex. pas d'écran après 21 h) : l'espace élève se ferme le temps de la plage.
  const user = await getServerUser();
  const prefs = user?.role === "child" ? await getChildPrefs(user.id) : null;
  const quiet = prefs ? isQuietNow(prefs) : false;

  return (
    <AITutorProvider>
      <Navbar />
      {user?.role === "child" && <QuietGuard quiet={quiet} />}
      {quiet && prefs ? (
        <main className="pt-[64px] min-h-screen bg-[var(--greek-blue)] text-white flex items-center justify-center px-6">
          <div className="max-w-md text-center py-24">
            <Moon className="w-16 h-16 mx-auto mb-6 text-[var(--greek-gold)]" />
            <h1 className="text-3xl font-[family-name:var(--font-display)] font-bold mb-3">C&apos;est l&apos;heure de te reposer</h1>
            <p className="opacity-90 mb-2">
              Educalcul est fermé de {prefs.quiet.start} à {prefs.quiet.end}, comme tes parents l&apos;ont prévu.
            </p>
            <p className="opacity-70 text-sm">Reviens après {prefs.quiet.end} : tes exercices t&apos;attendent.</p>
          </div>
        </main>
      ) : (
        <>
          <PresenceTracker />
          <AdminMessages />
          <ChildOnboardingWrapper />
          <ChildGradeChoiceModal />
          <main className="pt-[64px] min-h-screen bg-[var(--greek-cream)]">{children}</main>
          {caliaOn && <AITutor />}
        </>
      )}
    </AITutorProvider>
  );
}
