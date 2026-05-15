import ForumApp from "@/components/forum/ForumApp";
import { MessageSquare } from "lucide-react";
import { Suspense } from "react";

export default function ChildForumPage() {
  return (
    <div className="w-full min-h-screen bg-[var(--greek-cream)]">
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-8 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10 max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
            <MessageSquare className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)]" />
            LE FORUM
          </h1>
          <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
            <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
              ÉLÈVES
            </span>
            <span>Pose tes questions et aide les autres !</span>
          </p>
        </div>
      </div>

      <div className="px-4 pb-12 max-w-6xl mx-auto">
        <Suspense fallback={<div>Chargement du forum...</div>}>
          <ForumApp role="child" />
        </Suspense>
      </div>
    </div>
  );
}