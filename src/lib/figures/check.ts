import type { EduFig } from "@/lib/figures/types";
import { angleAt, buildGeometry, dist, fmtNum } from "@/lib/figures/build";

/**
 * Relit l'énoncé et vérifie que la figure dit la même chose : longueurs (« AB = 5 cm »), angle droit (« rectangle en
 * B »), angles (« \widehat{ABC} = 30° »), parallèles (« (MN) // (BC) »), triangle isocèle. C'est ce contrôle qui aurait
 * arrêté le triangle 5-12-13 annoncé « rectangle en A » alors qu'il l'est en B.
 */
export function checkFigureAgainstText(fig: EduFig, statement: string): string[] {
  if (fig.kind !== "geometry") return [];
  const problems: string[] = [];
  const scene = buildGeometry(fig);
  const P = scene.points;
  const text = statement
    .replace(/<[^>]+>/g, " ")
    .replace(/\\widehat\{\s*([A-Z]'?)\s*([A-Z]'?)\s*([A-Z]'?)\s*\}/g, "angle $1$2$3")
    .replace(/\\(?:text|mathrm)\{([^}]*)\}/g, "$1")
    .replace(/\\,|\;|\\ /g, " ")
    .replace(/[$]/g, " ")
    .replace(/\\parallel|∥|\/\//g, " // ")
    .replace(/\s+/g, " ");
  const pt = String.raw`[A-Z]'?`;
  const number = String.raw`(\d+(?:[.,]\d+)?)`;

  // Longueurs : « AB = 5 cm », « AB=5,2 ».
  for (const m of text.matchAll(new RegExp(String.raw`(?<![A-Za-z])(${pt})(${pt})\s*=\s*${number}\s*(?:cm|m|mm|dm|km|u)?(?![\d.,])`, "g"))) {
    const [, a, b, v] = m;
    const pa = P.get(a), pb = P.get(b);
    if (!pa || !pb) continue;
    const want = Number(v.replace(",", "."));
    const got = dist(pa, pb);
    if (Math.abs(got - want) > Math.max(0.02 * want, 0.05)) problems.push(`L'énoncé dit ${a}${b} = ${fmtNum(want)}, la figure mesure ${fmtNum(got)}.`);
  }
  // Angle droit : « rectangle en B » (dans le triangle cité juste avant, sinon le premier triangle de la figure).
  for (const m of text.matchAll(new RegExp(String.raw`(?:triangle\s+(${pt})(${pt})(${pt})\s+)?(?:est\s+)?rectangle\s+en\s+(${pt})`, "gi"))) {
    const v = m[4];
    let tri = m[1] ? [m[1], m[2], m[3]] : null;
    if (!tri) {
      const step = fig.steps.find((s) => s.op === "triangle" && s.names.includes(v));
      tri = step && step.op === "triangle" ? step.names : null;
    }
    if (!tri || !tri.includes(v)) continue;
    const others = tri.filter((x) => x !== v);
    const a = P.get(others[0]), b = P.get(v), c = P.get(others[1]);
    if (!a || !b || !c) continue;
    const ang = angleAt(a, b, c);
    if (Math.abs(ang - 90) > 1) {
      const real = tri.find((x) => { const o = tri!.filter((y) => y !== x); const pa = P.get(o[0]), pb = P.get(x), pc = P.get(o[1]); return pa && pb && pc && Math.abs(angleAt(pa, pb, pc) - 90) < 1; });
      problems.push(`L'énoncé dit « rectangle en ${v} », la figure a un angle de ${fmtNum(ang, 1)}° en ${v}${real ? ` (l'angle droit est en ${real})` : ""}.`);
    }
  }
  // Angles : « angle ABC = 30° ».
  for (const m of text.matchAll(new RegExp(String.raw`angle\s+(${pt})(${pt})(${pt})\s*=\s*${number}\s*°`, "gi"))) {
    const [, a, b, c, v] = m;
    const pa = P.get(a), pb = P.get(b), pc = P.get(c);
    if (!pa || !pb || !pc) continue;
    const got = angleAt(pa, pb, pc), want = Number(v.replace(",", "."));
    if (Math.abs(got - want) > 1) problems.push(`L'énoncé dit angle ${a}${b}${c} = ${fmtNum(want)}°, la figure mesure ${fmtNum(got, 1)}°.`);
  }
  // Parallèles : « (MN) // (BC) ».
  for (const m of text.matchAll(new RegExp(String.raw`\(?(${pt})(${pt})\)?\s*//\s*\(?(${pt})(${pt})\)?`, "g"))) {
    const [, a, b, c, d] = m;
    const pa = P.get(a), pb = P.get(b), pc = P.get(c), pd = P.get(d);
    if (!pa || !pb || !pc || !pd) continue;
    const cross = (pb.x - pa.x) * (pd.y - pc.y) - (pb.y - pa.y) * (pd.x - pc.x);
    if (Math.abs(cross) > 1e-3 * dist(pa, pb) * dist(pc, pd)) problems.push(`L'énoncé dit (${a}${b}) // (${c}${d}), ce n'est pas le cas sur la figure.`);
  }
  // Isocèle : « isocèle en A » dans le triangle cité.
  for (const m of text.matchAll(new RegExp(String.raw`triangle\s+(${pt})(${pt})(${pt})\s+(?:est\s+)?isocèle\s+en\s+(${pt})`, "gi"))) {
    const tri = [m[1], m[2], m[3]], v = m[4];
    const o = tri.filter((x) => x !== v);
    const a = P.get(v), b = P.get(o[0]), c = P.get(o[1]);
    if (a && b && c && Math.abs(dist(a, b) - dist(a, c)) > 0.02 * dist(a, b)) problems.push(`L'énoncé dit « isocèle en ${v} », la figure ne l'est pas.`);
  }
  return [...scene.errors, ...problems];
}
