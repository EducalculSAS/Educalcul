"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useConfirm } from "@/components/ConfirmDialog";

/** Bouton de suppression d'un profil enfant : seule action mutante de
 * /parent/children, isolée en client island. La liste elle-même est rendue
 * côté serveur ; router.refresh() la recharge après suppression au lieu de
 * gérer un état local dupliqué. */
export default function DeleteChildButton({ childId }: { childId: string }) {
  const confirm = useConfirm();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !(await confirm(
        "Êtes-vous sûr de vouloir supprimer ce profil enfant ? Cette action est irréversible.",
        { danger: true, title: "Supprimer le profil" }
      ))
    ) {
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase.from("users").delete().eq("id", childId);
      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error("Error deleting child:", error);
      alert("Une erreur est survenue lors de la suppression.");
      setDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
      title="Supprimer"
    >
      {deleting ? (
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-[var(--greek-blue)] border-t-transparent" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
    </button>
  );
}
