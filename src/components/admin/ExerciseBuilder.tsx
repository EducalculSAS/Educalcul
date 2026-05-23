"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  List,
  ArrowRightLeft,
  Type,
  Sparkles,
  Loader2,
} from "lucide-react";

import AIChatWindow from "./AIChatWindow";

export interface Block {
  id: string;
  type:
    | "text"
    | "image"
    | "single_choice"
    | "multiple_choice"
    | "true_false"
    | "text_input";
  title: string;
  content?: string; // HTML for text, URL for image

  // Question specific
  points?: number;
  options?: string[];
  correctAnswer?: string | string[];
  explanation?: string;
}

export interface Page {
  id: string;
  title: string;
  blocks: Block[];
}

interface ExerciseBuilderProps {
  initialContent: Page[];
  onChange: (content: Page[]) => void;
  onMetadataChange?: (metadata: any) => void;
}

export default function ExerciseBuilder({
  initialContent,
  onChange,
  onMetadataChange,
}: ExerciseBuilderProps) {
  const [pages, setPages] = useState<Page[]>(initialContent || []);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());

  // AI Generation State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("cm1");
  const contentRef = useRef<HTMLDivElement>(null);

  // Load KaTeX for Math rendering
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
    link.rel = "stylesheet";
    link.integrity =
      "sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
    script.integrity =
      "sha384-XjKyOOlGwcjNTAIQHIpgOno0Hl1YQqzUOEleOLALmuqehneUG+vnGctmUb0ZY0l8";
    script.crossOrigin = "anonymous";
    script.defer = true;
    document.head.appendChild(script);

    const autoRenderScript = document.createElement("script");
    autoRenderScript.src =
      "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";
    autoRenderScript.integrity =
      "sha384-+VBxd3r6XgURycqtZ117nYw44OOcIax56Z4dCRWbxyPt0Koah1uHoK0o4+/RRE05";
    autoRenderScript.crossOrigin = "anonymous";
    autoRenderScript.defer = true;
    document.head.appendChild(autoRenderScript);

    return () => {
      document.head.removeChild(link);
      document.head.removeChild(script);
      document.head.removeChild(autoRenderScript);
    };
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

  const handleAiGenerate = async (params: any) => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/admin/generate-exercise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      const data = await res.json();
      if (data.success && data.data) {
        // Handle new response structure (content + metadata)
        const content = data.data.content || data.data; // Fallback for old API
        const metadata = data.data.metadata;

        // Append generated pages
        const newPages = [...pages, ...content];
        setPages(newPages);

        // Expand new pages
        const newExpanded = new Set(expandedPages);
        content.forEach((p: Page) => newExpanded.add(p.id));
        setExpandedPages(newExpanded);

        // Update parent metadata if callback provided
        if (metadata && onMetadataChange) {
          onMetadataChange(metadata);
        }

        setIsAiModalOpen(false);
      } else {
        alert("Erreur lors de la génération: " + (data.error || "Inconnue"));
      }
    } catch (e) {
      console.error(e);
      alert("Erreur de connexion au service IA");
    } finally {
      setIsGenerating(false);
    }
  };

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

  const removePage = (id: string) => {
    if (confirm("Supprimer cette page et tout son contenu ?")) {
      setPages(pages.filter((p) => p.id !== id));
    }
  };

  const togglePage = (id: string) => {
    const newExpanded = new Set(expandedPages);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedPages(newExpanded);
  };

  const addBlock = (pageId: string) => {
    const newBlock: Block = {
      id: crypto.randomUUID(),
      type: "text",
      title: "Nouveau bloc",
      content: "",
      points: 1,
      options: ["Option 1", "Option 2"],
      correctAnswer: "Option 1",
    };
    setPages(
      pages.map((p) => {
        if (p.id === pageId) {
          return { ...p, blocks: [...p.blocks, newBlock] };
        }
        return p;
      })
    );
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
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-3 py-2 bg-white border border-[rgba(197,161,72,0.25)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="cp">CP</option>
            <option value="ce1">CE1</option>
            <option value="ce2">CE2</option>
            <option value="cm1">CM1</option>
            <option value="cm2">CM2</option>
            <option value="6eme">6ème</option>
            <option value="5eme">5ème</option>
            <option value="4eme">4ème</option>
            <option value="3eme">3ème</option>
            <option value="2nde">2nde</option>
            <option value="1ere">1ère</option>
            <option value="terminale">Terminale</option>
          </select>
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 transition-colors"
            type="button"
          >
            <Sparkles size={16} />
            Générer avec l'IA
          </button>
          <button
            onClick={addPage}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--greek-blue)] text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            type="button"
          >
            <Plus size={16} />
            Ajouter une page
          </button>
        </div>
      </div>

      {isAiModalOpen && (
        <AIChatWindow
          type="exercise"
          level={selectedLevel}
          onGenerate={handleAiGenerate}
          onClose={() => setIsAiModalOpen(false)}
        />
      )}

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
              className="border border-[rgba(197,161,72,0.25)] rounded-xl overflow-hidden bg-white"
            >
              {/* Page Header */}
              <div className="flex items-center gap-3 p-4 bg-gray-50 border-b border-[rgba(197,161,72,0.25)]">
                <button
                  onClick={() => togglePage(page.id)}
                  className="p-1 hover:bg-gray-200 rounded text-gray-500"
                  type="button"
                >
                  {expandedPages.has(page.id) ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
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
                <button
                  onClick={() => removePage(page.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  type="button"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Page Content (Blocks) */}
              {expandedPages.has(page.id) && (
                <div className="p-4 bg-gray-50/50">
                  <div className="space-y-4">
                    {page.blocks.map((block, blockIndex) => (
                      <div
                        key={block.id}
                        className="bg-white border border-[rgba(197,161,72,0.25)] rounded-lg p-4 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-4">
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
                              onChange={(e) =>
                                updateBlock(page.id, block.id, {
                                  type: e.target.value as Block["type"],
                                })
                              }
                              className="border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                            >
                              <option value="text">Texte</option>
                              <option value="image">Image</option>
                              <option value="single_choice">
                                Choix unique
                              </option>
                              <option value="multiple_choice">
                                Choix multiple
                              </option>
                              <option value="true_false">Vrai / Faux</option>
                              <option value="text_input">Réponse libre</option>
                            </select>
                          </div>
                          <button
                            onClick={() => removeBlock(page.id, block.id)}
                            className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Block Content based on Type */}
                        <div className="space-y-3">
                          {/* Common Question Text for all question types */}
                          {[
                            "single_choice",
                            "multiple_choice",
                            "true_false",
                            "text_input",
                          ].includes(block.type) && (
                            <div className="space-y-1">
                              <label className="text-xs font-medium text-gray-500 uppercase">
                                Énoncé
                              </label>
                              <textarea
                                value={block.content}
                                onChange={(e) =>
                                  updateBlock(page.id, block.id, {
                                    content: e.target.value,
                                  })
                                }
                                className="w-full h-24 border-[rgba(197,161,72,0.25)] rounded-lg text-sm p-3"
                                placeholder="Posez votre question ici..."
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
                            <div>
                              <input
                                type="text"
                                value={block.content}
                                onChange={(e) =>
                                  updateBlock(page.id, block.id, {
                                    content: e.target.value,
                                  })
                                }
                                className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm mb-2"
                                placeholder="URL de l'image"
                              />
                              {block.content && (
                                <img
                                  src={block.content}
                                  alt="Preview"
                                  className="h-32 object-contain border rounded bg-gray-50"
                                />
                              )}
                            </div>
                          )}

                          {(block.type === "single_choice" ||
                            block.type === "multiple_choice") && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">
                                Options
                              </label>
                              {block.options?.map((option, optIndex) => (
                                <div
                                  key={optIndex}
                                  className="flex items-center gap-2"
                                >
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) =>
                                      updateOption(
                                        page.id,
                                        block.id,
                                        optIndex,
                                        e.target.value
                                      )
                                    }
                                    className="flex-1 border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                  />
                                  <button
                                    onClick={() =>
                                      removeOption(page.id, block.id, optIndex)
                                    }
                                    className="p-1 text-gray-400 hover:text-red-500"
                                    type="button"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => addOption(page.id, block.id)}
                                className="text-sm text-[var(--greek-blue)] hover:underline flex items-center gap-1"
                                type="button"
                              >
                                <Plus size={14} /> Ajouter une option
                              </button>

                              <label className="block text-sm font-medium text-gray-700 mt-2">
                                Réponse correcte
                              </label>
                              <input
                                type="text"
                                value={
                                  Array.isArray(block.correctAnswer)
                                    ? block.correctAnswer.join(",")
                                    : block.correctAnswer
                                }
                                onChange={(e) =>
                                  updateBlock(page.id, block.id, {
                                    correctAnswer:
                                      block.type === "multiple_choice"
                                        ? e.target.value.split(",")
                                        : e.target.value,
                                  })
                                }
                                className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm"
                                placeholder={
                                  block.type === "multiple_choice"
                                    ? "Option 1,Option 2"
                                    : "Option 1"
                                }
                              />
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

                    <button
                      onClick={() => addBlock(page.id)}
                      className="w-full py-2 border-2 border-dashed border-[rgba(197,161,72,0.25)] rounded-lg text-gray-500 hover:border-[var(--greek-blue)] hover:text-[var(--greek-blue)] transition-colors flex items-center justify-center gap-2"
                      type="button"
                    >
                      <Plus size={16} />
                      Ajouter un bloc
                    </button>
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
