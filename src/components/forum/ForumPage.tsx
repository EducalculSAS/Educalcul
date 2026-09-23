import { Suspense } from "react";
import { MessagesSquare } from "lucide-react";
import PageHero from "@/components/PageHero";
import ForumApp from "./ForumApp";

const COPY = {
  child: { badge: "Élèves", subtitle: "Pose tes questions, aide les autres et partage tes astuces." },
  parent: { badge: "Parents", subtitle: "Entraide, conseils et suivi de la scolarité de vos enfants." },
} as const;

/** Page forum des espaces élève et parent : même en-tête, même forum. */
export default function ForumPage({ role }: { role: "child" | "parent" }) {
  const copy = COPY[role];
  return (
    <div className="w-full min-h-screen bg-[var(--greek-cream)]">
      <PageHero icon={MessagesSquare} title="Le forum" badge={copy.badge} subtitle={copy.subtitle} />
      <div className="px-4 pb-16 max-w-6xl mx-auto">
        <Suspense fallback={null}>
          <ForumApp role={role} />
        </Suspense>
      </div>
    </div>
  );
}
