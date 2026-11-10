import { describe, expect, it } from "vitest";
import { internalChildEmail, isInternalEmail, realEmail } from "@/lib/childEmail";
import { CHILD_TOUR, PARENT_TOUR, nextStepIndex } from "@/lib/tour/steps";

describe("e-mail facultatif des enfants", () => {
  it("fabrique une adresse technique à partir du pseudo, reconnue comme telle", () => {
    expect(internalChildEmail("Lea_06")).toBe("lea_06@educalcul.user");
    expect(isInternalEmail("lea_06@educalcul.user")).toBe(true);
    expect(isInternalEmail(" LEA@EDUCALCUL.USER ")).toBe(true);
    expect(isInternalEmail("lea@gmail.com")).toBe(false);
    expect(isInternalEmail(null)).toBe(false);
  });
  it("ne renvoie jamais une adresse technique comme adresse réelle", () => {
    expect(realEmail("lea@educalcul.user")).toBeNull();
    expect(realEmail("")).toBeNull();
    expect(realEmail(undefined)).toBeNull();
    expect(realEmail(" lea@gmail.com ")).toBe("lea@gmail.com");
  });
});

describe("tutoriels guidés", () => {
  for (const [name, steps] of [["parent", PARENT_TOUR], ["élève", CHILD_TOUR]] as const) {
    it(`${name} : étapes cohérentes`, () => {
      expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
      steps.forEach((s, i) => {
        // Une étape « clic » ou « formulaire » mène quelque part, et l'étape suivante se joue sur cette page.
        if (s.action !== "next") {
          expect(s.to, s.id).toBeTruthy();
          expect(s.target, s.id).toBeTruthy();
          expect(steps[i + 1]?.path, s.id).toBe(s.to);
        }
        // Une étape facultative a forcément une cible (c'est son absence qui la fait sauter).
        if (s.optional) expect(s.target, s.id).toBeTruthy();
      });
      // On commence et on finit par une bulle sans cible, avec un bouton.
      expect(steps[0].target).toBeUndefined();
      expect(steps[steps.length - 1].action).toBe("next");
      expect(steps[steps.length - 1].target).toBeUndefined();
    });
  }
  it("sauter une étape qui menait à une page saute aussi les étapes de cette page", () => {
    const i = PARENT_TOUR.findIndex((s) => s.id === "p-nav-sub");
    expect(PARENT_TOUR[nextStepIndex(PARENT_TOUR, i, true)].id).toBe("p-nav-profile");
    expect(PARENT_TOUR[nextStepIndex(PARENT_TOUR, i)].id).toBe("p-sub");
  });
});
