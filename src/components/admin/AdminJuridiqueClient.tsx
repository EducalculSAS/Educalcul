"use client";

import { useState } from "react";
import {
  Scale, FileText, Lock, Save, Eye, ChevronDown, CheckCircle,
  AlertTriangle, RefreshCw, Plus, Trash2, GripVertical,
} from "lucide-react";
import type { LegalPageData, LegalSection } from "@/components/LegalPageRenderer";
import { useConfirm } from "@/components/ConfirmDialog";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";

const PAGES = [
  { slug: "mentions-legales", label: "Mentions Légales",         icon: Scale,    href: "/mentions-legales",           color: "blue"   },
  { slug: "cgu",              label: "CGU",                       icon: FileText, href: "/cgu",                        color: "purple" },
  { slug: "politique-confidentialite", label: "Politique de confidentialité", icon: Lock, href: "/politique-confidentialite", color: "green" },
];

const ICON_OPTIONS = [
  "Globe","Server","Shield","Lock","Cookie","BookOpen","AlertTriangle",
  "FileText","Mail","Scale","RefreshCw","User","Clock","Target","Share2",
  "Database","CheckCircle","CreditCard","X",
];

const inputCls = "w-full px-3 py-2 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none text-sm bg-white";
const labelCls = "block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5";

/** Éditeur des pages juridiques : les 3 pages arrivent déjà chargées du
 * serveur ; toutes les éditions (titre, sections) et la sauvegarde restent
 * client, comme avant. */
export default function AdminJuridiqueClient({ initialPages }: { initialPages: Record<string, LegalPageData> }) {
  const confirm = useConfirm();
  const [activeSlug, setActiveSlug] = useState("mentions-legales");
  const [pages, setPages] = useState<Record<string, LegalPageData>>(initialPages);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const page = pages[activeSlug];

  const updatePage = (field: keyof LegalPageData, value: unknown) => {
    setPages(prev => ({ ...prev, [activeSlug]: { ...prev[activeSlug], [field]: value } }));
  };

  const updateSection = (idx: number, field: keyof LegalSection, value: string) => {
    const sections = [...(page?.sections ?? [])];
    sections[idx] = { ...sections[idx], [field]: value };
    updatePage("sections", sections);
  };

  const addSection = () => {
    const sections = [...(page?.sections ?? [])];
    const num = sections.length + 1;
    sections.push({ id: `section-${Date.now()}`, icon: "FileText", title: `${num}. Nouvelle section`, content: "Contenu de la section..." });
    updatePage("sections", sections);
    setOpenSection(`section-${Date.now() - 1}`);
  };

  const deleteSection = async (idx: number) => {
    if (!(await confirm("Supprimer cette section ?"))) return;
    const sections = [...(page?.sections ?? [])];
    sections.splice(idx, 1);
    updatePage("sections", sections);
  };

  const savePage = async () => {
    if (!page) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/legal-pages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: page.slug, title: page.title, subtitle: page.subtitle, sections: page.sections }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setPages(prev => ({ ...prev, [activeSlug]: { ...prev[activeSlug], updated_at: result.updated_at } }));
      showToast("success", "Page sauvegardée avec succès");
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };

  return (
    <div className="space-y-6">

      <AdminPageHeader
        icon={Scale}
        title="Pages Juridiques"
        subtitle="Modifiez le contenu des pages légales directement depuis l'interface"
        actions={
          <>
            {page && (
              <GlassButton
                size="sm"
                variant="outline"
                onClick={() => {
                  const href = PAGES.find(p => p.slug === activeSlug)?.href;
                  if (href) window.open(href, "_blank", "noopener,noreferrer");
                }}
              >
                <Eye size={16} /> Voir la page
              </GlassButton>
            )}
            <GlassButton
              size="sm"
              variant="navy"
              disabled={saving}
              onClick={savePage}
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Sauvegarde..." : "Sauvegarder"}
            </GlassButton>
          </>
        }
      />

      {/* Page tabs */}
      <GlassSegmentedControl
        size="sm"
        options={PAGES.map(({ slug, label, icon: Icon }) => ({
          id: slug,
          label: (
            <span className="flex items-center gap-1.5">
              <Icon size={14} className="shrink-0" />
              {label}
            </span>
          ),
        }))}
        value={activeSlug}
        onChange={(slug) => { setActiveSlug(slug); setOpenSection(null); }}
      />

      {!page ? (
        <div className="text-center py-20 text-gray-400">Page non trouvée en base de données.</div>
      ) : (
        <div className="space-y-4">

          {/* Page meta */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-[family-name:var(--font-display)] font-bold text-sm text-[var(--greek-blue)] uppercase tracking-wider">
                Informations générales
              </h2>
              {page.updated_at && (
                <span className="text-xs text-gray-400">Dernière modif. : {formatDate(page.updated_at)}</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Titre de la page</label>
                <input
                  type="text"
                  value={page.title}
                  onChange={e => updatePage("title", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Sous-titre (hero)</label>
                <input
                  type="text"
                  value={page.subtitle}
                  onChange={e => updatePage("subtitle", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-[family-name:var(--font-display)] font-bold text-sm text-[var(--greek-blue)] uppercase tracking-wider">
                Sections ({page.sections.length})
              </h2>
              <GlassButton size="sm" variant="navy" onClick={addSection}>
                <Plus size={13} /> Ajouter une section
              </GlassButton>
            </div>

            <div className="space-y-2">
              {page.sections.map((section, idx) => {
                const isOpen = openSection === section.id;
                return (
                  <div key={section.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Section header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setOpenSection(isOpen ? null : section.id)}
                      style={{ background: isOpen ? "rgba(197,161,72,0.04)" : undefined }}
                    >
                      <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
                      <span className="flex-1 text-sm font-semibold text-[var(--greek-blue)] truncate">{section.title}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{section.content.length} car.</span>
                      <span onClick={e => e.stopPropagation()} className="flex-shrink-0">
                        <GlassIconButton
                          icon={Trash2}
                          onClick={() => deleteSection(idx)}
                          color="red"
                          size="sm"
                          aria-label="Supprimer la section"
                        />
                      </span>
                      <ChevronDown
                        size={16}
                        className="text-gray-400 flex-shrink-0 transition-transform duration-200"
                        style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                      />
                    </div>

                    {/* Section editor */}
                    {isOpen && (
                      <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div>
                            <label className={labelCls}>Titre de la section</label>
                            <input
                              type="text"
                              value={section.title}
                              onChange={e => updateSection(idx, "title", e.target.value)}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Ancre (ID)</label>
                            <input
                              type="text"
                              value={section.id}
                              onChange={e => updateSection(idx, "id", e.target.value)}
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Icône</label>
                            <select
                              value={section.icon}
                              onChange={e => updateSection(idx, "icon", e.target.value)}
                              className={inputCls}
                            >
                              {ICON_OPTIONS.map(ico => (
                                <option key={ico} value={ico}>{ico}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className={labelCls}>
                            Contenu
                            <span className="ml-2 normal-case font-normal text-gray-400">
                              — <code className="bg-gray-100 px-1 rounded">## Sous-titre</code>{" "}
                              <code className="bg-gray-100 px-1 rounded">- Item liste</code>{" "}
                              <code className="bg-gray-100 px-1 rounded">**gras**</code>{" "}
                              <code className="bg-gray-100 px-1 rounded">[info]...[/info]</code>
                            </span>
                          </label>
                          <textarea
                            value={section.content}
                            onChange={e => updateSection(idx, "content", e.target.value)}
                            rows={12}
                            className={inputCls + " font-mono text-xs resize-y"}
                            spellCheck={false}
                          />
                        </div>

                        {/* Live preview */}
                        <div>
                          <p className={labelCls}>Aperçu</p>
                          <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-[var(--text-muted)] leading-relaxed space-y-2 max-h-48 overflow-y-auto">
                            {section.content.split("\n").map((line, j) => {
                              if (line.startsWith("## ")) return <p key={j} className="font-semibold text-[var(--greek-blue)]">{line.slice(3)}</p>;
                              if (line.startsWith("- ")) return <p key={j} className="text-xs">• {line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
                              if (line.trim() === "[info]" || line.trim() === "[/info]") return <span key={j} />;
                              if (line.trim()) return <p key={j} className="text-xs">{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
                              return null;
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Format help */}
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-6">
            <h2 className="font-[family-name:var(--font-display)] font-bold text-sm text-[var(--greek-blue)] uppercase tracking-wider mb-4">
              Guide de mise en forme
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { syntax: "## Titre",         desc: "Sous-titre de section" },
                { syntax: "- Élément",        desc: "Élément de liste à puces" },
                { syntax: "**texte**",         desc: "Texte en gras" },
                { syntax: "[info]...[/info]",  desc: "Bloc encadré doré" },
              ].map(({ syntax, desc }) => (
                <div key={syntax} className="bg-gray-50 rounded-xl p-3">
                  <code className="text-xs font-mono text-[var(--greek-blue)] block mb-1">{syntax}</code>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${
          toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
