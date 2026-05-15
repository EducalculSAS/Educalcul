import ForumApp from "@/components/forum/ForumApp";
import { MessageSquare } from "lucide-react";

export default function AdminForumPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8">
        <h1 className="text-3xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] flex items-center gap-3">
          <MessageSquare className="text-[var(--greek-gold)]" size={30} />
          Forum — Modération
        </h1>
        <p className="text-[var(--greek-bronze)] mt-1">Gérez les catégories, sujets et commentaires de la communauté.</p>
      </div>
      <ForumApp role="admin" />
    </div>
  );
}
