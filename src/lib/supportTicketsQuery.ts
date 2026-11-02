import type { Loose } from "@/types/loose";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { selectAllPages } from "@/lib/selectAllPages";

export async function fetchSupportTickets(viewMode: "active" | "archived") {
  // Paginé : un simple select s'arrêtait aux 1000 premiers tickets.
  const data = await selectAllPages<Loose>((from, to) => {
    const query = supabaseAdmin.from("support_tickets").select("*");
    return (viewMode === "archived"
      ? query.eq("is_archived", true).order("archived_at", { ascending: false })
      : query.eq("is_archived", false).order("updated_at", { ascending: false })
    )
      .order("id")
      .range(from, to);
  });

  if (viewMode !== "archived" && data) {
    const statusOrder: Record<string, number> = {
      Ouvert: 1,
      "En cours": 2,
      Répondu: 3,
      Résolu: 4,
    };

    data.sort((a, b) => {
      const priorityA = a.priority === "high" ? 0 : 1;
      const priorityB = b.priority === "high" ? 0 : 1;
      if (priorityA !== priorityB) return priorityA - priorityB;

      const statusA = statusOrder[a.status] || 5;
      const statusB = statusOrder[b.status] || 5;
      if (statusA !== statusB) return statusA - statusB;

      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }

  return data || [];
}
