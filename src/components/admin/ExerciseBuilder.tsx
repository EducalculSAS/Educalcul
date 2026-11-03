"use client";
 

import { useState, useEffect, useRef } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useDragAutoScroll } from "@/lib/useDragAutoScroll";
import { Plus, Sparkles, ListPlus, ShieldCheck } from "lucide-react";

import AISectionEditModal from "./AISectionEditModal";
import AIAddExerciseModal from "./AIAddExerciseModal";
import GlassButton from "@/components/ui/GlassButton";
import { useKatexIn } from "@/lib/useKatexIn";
import { QuickEntryModal, CheckPanel } from "./ExerciseAuthoringTools";
import { duplicateBlock, duplicatePage, makeVariants, newId, type AuthoringBlock, type AuthoringPage } from "@/lib/contentAuthoring";

import BuilderPageList from "@/components/admin/builder/BuilderPageList";
const BLOCK_CLIPBOARD_KEY = "educalcul:block-clipboard";

export type BlockType =
  | "text"
  | "image" // Média (image/vidéo/audio) — le nom de clé est conservé pour compat avec le contenu existant
  | "qcm"
  | "single_choice" // legacy, conservé en lecture pour le contenu déjà publié
  | "multiple_choice" // legacy, conservé en lecture pour le contenu déjà publié
  | "true_false"
  | "text_input"
  | "fill_in_the_blank"
  | "matching"
  | "ordering"
  | "coding"
  | "impossible_search"
  | "categorize"
  | "number_line_point"
  | "click_error";

/** Figure à compléter à même ses cases (texte à trous « sur une figure ») : pyramide de briques ou grille. "" = case vide. */
export type FigureSpec =
  | { kind: "brick_pyramid"; levels: string[][] }
  | { kind: "fill_grid"; cells: string[][] };

export interface Block {
  id: string;
  type: BlockType;
  title: string;
  content?: string; // HTML for text/questions, URL for image/media, texte à trous avec {{1}}, {{2}}... pour fill_in_the_blank

  // Média (type "image") : nature du fichier uploadé, pour savoir comment le rendre
  mediaType?: "image" | "video" | "audio";

  // Question specific
  points?: number;
  options?: string[]; // qcm / single_choice / multiple_choice
  correctAnswer?: string | string[]; // qcm : toujours un tableau (une ou plusieurs bonnes réponses)
  explanation?: string;
  /** Coups de pouce, du plus léger au plus fort : l'élève les demande un par un. */
  hints?: string[];

  // Texte à trous : une réponse attendue par blanc, dans l'ordre d'apparition
  // des jetons {{1}}, {{2}}... dans `content`. Alternatives séparées par "|".
  blanks?: string[];
  // Texte à trous sur une figure : les cases vides de la figure SONT les trous (dans l'ordre de lecture) ;
  // `content` est alors un simple énoncé, sans jetons {{1}}.
  figureSpec?: FigureSpec;

  // Association / Relier : paires à relier (le "right" affiché est mélangé côté élève)
  pairs?: { left: string; right: string }[];

  // Mise en ordre : éléments dans leur ORDRE CORRECT (mélangés à l'affichage élève)
  items?: string[];

  // Catégoriser : noms des catégories/bacs, puis éléments à y répartir.
  categories?: string[];
  categoryItems?: { text: string; category: string }[];

  // Point sur une droite graduée : bornes/pas de la graduation, valeur
  // correcte dans `correctAnswer` (chaîne numérique, ex: "0.75").
  numberLineMin?: number;
  numberLineMax?: number;
  numberLineStep?: number;

  // Repérage d'erreur : étapes affichées, l'index de l'étape fausse est
  // dans `correctAnswer` (chaîne, ex: "1").
  steps?: string[];

  // Champs fournis par l'API à la place de `pairs`/`items` quand la réponse
  // correcte a été retirée (lecture non-admin, avant soumission) : liste déjà
  // mélangée, sans révéler la correspondance/l'ordre attendu.
  matchingOptions?: string[];
  shuffledItems?: string[];
}

// Défauts sensés par type — utilisés à la création d'un bloc pour que l'admin
// n'ait jamais à reconfigurer un bloc vide avant de pouvoir travailler dessus.
function defaultBlockFields(type: BlockType): Partial<Block> {
  switch (type) {
    case "qcm":
    case "single_choice":
    case "multiple_choice":
      return { content: "", options: ["Option 1", "Option 2"], correctAnswer: ["Option 1"] };
    case "true_false":
      return { content: "", correctAnswer: "true" };
    case "text_input":
      return { content: "", correctAnswer: "" };
    case "fill_in_the_blank":
      return { content: "Complète : 3 + 5 = {{1}}", blanks: ["8"] };
    case "matching":
      return {
        content: "",
        pairs: [
          { left: "Élément 1", right: "Correspondance 1" },
          { left: "Élément 2", right: "Correspondance 2" },
        ],
      };
    case "ordering":
      return { content: "", items: ["Étape 1", "Étape 2", "Étape 3"] };
    case "coding":
      return { content: "", correctAnswer: "" };
    case "impossible_search":
      return { content: "", correctAnswer: "" };
    case "categorize":
      return {
        content: "",
        categories: ["Catégorie A", "Catégorie B"],
        categoryItems: [
          { text: "Élément 1", category: "Catégorie A" },
          { text: "Élément 2", category: "Catégorie B" },
        ],
      };
    case "number_line_point":
      return { content: "", numberLineMin: 0, numberLineMax: 10, numberLineStep: 1, correctAnswer: "5" };
    case "click_error":
      return { content: "", steps: ["Étape 1", "Étape 2 (fausse)", "Étape 3"], correctAnswer: "1" };
    case "image":
      return { content: "" };
    default:
      return { content: "" };
  }
}

/** Métadonnées qu'un éditeur de contenu peut proposer au formulaire qui l'entoure (titre, description, difficulté, durée). */
export interface ContentMetadata {
  title?: string;
  description?: string;
  difficulty_level?: "easy" | "medium" | "hard";
  time_limit?: number;
  time_limit_minutes?: number;
  min_score_percent?: number;
  max_attempts?: number;
}

export interface Page {
  id: string;
  title: string;
  blocks: Block[];
  /** « problem » : l'énoncé commun (texte, figure) reste affiché à côté des questions, qui se résolvent pas à pas. */
  layout?: "problem";
  /** Les questions se débloquent une par une : on répond à la première pour voir la suivante. */
  sequential?: boolean;
}

interface ExerciseBuilderProps {
  initialContent: Page[];
  onChange: (content: Page[]) => void;
  onMetadataChange?: (metadata: ContentMetadata) => void;
  /** Niveau scolaire de l'exercice, déjà choisi plus haut dans le formulaire. */
  level?: string;
}

export default function ExerciseBuilder({
  initialContent,
  onChange,
  level,
}: ExerciseBuilderProps) {
  const confirm = useConfirm();
  const [pages, setPages] = useState<Page[]>(initialContent || []);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [draggedPage, setDraggedPage] = useState<number | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<{ pageId: string; index: number } | null>(null);
  const [addBlockMenuFor, setAddBlockMenuFor] = useState<string | null>(null);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [uploadErrorBlockId, setUploadErrorBlockId] = useState<string | null>(null);
  useDragAutoScroll(draggedPage !== null || draggedBlock !== null);

  const reorder = <T,>(arr: T[], from: number, to: number): T[] => {
    const copy = [...arr];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    return copy;
  };

  const movePage = (from: number, to: number) => {
    if (from === to || to < 0 || to >= pages.length) return;
    setPages(reorder(pages, from, to));
  };

  const moveBlock = (pageId: string, from: number, to: number) => {
    setPages(pages.map((p) => {
      if (p.id !== pageId) return p;
      if (from === to || to < 0 || to >= p.blocks.length) return p;
      return { ...p, blocks: reorder(p.blocks, from, to) };
    }));
  };

  // Outils de rédaction à la main : saisie rapide, vérificateur, copier/coller de blocs entre exercices.
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryPageId, setQuickEntryPageId] = useState<string | null>(null);
  const [isCheckOpen, setIsCheckOpen] = useState(false);
  const [clipboardBlock, setClipboardBlock] = useState<Block | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BLOCK_CLIPBOARD_KEY);
      if (raw) setClipboardBlock(JSON.parse(raw) as Block);
    } catch {
      // Stockage indisponible ou contenu illisible : pas de bloc copié.
    }
  }, []);

  // Titres par défaut (« Question 3 ») renumérotés dans l'ordre après une duplication, des variantes ou un collage ;
  // un titre écrit à la main n'est jamais touché.
  const renumberDefaultTitles = (blocks: Block[]): Block[] => {
    let n = 0;
    return blocks.map((b) => (/^Question \d+$/.test(b.title) ? { ...b, title: `Question ${++n}` } : b));
  };

  const applyQuickEntry = (groups: { title: string | null; blocks: AuthoringBlock[] }[], targetPageId: string | null) => {
    const added: Page[] = [];
    let next = pages;
    groups.forEach((group, i) => {
      const blocks = group.blocks as unknown as Block[];
      if (targetPageId && i === 0 && !group.title) {
        next = next.map((p) => (p.id === targetPageId ? { ...p, blocks: renumberDefaultTitles([...p.blocks, ...blocks]) } : p));
      } else {
        const page: Page = { id: newId(), title: group.title || `Page ${next.length + added.length + 1}`, blocks };
        added.push(page);
      }
    });
    setPages([...next, ...added]);
    setExpandedPages((prev) => {
      const open = new Set(prev);
      if (targetPageId) open.add(targetPageId);
      added.forEach((p) => open.add(p.id));
      return open;
    });
  };

  const duplicateBlockAt = (pageId: string, blockId: string) => {
    setPages(pages.map((p) => {
      if (p.id !== pageId) return p;
      const at = p.blocks.findIndex((b) => b.id === blockId);
      if (at < 0) return p;
      const copy = duplicateBlock(p.blocks[at] as unknown as AuthoringBlock) as unknown as Block;
      return { ...p, blocks: renumberDefaultTitles([...p.blocks.slice(0, at + 1), copy, ...p.blocks.slice(at + 1)]) };
    }));
  };

  const duplicatePageAt = (pageId: string) => {
    const at = pages.findIndex((p) => p.id === pageId);
    if (at < 0) return;
    const copy = duplicatePage(pages[at] as unknown as AuthoringPage) as unknown as Page;
    setPages([...pages.slice(0, at + 1), copy, ...pages.slice(at + 1)]);
    setExpandedPages((prev) => new Set(prev).add(copy.id));
  };

  const copyBlockToClipboard = (block: Block) => {
    setClipboardBlock(block);
    try {
      localStorage.setItem(BLOCK_CLIPBOARD_KEY, JSON.stringify(block));
    } catch {
      // Le bloc reste copiable tant que cet exercice est ouvert.
    }
  };

  const pasteBlock = (pageId: string) => {
    if (!clipboardBlock) return;
    const copy = duplicateBlock(clipboardBlock as unknown as AuthoringBlock) as unknown as Block;
    setPages(pages.map((p) => (p.id === pageId ? { ...p, blocks: renumberDefaultTitles([...p.blocks, copy]) } : p)));
    setExpandedPages((prev) => new Set(prev).add(pageId));
  };

  const addVariants = (pageId: string, blockId: string) => {
    const page = pages.find((p) => p.id === pageId);
    const block = page?.blocks.find((b) => b.id === blockId);
    if (!page || !block) return;
    const result = makeVariants(block as unknown as AuthoringBlock, 5);
    if (result.blocks.length === 0) {
      alert(result.reason || "Aucune variante possible pour ce bloc.");
      return;
    }
    const at = page.blocks.findIndex((b) => b.id === blockId);
    setPages(pages.map((p) => (p.id === pageId ? { ...p, blocks: renumberDefaultTitles([...p.blocks.slice(0, at + 1), ...(result.blocks as unknown as Block[]), ...p.blocks.slice(at + 1)]) } : p)));
  };

  const jumpToBlock = (pageId: string, blockId: string) => {
    setIsCheckOpen(false);
    setExpandedPages((prev) => new Set(prev).add(pageId));
    setTimeout(() => document.getElementById(`block-${blockId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  };

  // AI Edit State
  const [isAiAddModalOpen, setIsAiAddModalOpen] = useState(false);
  const [aiEditTarget, setAiEditTarget] = useState<
    | { scope: "page"; pageId: string }
    | { scope: "block"; pageId: string; blockId: string }
    | null
  >(null);
  const effectiveLevel = level || "6eme";
  const contentRef = useRef<HTMLDivElement>(null);

  // Insertion d'un élément à une position ("start" | "end" | id existant).
  const insertAt = <T extends { id: string }>(arr: T[], item: T, position: string): T[] => {
    const copy = [...arr];
    if (position === "start") copy.unshift(item);
    else if (position === "end") copy.push(item);
    else {
      const i = copy.findIndex((x) => x.id === position);
      if (i >= 0) copy.splice(i + 1, 0, item);
      else copy.push(item);
    }
    return copy;
  };

  const addPageFromAI = (page: Page, position: string) => {
    setPages((prev) => insertAt(prev, page, position));
    setExpandedPages((prev) => new Set(prev).add(page.id));
  };

  const addBlockFromAI = (block: Block, pageId: string, position: string) => {
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, blocks: insertAt(p.blocks, block, position) } : p)));
    setExpandedPages((prev) => new Set(prev).add(pageId));
  };

  // Formules $…$ rendues en place (voir useKatexIn : plus d'appel différé sur un élément déjà démonté).
  useKatexIn(contentRef, [pages]);

  // Sync state with props when initialContent changes (e.g. from parent AI generation)
  useEffect(() => {
    if (
      initialContent &&
      JSON.stringify(initialContent) !== JSON.stringify(pages)
    ) {
      setPages(initialContent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- resynchronisation quand le contenu initial change, pas à chaque modification locale
  }, [initialContent]);

  useEffect(() => {
    onChange(pages);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange change d'identité à chaque rendu du parent : l'inclure relancerait l'effet en boucle
  }, [pages]);

  const addPage = () => {
    const newPage: Page = {
      id: crypto.randomUUID(),
      title: `Page ${pages.length + 1}`,
      blocks: [],
    };
    setPages([...pages, newPage]);
    setExpandedPages(new Set([...expandedPages, newPage.id]));
  };

  const updatePage = (id: string, updates: Partial<Page>) => {
    setPages(pages.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removePage = async (id: string) => {
    if (await confirm("Supprimer cette page et tout son contenu ?")) {
      setPages(pages.filter((p) => p.id !== id));
    }
  };

  const togglePage = (id: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedPages(newExpanded);
  };

  const addBlock = (pageId: string, type: BlockType) => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type,
      title: type === "text" ? "" : "Nouvelle question",
      points: type === "text" || type === "image" ? undefined : 1,
      ...defaultBlockFields(type),
    };
    setPages(
      pages.map((p) => {
        if (p.id === pageId) {
          return { ...p, blocks: [...p.blocks, newBlock] };
        }
        return p;
      })
    );
    setAddBlockMenuFor(null);
  };

  const updateBlock = (
    pageId: string,
    blockId: string,
    updates: Partial<Block>
  ) => {
    setPages(
      pages.map((p) => {
        if (p.id === pageId) {
          return {
            ...p,
            blocks: p.blocks.map((b) =>
              b.id === blockId ? { ...b, ...updates } : b
            ),
          };
        }
        return p;
      })
    );
  };

  const removeBlock = (pageId: string, blockId: string) => {
    setPages(
      pages.map((p) => {
        if (p.id === pageId) {
          return {
            ...p,
            blocks: p.blocks.filter((b) => b.id !== blockId),
          };
        }
        return p;
      })
    );
  };

  const uploadMedia = async (pageId: string, blockId: string, file: File) => {
    setUploadingBlockId(blockId);
    setUploadErrorBlockId(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "uploads/exercise_media");
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'upload");
      const mediaType = file.type.startsWith("video")
        ? "video"
        : file.type.startsWith("audio")
        ? "audio"
        : "image";
      updateBlock(pageId, blockId, { content: data.url, mediaType });
    } catch {
      setUploadErrorBlockId(blockId);
    } finally {
      setUploadingBlockId(null);
    }
  };

  const addOption = (pageId: string, blockId: string) => {
    setPages(
      pages.map((p) => {
        if (p.id === pageId) {
          return {
            ...p,
            blocks: p.blocks.map((b) => {
              if (b.id === blockId && b.options) {
                return {
                  ...b,
                  options: [...b.options, `Option ${b.options.length + 1}`],
                };
              }
              return b;
            }),
          };
        }
        return p;
      })
    );
  };

  const updateOption = (
    pageId: string,
    blockId: string,
    index: number,
    value: string
  ) => {
    setPages(
      pages.map((p) => {
        if (p.id === pageId) {
          return {
            ...p,
            blocks: p.blocks.map((b) => {
              if (b.id === blockId && b.options) {
                const newOptions = [...b.options];
                newOptions[index] = value;
                return { ...b, options: newOptions };
              }
              return b;
            }),
          };
        }
        return p;
      })
    );
  };

  const removeOption = (pageId: string, blockId: string, index: number) => {
    setPages(
      pages.map((p) => {
        if (p.id === pageId) {
          return {
            ...p,
            blocks: p.blocks.map((b) => {
              if (b.id === blockId && b.options) {
                return {
                  ...b,
                  options: b.options.filter((_, i) => i !== index),
                };
              }
              return b;
            }),
          };
        }
        return p;
      })
    );
  };

  return (
    <div className="space-y-4" ref={contentRef}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-900">Contenu de l&apos;exercice</h3>
        <div className="flex flex-wrap gap-2 justify-end">
          <GlassButton size="sm" variant="navy" type="button" onClick={() => { setQuickEntryPageId(null); setIsQuickEntryOpen(true); }}>
            <ListPlus size={16} />
            Saisie rapide
          </GlassButton>
          <GlassButton size="sm" variant="ghost" type="button" onClick={() => setIsCheckOpen(true)}>
            <ShieldCheck size={16} />
            Vérifier
          </GlassButton>
          <GlassButton size="sm" variant="navy" onClick={() => setIsAiAddModalOpen(true)}>
            <Sparkles size={16} />
            Ajouter avec l&apos;IA
          </GlassButton>
          <GlassButton size="sm" variant="navy" onClick={addPage}>
            <Plus size={16} />
            Ajouter une page
          </GlassButton>
        </div>
      </div>

      {isQuickEntryOpen && (
        <QuickEntryModal
          pages={pages as unknown as AuthoringPage[]}
          defaultPageId={quickEntryPageId}
          onApply={applyQuickEntry}
          onClose={() => setIsQuickEntryOpen(false)}
        />
      )}

      {isCheckOpen && <CheckPanel pages={pages as unknown as AuthoringPage[]} onJump={jumpToBlock} onClose={() => setIsCheckOpen(false)} />}

      {isAiAddModalOpen && (
        <AIAddExerciseModal
          level={effectiveLevel}
          pages={pages}
          onAddPage={addPageFromAI}
          onAddBlock={addBlockFromAI}
          onClose={() => setIsAiAddModalOpen(false)}
        />
      )}

      {aiEditTarget?.scope === "page" && (() => {
        const page = pages.find((p) => p.id === aiEditTarget.pageId);
        if (!page) return null;
        return (
          <AISectionEditModal
            scope="page"
            level={effectiveLevel}
            section={page}
            onApply={(updated) => updatePage(page.id, updated)}
            onClose={() => setAiEditTarget(null)}
          />
        );
      })()}

      {aiEditTarget?.scope === "block" && (() => {
        const page = pages.find((p) => p.id === aiEditTarget.pageId);
        const block = page?.blocks.find((b) => b.id === aiEditTarget.blockId);
        if (!page || !block) return null;
        return (
          <AISectionEditModal
            scope="block"
            level={effectiveLevel}
            section={block}
            onApply={(updated) => updateBlock(page.id, block.id, updated)}
            onClose={() => setAiEditTarget(null)}
          />
        );
      })()}

      {pages.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50">
          <p className="text-gray-500 mb-2">Aucun contenu</p>
          <p className="text-sm text-gray-400">
            Ajoutez une page pour commencer
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {<BuilderPageList pages={pages} setDraggedPage={setDraggedPage} draggedPage={draggedPage} movePage={movePage} expandedPages={expandedPages} togglePage={togglePage} updatePage={updatePage} setAiEditTarget={setAiEditTarget} setQuickEntryPageId={setQuickEntryPageId} setIsQuickEntryOpen={setIsQuickEntryOpen} clipboardBlock={clipboardBlock} pasteBlock={pasteBlock} duplicatePageAt={duplicatePageAt} removePage={removePage} setDraggedBlock={setDraggedBlock} draggedBlock={draggedBlock} moveBlock={moveBlock} updateBlock={updateBlock} addVariants={addVariants} duplicateBlockAt={duplicateBlockAt} copyBlockToClipboard={copyBlockToClipboard} removeBlock={removeBlock} uploadMedia={uploadMedia} uploadingBlockId={uploadingBlockId} uploadErrorBlockId={uploadErrorBlockId} updateOption={updateOption} removeOption={removeOption} addOption={addOption} addBlockMenuFor={addBlockMenuFor} setAddBlockMenuFor={setAddBlockMenuFor} addBlock={addBlock} />}
        </div>
      )}
    </div>
  );
}
