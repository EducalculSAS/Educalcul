"use client";
 
import { GripVertical, ChevronDown, ChevronRight, Sparkles, ListPlus, ClipboardPaste, Copy, Trash2, Shuffle, Plus } from "lucide-react";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassButton from "@/components/ui/GlassButton";
import ContentInsertToolbar from "@/components/admin/ContentInsertToolbar";
import ImageBlockEditor from "@/components/admin/builder/ImageBlockEditor";
import FillBlankEditor from "@/components/admin/builder/FillBlankEditor";
import MatchingEditor from "@/components/admin/builder/MatchingEditor";
import OrderingEditor from "@/components/admin/builder/OrderingEditor";
import CategorizeEditor from "@/components/admin/builder/CategorizeEditor";
import ClickErrorEditor from "@/components/admin/builder/ClickErrorEditor";
import NumberLinePointEditor from "@/components/admin/builder/NumberLinePointEditor";
import type { Page, Block, BlockType } from "@/components/admin/ExerciseBuilder";
import { defaultBlockFields, CREATABLE_BLOCK_TYPES, LEGACY_BLOCK_LABELS, BLOCK_TYPE_META, correctAnswersArray } from "@/components/admin/builder/blockMeta";

type BuilderPageListProps = {
  pages: Page[];
  setDraggedPage: React.Dispatch<React.SetStateAction<number | null>>;
  draggedPage: number | null;
  movePage: (from: number, to: number) => void;
  expandedPages: Set<string>;
  togglePage: (id: string) => void;
  updatePage: (id: string, updates: Partial<Page>) => void;
  setAiEditTarget: React.Dispatch<React.SetStateAction<{ scope: 'page'; pageId: string; } | { scope: 'block'; pageId: string; blockId: string; } | null>>;
  setQuickEntryPageId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsQuickEntryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clipboardBlock: Block | null;
  pasteBlock: (pageId: string) => void;
  duplicatePageAt: (pageId: string) => void;
  removePage: (id: string) => Promise<void>;
  setDraggedBlock: React.Dispatch<React.SetStateAction<{ pageId: string; index: number; } | null>>;
  draggedBlock: { pageId: string; index: number; } | null;
  moveBlock: (pageId: string, from: number, to: number) => void;
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void;
  addVariants: (pageId: string, blockId: string) => void;
  duplicateBlockAt: (pageId: string, blockId: string) => void;
  copyBlockToClipboard: (block: Block) => void;
  removeBlock: (pageId: string, blockId: string) => void;
  uploadMedia: (pageId: string, blockId: string, file: File) => Promise<void>;
  uploadingBlockId: string | null;
  uploadErrorBlockId: string | null;
  updateOption: (pageId: string, blockId: string, index: number, value: string) => void;
  removeOption: (pageId: string, blockId: string, index: number) => void;
  addOption: (pageId: string, blockId: string) => void;
  addBlockMenuFor: string | null;
  setAddBlockMenuFor: React.Dispatch<React.SetStateAction<string | null>>;
  addBlock: (pageId: string, type: BlockType) => void;
};

export default function BuilderPageList(props: BuilderPageListProps) {
  const { pages, setDraggedPage, draggedPage, movePage, expandedPages, togglePage, updatePage, setAiEditTarget, setQuickEntryPageId, setIsQuickEntryOpen, clipboardBlock, pasteBlock, duplicatePageAt, removePage, setDraggedBlock, draggedBlock, moveBlock, updateBlock, addVariants, duplicateBlockAt, copyBlockToClipboard, removeBlock, uploadMedia, uploadingBlockId, uploadErrorBlockId, updateOption, removeOption, addOption, addBlockMenuFor, setAddBlockMenuFor, addBlock } = props;
  return (
    pages.map((page, pageIndex) => (
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
          icon={ListPlus}
          onClick={() => { setQuickEntryPageId(page.id); setIsQuickEntryOpen(true); }}
          color="navy"
          size="sm"
          aria-label="Saisie rapide dans cette page"
        />
        {clipboardBlock && (
          <GlassIconButton
            icon={ClipboardPaste}
            onClick={() => pasteBlock(page.id)}
            color="navy"
            size="sm"
            aria-label="Coller le bloc copié dans cette page"
          />
        )}
        <GlassIconButton
          icon={Copy}
          onClick={() => duplicatePageAt(page.id)}
          color="navy"
          size="sm"
          aria-label="Dupliquer la page"
        />
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
                id={`block-${block.id}`}
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
                  {block.type === "text_input" && (
                    <GlassIconButton
                      icon={Shuffle}
                      onClick={() => addVariants(page.id, block.id)}
                      color="navy"
                      size="sm"
                      aria-label="Créer 5 variantes de ce calcul (autres nombres, réponse recalculée)"
                      className="ml-2"
                    />
                  )}
                  <GlassIconButton
                    icon={Copy}
                    onClick={() => duplicateBlockAt(page.id, block.id)}
                    color="navy"
                    size="sm"
                    aria-label="Dupliquer le bloc"
                    className="ml-2"
                  />
                  <GlassIconButton
                    icon={ClipboardPaste}
                    onClick={() => copyBlockToClipboard(block)}
                    color="navy"
                    size="sm"
                    aria-label="Copier le bloc (à coller dans une autre page ou un autre exercice)"
                    className="ml-1"
                  />
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
                          Un énoncé qui semble demander un calcul/une réponse mais n&apos;en a pas
                          (données insuffisantes, contradictoires, ou hors du domaine étudié).
                          L&apos;élève doit reconnaître et justifier l&apos;impossibilité, pas calculer.
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
  
                  {block.type === "image" && <ImageBlockEditor block={block} updateBlock={updateBlock} page={page} uploadMedia={uploadMedia} uploadingBlockId={uploadingBlockId} uploadErrorBlockId={uploadErrorBlockId} />}
  
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
                        Solution de référence (utilisée par l&apos;IA pour corriger)
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
                        Justification attendue (utilisée par l&apos;IA pour corriger)
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
  
                  {block.type === "fill_in_the_blank" && <FillBlankEditor block={block} updateBlock={updateBlock} page={page} />}
  
                  {block.type === "matching" && <MatchingEditor block={block} updateBlock={updateBlock} page={page} />}
  
                  {block.type === "ordering" && <OrderingEditor block={block} updateBlock={updateBlock} page={page} />}
  
                  {block.type === "categorize" && <CategorizeEditor block={block} updateBlock={updateBlock} page={page} />}
  
                  {block.type === "click_error" && <ClickErrorEditor block={block} updateBlock={updateBlock} page={page} />}
  
                  {block.type === "number_line_point" && <NumberLinePointEditor block={block} updateBlock={updateBlock} page={page} />}
  
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
  ))
  );
}
