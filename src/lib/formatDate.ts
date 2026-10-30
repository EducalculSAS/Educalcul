/**
 * Dates affichées dans des composants rendus aussi sur le serveur : la langue ET le fuseau sont fixés, sinon le serveur
 * (en-US, UTC) et le navigateur (fr-FR, Paris) n'écrivent pas la même chose et React signale une erreur d'hydratation (#418).
 */
export function formatDateFr(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}
