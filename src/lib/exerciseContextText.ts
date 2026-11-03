/** Bloc tel que stocké en base. Les champs `text`, `question`, `prompt`, `statement`, `label`, `placeholder`, `alt`, `caption` et les options
 * en objets viennent d'anciennes versions de l'éditeur : on les lit encore pour que l'assistant garde le contexte des vieux exercices. */
interface StoredBlock {
  type?: string;
  content?: string;
  text?: string;
  question?: string;
  prompt?: string;
  statement?: string;
  label?: string;
  placeholder?: string;
  alt?: string;
  caption?: string;
  options?: (string | { text?: string; label?: string })[];
}
interface StoredPage { blocks?: StoredBlock[] }

/** Texte de tout l'exercice (énoncés, options, légendes), donné comme contexte à l'assistant de l'élève. */
export function extractExerciseContent(contentJson: unknown, options: { includePlaceholder?: boolean } = {}): string {
  if (!contentJson || !Array.isArray(contentJson)) {
    return "";
  }

  const allContent: string[] = [];

  (contentJson as StoredPage[]).forEach((page) => {
    if (page.blocks && Array.isArray(page.blocks)) {
      page.blocks.forEach((block) => {
        if (block.content) allContent.push(block.content);
        if (block.text) allContent.push(block.text);
        if (block.question) allContent.push(block.question);
        if (block.prompt) allContent.push(block.prompt);

        if (block.options && Array.isArray(block.options)) {
          block.options.forEach((opt) => {
            if (typeof opt === "string") return;
            if (opt.text) allContent.push(`- ${opt.text}`);
            if (opt.label) allContent.push(`- ${opt.label}`);
          });
        }

        if (block.type === "true_false") {
          if (block.statement) allContent.push(block.statement);
        }

        if (block.type === "text_input") {
          if (block.label) allContent.push(block.label);
          if (options.includePlaceholder && block.placeholder) allContent.push(`Indice: ${block.placeholder}`);
        }

        if (block.type === "image") {
          if (block.alt) allContent.push(`[Image: ${block.alt}]`);
          if (block.caption) allContent.push(block.caption);
        }
      });
    }
  });

  return allContent.filter((c) => c && c.length > 0).join("\n");
}
