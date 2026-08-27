import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL manque dans .env.local");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE manque dans .env.local");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Key = { label: string; latex?: string; cmd?: string; wide?: boolean };
type Tab = { id: string; label: string; rows: Key[][] };

const DEFAULT_STYLE = {
  bg: "rgba(250, 247, 242, 0.55)",
  keyBg: "rgba(255, 255, 255, 0.55)",
  keyText: "#1a1008",
  keyActiveBg: "#c5a148",
  keyActiveText: "#ffffff",
  accent: "#0f1e3a",
};

// Rangées de chiffres/opérations de base — communes à tous les niveaux.
const NUM_ROWS: Key[][] = [
  [{ label: "7", latex: "7" }, { label: "8", latex: "8" }, { label: "9", latex: "9" }, { label: "÷", latex: "\\div" }],
  [{ label: "4", latex: "4" }, { label: "5", latex: "5" }, { label: "6", latex: "6" }, { label: "×", latex: "\\times" }],
  [{ label: "1", latex: "1" }, { label: "2", latex: "2" }, { label: "3", latex: "3" }, { label: "-", latex: "-" }],
  [{ label: "0", latex: "0" }, { label: ",", latex: "{,}" }, { label: "=", latex: "=" }, { label: "+", latex: "+" }],
];

const PRIMAIRE_TABS: Tab[] = [
  { id: "num", label: "123", rows: NUM_ROWS },
  {
    id: "unites",
    label: "Unités",
    rows: [
      [{ label: "cm", latex: "\\text{ cm}" }, { label: "m", latex: "\\text{ m}" }, { label: "km", latex: "\\text{ km}" }],
      [{ label: "g", latex: "\\text{ g}" }, { label: "kg", latex: "\\text{ kg}" }, { label: "L", latex: "\\text{ L}" }],
      [{ label: "€", latex: "\\text{ €}" }, { label: "h", latex: "\\text{ h}" }, { label: "min", latex: "\\text{ min}" }],
    ],
  },
];

const COLLEGE_TABS: Tab[] = [
  { id: "num", label: "123", rows: NUM_ROWS },
  {
    id: "alg",
    label: "x",
    rows: [
      [{ label: "x", latex: "x" }, { label: "y", latex: "y" }, { label: "x²", latex: "x^2" }, { label: "√", latex: "\\sqrt{\\placeholder{}}" }],
      [{ label: "( )", latex: "(\\placeholder{})" }, { label: "a/b", latex: "\\frac{\\placeholder{}}{\\placeholder{}}" }, { label: "π", latex: "\\pi" }, { label: "°", latex: "\\degree" }],
      [{ label: "<", latex: "<" }, { label: ">", latex: ">" }, { label: "≤", latex: "\\leq" }, { label: "≥", latex: "\\geq" }],
    ],
  },
  {
    id: "geo",
    label: "Géo",
    rows: [
      [{ label: "△", latex: "\\triangle " }, { label: "∥", latex: "\\parallel " }, { label: "⊥", latex: "\\perp " }],
      [{ label: "∈", latex: "\\in " }, { label: "∉", latex: "\\notin " }, { label: "⊂", latex: "\\subset " }],
    ],
  },
];

const LYCEE_TABS: Tab[] = [
  { id: "num", label: "123", rows: NUM_ROWS },
  {
    id: "alg",
    label: "x",
    rows: [
      [{ label: "x", latex: "x" }, { label: "x²", latex: "x^2" }, { label: "xⁿ", latex: "x^{\\placeholder{}}" }, { label: "√", latex: "\\sqrt{\\placeholder{}}" }],
      [{ label: "a/b", latex: "\\frac{\\placeholder{}}{\\placeholder{}}" }, { label: "( )", latex: "(\\placeholder{})" }, { label: "|x|", latex: "\\left|\\placeholder{}\\right|" }, { label: "Matrice", cmd: "insertMatrix" }],
      [{ label: "≤", latex: "\\leq" }, { label: "≥", latex: "\\geq" }, { label: "≠", latex: "\\neq" }, { label: "≈", latex: "\\approx" }],
    ],
  },
  {
    id: "fct",
    label: "f(x)",
    rows: [
      [{ label: "f(x)", latex: "f(\\placeholder{})" }, { label: "f'(x)", latex: "f'(\\placeholder{})" }, { label: "lim", latex: "\\lim_{\\placeholder{} \\to \\placeholder{}}" }],
      [{ label: "∫", latex: "\\int_{\\placeholder{}}^{\\placeholder{}}" }, { label: "Σ", latex: "\\sum_{\\placeholder{}}^{\\placeholder{}}" }, { label: "e^x", latex: "e^{\\placeholder{}}" }, { label: "ln", latex: "\\ln(\\placeholder{})" }],
      [{ label: "sin", latex: "\\sin(\\placeholder{})" }, { label: "cos", latex: "\\cos(\\placeholder{})" }, { label: "tan", latex: "\\tan(\\placeholder{})" }],
    ],
  },
  {
    id: "ens",
    label: "ℝ ∃",
    rows: [
      [{ label: "ℝ", latex: "\\mathbb{R}" }, { label: "ℕ", latex: "\\mathbb{N}" }, { label: "ℤ", latex: "\\mathbb{Z}" }, { label: "∅", latex: "\\emptyset" }],
      [{ label: "∈", latex: "\\in " }, { label: "∀", latex: "\\forall " }, { label: "∃", latex: "\\exists " }, { label: "⇒", latex: "\\Rightarrow " }],
      [{ label: "α", latex: "\\alpha" }, { label: "β", latex: "\\beta" }, { label: "θ", latex: "\\theta" }, { label: "π", latex: "\\pi" }],
    ],
  },
];

const LEVEL_TIERS: Record<string, Tab[]> = {
  cp: PRIMAIRE_TABS, ce1: PRIMAIRE_TABS, ce2: PRIMAIRE_TABS, cm1: PRIMAIRE_TABS, cm2: PRIMAIRE_TABS,
  "6eme": COLLEGE_TABS, "5eme": COLLEGE_TABS, "4eme": COLLEGE_TABS, "3eme": COLLEGE_TABS,
  "2nde": LYCEE_TABS,
  "1ere-generale": LYCEE_TABS, "1ere-generale-maths": LYCEE_TABS,
  "terminale-generale": LYCEE_TABS, "terminale-generale-maths": LYCEE_TABS,
  "terminale-generale-expertes": LYCEE_TABS, "terminale-generale-complementaires": LYCEE_TABS,
};

const LEVEL_LABELS: Record<string, string> = {
  cp: "CP", ce1: "CE1", ce2: "CE2", cm1: "CM1", cm2: "CM2",
  "6eme": "6ème", "5eme": "5ème", "4eme": "4ème", "3eme": "3ème",
  "2nde": "Seconde",
  "1ere-generale": "Première (sans spé maths)", "1ere-generale-maths": "Première (spé maths)",
  "terminale-generale": "Terminale (sans maths)", "terminale-generale-maths": "Terminale (spé maths)",
  "terminale-generale-expertes": "Terminale (maths expertes)", "terminale-generale-complementaires": "Terminale (maths complémentaires)",
};

async function main() {
  const rows = Object.entries(LEVEL_TIERS).map(([level, tabs]) => ({
    level,
    label: LEVEL_LABELS[level] || level,
    config: { tabs, style: DEFAULT_STYLE },
  }));

  const { data, error } = await supabase
    .from("math_keyboards")
    .upsert(rows, { onConflict: "level" })
    .select("id, level");

  if (error) throw error;
  console.log(`✅ ${data?.length ?? 0} claviers créés/mis à jour.`);
}

main().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});
