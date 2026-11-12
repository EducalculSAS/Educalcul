import { renderUserText } from "@/lib/katexLoader";

/**
 * Texte court (titre, description) qui peut contenir des formules `$…$` : les formules sont rendues en LaTeX, le
 * reste est échappé. Sans « $ », le texte est rendu tel quel (aucun coût).
 */
export default function MathText({ text, className }: { text: string | null | undefined; className?: string }) {
  const value = text ?? "";
  if (!value.includes("$")) return <span className={className}>{value}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderUserText(value) }} />;
}
