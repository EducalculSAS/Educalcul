/**
 * Lit le corps JSON d'une requête SANS jamais lever d'exception : un corps vide, tronqué ou qui n'est pas du JSON donne `{}`.
 * Les routes valident ensuite les champs attendus et répondent 400 (« champ requis »), au lieu d'une erreur 500 « Unexpected end of JSON ».
 */
export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await req.json();
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
