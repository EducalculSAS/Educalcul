"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, RotateCcw, Trash2, Save, Keyboard as KeyboardIcon, Loader2, X } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDialog";
import { defaultTabsForLevel, numRows } from "@/lib/mathKeyboardDefaults";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import CustomMathKeyboard, {
  type MathKeyboardConfig,
  type MathKeyboardKey,
  type MathKeyboardTab,
} from "@/components/CustomMathKeyboard";
import { errMessage } from "@/lib/safeError";

interface KeyboardRow {
  id: number;
  level: string;
  label: string;
  config: MathKeyboardConfig;
}

// Une touche a UNE valeur : maths (LaTeX), texte ou commande. Avant, l'éditeur ne montrait que « latex » alors que la
// valeur « texte » (cachée) l'emportait : on modifiait le chiffre, la touche insérait toujours l'ancien.
type KeyMode = "latex" | "text" | "cmd";
const modeOf = (k: MathKeyboardKey): KeyMode => (k.cmd ? "cmd" : k.text !== undefined ? "text" : "latex");
const valueOf = (k: MathKeyboardKey) => k.cmd ?? k.text ?? k.latex ?? "";
const buildKey = (label: string, mode: KeyMode, value: string, wide?: boolean): MathKeyboardKey => ({
  label,
  ...(mode === "cmd" ? { cmd: value } : mode === "text" ? { text: value } : { latex: value }),
  ...(wide ? { wide } : {}),
});

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
  const confirm = useConfirm();
  const [copySourceId, setCopySourceId] = useState<number | null>(null);
  const [copyTabId, setCopyTabId] = useState<string>("");

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
              rows: t.rows.map((row, r) => (r === rowIndex ? [...row, { label: "?", latex: "?" }] : row)),
            }
          : t,
      ),
    }));
  };

  /** Remplace une touche en entier (jamais de reste d'une ancienne valeur). */
  const replaceKey = (tabIndex: number, rowIndex: number, keyIndex: number, next: MathKeyboardKey) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) =>
        i === tabIndex
          ? { ...t, rows: t.rows.map((row, r) => (r === rowIndex ? row.map((k, ki) => (ki === keyIndex ? next : k)) : row)) }
          : t,
      ),
    }));
  };

  // Le texte de la touche et sa valeur restent identiques tant qu'on ne les a pas dissociés (chiffres, lettres, +, -…) :
  // changer « 7 » en « 1 » change aussi ce qui est inséré.
  const setKeyLabel = (ti: number, ri: number, ki: number, key: MathKeyboardKey, label: string) => {
    const value = valueOf(key);
    const synced = value === key.label;
    replaceKey(ti, ri, ki, buildKey(label, modeOf(key), synced ? label : value, key.wide));
  };
  const setKeyValue = (ti: number, ri: number, ki: number, key: MathKeyboardKey, value: string) =>
    replaceKey(ti, ri, ki, buildKey(key.label, modeOf(key), value, key.wide));
  const setKeyMode = (ti: number, ri: number, ki: number, key: MathKeyboardKey, mode: KeyMode) =>
    replaceKey(ti, ri, ki, buildKey(key.label, mode, mode === "cmd" ? valueOf(key) || "moveToNextChar" : valueOf(key), key.wide));

  const moveKey = (tabIndex: number, rowIndex: number, keyIndex: number, dir: -1 | 1) => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) => {
        if (i !== tabIndex) return t;
        return {
          ...t,
          rows: t.rows.map((row, r) => {
            const j = keyIndex + dir;
            if (r !== rowIndex || j < 0 || j >= row.length) return row;
            const next = [...row];
            [next[keyIndex], next[j]] = [next[j], next[keyIndex]];
            return next;
          }),
        };
      }),
    }));
  };

  const applyNumLayout = (tabIndex: number, layout: "calculator" | "phone") => {
    updateSelectedConfig((config) => ({
      ...config,
      tabs: config.tabs.map((t, i) => (i === tabIndex ? { ...t, rows: numRows(layout) } : t)),
    }));
  };

  const resetKeyboard = async () => {
    if (!selected) return;
    if (!(await confirm(`Rétablir le clavier « ${selected.label} » tel qu'il était à l'origine ? Tes réglages de touches pour ce niveau seront remplacés (rien n'est enregistré avant d'appuyer sur « Enregistrer »).`))) return;
    updateSelectedConfig((config) => ({ ...config, tabs: defaultTabsForLevel(selected.level) }));
  };

  /** Copie un onglet d'un autre niveau (ex. « f(x) » du lycée vers le collège) : remplace l'onglet de même nom, sinon l'ajoute. */
  const copyTabFrom = () => {
    const source = keyboards.find((k) => k.id === copySourceId);
    const tab = source?.config.tabs.find((t) => t.id === copyTabId);
    if (!source || !tab || !selected) return;
    const clone: MathKeyboardTab = JSON.parse(JSON.stringify(tab));
    updateSelectedConfig((config) => {
      const exists = config.tabs.some((t) => t.id === clone.id);
      return { ...config, tabs: exists ? config.tabs.map((t) => (t.id === clone.id ? clone : t)) : [...config.tabs, clone] };
    });
    setNotice(`Onglet « ${tab.label} » copié depuis ${source.label}. Pense à enregistrer.`);
    setTimeout(() => setNotice(null), 4000);
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
      const res = await fetch("/api/admin/keyboards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, config: selected.config }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Échec");
      setNotice("Clavier enregistré.");
    } catch (e: unknown) {
      setNotice(`Erreur : ${errMessage(e) || e}`);
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
        <nav aria-label="Niveaux" className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] p-3 h-fit flex flex-col gap-1.5 md:sticky md:top-[calc(var(--nav-h,64px)+1rem)]">
          {keyboards.map((k) => (
            <GlassButton
              key={k.id}
              onClick={() => { setSelectedId(k.id); setPreviewVisible(true); }}
              variant={selectedId === k.id ? "navy" : "ghost"}
              size="sm"
              fullWidth
              className={`!justify-start text-left ${selectedId === k.id ? "" : "!text-[var(--greek-blue)]"}`}
            >
              {k.label}
            </GlassButton>
          ))}
        </nav>

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
                      {tab.id === "num" && (
                        <>
                          <GlassButton size="sm" variant="outline" onClick={() => applyNumLayout(tabIndex, "calculator")}>
                            <RotateCcw className="w-3.5 h-3.5" /> Calculatrice (7-8-9 en haut)
                          </GlassButton>
                          <GlassButton size="sm" variant="outline" onClick={() => applyNumLayout(tabIndex, "phone")}>
                            <RotateCcw className="w-3.5 h-3.5" /> Téléphone (1-2-3 en haut)
                          </GlassButton>
                        </>
                      )}
                      <GlassIconButton icon={Trash2} color="red" size="sm" onClick={() => removeTab(tabIndex)} aria-label="Supprimer l'onglet" />
                    </div>

                    <div className="space-y-2">
                      {tab.rows.map((row, rowIndex) => (
                        <div key={rowIndex} className="flex items-center gap-1.5 flex-wrap">
                          {row.map((key, keyIndex) => (
                            <div key={keyIndex} className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg p-1">
                              <input
                                value={key.label}
                                onChange={(e) => setKeyLabel(tabIndex, rowIndex, keyIndex, key, e.target.value)}
                                className="w-12 text-center text-sm border-none bg-transparent"
                                placeholder="touche"
                                title="Texte affiché sur la touche"
                                aria-label="Texte affiché sur la touche"
                              />
                              <input
                                value={valueOf(key)}
                                onChange={(e) => setKeyValue(tabIndex, rowIndex, keyIndex, key, e.target.value)}
                                className="w-24 text-xs border-l border-gray-200 pl-1 bg-transparent font-mono"
                                placeholder="valeur"
                                title="Ce qui est inséré quand on appuie sur la touche (identique au texte de la touche tant que tu ne l'as pas modifié)"
                                aria-label="Valeur insérée"
                              />
                              <select
                                value={modeOf(key)}
                                onChange={(e) => setKeyMode(tabIndex, rowIndex, keyIndex, key, e.target.value as KeyMode)}
                                className="!py-0.5 !pl-1.5 !pr-6 !text-[11px] !rounded-md w-[78px]"
                                title="Type de valeur : maths (LaTeX), texte, ou commande du clavier"
                                aria-label="Type de valeur"
                              >
                                <option value="latex">Maths</option>
                                <option value="text">Texte</option>
                                <option value="cmd">Commande</option>
                              </select>
                              <GlassIconButton icon={ChevronLeft} color="gray" size="sm" onClick={() => moveKey(tabIndex, rowIndex, keyIndex, -1)} disabled={keyIndex === 0} aria-label="Déplacer la touche à gauche" />
                              <GlassIconButton icon={ChevronRight} color="gray" size="sm" onClick={() => moveKey(tabIndex, rowIndex, keyIndex, 1)} disabled={keyIndex === row.length - 1} aria-label="Déplacer la touche à droite" />
                              <GlassIconButton icon={X} color="red" size="sm" onClick={() => removeKey(tabIndex, rowIndex, keyIndex)} aria-label="Supprimer la touche" />
                            </div>
                          ))}
                          <GlassButton size="sm" variant="outline" onClick={() => addKey(tabIndex, rowIndex)}>
                            <Plus className="w-3.5 h-3.5" /> Touche
                          </GlassButton>
                          <GlassButton size="sm" variant="danger" onClick={() => removeRow(tabIndex, rowIndex)}>
                            <Trash2 className="w-3.5 h-3.5" /> Rangée
                          </GlassButton>
                        </div>
                      ))}
                      <GlassButton size="sm" variant="outline" onClick={() => addRow(tabIndex)}>
                        <Plus className="w-3.5 h-3.5" /> Rangée
                      </GlassButton>
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-2">
                  <GlassButton size="sm" variant="outline" onClick={addTab}>
                    <Plus className="w-4 h-4" /> Ajouter un onglet
                  </GlassButton>
                  <GlassButton size="sm" variant="outline" onClick={resetKeyboard}>
                    <RotateCcw className="w-4 h-4" /> Rétablir ce clavier par défaut
                  </GlassButton>
                </div>

                <div className="border border-dashed border-[rgba(197,161,72,0.5)] rounded-xl p-4 bg-[var(--greek-cream)]/40">
                  <p className="text-sm font-bold text-[var(--greek-blue)] mb-1">Copier un onglet d&apos;un autre niveau</p>
                  <p className="text-xs text-gray-500 mb-3">Par exemple l&apos;onglet « f(x) » ou « ℝ ∃ » du lycée vers le collège. Un onglet de même nom est remplacé, sinon il est ajouté.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={copySourceId ?? ""} onChange={(e) => { setCopySourceId(e.target.value ? Number(e.target.value) : null); setCopyTabId(""); }} className="min-w-[180px]" aria-label="Niveau à copier">
                      <option value="">Niveau…</option>
                      {keyboards.filter((k) => k.id !== selected.id).map((k) => (<option key={k.id} value={k.id}>{k.label}</option>))}
                    </select>
                    <select value={copyTabId} onChange={(e) => setCopyTabId(e.target.value)} disabled={copySourceId === null} className="min-w-[140px]" aria-label="Onglet à copier">
                      <option value="">Onglet…</option>
                      {(keyboards.find((k) => k.id === copySourceId)?.config.tabs ?? []).map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
                    </select>
                    <GlassButton size="sm" variant="navy" onClick={copyTabFrom} disabled={!copyTabId}>
                      <Copy className="w-4 h-4" /> Copier dans {selected.label}
                    </GlassButton>
                  </div>
                </div>
              </div>
            </div>

            {/* Aperçu live — exactement le même composant que côté élève */}
            <div className="bg-[var(--greek-cream)] rounded-[20px] border border-[rgba(197,161,72,0.25)] p-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Aperçu</p>
              {/* Hauteur = celle du clavier (plus de hauteur fixe qui coupait
                  le haut, donc le sélecteur d'onglets). */}
              <div className="relative bg-white/40 rounded-xl overflow-hidden min-h-[120px]">
                <CustomMathKeyboard
                  config={selected.config}
                  visible={previewVisible}
                  onKey={() => {}}
                  onClose={() => setPreviewVisible(false)}
                  embedded
                />
                {!previewVisible && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center">
                    <GlassButton size="sm" variant="navy" onClick={() => setPreviewVisible(true)}>
                      <KeyboardIcon className="w-4 h-4" /> Réafficher l&apos;aperçu
                    </GlassButton>
                  </div>
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
