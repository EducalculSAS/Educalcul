import React from "react";
import ForumApp from "@/components/forum/ForumApp";
import { ShieldCheck } from "lucide-react";

export default function AdminForumPage() {
  return (
    <div className="space-y-8 w-full animate-fade-in">
      {/* Header Card (White block like Courses/Exercises) */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden group">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none group-hover:opacity-10 transition-opacity"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
              <ShieldCheck className="text-[var(--greek-gold)]" size={32} />
              Le Sanctuaire de Modération
            </h1>
            <p className="text-[var(--greek-bronze)] text-lg opacity-80">
              Veille sur la communauté et guide les héros vers la sagesse.
            </p>
          </div>
          
          <div className="hidden xl:block">
             <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 italic font-bold text-[var(--greek-blue)] text-sm">
                MODÉRATION ACTIVE
             </div>
          </div>
        </div>
      </div>

      {/* Main Forum App (Full Width) */}
      <div className="w-full">
        <ForumApp role="admin" />
      </div>
    </div>
  );
}
