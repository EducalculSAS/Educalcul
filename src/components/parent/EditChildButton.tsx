"use client";

import { Edit } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";

/** Bouton « modifier le profil » en verre liquide (îlot client : l'icône est une fonction, elle ne passe pas depuis le serveur). */
export default function EditChildButton({ childId }: { childId: string }) {
  return <GlassIconButton icon={Edit} href={`/parent/edit-child/${childId}`} color="gray" size="sm" aria-label="Modifier le profil" />;
}
