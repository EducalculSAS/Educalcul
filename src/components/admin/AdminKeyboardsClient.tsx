"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Keyboard as KeyboardIcon, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import CustomMathKeyboard, {
  type MathKeyboardConfig,
  type MathKeyboardKey,
  type MathKeyboardTab,
} from "@/components/CustomMathKeyboard";

interface KeyboardRow {
  id: number;
  level: string;
  label: string;
  config: MathKeyboardConfig;
}

/** Section admin "Clavier" : un clavier mathématique virtuel par niveau
 * (remplace le clavier par défaut de MathLive dans les exercices/cours, voir
 * MathInput.tsx / CustomMathKeyboard.tsx). Chaque niveau a ses onglets,
 * chaque onglet ses rangées de touches — tout est éditable ici, avec un
 * aperçu live qui utilise EXACTEMENT le même composant que côté élève. */
export default function AdminKeyboardsClient({ initialKeyboards }: { initialKeyboards: KeyboardRow[] }) {
  const [keyboards, setKeyboards] = useState<KeyboardRow[]>(initialKeyboards);
  const [selectedId, setSelectedId] = useState<number | null>(initialKeyboards[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(true);

  const selected = keyboards.find((k) => k.id === selectedId) || null;

  const updateSelectedConfig = (updater: (config: MathKeyboardConfig) => MathKeyboardConfig) => {
    if (!selected) return;
    setKeyboards((prev) =>
      prev.map((k) => (k.id === selected.id ? { ...k, config: updater(k.config) } : k)),
    );
  };

  const addTab = () => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: [...config.tabs, { id: `tab-${Date.now()}`, label: "Nouveau", rows: [[]] }],
    }));
  };

  const removeTab = (tabIndex: number) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.filter((_, i) => i !== tabIndex),
    }));
  };

  const updateTab = (tabIndex: number, patch: Partial<MathKeyboardTab>) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) => (i === tabIndex ? { ...t, ...patch } : t)),
    }));
  };

  const addRow = (tabIndex: number) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) => (i === tabIndex ? { ...t, rows: [...t.rows, []] } : t)),
    }));
  };

  const removeRow = (tabIndex: number, rowIndex: number) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) =>
        i === tabIndex ? { ...t, rows: t.rows.filter((_, r) => r !== rowIndex) } : t,
      ),
    }));
  };

  const addKey = (tabIndex: number, rowIndex: number) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) =>
        i === tabIndex
          ? {
              ...t,
              rows: t.rows.map((row, r) => (r === rowIndex ? [...row, { label: "?", latex: "" }] : row)),
            }
          : t,
      ),
    }));
  };

  const updateKey = (tabIndex: number, rowIndex: number, keyIndex: number, patch: Partial<MathKeyboardKey>) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) =>
        i === tabIndex
          ? {
              ...t,
              rows: t.rows.map((row, r) =>
                r === rowIndex ? row.map((k, ki) => (ki === keyIndex ? { ...k, ...patch } : k)) : row,
              ),
            }
          : t,
      ),
    }));
  };

  const removeKey = (tabIndex: number, rowIndex: number, keyIndex: number) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) =>
        i === tabIndex
          ? {
              ...t,
              rows: t.rows.map((row, r) => (r === rowIndex ? row.filter((_, ki) => ki !== keyIndex) : row)),
            }
          : t,
      ),
    }));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    try {
      const { error } = await supabase
        .from("math_keyboards")
        .update({ config: selected.config, updated_at: new Date().toISOString() })
        .eq("id", selected.id);
      if (error) throw error;
      setNotice("Clavier enregistré.");
    } catch (e: any) {
      setNotice(`Erreur : ${e.message || e}`);
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={KeyboardIcon}
        title="Clavier mathématique"
        subtitle="Le clavier virtuel affiché aux élèves pour répondre aux questions, personnalisable par niveau."
      />

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Liste des niveaux */}
        <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-3 h-fit">
          {keyboards.map((k) => (
            <button
              key={k.id}
              onClick={() => setSelectedId(k.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors mb-1 ${
                selectedId === k.id
                  ? "bg-[var(--greek-blue)] text-white"
                  : "text-[var(--greek-blue)] hover:bg-gray-100"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Éditeur */}
        {selected ? (
          <div className="space-y-4">
            <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                  {selected.label}
                </h2>
                <div className="flex items-center gap-2">
                  {notice && <span className="text-sm text-[var(--greek-bronze)]">{notice}</span>}
                  <GlassButton size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </GlassButton>
                </div>
              </div>

              <div className="space-y-4">
                {selected.config.tabs.map((tab, tabIndex) => (
                  <div key={tabIndex} className="border border-[rgba(197,161,72,0.25)] rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        value={tab.label}
                        onChange={(e) => updateTab(tabIndex, { label: e.target.value })}
                        className="font-bold text-sm border border-gray-200 rounded-lg px-2 py-1 w-32"
                        placeholder="Nom de l'onglet"
                      />
                      <div className="flex-1" />
                      <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => removeTab(tabIndex)} aria-label="Supprimer l'onglet" />
                    </div>

                    <div className="space-y-2">
                      {tab.rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex items-center gap-1.5 flex-wrap">
                          {row.map((key, keyIndex) => (
                            <div key={keyIndex} className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg p-1">
                              <input
                                value={key.label}
                                onChange={(e) => updateKey(tabIndex, rowIndex, keyIndex, { label: e.target.value })}
                                className="w-12 text-center text-sm border-none bg-transparent"
                                placeholder="label"
                                title="Texte affiché sur la touche"
                              />
                              <input
                                value={key.latex ?? ""}
                                onChange={(e) => updateKey(tabIndex, rowIndex, keyIndex, { latex: e.target.value, cmd: undefined })}
                                className="w-24 text-xs border-l border-gray-200 pl-1 bg-transparent font-mono"
                                placeholder="latex"
                                title="LaTeX inséré (laisser vide si c'est une commande)"
                              />
                              <button
                                onClick={() => removeKey(tabIndex, rowIndex, keyIndex)}
                                className="text-gray-400 hover:text-red-500 px-1"
                                aria-label="Supprimer la touche"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addKey(tabIndex, rowIndex)}
                            className="text-xs text-[var(--greek-blue)] hover:underline px-2 py-1"
                          >
                            + Touche
                          </button>
                          <button
                            onClick={() => removeRow(tabIndex, rowIndex)}
                            className="text-xs text-gray-400 hover:text-red-500 px-2"
                          >
                            Suppr. rangée
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addRow(tabIndex)}
                        className="text-xs font-semibold text-[var(--greek-blue)] hover:underline"
                      >
                        + Rangée
                      </button>
                    </div>
                  </div>
                ))}

                <GlassButton size="sm" variant="outline" onClick={addTab}>
                  <Plus className="w-4 h-4" /> Ajouter un onglet
                </GlassButton>
              </div>
            </div>

            {/* Aperçu live — exactement le même composant que côté élève */}
            <div className="bg-[var(--greek-cream)] rounded-[20px] border border-[rgba(197,161,72,0.25)] p-6 relative min-h-[220px]">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Aperçu</p>
              <div className="relative h-[260px] bg-white/40 rounded-xl overflow-hidden">
                <CustomMathKeyboard
                  config={selected.config}
                  visible={previewVisible}
                  onKey={() => {}}
                  onClose={() => setPreviewVisible(false)}
                  embedded
                />
                {!previewVisible && (
                  <button
                    onClick={() => setPreviewVisible(true)}
                    className="absolute inset-0 flex items-center justify-center text-sm text-[var(--greek-blue)] font-semibold"
                  >
                    Cliquer pour réafficher l'aperçu
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-6 text-gray-500">
            Sélectionne un niveau à gauche.
          </div>
        )}
      </div>
    </div>
  );
}
