import { describe, expect, it } from "vitest";
import { forumTextIssue } from "@/lib/forumFilter";

describe("filtre du forum", () => {
  it("laisse passer les messages de maths ordinaires", () => {
    for (const t of [
      "Je ne comprends pas comment résoudre 2x + 5 = 11, quelqu'un peut m'aider ?",
      "Le théorème de Pythagore dit que a² + b² = c². Dans mon exercice, 3,5 × 12 = 42.",
      "Combien font 1 250 000 + 375 000 ? J'ai trouvé 1 625 000.",
      "La consigne dit de calculer le périmètre du cercle de rayon 4 cm.",
      "Comment on convertit 2,5 km en m ? Merci !",
      "Il faut conclure avec une phrase réponse.",
    ]) expect(forumTextIssue(t), t).toBeNull();
  });
  it("refuse les coordonnées et les invitations à se retrouver ailleurs", () => {
    for (const t of [
      "écris moi à lea.dupont@gmail.com", "mon num c'est 06 12 34 56 78", "+33 6 12 34 56 78", "va voir https://exemple.com/truc",
      "ajoute-moi sur snap", "mon insta c'est @lea_2012", "viens sur discord", "j'habite 12 rue des Lilas", "lea arobase gmail point com",
    ]) expect(forumTextIssue(t), t).toBe("contact");
  });
  it("refuse les insultes, même maquillées", () => {
    for (const t of ["t'es un connard", "T'ES DÉBILE", "espèce de c0nnard", "ta gueule", "va mourir", "sale abrutiiii"]) {
      expect(forumTextIssue(t), t).toBe("insulte");
    }
  });
});
