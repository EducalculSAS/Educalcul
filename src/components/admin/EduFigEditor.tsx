"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Wand2, Braces } from "lucide-react";
import GlassDialog from "@/components/ui/GlassDialog";
import GlassButton from "@/components/ui/GlassButton";
import GlassSwitch from "@/components/ui/GlassSwitch";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { EDUFIG_PRESETS, PRESET_FAMILIES, presetDefaults, type FigPreset, type PresetFamily } from "@/lib/figures/presets";
import { normalizeEduFig } from "@/lib/figures/normalize";
import { eduFigHtml, renderEduFig } from "@/lib/figures/render";
import { checkFigureAgainstText } from "@/lib/figures/check";
import type { EduFig, FigSize } from "@/lib/figures/types";

/**
 * Éditeur de figures de l'admin : on choisit un modèle (Pythagore, Thalès, fonction, diagramme…), on remplit quelques
 * cases, l'aperçu se met à jour en direct et signale ce qui ne va pas (triangle impossible, figure qui contredit
 * l'énoncé). L'onglet « Avancé » donne la description complète, modifiable à la main.
 */
const INPUT = "w-full rounded-xl border border-[rgba(197,161,72,0.35)] bg-white px-3 py-2 text-sm text-[var(--greek-blue)] outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/25";

export default function EduFigEditor({
  initial,
  statement,
  onInsert,
  onClose,
}: {
  initial?: EduFig;
  /** Énoncé autour de la figure : sert à vérifier qu'ils disent la même chose. */
  statement?: string;
  onInsert: (html: string, fig: EduFig) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"presets" | "advanced">(initial ? "advanced" : "presets");
  const [family, setFamily] = useState<PresetFamily>("geometry");
  const [preset, setPreset] = useState<FigPreset>(EDUFIG_PRESETS[0]);
  const [params, setParams] = useState<Record<string, string | number | boolean>>(presetDefaults(EDUFIG_PRESETS[0]));
  const [json, setJson] = useState(() => JSON.stringify(initial ?? EDUFIG_PRESETS[0].build(presetDefaults(EDUFIG_PRESETS[0])), null, 2));
  const [caption, setCaption] = useState(initial?.caption ?? "");
  const [size, setSize] = useState<FigSize>(initial?.size ?? "m");
  const [interactive, setInteractive] = useState(!!initial?.interactive);

  // La figure courante : celle du modèle, ou celle écrite à la main.
  const { fig, errors } = useMemo(() => {
    if (mode === "presets") {
      try { return normalizeEduFig(preset.build(params)); } catch { return { fig: null, errors: ["Valeurs incomplètes."] }; }
    }
    return normalizeEduFig(json);
  }, [mode, preset, params, json]);

  const final: EduFig | null = useMemo(() => (fig ? { ...fig, caption: caption.trim() || undefined, size: size === "m" ? undefined : size, interactive: interactive || undefined } : null), [fig, caption, size, interactive]);
  const rendered = useMemo(() => (final ? renderEduFig(final) : null), [final]);
  const coherence = useMemo(() => (final && statement ? checkFigureAgainstText(final, statement) : []), [final, statement]);
  const problems = [...errors, ...(rendered?.errors ?? []), ...coherence.filter((c) => !(rendered?.errors ?? []).includes(c))];

  const choose = (p: FigPreset) => { setPreset(p); setParams(presetDefaults(p)); };
  const toAdvanced = () => { if (fig) setJson(JSON.stringify(fig, null, 2)); setMode("advanced"); };

  return (
    <GlassDialog
      title={initial ? "Modifier la figure" : "Insérer une figure"}
      onClose={onClose}
      wide="xl"
      footer={(
        <>
          <GlassButton variant="ghost" onClick={onClose}>Annuler</GlassButton>
          <GlassButton variant="navy" disabled={!final || !rendered?.svg} onClick={() => { if (final) { onInsert(eduFigHtml(final), final); onClose(); } }}>
            {initial ? "Enregistrer la figure" : "Insérer la figure"}
          </GlassButton>
        </>
      )}
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-6">
        {/* Réglages */}
        <div className="space-y-4 min-w-0">
          <GlassSegmentedControl
            size="sm"
            value={mode}
            onChange={(v) => (v === "advanced" ? toAdvanced() : setMode("presets"))}
            options={[
              { id: "presets", label: <span className="inline-flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" />Modèles</span> },
              { id: "advanced", label: <span className="inline-flex items-center gap-1.5"><Braces className="w-3.5 h-3.5" />Avancé</span> },
            ]}
          />

          {mode === "presets" ? (
            <>
              <GlassSegmentedControl size="sm" value={family} onChange={(v) => setFamily(v as PresetFamily)} options={PRESET_FAMILIES.map((f) => ({ id: f.id, label: f.label }))} />
              <div className="grid grid-cols-2 gap-2">
                {EDUFIG_PRESETS.filter((p) => p.family === family).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p)}
                    className={`text-left rounded-2xl border px-3 py-2.5 transition-colors ${p.id === preset.id ? "border-[var(--greek-blue)] bg-blue-50/60" : "border-[rgba(197,161,72,0.3)] bg-white hover:border-[var(--greek-gold)]"}`}
                  >
                    <span className="block text-sm font-bold text-[var(--greek-blue)]">{p.label}</span>
                    <span className="block text-xs text-gray-500 line-clamp-2">{p.description}</span>
                  </button>
                ))}
              </div>
              <div className="rounded-2xl border border-[rgba(197,161,72,0.25)] bg-[var(--greek-cream)]/40 p-4 space-y-3">
                <p className="text-sm font-bold text-[var(--greek-blue)]">{preset.label}</p>
                {preset.params.length === 0 && <p className="text-xs text-gray-500">Ce modèle n&apos;a pas de réglage : passe en « Avancé » pour le modifier.</p>}
                {preset.params.map((prm) => (
                  <label key={prm.key} className="block">
                    <span className="block text-xs font-semibold text-gray-600 mb-1">{prm.label}</span>
                    {prm.type === "bool" ? (
                      <GlassSwitch checked={params[prm.key] === true} label={prm.label} onChange={(v) => setParams({ ...params, [prm.key]: v })} />
                    ) : prm.type === "select" ? (
                      <select className={INPUT} value={String(params[prm.key])} onChange={(e) => setParams({ ...params, [prm.key]: e.target.value })}>
                        {prm.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        className={INPUT}
                        inputMode={prm.type === "number" ? "decimal" : "text"}
                        value={String(params[prm.key] ?? "")}
                        onChange={(e) => setParams({ ...params, [prm.key]: e.target.value })}
                      />
                    )}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Description complète de la figure. Les modèles en donnent des exemples : choisis-en un, puis reviens ici pour l&apos;ajuster
                (ajouter un point, coder un angle, changer une couleur).
              </p>
              <textarea className={`${INPUT} font-mono text-xs min-h-[22rem]`} spellCheck={false} value={json} onChange={(e) => setJson(e.target.value)} />
            </div>
          )}

          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <label className="block">
              <span className="block text-xs font-semibold text-gray-600 mb-1">Légende (facultative)</span>
              <input className={INPUT} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Ex. Le triangle ABC est rectangle en B." />
            </label>
            <GlassSegmentedControl size="sm" value={size} onChange={(v) => setSize(v as FigSize)} options={[{ id: "s", label: "Petite" }, { id: "m", label: "Moyenne" }, { id: "l", label: "Grande" }]} />
          </div>
          {final?.kind === "geometry" && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[rgba(197,161,72,0.25)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--greek-blue)]">Figure manipulable</p>
                <p className="text-xs text-gray-500">L&apos;élève peut déplacer les points définis comme libres (« free »).</p>
              </div>
              <GlassSwitch checked={interactive} label="Figure manipulable" onChange={setInteractive} />
            </div>
          )}
        </div>

        {/* Aperçu */}
        <div className="min-w-0 order-first lg:order-none lg:sticky lg:top-0 self-start space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--greek-bronze)]">Aperçu, tel que l&apos;élève le verra</p>
          {rendered?.svg ? (
            <figure className="edu-fig !my-0" data-size={size} dangerouslySetInnerHTML={{ __html: rendered.svg + (caption ? `<figcaption>${caption.replace(/</g, "&lt;")}</figcaption>` : "") }} />
          ) : (
            <div className="rounded-[20px] border border-dashed border-[rgba(197,161,72,0.5)] p-10 text-center text-sm text-gray-500">La figure apparaîtra ici.</div>
          )}
          {problems.length > 0 ? (
            <ul className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1.5">
              {problems.map((p) => (
                <li key={p} className="flex gap-2 text-sm text-amber-900"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{p}</li>
              ))}
            </ul>
          ) : final ? (
            <p className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="w-4 h-4" />{statement ? "Figure construite et conforme à l'énoncé." : "Figure construite à l'échelle."}</p>
          ) : null}
        </div>
      </div>
    </GlassDialog>
  );
}
