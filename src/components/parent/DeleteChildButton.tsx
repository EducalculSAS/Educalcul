"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useConfirm } from "@/components/ConfirmDialog";
import GlassIconButton from "@/components/ui/GlassIconButton";

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

  if (deleting) {
    return (
      <div className="w-9 h-9 flex items-center justify-center">
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-[var(--greek-blue)] border-t-transparent" />
      </div>
    );
  }

  return (
    <GlassIconButton
      icon={Trash2}
      onClick={handleDelete}
      color="red"
      aria-label="Supprimer le profil enfant"
    />
  );
}
