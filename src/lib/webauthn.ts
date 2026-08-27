// Config WebAuthn (clés d'accès — empreinte, Face ID, clé de sécurité)
// dérivée de la requête elle-même plutôt que d'une variable d'env figée :
// le rpID DOIT correspondre exactement au nom d'hôte affiché dans le
// navigateur (localhost en dev, educalcul.com en prod), sinon la cérémonie
// échoue silencieusement côté navigateur.
export function getWebauthnRp(req: Request): { rpID: string; rpName: string; origin: string } {
  const originHeader = req.headers.get("origin");
  let origin = originHeader || "https://educalcul.com";
  let rpID: string;
  try {
    rpID = new URL(origin).hostname;
  } catch {
    origin = "https://educalcul.com";
    rpID = "educalcul.com";
  }
  return { rpID, rpName: "Educalcul", origin };
}
