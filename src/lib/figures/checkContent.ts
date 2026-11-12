import { EDUFIG_RE, findEduFigs } from "@/lib/figures/render";
import { checkFigureAgainstText } from "@/lib/figures/check";

/** Écarts entre les figures EduFig d'un exercice compilé et le texte de leur question. */
export function checkExerciseFigures(contentJson: unknown): string[] {
  const warnings: string[] = [];
  const pages = Array.isArray(contentJson) ? contentJson : [];
  let q = 0;
  for (const page of pages as { blocks?: { content?: unknown; type?: unknown }[] }[]) {
    for (const block of page.blocks ?? []) {
      if (block.type !== "text") q += 1;
      const html = typeof block.content === "string" ? block.content : "";
      for (const { fig } of findEduFigs(html)) {
        for (const problem of checkFigureAgainstText(fig, html.replace(EDUFIG_RE, " "))) warnings.push(`Question ${q || 1} : ${problem}`);
      }
    }
  }
  return warnings;
}
