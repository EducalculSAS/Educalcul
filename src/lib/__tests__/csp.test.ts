import { describe, expect, it } from "vitest";
import { allowsEval, standardCsp, strictCsp } from "@/lib/csp";

describe("Content-Security-Policy des pages publiques", () => {
  it("retire unsafe-eval des pages sans figure ni calcul à l'exécution", () => {
    for (const p of ["/", "/tarifs", "/faq", "/contact", "/a-propos", "/programmes", "/programmes/6eme", "/calia-tuteur-ia-maths", "/methode-pedagogique", "/cgu"]) {
      expect(standardCsp(p), p).not.toContain("'unsafe-eval'");
      expect(allowsEval(p), p).toBe(false);
    }
  });
  it("le garde là où les lecteurs de cours et d'exercices tournent (démo de la page Offres)", () => {
    expect(standardCsp("/offres")).toContain("'unsafe-eval'");
    expect(standardCsp("/auth/connexion")).toContain("'unsafe-eval'");
    expect(standardCsp("/page-inconnue")).toContain("'unsafe-eval'");
  });
  it("garde le reste de la politique, pages publiques comme espaces connectés", () => {
    for (const csp of [standardCsp("/"), strictCsp("abc")]) {
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'self'");
      expect(csp).toContain("base-uri 'self'");
    }
    expect(strictCsp("abc")).toContain("'nonce-abc'");
    const scriptSrc = (csp: string) => csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(scriptSrc(strictCsp("abc"))).not.toContain("'unsafe-inline'"); // espaces connectés : scripts en ligne seulement avec le nonce
  });
});
