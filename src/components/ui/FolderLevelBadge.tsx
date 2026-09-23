import { getCatalogLevelLabel } from "@/lib/constants";

/**
 * Pastille de niveau affichée sur une carte de dossier.
 *
 * Le niveau et la couleur viennent du dossier racine, propagés aux
 * sous-dossiers en base par le déclencheur `inherit_folder_style_from_parent` :
 * aucune requête ni jointure supplémentaire n'est nécessaire côté composant.
 *
 * Partagé par les catalogues d'exercices ET de quiz, pour que les deux ne
 * divergent pas — ils affichaient déjà la même carte à quelques classes près.
 */
export default function FolderLevelBadge({
  gradeLevel,
  color,
}: {
  gradeLevel?: string | null;
  color?: string | null;
}) {
  if (!gradeLevel) return null;
  const tone = color || "#3b82f6";
  return (
    <span
      className="mt-2 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ backgroundColor: `${tone}1f`, color: tone }}
    >
      {getCatalogLevelLabel(gradeLevel)}
    </span>
  );
}
