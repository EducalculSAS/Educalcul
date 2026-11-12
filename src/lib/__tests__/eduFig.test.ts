import { describe, expect, it } from "vitest";
import { buildGeometry, dist, angleAt, solveTriangle } from "@/lib/figures/build";
import { checkFigureAgainstText } from "@/lib/figures/check";
import { normalizeEduFig } from "@/lib/figures/normalize";
import { decodeFigAttr, eduFigHtml, findEduFigs, renderEduFig } from "@/lib/figures/render";
import type { EduFig, GeometryFig } from "@/lib/figures/types";
import { EDUFIG_PRESETS } from "@/lib/figures/presets";

const geo = (steps: GeometryFig["steps"], items?: GeometryFig["items"]): GeometryFig => ({ v: 1, kind: "geometry", steps, items });

describe("construction géométrique", () => {
  it("construit un triangle à partir de trois côtés, à l'échelle", () => {
    const s = buildGeometry(geo([{ op: "triangle", names: ["A", "B", "C"], lengths: { AB: 5, BC: 12, AC: 13 } }]));
    const P = s.points;
    expect(dist(P.get("A")!, P.get("B")!)).toBeCloseTo(5);
    expect(dist(P.get("B")!, P.get("C")!)).toBeCloseTo(12);
    expect(angleAt(P.get("A")!, P.get("B")!, P.get("C")!)).toBeCloseTo(90);
  });

  it("place l'angle droit là où on le demande et calcule l'hypoténuse", () => {
    const s = buildGeometry(geo([{ op: "triangle", names: ["D", "E", "F"], right: "D", lengths: { DE: 6, DF: 8 } }]));
    expect(dist(s.points.get("E")!, s.points.get("F")!)).toBeCloseTo(10);
    expect(s.autoItems.some((i) => i.type === "right")).toBe(true);
  });

  it("résout deux côtés et l'angle compris, puis un côté et deux angles", () => {
    expect(solveTriangle(["A", "B", "C"], { AB: 4, AC: 4 }, { A: 60 }, undefined).sides?.[0]).toBeCloseTo(4);
    const r = solveTriangle(["A", "B", "C"], { BC: 10 }, { B: 30 }, "C");
    expect(r.sides?.[1]).toBeCloseTo(10 * Math.tan(Math.PI / 6) * 1, 5);
  });

  it("refuse un triangle impossible avec une explication", () => {
    const s = buildGeometry(geo([{ op: "triangle", names: ["A", "B", "C"], lengths: { AB: 3, BC: 4, AC: 8 } }]));
    expect(s.errors[0]).toMatch(/impossible/);
  });

  it("signale des données contradictoires (pas rectangle avec ces longueurs)", () => {
    const s = buildGeometry(geo([{ op: "triangle", names: ["A", "B", "C"], right: "A", lengths: { AB: 5, BC: 12, AC: 13 } }]));
    expect(s.errors.join(" ")).toMatch(/n'est pas rectangle en A/);
  });

  it("construit une configuration de Thalès avec (MN) parallèle à (BC)", () => {
    const s = buildGeometry(geo([{ op: "thales", names: ["A", "B", "C", "M", "N"], AB: 6, AC: 9, BC: 7.5, AM: 2 }]));
    const P = s.points;
    expect(dist(P.get("A")!, P.get("M")!)).toBeCloseTo(2);
    expect(dist(P.get("A")!, P.get("N")!)).toBeCloseTo(3);
    expect(dist(P.get("M")!, P.get("N")!)).toBeCloseTo(2.5);
  });

  it("transforme une figure (symétrie centrale, homothétie)", () => {
    const s = buildGeometry(geo([
      { op: "point", name: "O", x: 0, y: 0 },
      { op: "point", name: "A", x: 2, y: 1 },
      { op: "image", map: { A: "A'" }, transform: { type: "symmetryPoint", center: "O" } },
      { op: "image", map: { A: "A2" }, transform: { type: "homothety", center: "O", k: 3 } },
    ]));
    expect(s.points.get("A'")).toEqual({ x: -2, y: -1 });
    expect(s.points.get("A2")!.x).toBeCloseTo(6);
  });
});

describe("contrôle énoncé / figure", () => {
  const fig = geo([{ op: "triangle", names: ["A", "B", "C"], lengths: { AB: 5, BC: 12, AC: 13 } }]);

  it("arrête « rectangle en A » quand l'angle droit est en B", () => {
    const pb = checkFigureAgainstText(fig, "Le triangle ABC avec AB = 5 cm, BC = 12 cm et AC = 13 cm est rectangle en A.");
    expect(pb.join(" ")).toMatch(/l'angle droit est en B/);
  });

  it("laisse passer un énoncé conforme", () => {
    expect(checkFigureAgainstText(fig, "Le triangle $ABC$ est rectangle en $B$ avec $AB = 5$ cm et $BC = 12$ cm.")).toEqual([]);
  });

  it("repère une longueur fausse et un parallélisme faux", () => {
    expect(checkFigureAgainstText(fig, "On donne AB = 6 cm.")[0]).toMatch(/AB = 6/);
    const th = geo([{ op: "thales", names: ["A", "B", "C", "M", "N"], AB: 6, AC: 9, BC: 7.5, AM: 2 }]);
    expect(checkFigureAgainstText(th, "Les droites (MN) // (BC).")).toEqual([]);
    expect(checkFigureAgainstText(th, "Les droites (MC) // (BN).").length).toBe(1);
  });
});

describe("format et rendu", () => {
  it("accepte une description écrite à la main (virgules, noms collés)", () => {
    const { fig, errors } = normalizeEduFig({ kind: "geometry", steps: [{ op: "rectangle", names: "ABCD", width: "12", height: "5,5" }] });
    expect(errors).toEqual([]);
    expect(fig?.kind === "geometry" && fig.steps[0]).toMatchObject({ op: "rectangle", names: ["A", "B", "C", "D"], height: 5.5 });
  });

  it("refuse un type inconnu", () => {
    expect(normalizeEduFig({ kind: "hologramme" }).fig).toBeNull();
  });

  it("chaque modèle de l'admin produit une figure valide et dessinée", () => {
    for (const preset of EDUFIG_PRESETS) {
      const fig = preset.build(Object.fromEntries(preset.params.map((p) => [p.key, p.default])));
      const { fig: again, errors } = normalizeEduFig(JSON.parse(JSON.stringify(fig)));
      expect(errors, preset.id).toEqual([]);
      const r = renderEduFig(again!);
      expect(r.errors, preset.id).toEqual([]);
      expect(r.svg, preset.id).toMatch(/^<svg/);
    }
  });

  it("range la description avec le dessin et la relit", () => {
    const fig: EduFig = { v: 1, kind: "graph", x: [-4, 4], curves: [{ expr: "2x + 1", name: "f" }], caption: "Droite d'équation \"y = 2x + 1\"" };
    const html = eduFigHtml(fig);
    expect(html).toContain("<svg");
    const found = findEduFigs(`<p>avant</p>${html}<p>après</p>`);
    expect(found).toHaveLength(1);
    expect(found[0].fig).toMatchObject({ kind: "graph", caption: fig.caption });
    expect(decodeFigAttr(JSON.stringify(fig))?.kind).toBe("graph");
  });
});
