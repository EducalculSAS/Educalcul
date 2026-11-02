import { describe, expect, it } from "vitest";
import { parseDelimited, parseQuickEntry, plainToHtml, htmlToPlain } from "@/lib/contentAuthoring";

describe("contentAuthoring", () => {
  it("convertit texte ↔ HTML sans perte de contenu", () => {
    expect(htmlToPlain(plainToHtml("Calcule 12 + 8"))).toContain("Calcule 12 + 8");
  });
  it("détecte le séparateur d'un tableur (point-virgule, virgule, tabulation)", () => {
    expect(parseDelimited("a;b;c\n1;2;3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
    expect(parseDelimited("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseDelimited("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("lit la saisie rapide : chaque ligne donne un bloc, avec un total cohérent", () => {
    const res = parseQuickEntry("# Partie 1\nCombien font 2 + 2 ? | 4\nCombien font 3 + 3 ? | 6");
    const blocks = res.groups.flatMap((g) => g.blocks);
    expect(blocks.length).toBe(res.total);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(res.groups[0].title).toBe("Partie 1");
  });
});
