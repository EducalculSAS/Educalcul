"use client";

import { useState, useEffect, useRef } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { useDragAutoScroll } from "@/lib/useDragAutoScroll";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  CheckSquare,
  List,
  ArrowRightLeft,
  ArrowUpDown,
  AlignLeft,
  Code2,
  ToggleLeft,
  Type,
  Sparkles,
  Loader2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  LayoutGrid,
  Ruler,
  SearchX,
} from "lucide-react";

import AISectionEditModal from "./AISectionEditModal";
import AIAddExerciseModal from "./AIAddExerciseModal";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import ContentInsertToolbar from "./ContentInsertToolbar";
import { ensureKatexAutoRenderLoaded } from "@/lib/katexLoader";

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

// Types encore proposés à la création — single_choice/multiple_choice restent
// gérés en LECTURE (contenu déjà publié) mais ne sont plus proposés : "qcm"
// les remplace (une case à cocher par option détermine les bonnes réponses).
export const BLOCK_TYPE_META: Partial<Record<BlockType, { label: string; icon: typeof FileText; description: string }>> = {
  text: { label: "Texte", icon: AlignLeft, description: "Paragraphe explicatif, sans question" },
  image: { label: "Média (image / vidéo / audio)", icon: ImageIcon, description: "Fichier à téléverser ou glisser" },
  text_input: { label: "Réponse libre", icon: Type, description: "Calcul / réponse courte, corrigée par IA" },
  qcm: { label: "QCM", icon: CheckSquare, description: "Une ou plusieurs bonnes réponses, cochées dans les options" },
  true_false: { label: "Vrai / Faux", icon: ToggleLeft, description: "Affirmation à valider" },
  fill_in_the_blank: { label: "Texte à trous", icon: List, description: "Compléter un texte avec des mots manquants" },
  matching: { label: "Association", icon: ArrowRightLeft, description: "Relier des éléments entre eux" },
  ordering: { label: "Mise en ordre", icon: ArrowUpDown, description: "Remettre des éléments dans le bon ordre" },
  coding: { label: "Code / Algo", icon: Code2, description: "Écrire un algorithme ou du code, corrigé par IA" },
  impossible_search: { label: "Recherche impossible", icon: AlertTriangle, description: "L'énoncé n'a pas de solution, l'élève doit le justifier, corrigé par IA" },
  categorize: { label: "Catégoriser", icon: LayoutGrid, description: "Trier des éléments dans plusieurs catégories (glisser-déposer)" },
  number_line_point: { label: "Point sur une droite graduée", icon: Ruler, description: "Placer un point à la bonne valeur sur une droite graduée" },
  click_error: { label: "Repérer l'erreur", icon: SearchX, description: "Cliquer sur l'étape incorrecte d'un calcul ou d'un raisonnement" },
};

// Liste type-safe des types proposés à la création (pickers), dans l'ordre
// d'affichage — dérivée des clés réellement présentes dans BLOCK_TYPE_META.
export const CREATABLE_BLOCK_TYPES = Object.keys(BLOCK_TYPE_META) as BlockType[];

// Libellés pour les anciens types qui peuvent encore exister en base (contenu
// déjà publié) mais qu'on ne propose plus à la création.
const LEGACY_BLOCK_LABELS: Partial<Record<BlockType, string>> = {
  single_choice: "QCM (ancien format, choix unique)",
  multiple_choice: "QCM (ancien format, choix multiple)",
};

// Normalise correctAnswer en tableau, que le bloc soit "qcm" (toujours un
// tableau) ou un ancien "single_choice" (chaîne unique historique).
export function correctAnswersArray(block: Block): string[] {
  return Array.isArray(block.correctAnswer)
    ? block.correctAnswer
    : block.correctAnswer
    ? [block.correctAnswer]
    : [];
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
  onMetadataChange?: (metadata: any) => void;
  /** Niveau scolaire de l'exercice, déjà choisi plus haut dans le formulaire. */
  level?: string;
}

export default function ExerciseBuilder({
  initialContent,
  onChange,
  onMetadataChange,
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

  // Charge KaTeX une seule fois, partagé entre tous les builders montés
  // (voir ensureKatexAutoRenderLoaded — évite d'accumuler/retirer des
  // scripts globaux à chaque montage/démontage de builder).
  useEffect(() => {
    ensureKatexAutoRenderLoaded()
      .then(() => {
        if (contentRef.current && (window as any).renderMathInElement) {
          (window as any).renderMathInElement(contentRef.current, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
          });
        }
      })
      .catch((err) => console.error(err));
  }, []);

  // Re-run math rendering when content changes
  useEffect(() => {
    if ((window as any).renderMathInElement && contentRef.current) {
      // Small timeout to ensure DOM is updated
      setTimeout(() => {
        (window as any).renderMathInElement(contentRef.current, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      }, 100);
    }
  }, [pages]);

  // Sync state with props when initialContent changes (e.g. from parent AI generation)
  useEffect(() => {
    if (
      initialContent &&
      JSON.stringify(initialContent) !== JSON.stringify(pages)
    ) {
      setPages(initialContent);
    }
  }, [initialContent]);

  useEffect(() => {
    onChange(pages);
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
        <h3 className="font-semibold text-gray-900">Contenu de l'exercice</h3>
        <div className="flex gap-2">
          <GlassButton size="sm" variant="navy" onClick={() => setIsAiAddModalOpen(true)}>
            <Sparkles size={16} />
            Ajouter avec l'IA
          </GlassButton>
          <GlassButton size="sm" variant="navy" onClick={addPage}>
            <Plus size={16} />
            Ajouter une page
          </GlassButton>
        </div>
      </div>

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
          {pages.map((page, pageIndex) => (
            <div
              key={page.id}
              draggable
              onDragStart={() => setDraggedPage(pageIndex)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedPage !== null) movePage(draggedPage, pageIndex);
                setDraggedPage(null);
              }}
              onDragEnd={() => setDraggedPage(null)}
              className={`border border-[rgba(197,161,72,0.25)] rounded-xl overflow-hidden bg-white transition-opacity ${draggedPage === pageIndex ? "opacity-40" : ""}`}
            >
              {/* Page Header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-[rgba(197,161,72,0.25)]">
                <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500" title="Glisser pour réordonner">
                  <GripVertical size={18} />
                </div>
                <GlassIconButton
                  icon={expandedPages.has(page.id) ? ChevronDown : ChevronRight}
                  onClick={() => togglePage(page.id)}
                  color="navy"
                  size="sm"
                  aria-label={expandedPages.has(page.id) ? "Replier la page" : "Déplier la page"}
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={page.title}
                    onChange={(e) =>
                      updatePage(page.id, { title: e.target.value })
                    }
                    className="bg-transparent border-none font-medium text-gray-900 focus:outline-none focus:ring-0 w-full"
                    placeholder="Titre de la page"
                  />
                </div>
                <GlassButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setAiEditTarget({ scope: "page", pageId: page.id })}
                  className="!px-2.5"
                >
                  <Sparkles size={14} />
                  <span className="hidden sm:inline">IA</span>
                </GlassButton>
                <GlassIconButton
                  icon={Trash2}
                  onClick={() => removePage(page.id)}
                  color="red"
                  size="sm"
                  aria-label="Supprimer la page"
                />
              </div>

              {/* Page Content (Blocks) */}
              {expandedPages.has(page.id) && (
                <div className="p-4 bg-gray-50/50">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-xs text-gray-600">
                    <label className="flex items-center gap-1.5" title="Les blocs « Texte » et « Média » du début forment l'énoncé commun, affiché à côté des questions">
                      <input
                        type="checkbox"
                        checked={page.layout === "problem"}
                        onChange={(e) => updatePage(page.id, { layout: e.target.checked ? "problem" : undefined })}
                      />
                      Problème guidé : énoncé et figure fixes à côté des questions
                    </label>
                    <label className="flex items-center gap-1.5" title="La question suivante apparaît quand l'élève a répondu à la précédente">
                      <input
                        type="checkbox"
                        checked={page.sequential === true}
                        onChange={(e) => updatePage(page.id, { sequential: e.target.checked || undefined })}
                      />
                      Questions débloquées une par une
                    </label>
                  </div>
                  <div className="space-y-4">
                    {page.blocks.map((block, blockIndex) => (
                      <div
                        key={block.id}
                        draggable
                        onDragStart={() => setDraggedBlock({ pageId: page.id, index: blockIndex })}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedBlock && draggedBlock.pageId === page.id) {
                            moveBlock(page.id, draggedBlock.index, blockIndex);
                          }
                          setDraggedBlock(null);
                        }}
                        onDragEnd={() => setDraggedBlock(null)}
                        className={`bg-white border border-[rgba(197,161,72,0.25)] rounded-lg p-4 shadow-sm transition-opacity ${draggedBlock?.pageId === page.id && draggedBlock.index === blockIndex ? "opacity-40" : ""}`}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mr-2 mt-1" title="Glisser pour réordonner">
                            <GripVertical size={16} />
                          </div>
                          <div className="flex-1 grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              value={block.title}
                              onChange={(e) =>
                                updateBlock(page.id, block.id, {
                                  title: e.target.value,
                                })
                              }
                              className="border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                              placeholder="Titre du bloc"
                            />
                            <select
                              value={block.type}
                              onChange={(e) => {
                                const newType = e.target.value as BlockType;
                                if (newType === block.type) return;
                                updateBlock(page.id, block.id, {
                                  type: newType,
                                  ...defaultBlockFields(newType),
                                });
                              }}
                              className="border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                            >
                              {!CREATABLE_BLOCK_TYPES.includes(block.type) && (
                                <option value={block.type}>
                                  {LEGACY_BLOCK_LABELS[block.type] || block.type}
                                </option>
                              )}
                              {CREATABLE_BLOCK_TYPES.map((t) => (
                                <option key={t} value={t}>{BLOCK_TYPE_META[t]!.label}</option>
                              ))}
                            </select>
                          </div>
                          <GlassIconButton
                            icon={Sparkles}
                            onClick={() => setAiEditTarget({ scope: "block", pageId: page.id, blockId: block.id })}
                            color="navy"
                            size="sm"
                            aria-label="Modifier ce bloc avec l'IA"
                            className="ml-2"
                          />
                          <GlassIconButton
                            icon={Trash2}
                            onClick={() => removeBlock(page.id, block.id)}
                            color="red"
                            size="sm"
                            aria-label="Supprimer le bloc"
                            className="ml-1"
                          />
                        </div>

                        {/* Block Content based on Type */}
                        <div className="space-y-3">
                          {/* Common Question Text for all question types */}
                          {[
                            "qcm",
                            "single_choice",
                            "multiple_choice",
                            "true_false",
                            "text_input",
                            "fill_in_the_blank",
                            "matching",
                            "ordering",
                            "coding",
                            "impossible_search",
                            "categorize",
                            "number_line_point",
                            "click_error",
                          ].includes(block.type) && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-gray-500 uppercase">
                                {block.type === "fill_in_the_blank" ? "Texte à trous" : "Énoncé"}
                              </label>
                              {block.type === "fill_in_the_blank" && (
                                <p className="text-xs text-gray-400">
                                  Utilise <code className="bg-gray-100 px-1 rounded">{"{{1}}"}</code>, <code className="bg-gray-100 px-1 rounded">{"{{2}}"}</code>... à la place des mots manquants.
                                </p>
                              )}
                              {block.type === "impossible_search" && (
                                <p className="text-xs text-gray-400">
                                  Un énoncé qui semble demander un calcul/une réponse mais n'en a pas
                                  (données insuffisantes, contradictoires, ou hors du domaine étudié).
                                  L'élève doit reconnaître et justifier l'impossibilité, pas calculer.
                                </p>
                              )}
                              <ContentInsertToolbar
                                content={block.content}
                                onReplace={(next) => updateBlock(page.id, block.id, { content: next })}
                                onInsert={(html) =>
                                  updateBlock(page.id, block.id, {
                                    content: `${block.content || ""}\n${html}\n`,
                                  })
                                }
                              />
                              <textarea
                                value={block.content}
                                onChange={(e) =>
                                  updateBlock(page.id, block.id, {
                                    content: e.target.value,
                                  })
                                }
                                className="w-full h-24 border-[rgba(197,161,72,0.25)] rounded-lg text-sm p-3"
                                placeholder={
                                  block.type === "fill_in_the_blank"
                                    ? "Complète : 3 + 5 = {{1}}"
                                    : block.type === "coding"
                                    ? "Décris l'algorithme à écrire..."
                                    : block.type === "impossible_search"
                                    ? "Ex : Calcule le troisième côté du triangle sachant qu'il mesure 3cm, 4cm et a un angle droit de 100°..."
                                    : block.type === "matching" || block.type === "ordering"
                                    ? "Consigne (optionnelle)..."
                                    : "Posez votre question ici..."
                                }
                              />
                              {(block.content?.includes("$$") ||
                                block.content?.includes("\\")) && (
                                <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm">
                                  <span className="text-xs font-bold text-blue-400 block mb-1 uppercase tracking-wider">
                                    Aperçu
                                  </span>
                                  <div className="latex-content text-gray-800">
                                    {block.content}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {block.type === "text" && (
                            <div>
                              <ContentInsertToolbar
                                content={block.content}
                                onReplace={(next) => updateBlock(page.id, block.id, { content: next })}
                                onInsert={(html) =>
                                  updateBlock(page.id, block.id, {
                                    content: `${block.content || ""}\n${html}\n`,
                                  })
                                }
                              />
                              <textarea
                                value={block.content}
                                onChange={(e) =>
                                  updateBlock(page.id, block.id, {
                                    content: e.target.value,
                                  })
                                }
                                className="w-full h-32 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                placeholder="Contenu texte (HTML supporté)..."
                              />
                              {(block.content?.includes("$$") ||
                                block.content?.includes("\\")) && (
                                <div className="mt-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-sm">
                                  <span className="text-xs font-bold text-blue-400 block mb-1 uppercase tracking-wider">
                                    Aperçu
                                  </span>
                                  <div className="latex-content text-gray-800">
                                    {block.content}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {block.type === "image" && (
                            <div className="space-y-2">
                              {block.content ? (
                                <div className="relative inline-block">
                                  {block.mediaType === "video" ? (
                                    <video src={block.content} controls className="h-40 rounded-lg border bg-black" />
                                  ) : block.mediaType === "audio" ? (
                                    <audio src={block.content} controls className="w-64" />
                                  ) : (
                                    <img src={block.content} alt="Preview" className="h-40 object-contain border rounded-lg bg-gray-50" />
                                  )}
                                  <GlassIconButton
                                    icon={Trash2}
                                    onClick={() => updateBlock(page.id, block.id, { content: "", mediaType: undefined })}
                                    color="red"
                                    size="sm"
                                    aria-label="Retirer le fichier"
                                    className="absolute -top-2 -right-2"
                                  />
                                </div>
                              ) : (
                                <label
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) uploadMedia(page.id, block.id, file);
                                  }}
                                  className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[rgba(197,161,72,0.4)] rounded-lg py-8 cursor-pointer hover:border-[var(--greek-blue)] hover:bg-[var(--greek-blue)]/5 transition-colors text-center"
                                >
                                  <ImageIcon size={22} className="text-gray-400" />
                                  <span className="text-sm text-gray-500">
                                    {uploadingBlockId === block.id
                                      ? "Envoi en cours..."
                                      : "Clique pour choisir un fichier, ou glisse-le ici"}
                                  </span>
                                  <span className="text-xs text-gray-400">Image, vidéo (mp4/webm) ou audio (mp3/wav)</span>
                                  <input
                                    type="file"
                                    accept="image/*,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg"
                                    className="hidden"
                                    disabled={uploadingBlockId === block.id}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) uploadMedia(page.id, block.id, file);
                                    }}
                                  />
                                </label>
                              )}
                              {uploadErrorBlockId === block.id && (
                                <p className="text-xs text-red-500">Échec de l'envoi du fichier. Réessaie (max 20 Mo).</p>
                              )}
                            </div>
                          )}

                          {["qcm", "single_choice", "multiple_choice"].includes(block.type) && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Options, coche la/les bonne(s) réponse(s)
                              </label>
                              {block.options?.map((option, optIndex) => {
                                const correct = correctAnswersArray(block);
                                const isChecked = correct.includes(option);
                                return (
                                  <div
                                    key={optIndex}
                                    className="flex items-center gap-2"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const next = e.target.checked
                                          ? [...correct, option]
                                          : correct.filter((c) => c !== option);
                                        updateBlock(page.id, block.id, { correctAnswer: next });
                                      }}
                                      className="w-4 h-4 shrink-0 accent-[var(--greek-blue)]"
                                      title="Bonne réponse"
                                    />
                                    <input
                                      type="text"
                                      value={option}
                                      onChange={(e) => {
                                        // Si l'option cochée est renommée, on met à jour correctAnswer en conséquence.
                                        const wasCorrect = correct.includes(option);
                                        updateOption(page.id, block.id, optIndex, e.target.value);
                                        if (wasCorrect) {
                                          updateBlock(page.id, block.id, {
                                            correctAnswer: correct.map((c) => (c === option ? e.target.value : c)),
                                          });
                                        }
                                      }}
                                      className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                    />
                                    <GlassIconButton
                                      icon={Trash2}
                                      onClick={() => {
                                        removeOption(page.id, block.id, optIndex);
                                        updateBlock(page.id, block.id, {
                                          correctAnswer: correct.filter((c) => c !== option),
                                        });
                                      }}
                                      color="red"
                                      size="sm"
                                      aria-label="Supprimer l'option"
                                    />
                                  </div>
                                );
                              })}
                              <GlassButton
                                size="sm"
                                variant="ghost"
                                onClick={() => addOption(page.id, block.id)}
                              >
                                <Plus size={14} /> Ajouter une option
                              </GlassButton>
                            </div>
                          )}

                          {block.type === "true_false" && (
                            <div className="flex gap-4">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${block.id}`}
                                  checked={block.correctAnswer === "true"}
                                  onChange={() =>
                                    updateBlock(page.id, block.id, {
                                      correctAnswer: "true",
                                    })
                                  }
                                />
                                <span className="text-sm">Vrai</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`correct-${block.id}`}
                                  checked={block.correctAnswer === "false"}
                                  onChange={() =>
                                    updateBlock(page.id, block.id, {
                                      correctAnswer: "false",
                                    })
                                  }
                                />
                                <span className="text-sm">Faux</span>
                              </label>
                            </div>
                          )}

                          {block.type === "text_input" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Réponse attendue
                              </label>
                              <input
                                type="text"
                                value={(block.correctAnswer as string) || ""}
                                onChange={(e) =>
                                  updateBlock(page.id, block.id, {
                                    correctAnswer: e.target.value,
                                  })
                                }
                                className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                placeholder="La réponse exacte attendue..."
                              />
                            </div>
                          )}

                          {block.type === "coding" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Solution de référence (utilisée par l'IA pour corriger)
                              </label>
                              <textarea
                                value={(block.correctAnswer as string) || ""}
                                onChange={(e) =>
                                  updateBlock(page.id, block.id, {
                                    correctAnswer: e.target.value,
                                  })
                                }
                                className="w-full h-24 border-[rgba(197,161,72,0.25)] rounded-lg text-sm p-3 font-mono"
                                placeholder="Algorithme / code attendu, ou description de la démarche correcte..."
                              />
                            </div>
                          )}

                          {block.type === "impossible_search" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Justification attendue (utilisée par l'IA pour corriger)
                              </label>
                              <textarea
                                value={(block.correctAnswer as string) || ""}
                                onChange={(e) =>
                                  updateBlock(page.id, block.id, {
                                    correctAnswer: e.target.value,
                                  })
                                }
                                className="w-full h-24 border-[rgba(197,161,72,0.25)] rounded-lg text-sm p-3"
                                placeholder="Ex : Impossible, la somme des angles d'un triangle ne peut pas dépasser 180°..."
                              />
                            </div>
                          )}

                          {block.type === "fill_in_the_blank" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Réponses attendues (une par trou, dans l'ordre)
                              </label>
                              {(block.blanks || []).map((blank, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-400 w-6">{`{{${i + 1}}}`}</span>
                                  <input
                                    type="text"
                                    value={blank}
                                    onChange={(e) => {
                                      const next = [...(block.blanks || [])];
                                      next[i] = e.target.value;
                                      updateBlock(page.id, block.id, { blanks: next });
                                    }}
                                    className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                    placeholder="Réponse attendue (alternatives séparées par |)"
                                  />
                                  <GlassIconButton
                                    icon={Trash2}
                                    onClick={() => {
                                      const next = (block.blanks || []).filter((_, j) => j !== i);
                                      updateBlock(page.id, block.id, { blanks: next });
                                    }}
                                    color="red"
                                    size="sm"
                                    aria-label="Supprimer ce trou"
                                  />
                                </div>
                              ))}
                              <GlassButton
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  updateBlock(page.id, block.id, {
                                    blanks: [...(block.blanks || []), ""],
                                  })
                                }
                              >
                                <Plus size={14} /> Ajouter un trou
                              </GlassButton>
                            </div>
                          )}

                          {block.type === "matching" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Paires à relier
                              </label>
                              {(block.pairs || []).map((pair, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={pair.left}
                                    onChange={(e) => {
                                      const next = [...(block.pairs || [])];
                                      next[i] = { ...next[i], left: e.target.value };
                                      updateBlock(page.id, block.id, { pairs: next });
                                    }}
                                    className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                    placeholder="Élément"
                                  />
                                  <ArrowRightLeft size={14} className="text-gray-300 shrink-0" />
                                  <input
                                    type="text"
                                    value={pair.right}
                                    onChange={(e) => {
                                      const next = [...(block.pairs || [])];
                                      next[i] = { ...next[i], right: e.target.value };
                                      updateBlock(page.id, block.id, { pairs: next });
                                    }}
                                    className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                    placeholder="Correspondance"
                                  />
                                  <GlassIconButton
                                    icon={Trash2}
                                    onClick={() => {
                                      const next = (block.pairs || []).filter((_, j) => j !== i);
                                      updateBlock(page.id, block.id, { pairs: next });
                                    }}
                                    color="red"
                                    size="sm"
                                    aria-label="Supprimer cette paire"
                                  />
                                </div>
                              ))}
                              <GlassButton
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  updateBlock(page.id, block.id, {
                                    pairs: [...(block.pairs || []), { left: "", right: "" }],
                                  })
                                }
                              >
                                <Plus size={14} /> Ajouter une paire
                              </GlassButton>
                            </div>
                          )}

                          {block.type === "ordering" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Éléments, dans leur ordre CORRECT
                              </label>
                              {(block.items || []).map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
                                  <input
                                    type="text"
                                    value={item}
                                    onChange={(e) => {
                                      const next = [...(block.items || [])];
                                      next[i] = e.target.value;
                                      updateBlock(page.id, block.id, { items: next });
                                    }}
                                    className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                    placeholder="Étape / élément"
                                  />
                                  <GlassIconButton
                                    icon={ArrowUp}
                                    disabled={i === 0}
                                    onClick={() => {
                                      const next = [...(block.items || [])];
                                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                      updateBlock(page.id, block.id, { items: next });
                                    }}
                                    color="navy"
                                    size="sm"
                                    aria-label="Monter cet élément"
                                  />
                                  <GlassIconButton
                                    icon={ArrowDown}
                                    disabled={i === (block.items?.length || 0) - 1}
                                    onClick={() => {
                                      const next = [...(block.items || [])];
                                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                                      updateBlock(page.id, block.id, { items: next });
                                    }}
                                    color="navy"
                                    size="sm"
                                    aria-label="Descendre cet élément"
                                  />
                                  <GlassIconButton
                                    icon={Trash2}
                                    onClick={() => {
                                      const next = (block.items || []).filter((_, j) => j !== i);
                                      updateBlock(page.id, block.id, { items: next });
                                    }}
                                    color="red"
                                    size="sm"
                                    aria-label="Supprimer cet élément"
                                  />
                                </div>
                              ))}
                              <GlassButton
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  updateBlock(page.id, block.id, {
                                    items: [...(block.items || []), ""],
                                  })
                                }
                              >
                                <Plus size={14} /> Ajouter un élément
                              </GlassButton>
                            </div>
                          )}

                          {block.type === "categorize" && (
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Catégories</label>
                                {(block.categories || []).map((cat, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={cat}
                                      onChange={(e) => {
                                        const oldName = cat;
                                        const nextCats = [...(block.categories || [])];
                                        nextCats[i] = e.target.value;
                                        const nextItems = (block.categoryItems || []).map((it) =>
                                          it.category === oldName ? { ...it, category: e.target.value } : it
                                        );
                                        updateBlock(page.id, block.id, { categories: nextCats, categoryItems: nextItems });
                                      }}
                                      className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                      placeholder="Nom de la catégorie"
                                    />
                                    <GlassIconButton
                                      icon={Trash2}
                                      disabled={(block.categories?.length || 0) <= 2}
                                      onClick={() => {
                                        const removed = cat;
                                        const nextCats = (block.categories || []).filter((_, j) => j !== i);
                                        const nextItems = (block.categoryItems || []).filter((it) => it.category !== removed);
                                        updateBlock(page.id, block.id, { categories: nextCats, categoryItems: nextItems });
                                      }}
                                      color="red"
                                      size="sm"
                                      aria-label="Supprimer cette catégorie"
                                    />
                                  </div>
                                ))}
                                <GlassButton
                                  size="sm"
                                  variant="ghost"
                                  disabled={(block.categories?.length || 0) >= 4}
                                  onClick={() =>
                                    updateBlock(page.id, block.id, {
                                      categories: [...(block.categories || []), `Catégorie ${(block.categories?.length || 0) + 1}`],
                                    })
                                  }
                                >
                                  <Plus size={14} /> Ajouter une catégorie (max 4)
                                </GlassButton>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Éléments à classer</label>
                                {(block.categoryItems || []).map((item, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={item.text}
                                      onChange={(e) => {
                                        const next = [...(block.categoryItems || [])];
                                        next[i] = { ...next[i], text: e.target.value };
                                        updateBlock(page.id, block.id, { categoryItems: next });
                                      }}
                                      className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                      placeholder="Élément"
                                    />
                                    <select
                                      value={item.category}
                                      onChange={(e) => {
                                        const next = [...(block.categoryItems || [])];
                                        next[i] = { ...next[i], category: e.target.value };
                                        updateBlock(page.id, block.id, { categoryItems: next });
                                      }}
                                      className="border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                    >
                                      {(block.categories || []).map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                      ))}
                                    </select>
                                    <GlassIconButton
                                      icon={Trash2}
                                      onClick={() => {
                                        const next = (block.categoryItems || []).filter((_, j) => j !== i);
                                        updateBlock(page.id, block.id, { categoryItems: next });
                                      }}
                                      color="red"
                                      size="sm"
                                      aria-label="Supprimer cet élément"
                                    />
                                  </div>
                                ))}
                                <GlassButton
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    updateBlock(page.id, block.id, {
                                      categoryItems: [
                                        ...(block.categoryItems || []),
                                        { text: "", category: (block.categories || [])[0] || "" },
                                      ],
                                    })
                                  }
                                >
                                  <Plus size={14} /> Ajouter un élément
                                </GlassButton>
                              </div>
                            </div>
                          )}

                          {block.type === "click_error" && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Étapes, coche celle qui est FAUSSE
                              </label>
                              {(block.steps || []).map((step, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <input
                                    type="radio"
                                    name={`click-error-${block.id}`}
                                    checked={block.correctAnswer === String(i)}
                                    onChange={() => updateBlock(page.id, block.id, { correctAnswer: String(i) })}
                                    className="shrink-0"
                                    aria-label={`Étape ${i + 1} incorrecte`}
                                  />
                                  <input
                                    type="text"
                                    value={step}
                                    onChange={(e) => {
                                      const next = [...(block.steps || [])];
                                      next[i] = e.target.value;
                                      updateBlock(page.id, block.id, { steps: next });
                                    }}
                                    className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm font-mono"
                                    placeholder="Étape du calcul"
                                  />
                                  <GlassIconButton
                                    icon={Trash2}
                                    onClick={() => {
                                      const next = (block.steps || []).filter((_, j) => j !== i);
                                      updateBlock(page.id, block.id, {
                                        steps: next,
                                        correctAnswer: block.correctAnswer === String(i) ? "" : block.correctAnswer,
                                      });
                                    }}
                                    color="red"
                                    size="sm"
                                    aria-label="Supprimer cette étape"
                                  />
                                </div>
                              ))}
                              <GlassButton
                                size="sm"
                                variant="ghost"
                                onClick={() => updateBlock(page.id, block.id, { steps: [...(block.steps || []), ""] })}
                              >
                                <Plus size={14} /> Ajouter une étape
                              </GlassButton>
                            </div>
                          )}

                          {block.type === "number_line_point" && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-gray-500">Minimum</label>
                                <input
                                  type="number"
                                  value={block.numberLineMin ?? 0}
                                  onChange={(e) => updateBlock(page.id, block.id, { numberLineMin: parseFloat(e.target.value) || 0 })}
                                  className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Maximum</label>
                                <input
                                  type="number"
                                  value={block.numberLineMax ?? 10}
                                  onChange={(e) => updateBlock(page.id, block.id, { numberLineMax: parseFloat(e.target.value) || 0 })}
                                  className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Pas de graduation</label>
                                <input
                                  type="number"
                                  value={block.numberLineStep ?? 1}
                                  onChange={(e) => updateBlock(page.id, block.id, { numberLineStep: parseFloat(e.target.value) || 1 })}
                                  className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500">Valeur correcte</label>
                                <input
                                  type="text"
                                  value={typeof block.correctAnswer === "string" ? block.correctAnswer : ""}
                                  onChange={(e) => updateBlock(page.id, block.id, { correctAnswer: e.target.value })}
                                  className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                  placeholder="ex: 0.75"
                                />
                              </div>
                            </div>
                          )}

                          {!["text", "image"].includes(block.type) && (
                            <div className="space-y-1 mt-2">
                              <label className="text-xs font-medium text-gray-500 uppercase">
                                Coups de pouce (un par ligne, du plus léger au plus fort)
                              </label>
                              <textarea
                                defaultValue={(block.hints ?? []).join("\n")}
                                key={`hints-${block.id}`}
                                onBlur={(e) => {
                                  const hints = e.target.value.split("\n").map((h) => h.trim()).filter(Boolean);
                                  updateBlock(page.id, block.id, { hints: hints.length ? hints : undefined });
                                }}
                                className="w-full h-16 border-[rgba(197,161,72,0.25)] rounded-lg text-xs p-2"
                                placeholder="Ex : Pense au théorème de Pythagore.&#10;Dans le triangle ABC rectangle en A, BC² = AB² + AC²."
                              />
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <label className="text-xs text-gray-500">
                              Points:
                            </label>
                            <input
                              type="number"
                              value={block.points}
                              onChange={(e) =>
                                updateBlock(page.id, block.id, {
                                  points: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-20 border-[rgba(197,161,72,0.25)] rounded text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {addBlockMenuFor === page.id ? (
                      <div className="border-2 border-[var(--greek-blue)]/30 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-gray-500 uppercase">Quel type de question ?</span>
                          <GlassButton size="sm" variant="ghost" onClick={() => setAddBlockMenuFor(null)}>Annuler</GlassButton>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {CREATABLE_BLOCK_TYPES.map((t) => {
                            const meta = BLOCK_TYPE_META[t]!;
                            const Icon = meta.icon;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => addBlock(page.id, t)}
                                title={meta.description}
                                className="flex items-center gap-2 p-2.5 border border-[rgba(197,161,72,0.25)] rounded-lg text-left hover:border-[var(--greek-blue)] hover:bg-[var(--greek-blue)]/5 transition-colors"
                              >
                                <Icon size={16} className="text-[var(--greek-blue)] shrink-0" />
                                <span className="text-xs font-medium text-gray-700">{meta.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <GlassButton
                        size="sm"
                        variant="outline"
                        fullWidth
                        onClick={() => setAddBlockMenuFor(page.id)}
                      >
                        <Plus size={16} />
                        Ajouter un bloc
                      </GlassButton>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
