import { describe, expect, it } from "vitest";
import { extractMistralText, parseJSON, retryDelayMs } from "@/lib/llmCore";

describe("parseJSON : réparer les JSON abîmés renvoyés par l'IA", () => {
  it("JSON valide inchangé", () => {
    expect(parseJSON('{"a":1,"b":[true,null]}')).toEqual({ a: 1, b: [true, null] });
  });
  it("LaTeX non échappé dans une chaîne (\\frac, \\times)", () => {
    const out = parseJSON('{"q":"Calcule \\frac{1}{2} \\times 4"}') as { q: string };
    expect(out.q).toBe("Calcule \\frac{1}{2} \\times 4");
  });
  it("retours à la ligne bruts dans une chaîne", () => {
    const out = parseJSON('{"t":"ligne 1\nligne 2"}') as { t: string };
    expect(out.t).toBe("ligne 1\nligne 2");
  });
  it("guillemets non échappés dans une chaîne", () => {
    const out = parseJSON('{"t":"Il a dit "bonjour" hier","n":2}') as { t: string; n: number };
    expect(out.n).toBe(2);
    expect(out.t).toContain("bonjour");
  });
  it("barres obliques inverses isolées", () => {
    const out = parseJSON('{"p":"C:\\temp et \\alpha"}') as { p: string };
    expect(typeof out.p).toBe("string");
  });
  it("lève une erreur claire quand rien n'est récupérable", () => {
    expect(() => parseJSON("pas du json du tout {")).toThrow(/JSON invalide/);
  });
});

describe("extractMistralText", () => {
  it("texte simple, morceaux de texte, JSON structuré", () => {
    expect(extractMistralText("salut")).toBe("salut");
    expect(extractMistralText([{ type: "text", text: "a" }, { type: "text", text: "b" }])).toBe("ab");
    expect(extractMistralText([{ type: "json", json: { x: 1 } }])).toBe('{"x":1}');
    expect(extractMistralText({ json: { y: 2 } })).toBe('{"y":2}');
  });
  it("renvoie une chaîne vide pour le reste", () => {
    for (const v of [null, undefined, 12, [], [{ type: "image" }]]) expect(extractMistralText(v)).toBe("");
  });
});

describe("retryDelayMs", () => {
  it("respecte l'en-tête Retry-After et croît avec les tentatives", () => {
    // Délai plafonné à 1,5 s (+ jitter < 150 ms) : on ne bloque jamais une requête utilisateur plus longtemps.
    expect(retryDelayMs(0, "1")).toBeGreaterThanOrEqual(1000);
    expect(retryDelayMs(0, "30")).toBeLessThan(1700);
    expect(retryDelayMs(3, null)).toBeGreaterThan(retryDelayMs(0, null) - 150);
  });
});
