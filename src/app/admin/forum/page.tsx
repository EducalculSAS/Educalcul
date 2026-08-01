import ForumApp from "@/components/forum/ForumApp";
import { MessageSquare } from "lucide-react";

export default function AdminForumPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <MessageSquare className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Forum — Modération
          </h1>
          <p className="text-sm text-muted-foreground">
            Gérez les catégories, sujets et commentaires de la communauté.
          </p>
        </div>
      </header>
      <ForumApp role="admin" />
    </div>
  );
}
