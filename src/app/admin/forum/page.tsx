import ForumApp from "@/components/forum/ForumApp";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default function AdminForumPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        iconName="message-square"
        title="Forum — Modération"
        subtitle="Gérez les catégories, sujets et commentaires de la communauté."
      />
      <ForumApp role="admin" />
    </div>
  );
}
