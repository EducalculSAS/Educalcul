/** Partagé entre la page /tarifs (comparateur) et l'aperçu tarifs de la home —
 * même mapping features -> libellés, pour ne jamais diverger entre les deux. */
export const FEATURE_ROWS: { key: string; label: string; tip?: string }[] = [
  { key: "max_children", label: "Enfants", tip: "Profils enfants actifs simultanément" },
  { key: "access_level_exercises", label: "Niveaux scolaires", tip: "CP à 6ème / CP à 3ème / CP à Terminale" },
  { key: "ai_access", label: "IA EpsiAI", tip: "Accès à l'assistante pédagogique IA" },
  { key: "ai_daily_limit", label: "Questions IA / jour", tip: "Nombre de messages envoyés à EpsiAI" },
  { key: "quiz_access", label: "Quiz & évaluations", tip: "Accès à tous les quiz" },
  { key: "detailed_reports", label: "Rapports hebdomadaires", tip: "Email récapitulatif chaque semaine" },
  { key: "custom_avatars", label: "Avatars & cosmétiques", tip: "Contours et couleurs de nom exclusifs" },
  { key: "priority_support", label: "Support prioritaire", tip: "Réponse garantie sous 4h en semaine" },
];

export function formatVal(key: string, val: boolean | number | string | null): { label: string; included: boolean } {
  if (val === false || val === null || val === 0 || val === "none") return { label: "", included: false };
  if (val === true) return { label: "Inclus", included: true };
  if (key === "max_children") return { label: Number(val) === -1 ? "Illimité" : `${val} enfant${Number(val) > 1 ? "s" : ""}`, included: true };
  if (key === "ai_daily_limit") return { label: Number(val) === -1 ? "Illimité" : `${val} / jour`, included: true };
  if (key === "ai_access") {
    if (val === "unlimited") return { label: "Illimité", included: true };
    if (val === "limited") return { label: "Limité", included: true };
    return { label: "", included: false };
  }
  if (key === "access_level_exercises") {
    if (val === "all") return { label: "CP → Terminale", included: true };
    if (val === "college") return { label: "CP → 3ème", included: true };
    if (val === "basic") return { label: "CP → 6ème", included: true };
    return { label: String(val), included: true };
  }
  if (key === "history") {
    if (val === "unlim" || val === "unlimited") return { label: "Illimité", included: true };
    if (val === "30d") return { label: "30 jours", included: true };
    if (val === "7d") return { label: "7 jours", included: true };
    return { label: String(val), included: true };
  }
  return { label: String(val), included: true };
}

export const intervalLabel = (i: string) => {
  switch (i) {
    case "year": return "/an";
    case "semester": return "/semestre";
    case "quarter": return "/trimestre";
    default: return "/mois";
  }
};
