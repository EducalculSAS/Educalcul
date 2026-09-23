import { Suspense } from "react";
import ForumApp from "@/components/forum/ForumApp";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default function AdminForumPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        iconName="message-square"
        title="Forum — Modération"
        subtitle="Catégories, sujets et réponses de toute la communauté (élèves et parents)."
      />
      <Suspense fallback={null}>
        <ForumApp role="admin" />
      </Suspense>
    </div>
  );
}
