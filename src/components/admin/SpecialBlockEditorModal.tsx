"use client";

import { useMemo, useState } from "react";
import { normalizeCourseBlock } from "@/lib/ai/structuredContent";
import { compileCourseBlock } from "@/lib/ai/compiler";
import { renderLatexInHTML } from "@/lib/katexLoader";
import { renderMathGraphPlaceholders } from "@/lib/mathGraph";
import GlassButton from "@/components/ui/GlassButton";
import GlassCloseButton from "@/components/ui/GlassCloseButton";
import { Upload } from "lucide-react";
import JsxFigureEditor from "@/components/admin/JsxFigureEditor";
import { JSX_PRESETS } from "@/lib/jsxFigure";

const TEMPLATES: Record<string, { label: string; group: string; data: Record<string, unknown> }> = {
  image: { label: "Image (lien ou upload)", group: "Texte", data: { url: "", caption: "Légende de l'image" } },
  heading: { label: "Titre", group: "Texte", data: { level: 3, content: "Sous-titre" } },
  paragraph: { label: "Paragraphe", group: "Texte", data: { content: "Texte du paragraphe, avec $math$ si besoin." } },
  list: { label: "Liste", group: "Texte", data: { ordered: false, items: ["Élément 1", "Élément 2"] } },
  callout: { label: "Encadré", group: "Texte", data: { variant: "note", title: "Titre court", paragraphs: ["Texte de l'encadré."] } },
  checklist: { label: "Checklist (fin de cours)", group: "Texte", data: { items: ["Je sais...", "Je sais..."] } },
  steps: { label: "Démonstration pas à pas", group: "Texte", data: { steps: [{ title: "Étape 1", blocks: [{ type: "paragraph", content: "..." }] }] } },
  definition: { label: "Fiche mot-clé", group: "Texte", data: { term: "Mot nouveau", definition: "Explication simple.", example: "Exemple d'usage." } },
  table: { label: "Tableau générique", group: "Données", data: { headers: ["", "Colonne 1"], rows: [["Ligne 1", "valeur"]] } },
  bar_chart: { label: "Diagramme en barres", group: "Données", data: { caption: "Comparaison", bars: [{ label: "A", value: 4, tone: "blue" }, { label: "B", value: 7, tone: "red" }] } },
  pie_chart: { label: "Camembert", group: "Données", data: { caption: "Répartition", slices: [{ label: "A", value: 4, tone: "blue" }, { label: "B", value: 6, tone: "red" }] } },
  box_plot: { label: "Boîte à moustaches", group: "Données", data: { caption: "Boîte", min: 2, q1: 5, median: 7, q3: 9, max: 12 } },
  number_line: { label: "Droite graduée", group: "Géométrie/Nombres", data: { caption: "Droite", min: -5, max: 5, points: [{ value: 2, label: "A" }], intervals: [] } },
  jsx_figure: { label: "Figure libre (toute figure de maths)", group: "Figure libre", data: { ...JSX_PRESETS[0].spec } as unknown as Record<string, unknown> },
  shape: { label: "Formes libres (quadrillage)", group: "Géométrie/Nombres", data: { caption: "Un carré et un cercle", width: 14, height: 8, preset: "none", a: 3, b: 4, parts: [
    { kind: "square", text: "", x: 1, y: 1, w: 5, h: 5, r: 3, start_angle: 0, end_angle: 90, points: [], tone: "blue", filled: true, dashed: false, arrow: "none", vertex_labels: ["A", "B", "C", "D"], side_labels: [], right_angle_at: null, show_dimensions: true },
    { kind: "circle", text: "", x: 10, y: 4, w: 6, h: 4, r: 3, start_angle: 0, end_angle: 90, points: [], tone: "red", filled: false, dashed: false, arrow: "none", vertex_labels: ["O"], side_labels: [], right_angle_at: null, show_dimensions: true },
  ] } },
  display_math: { label: "Formule en avant", group: "Géométrie/Nombres", data: { latex: "a^2+b^2=c^2" } },
  graph: { label: "Courbe de fonction", group: "Géométrie/Nombres", data: { expression: "x^2", xmin: -5, xmax: 5, caption: "Courbe" } },
  column_operation: { label: "Opération posée", group: "Primaire", data: { operator: "+", operands: ["28", "37"], result: "65", carries: ["1"] } },
  base_ten_blocks: { label: "Dizaines/unités", group: "Primaire", data: { hundreds: 0, tens: 6, units: 3, caption: "63" } },
  clock: { label: "Horloge", group: "Primaire", data: { hours: 3, minutes: 30, caption: "Horloge", interactive: true } },
  fraction: { label: "Fraction (barre/disque)", group: "Primaire", data: { numerator: 3, denominator: 4, shape: "bar", caption: "3/4" } },
  coin_purse: { label: "Porte-monnaie", group: "Primaire", data: { coins: [100, 200, 500], target: 700, caption: "Fais 7 €" } },
  balance_scale: { label: "Balance de Roberval", group: "Primaire", data: { left: [3, 4], right: [7], left_label: "", right_label: "", tilt: "auto", caption: "3 + 4 est égal à 7" } },
  grid_painter: { label: "Quadrillage à colorier", group: "Primaire", data: { rows: 3, cols: 4, highlighted: 6, caption: "3×4" } },
  pattern_maker: { label: "Suite logique", group: "Primaire", data: { sequence: ["cercle", "carre", "cercle", "carre"], options: ["cercle", "triangle"], answer: "cercle", caption: "Complète la suite" } },
  ruler_measurer: { label: "Règle graduée", group: "Primaire", data: { segmentLength: 8, unit: "cm", caption: "Mesure" } },
  tape_diagram: { label: "Schéma en barres", group: "Primaire", data: { parts: [{ label: "Paul", value: 5, tone: "blue" }, { label: "Léa", value: 3, tone: "green" }], caption: "Répartition" } },
  fraction_strips: { label: "Réglettes de fractions", group: "Primaire", data: { fractions: [{ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 4 }], caption: "Comparaison" } },
  place_value_chart: { label: "Tableau de numération", group: "Primaire", data: { number: 304.5, caption: "Numération" } },
  ratio_mixer: { label: "Jauges de proportions", group: "Primaire", data: { ratios: [{ label: "Farine", value: 300, tone: "gold" }, { label: "Eau", value: 150, tone: "blue" }], caption: "Recette" } },
  net_folder: { label: "Patron 3D pliable", group: "Primaire", data: { solid: "cube", width: 4, height: 4, depth: 4, caption: "Cube" } },
  interactive_protractor: { label: "Rapporteur", group: "Collège", data: { angleDeg: 50, caption: "Rapporteur" } },
  compass_tool: { label: "Compas", group: "Collège", data: { radius: 5, centerLabel: "O", caption: "Cercle" } },
  thermometer_axis: { label: "Thermomètre (relatifs)", group: "Collège", data: { min: -10, max: 10, points: [{ value: -3, label: "A" }], caption: "Nombres relatifs" } },
  area_decomposer: { label: "Décomposition d'aire", group: "Collège", data: { shapes: [{ width: 4, height: 3, label: "Rectangle" }], caption: "Aire" } },
  shape_pythagoras: { label: "Pythagore (carrés)", group: "Collège", data: { type: "shape", caption: "Pythagore", width: 12, height: 12, preset: "pythagoras", a: 3, b: 4, parts: [] } },
  scientific_notation_converter: { label: "Notation scientifique", group: "Collège", data: { value: 3.2, exponent: 5, caption: "Puissance de 10" } },
  equation_balancer: { label: "Balance algébrique", group: "Collège", data: { leftTerms: ["2x", "+3"], rightTerms: ["11"], caption: "Équation" } },
  slope_triangle: { label: "Triangle de pente", group: "Collège", data: { a: 2, b: -1, xMin: -5, xMax: 5, caption: "Droite" } },
  vector_addition_pad: { label: "Somme de vecteurs", group: "Lycée", data: { ux: 2, uy: 1, vx: 1, vy: 2, caption: "u + v" } },
  interval_builder: { label: "Intervalle", group: "Lycée", data: { min: -5, max: 5, lowerBound: -2, upperBound: 3, lowerOpen: true, upperOpen: false, caption: "Intervalle" } },
  tangent_scrubber: { label: "Tangente à une courbe", group: "Lycée", data: { expression: "x^2", x0: 1, xMin: -3, xMax: 3, caption: "Tangente" } },
  sequence_cobweb: { label: "Suite récurrente (toile)", group: "Lycée", data: { expression: "0.5*x+1", u0: 0.5, iterations: 5, xMin: 0, xMax: 4, caption: "Convergence" } },
  integral_riemann_slider: { label: "Rectangles de Riemann", group: "Lycée", data: { expression: "x^2", xMin: 0, xMax: 3, rectangles: 8, caption: "Intégrale" } },
  complex_plane_polar: { label: "Plan complexe", group: "Lycée", data: { re: 3, im: 2, caption: "Nombre complexe" } },
  algo_sandbox: { label: "Extrait de code (lecture seule)", group: "Lycée", data: { code: "def f(x):\n    return x**2", language: "python", caption: "Algorithme" } },
};

const GROUP_ORDER = ["Figure libre", "Texte", "Données", "Géométrie/Nombres", "Primaire", "Collège", "Lycée"];

export default function SpecialBlockEditorModal({
  isOpen,
  onClose,
  initialType,
  initialData,
  onInsert,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialType?: string;
  initialData?: Record<string, unknown>;
  onInsert: (html: string, specialType: string, specialData: Record<string, unknown>) => void;
}) {
  const [selectedType, setSelectedType] = useState(initialType || "definition");
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(initialData ?? TEMPLATES[initialType || "definition"]?.data ?? {}, null, 2),
  );
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "uploads/course_images");
      const response = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Échec de l'upload");
      const parsed = JSON.parse(jsonText || "{}");
      setJsonText(JSON.stringify({ ...parsed, url: result.url }, null, 2));
    } catch (err) {
      alert("Erreur upload : " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
    }
  };

  const { html, error } = useMemo(() => {
    try {
      const parsed = JSON.parse(jsonText);
      const normalized = normalizeCourseBlock({ type: selectedType, ...parsed });
      if (!normalized) return { html: "", error: "Données invalides pour ce type de bloc (champs manquants ou incorrects)." };
      const compiled = compileCourseBlock(normalized, [], new Set());
      return { html: compiled, error: "" };
    } catch (e) {
      return { html: "", error: e instanceof Error ? e.message : "JSON invalide." };
    }
  }, [selectedType, jsonText]);

  if (!isOpen) return null;

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setJsonText(JSON.stringify(TEMPLATES[type]?.data ?? {}, null, 2));
  };

  const handleInsert = () => {
    if (!html) return;
    try {
      const parsed = JSON.parse(jsonText);
      onInsert(html, selectedType, parsed);
      onClose();
    } catch {
      // JSON invalide : le bouton est de toute façon désactivé dans ce cas
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 modal-overlay">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Bloc spécial (figure, outil interactif...)</h3>
          <GlassCloseButton onClick={onClose} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 uppercase">Type de bloc</label>
          <select
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="w-full border-[rgba(197,161,72,0.25)] rounded-lg text-sm px-3 py-2"
          >
            {GROUP_ORDER.map((group) => (
              <optgroup key={group} label={group}>
                {Object.entries(TEMPLATES)
                  .filter(([, t]) => t.group === group)
                  .map(([key, t]) => (
                    <option key={key} value={key}>
                      {t.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>

        {selectedType === "image" && (
          <div className="flex items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-dashed border-[rgba(197,161,72,0.4)] rounded-lg text-xs text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors">
              <Upload size={14} />
              {uploading ? "Upload..." : "Uploader une image"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleImageUpload} />
            </label>
            <span className="text-xs text-gray-400">ou colle directement un lien dans le champ "url" ci-dessous</span>
          </div>
        )}

        {selectedType === "jsx_figure" && (
          <JsxFigureEditor
            value={(() => {
              try { return JSON.parse(jsonText) as Record<string, unknown>; } catch { return {}; }
            })()}
            onChange={(spec) => setJsonText(JSON.stringify(spec, null, 2))}
          />
        )}

        <details className="space-y-2" open={selectedType !== "jsx_figure"}>
          <summary className="text-xs font-medium text-gray-500 uppercase cursor-pointer">Données (JSON){selectedType === "jsx_figure" ? " : mode avancé" : ""}</summary>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full min-h-[160px] p-3 border border-[rgba(197,161,72,0.25)] rounded-lg text-xs font-mono resize-y mt-2"
            spellCheck={false}
          />
        </details>

        <div className="space-y-2" hidden={selectedType === "jsx_figure"}>
          <label className="text-xs font-medium text-gray-500 uppercase">Aperçu</label>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <div
              className="latex-content border border-[rgba(197,161,72,0.15)] rounded-lg p-3 bg-gray-50 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: selectedType === "jsx_figure" ? "" : renderLatexInHTML(renderMathGraphPlaceholders(html)) }}
            />
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <GlassButton size="sm" variant="ghost" onClick={onClose}>
            Annuler
          </GlassButton>
          <GlassButton size="sm" onClick={handleInsert} disabled={!html}>
            Insérer
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
