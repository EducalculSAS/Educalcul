import { describe, expect, it } from "vitest";
import { plural } from "@/lib/plural";

describe("plural", () => {
  it("garde le singulier pour 0 et 1 (règle française)", () => {
    expect(plural(0, "leçon")).toBe("0 leçon");
    expect(plural(1, "chapitre")).toBe("1 chapitre");
  });
  it("met le pluriel à partir de 2", () => {
    expect(plural(2, "leçon")).toBe("2 leçons");
    expect(plural(12, "chapitre")).toBe("12 chapitres");
  });
  it("accepte un pluriel irrégulier", () => {
    expect(plural(3, "cheval", "chevaux")).toBe("3 chevaux");
  });
});
