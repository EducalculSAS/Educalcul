import React from "react";
import ForumApp from "@/components/forum/ForumApp";
import { MessageSquare } from "lucide-react";

export default function ParentForumPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-6xl animate-fade-in">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-[var(--greek-blue)] mb-3 font-[family-name:var(--font-display)] drop-shadow-sm flex items-center justify-center gap-4">
          <MessageSquare className="w-10 h-10 text-[var(--greek-gold)]" />
          Le Forum des Héros
        </h1>
        <p className="text-gray-600 text-lg">
          Entraide, conseils et progrès pour nos enfants.
        </p>
      </div>
      
      <div className="w-full">
        <ForumApp role="parent" />
      </div>
    </main>
  );
}
