"use client";

import ForumApp from "@/components/forum/ForumApp";
import { MessageSquare } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default function AdminForumPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={MessageSquare}
        title="Forum — Modération"
        subtitle="Gérez les catégories, sujets et commentaires de la communauté."
      />
      <ForumApp role="admin" />
    </div>
  );
}
