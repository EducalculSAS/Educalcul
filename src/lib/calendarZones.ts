export const ZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Toutes zones" },
  { value: "A", label: "Zone A" },
  { value: "B", label: "Zone B" },
  { value: "C", label: "Zone C" },
  { value: "corse", label: "Corse" },
  { value: "guadeloupe", label: "Guadeloupe" },
  { value: "guyane", label: "Guyane" },
  { value: "martinique", label: "Martinique" },
  { value: "mayotte", label: "Mayotte" },
  { value: "nouvelle_caledonie", label: "Nouvelle-Calédonie" },
  { value: "polynesie", label: "Polynésie française" },
  { value: "reunion", label: "La Réunion" },
];

export const STUDENT_ZONE_OPTIONS = ZONE_OPTIONS.filter(z => z.value !== "all");

export function getZoneLabel(zone: string): string {
  return ZONE_OPTIONS.find(z => z.value === zone)?.label || zone;
}
