import ForumApp from "@/components/forum/ForumApp";
import { Star } from "lucide-react";

export default function ChildForumPage() {
  return (
    <div className="w-full min-h-screen bg-[var(--greek-cream)]/10">
      {/* Dynamic Hero Header (Child Space Style) */}
      <div className="bg-[var(--greek-blue)] text-white pt-20 pb-12 px-8 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 max-w-[1600px] mx-auto">
          <div>
            <h1 className="text-4xl md:text-5xl font-[family-name:var(--font-display)] font-bold mb-3 flex items-center gap-4">
              <Star className="w-10 h-10 md:w-14 md:h-14 text-[var(--greek-gold)] fill-current animate-spin-slow" />
              LE FORUM DES HÉROS
            </h1>
            <p className="text-xl opacity-90 flex items-center gap-3 font-medium">
              <span className="bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                HÉROS
              </span>
              <span>Pose tes questions et aide les autres champions !</span>
            </p>
          </div>

          <div className="flex items-center gap-4 bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/10 shadow-xl">
             <div className="text-center px-6">
                <div className="text-[var(--greek-gold)] font-bold text-2xl font-[family-name:var(--font-display)]">UNIS</div>
                <div className="text-xs uppercase font-black text-white/60 tracking-[0.2em] mt-1">Pour vaincre !</div>
             </div>
          </div>
        </div>
      </div>

      <div className="px-8 pb-12 w-full max-w-[1600px] mx-auto animate-fade-in">
        <ForumApp role="child" />
      </div>
    </div>
  );
}
