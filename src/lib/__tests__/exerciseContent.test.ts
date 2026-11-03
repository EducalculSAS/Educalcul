import { describe, expect, it } from "vitest";
import { stripBlockAnswers, stripAnswers, dedupeBlockIds } from "@/lib/exerciseContent";
import type { Block } from "@/components/admin/ExerciseBuilder";

const b = (extra: Partial<Block>): Block => ({ id: "b1", type: "qcm", content: "Q", points: 1, ...extra }) as Block;

describe("stripBlockAnswers : aucune bonne réponse ne doit partir vers l'élève", () => {
  it("retire correctAnswer et blanks", () => {
    const out = stripBlockAnswers(b({ type: "fill_in_the_blank", correctAnswer: "x", blanks: ["huit"] })) as Record<string, unknown>;
    expect(out).not.toHaveProperty("correctAnswer");
    expect(out).not.toHaveProperty("blanks");
  });
  it("association : seules les parties gauches, droites mélangées à part", () => {
    const out = stripBlockAnswers(b({ type: "matching", pairs: [{ left: "A", right: "a" }, { left: "B", right: "b" }] })) as Record<string, unknown>;
    expect(out.pairs).toEqual([{ left: "A" }, { left: "B" }]);
    expect([...(out.matchingOptions as string[])].sort()).toEqual(["a", "b"]);
  });
  it("mise en ordre : liste mélangée, jamais l'ordre d'origine exposé sous items", () => {
    const out = stripBlockAnswers(b({ type: "ordering", items: ["1", "2", "3"] })) as Record<string, unknown>;
    expect(out).not.toHaveProperty("items");
    expect([...(out.shuffledItems as string[])].sort()).toEqual(["1", "2", "3"]);
  });
  it("catégories : le texte seulement, sans la catégorie attendue", () => {
    const out = stripBlockAnswers(b({ type: "categorize", categoryItems: [{ text: "x", category: "A" }] })) as Record<string, unknown>;
    expect(out.categoryItems).toEqual([{ text: "x" }]);
  });
  it("mélange stable pour un même bloc", () => {
    const blk = b({ type: "ordering", items: ["a", "b", "c", "d", "e"] });
    expect((stripBlockAnswers(blk) as Record<string, unknown>).shuffledItems).toEqual((stripBlockAnswers(blk) as Record<string, unknown>).shuffledItems);
  });
});

describe("stripAnswers / dedupeBlockIds", () => {
  it("nettoie toutes les pages", () => {
    const out = stripAnswers({ content_json: [{ id: "p", blocks: [b({ correctAnswer: "z" })] }] }) as unknown as { content_json: { blocks: Record<string, unknown>[] }[] };
    expect(out.content_json[0].blocks[0]).not.toHaveProperty("correctAnswer");
  });
  it("rend les identifiants uniques dans tout l'exercice", () => {
    const out = dedupeBlockIds([{ blocks: [{ id: "block-1" }] }, { blocks: [{ id: "block-1" }] }]) as { blocks: { id: string }[] }[];
    expect(out[0].blocks[0].id).toBe("block-1");
    expect(out[1].blocks[0].id).not.toBe("block-1");
  });
});
