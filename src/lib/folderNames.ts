/** Nom de dossier comparable : sans accents, « & » = « et », sans petits mots (« Nombres & calculs » = « Nombres et calculs »). */
export const normFolderName = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(et|de|des|la|le|les|du)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
