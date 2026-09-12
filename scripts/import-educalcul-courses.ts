import { createClient } from "@supabase/supabase-js";
import { cp, mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/* ============================================================
   CONFIG
   ============================================================ */

const ROOT = process.cwd();

const CATALOGUE_DIR = path.join(ROOT, "educalcul_courses_final");

const COURSES_DIR = CATALOGUE_DIR;

const SOURCE_ASSETS_DIR = path.join(ROOT, "public", "educalcul-course-assets");

const TARGET_ASSETS_DIR = path.join(ROOT, "public", "educalcul-course-assets");

const APPLY = process.argv.includes("--apply");

/* ============================================================
   ENV
   ============================================================ */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL manque dans .env.local",
  );
}

if (!serviceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE manque dans .env.local");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/* ============================================================
   TYPES
   ============================================================ */

type CourseJson = {
  id?: number | string;
  _type?: string;
  _version?: string;
  _exported_at?: string;

  title: string;
  description?: string | null;
  subject: string;
  level: string;

  thumbnail_url?: string | null;
  status?: string;
  folder_id?: number | null;
  estimated_time?: number | null;
  content_json: unknown;

  created_at?: string;
  updated_at?: string;

  [key: string]: unknown;
};

type FolderRow = {
  id: number;
  name: string;
  grade_level: string | null;
  parent_id: number | null;
};

/* ============================================================
   NORMALISATION
   ============================================================ */

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeLevel(value: string): string {
  const level = normalizeText(value);

  const aliases: Record<string, string> = {
    cp: "cp",
    ce1: "ce1",
    ce2: "ce2",
    cm1: "cm1",
    cm2: "cm2",

    "6eme": "6eme",
    "6e": "6eme",

    "5eme": "5eme",
    "5e": "5eme",

    "4eme": "4eme",
    "4e": "4eme",

    "3eme": "3eme",
    "3e": "3eme",

    seconde: "2nde",
    "2nde": "2nde",

    "premiere-sans-spe-maths": "1ere-generale",
    "premiere-generale": "1ere-generale",
    "1ere-generale": "1ere-generale",

    "premiere-spe-maths": "1ere-generale-maths",
    "premiere-generale-maths": "1ere-generale-maths",
    "1ere-generale-maths": "1ere-generale-maths",

    "terminale-sans-maths": "terminale-generale",
    "terminale-generale": "terminale-generale",

    "terminale-maths-complementaires": "terminale-generale-complementaires",
    "terminale-generale-complementaires": "terminale-generale-complementaires",

    "terminale-spe-maths": "terminale-generale-maths",
    "terminale-generale-maths": "terminale-generale-maths",

    "terminale-maths-expertes": "terminale-generale-expertes",
    "terminale-generale-expertes": "terminale-generale-expertes",
  };

  return aliases[level] ?? level;
}

function inferLevelFromFile(file: string, declaredLevel: string): string {
  const filename = path.basename(file).toLowerCase();

  // Première
  if (filename.startsWith("1ere-generale-maths-")) {
    return "1ere-generale-maths";
  }

  if (filename.startsWith("1ere-generale-")) {
    return "1ere-generale";
  }

  // Terminale : ordre important, du plus spécifique au plus général
  if (filename.startsWith("terminale-generale-complementaires-")) {
    return "terminale-generale-complementaires";
  }

  if (filename.startsWith("terminale-generale-expertes-")) {
    return "terminale-generale-expertes";
  }

  if (filename.startsWith("terminale-generale-maths-")) {
    return "terminale-generale-maths";
  }

  if (filename.startsWith("terminale-generale-")) {
    return "terminale-generale";
  }

  return normalizeLevel(declaredLevel);
}

function canonicalSubject(level: string, subject: string): string {
  const l = normalizeLevel(level);
  const s = normalizeText(subject);

  const aliases: Record<string, Record<string, string>> = {
    cp: {
      [normalizeText("Premiers problèmes de multiplication et partage")]:
        "Premiers problèmes de multiplication et de partage",
    },

    ce1: {
      [normalizeText("Les nombres jusqu'à 1 000")]:
        "Nombres entiers et numération",

      [normalizeText("Les fractions")]:
        "Fractions simples et premières écritures décimales",

      [normalizeText("Addition et soustraction")]: "Les quatre opérations",

      [normalizeText("Multiplication, groupements et partages")]:
        "Les quatre opérations",

      [normalizeText("Calcul mental et automatismes")]:
        "Calcul mental et tables",

      [normalizeText("Organisation et gestion de données")]:
        "Organisation et gestion de données",
    },

    ce2: {
      [normalizeText("Organisation et gestion de données")]:
        "Organisation de données",
    },

    cm1: {
      [normalizeText("Données et probabilités")]:
        "Données, probabilités et proportionnalité",

      [normalizeText("Proportionnalité")]:
        "Données, probabilités et proportionnalité",

      [normalizeText("Pensée informatique")]:
        "Initiation à la pensée informatique",
    },

    "6eme": {
      [normalizeText("Espace")]: "Espace et représentation",

      [normalizeText("Algorithmique")]: "Pensée informatique et algorithmique",
    },

    "5eme": {
      [normalizeText("Pensée informatique")]:
        "Algorithmique et pensée informatique",
    },

    "3eme": {
      [normalizeText("Algorithmique et préparation DNB")]:
        "Algorithmique et programmation",
    },

    "2nde": {
      [normalizeText("Arithmétique et nombres réels")]:
        "Nombres réels et arithmétique",

      [normalizeText("Calcul algébrique, équations et inéquations")]:
        "Calcul algébrique",

      [normalizeText("Vecteurs et problèmes de géométrie")]:
        "Vecteurs et géométrie",

      [normalizeText("Statistiques, information chiffrée et probabilités")]:
        "Statistiques, données et probabilités",

      [normalizeText("Logique, ensembles, algorithmique et automatismes")]:
        "Logique, ensembles, algorithmique et automatismes",
    },

    "1ere-generale": {
      [normalizeText("Automatismes")]: "Automatismes",

      [normalizeText("Analyse de l'information chiffrée")]:
        "Analyse de l’information chiffrée",

      [normalizeText("Phénomènes aléatoires")]: "Phénomènes aléatoires",

      [normalizeText("Variation linéaire")]: "Variation linéaire",

      [normalizeText("Modélisation quadratique")]: "Modélisation quadratique",

      [normalizeText("Variation exponentielle")]: "Variation exponentielle",
    },

    "1ere-generale-maths": {
      [normalizeText("Logique, algorithmique et automatismes")]:
        "Outils, automatismes, logique et algorithmique",

      [normalizeText("Suites numériques et modèles discrets")]:
        "Suites et modèles discrets",

      [normalizeText("Second degré")]: "Second degré et fonctions",

      [normalizeText("Dérivation et variations")]:
        "Analyse : dérivation, exponentielle et trigonométrie",

      [normalizeText("Fonction exponentielle et trigonométrie")]:
        "Analyse : dérivation, exponentielle et trigonométrie",

      [normalizeText("Géométrie : produit scalaire et repérage")]:
        "Géométrie : produit scalaire et repérage",

      [normalizeText("Probabilités et statistiques")]:
        "Probabilités et statistiques",
    },

    "terminale-generale": {
      [normalizeText("Calculs, pourcentages et évolutions")]:
        "Calculs, pourcentages et évolutions",

      [normalizeText("Fonctions et lecture de graphiques")]:
        "Fonctions et lecture de graphiques",

      [normalizeText("Statistiques et données")]: "Statistiques et données",

      [normalizeText("Probabilités et modélisation")]:
        "Probabilités et modélisation",
    },

    "terminale-generale-complementaires": {
      [normalizeText("Modèles définis par une fonction")]:
        "Modèles définis par une fonction",

      [normalizeText("Modèles d’évolution")]: "Modèles d’évolution",

      [normalizeText("Fonction logarithme")]: "Fonction logarithme",

      [normalizeText("Calculs d’aires et intégrales")]:
        "Calculs d’aires et intégrales",

      [normalizeText("Répartition des richesses et inégalités")]:
        "Répartition des richesses et inégalités",

      [normalizeText("Inférence bayésienne")]: "Inférence bayésienne",

      [normalizeText("Expériences indépendantes et échantillonnage")]:
        "Expériences indépendantes et échantillonnage",

      [normalizeText("Temps d’attente")]: "Temps d’attente",

      [normalizeText("Corrélation et causalité")]: "Corrélation et causalité",
    },

    "terminale-generale-maths": {
      [normalizeText("Dénombrement et algèbre")]: "Dénombrement et algèbre",

      [normalizeText("Géométrie dans l’espace")]: "Géométrie dans l’espace",

      [normalizeText("Suites")]: "Suites",

      [normalizeText("Limites, dérivation, continuité et logarithme")]:
        "Limites, dérivation, continuité et logarithme",

      [normalizeText("Primitives, intégrales et équations différentielles")]:
        "Primitives, intégrales et équations différentielles",

      [normalizeText("Intégration")]:
        "Primitives, intégrales et équations différentielles",

      [normalizeText("Probabilités")]: "Probabilités",

      [normalizeText("Algorithmique, logique et automatismes")]:
        "Algorithmique, logique et automatismes",
    },

    "terminale-generale-expertes": {
      [normalizeText("Nombres complexes")]: "Nombres complexes",

      [normalizeText("Arithmétique")]: "Arithmétique",

      [normalizeText("Graphes et matrices")]: "Graphes et matrices",
    },
  };

  return aliases[l]?.[s] ?? subject;
}

/* ============================================================
   LECTURE RECURSIVE DES JSON
   ============================================================ */

async function findJsonFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });

  const result: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...(await findJsonFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      result.push(fullPath);
    }
  }

  return result.sort();
}

/* ============================================================
   ASSETS
   ============================================================ */

async function copyAssets() {
  try {
    const sourceStat = await stat(SOURCE_ASSETS_DIR);

    if (!sourceStat.isDirectory()) {
      return;
    }
  } catch {
    console.warn("⚠️  Aucun dossier d'assets trouvé :", SOURCE_ASSETS_DIR);
    return;
  }

  await mkdir(TARGET_ASSETS_DIR, {
    recursive: true,
  });

  await cp(SOURCE_ASSETS_DIR, TARGET_ASSETS_DIR, {
    recursive: true,
    force: true,
  });

  console.log("✅ Assets copiés vers public/educalcul-course-assets/");
}

/* ============================================================
   DOSSIERS SUPABASE
   ============================================================ */

async function loadFolders(): Promise<FolderRow[]> {
  const { data, error } = await supabase
    .from("course_folders")
    .select("id,name,grade_level,parent_id");

  if (error) {
    throw new Error(`Impossible de lire course_folders : ${error.message}`);
  }

  return (data ?? []) as FolderRow[];
}

function createFolderResolver(folders: FolderRow[]) {
  /*
   * Les dossiers racines possèdent parent_id = null.
   *
   * Certains ont grade_level rempli (collège/lycée),
   * tandis que CP/CE1/etc. utilisent principalement leur nom.
   */

  const roots = folders.filter((folder) => folder.parent_id === null);

  function findRoot(level: string): FolderRow | undefined {
    const normalizedLevel = normalizeLevel(level);

    return roots.find((root) => {
      const candidates = [root.grade_level ?? "", root.name].map(
        normalizeLevel,
      );

      return candidates.includes(normalizedLevel);
    });
  }

  return function resolveFolder(
    level: string,
    subject: string,
  ): FolderRow | null {
    const root = findRoot(level);

    if (!root) {
      return null;
    }

    const resolvedSubject = canonicalSubject(level, subject);
    const normalizedSubject = normalizeText(resolvedSubject);

    const children = folders.filter((folder) => folder.parent_id === root.id);

    const exact = children.find(
      (folder) => normalizeText(folder.name) === normalizedSubject,
    );

    return exact ?? null;
  };
}

/* ============================================================
   NETTOYAGE JSON AVANT INSERTION
   ============================================================ */

function databasePayload(course: CourseJson, folderId: number) {
  /*
   * IMPORTANT :
   * on ne réimporte PAS :
   *
   * - id
   * - created_at
   * - updated_at
   * - _type
   * - _version
   * - _exported_at
   *
   * PostgreSQL garde ainsi ses propres IDs/séquences.
   */

  return {
    title: String(course.title).trim(),

    description: course.description == null ? "" : String(course.description),

    subject: String(course.subject).trim(),

    level: String(course.level).trim(),

    thumbnail_url:
      course.thumbnail_url == null ? "" : String(course.thumbnail_url),

    status: "draft",

    folder_id: folderId,

    estimated_time:
      typeof course.estimated_time === "number"
        ? Math.max(1, Math.round(course.estimated_time))
        : null,

    content_json: course.content_json,
  };
}

/* ============================================================
   VALIDATION
   ============================================================ */

function validateCourse(course: CourseJson, filename: string): string[] {
  const errors: string[] = [];

  if (!course.title?.trim()) {
    errors.push(`${filename}: title manquant`);
  }

  if (!course.level?.trim()) {
    errors.push(`${filename}: level manquant`);
  }

  if (!course.subject?.trim()) {
    errors.push(`${filename}: subject manquant`);
  }

  if (!course.content_json) {
    errors.push(`${filename}: content_json manquant`);
  }

  return errors;
}

/* ============================================================
   IMPORT
   ============================================================ */

async function main() {
  console.log("");
  console.log("══════════════════════════════════════════════");
  console.log(" EDUCALCUL — IMPORT COMPLET DES COURS");
  console.log("══════════════════════════════════════════════");
  console.log("");

  if (!APPLY) {
    console.log("🔎 MODE TEST : aucune modification Supabase.");
    console.log("   Après validation, lance avec --apply.");
  } else {
    console.log("🚀 MODE IMPORT : les cours vont être enregistrés.");
  }

  console.log("");

  /* ----------------------------------------------------------
     Vérifier le catalogue
     ---------------------------------------------------------- */

  try {
    const courseDirStat = await stat(COURSES_DIR);

    if (!courseDirStat.isDirectory()) {
      throw new Error();
    }
  } catch {
    throw new Error(
      `Dossier introuvable :\n${COURSES_DIR}\n\n` +
        "Vérifie que le dossier décompressé v7 est bien à la racine du projet.",
    );
  }

  /* ----------------------------------------------------------
     Assets
     ---------------------------------------------------------- */

  if (APPLY) {
    await copyAssets();
  }

  /* ----------------------------------------------------------
     Charger les dossiers
     ---------------------------------------------------------- */

  console.log("📁 Lecture de course_folders...");

  const folders = await loadFolders();

  console.log(`✅ ${folders.length} dossiers Supabase trouvés.`);

  const resolveFolder = createFolderResolver(folders);

  /* ----------------------------------------------------------
     Charger tous les JSON
     ---------------------------------------------------------- */

  console.log("📚 Recherche des cours...");

  const allFiles = await findJsonFiles(COURSES_DIR);

  const ignoredJsonFiles = new Set([
    "manifest.json",
    "validation.json",
    "semantic_qa.json",
  ]);

  const files = allFiles.filter(
    (file) => !ignoredJsonFiles.has(path.basename(file).toLowerCase()),
  );

  console.log(`✅ ${files.length} fichiers JSON trouvés.`);
  console.log("");

  if (files.length === 0) {
    throw new Error("Aucun JSON trouvé dans courses/.");
  }

  /* ----------------------------------------------------------
     Lire + valider TOUS les cours avant toute insertion
     ---------------------------------------------------------- */

  const prepared: Array<{
    file: string;
    course: CourseJson;
    folder: FolderRow;
  }> = [];

  const validationErrors: string[] = [];

  const unresolved = new Map<
    string,
    {
      level: string;
      subject: string;
      count: number;
    }
  >();

  for (const file of files) {
    let course: CourseJson;

    try {
      course = JSON.parse(await readFile(file, "utf8")) as CourseJson;
    } catch (error) {
      validationErrors.push(`${file}: JSON invalide (${String(error)})`);
      continue;
    }

    // Les JSON utilisent parfois "premiere" ou "terminale" comme niveau
    // générique. Le nom du fichier contient le parcours exact.
    course.level = inferLevelFromFile(file, course.level);

    validationErrors.push(...validateCourse(course, file));

    if (!course.level || !course.subject) {
      continue;
    }

    const folder = resolveFolder(course.level, course.subject);

    if (!folder) {
      const key =
        normalizeLevel(course.level) + "::" + normalizeText(course.subject);

      const current = unresolved.get(key);

      unresolved.set(key, {
        level: course.level,
        subject: course.subject,
        count: (current?.count ?? 0) + 1,
      });

      continue;
    }

    prepared.push({
      file,
      course,
      folder,
    });
  }
  if (unresolved.size > 0) {
    console.error("");
    console.error(
      "❌ IMPORT BLOQUÉ : certains thèmes ne correspondent pas à course_folders.",
    );
    console.error("");

    for (const item of unresolved.values()) {
      console.error(`   ${item.level} | ${item.subject} | ${item.count} cours`);
    }

    console.error("");
    console.error("Aucun cours n'a été importé.");

    process.exit(1);
  }

  if (validationErrors.length > 0) {
    console.error("");
    console.error("❌ Erreurs de validation :");

    for (const error of validationErrors) {
      console.error("   " + error);
    }

    console.error("");
    console.error("Aucun cours n'a été importé.");

    process.exit(1);
  }

  console.log(`✅ ${prepared.length}/${files.length} cours valides.`);

  /* ----------------------------------------------------------
     Résumé des dossiers
     ---------------------------------------------------------- */

  const counts = new Map<string, number>();

  for (const item of prepared) {
    const key =
      `${item.course.level} → ${item.course.subject}` +
      ` [folder ${item.folder.id}]`;

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log("");
  console.log("📊 Répartition détectée :");
  console.log("");

  for (const [name, count] of counts) {
    console.log(`   ${String(count).padStart(3)} × ${name}`);
  }

  /* ----------------------------------------------------------
     MODE TEST → ARRÊT ICI
     ---------------------------------------------------------- */

  if (!APPLY) {
    console.log("");
    console.log("══════════════════════════════════════════════");
    console.log(" ✅ VALIDATION TERMINÉE");
    console.log("══════════════════════════════════════════════");
    console.log("");
    console.log(`${prepared.length} cours sont prêts à être importés.`);
    console.log("");
    console.log("Pour réellement importer :");
    console.log("");
    console.log(
      "  npx tsx --env-file=.env.local scripts/import-educalcul-courses.ts --apply",
    );
    console.log("");

    return;
  }

  /* ----------------------------------------------------------
     Charger les cours existants pour rendre l'import relançable
     ---------------------------------------------------------- */

  console.log("");
  console.log("🔍 Recherche des éventuels cours déjà présents...");

  const { data: existingRows, error: existingError } = await supabase
    .from("courses")
    .select("id,title,level,subject");

  if (existingError) {
    throw new Error(`Impossible de lire courses : ${existingError.message}`);
  }

  const existing = new Map<string, { id: number }>();

  for (const row of existingRows ?? []) {
    const key = [
      normalizeLevel(String(row.level ?? "")),
      normalizeText(String(row.subject ?? "")),
      normalizeText(String(row.title ?? "")),
    ].join("::");

    existing.set(key, {
      id: Number(row.id),
    });
  }

  // Le générateur (gemini/run.ts) réécrit les titres mais conserve l'ancien
  // dans `_original_title`. On matche donc la ligne existante par l'ancien titre
  // (1er import) OU par le nouveau (imports suivants) — jamais de doublon.
  function findExisting(course: CourseJson): { id: number } | undefined {
    const l = normalizeLevel(course.level);
    const s = normalizeText(course.subject);
    const originalTitle = (course as { _original_title?: unknown })._original_title;
    const keys = [
      typeof originalTitle === "string" ? [l, s, normalizeText(originalTitle)].join("::") : null,
      [l, s, normalizeText(course.title)].join("::"),
    ].filter(Boolean) as string[];
    for (const k of keys) {
      const hit = existing.get(k);
      if (hit) return hit;
    }
    return undefined;
  }

  /* ----------------------------------------------------------
     Import
     ---------------------------------------------------------- */

  console.log("");
  console.log("🚀 Import en cours...");
  console.log("");

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  const failures: Array<{
    title: string;
    error: string;
  }> = [];

  for (let index = 0; index < prepared.length; index += 1) {
    const item = prepared[index];

    const course = item.course;

    const payload = databasePayload(course, item.folder.id);

    const previous = findExisting(course);

    let error: { message: string } | null = null;

    if (previous) {
      const response = await supabase
        .from("courses")
        .update(payload)
        .eq("id", previous.id);

      error = response.error;

      if (!error) {
        updated += 1;
      }
    } else {
      const response = await supabase.from("courses").insert(payload);

      error = response.error;

      if (!error) {
        inserted += 1;
      }
    }

    const position = `[${index + 1}/${prepared.length}]`;

    if (error) {
      failed += 1;

      failures.push({
        title: course.title,
        error: error.message,
      });

      console.error(
        `❌ ${position} ${course.level} / ${course.subject} / ${course.title}`,
      );

      console.error(`   ${error.message}`);
    } else {
      console.log(
        `✅ ${position} ${course.level} / ${course.subject} / ${course.title} → folder ${item.folder.id}`,
      );
    }
  }

  /* ----------------------------------------------------------
     Vérification finale
     ---------------------------------------------------------- */

  console.log("");
  console.log("🔎 Vérification Supabase...");

  const { count, error: countError } = await supabase
    .from("courses")
    .select("*", {
      count: "exact",
      head: true,
    });

  if (countError) {
    console.warn("⚠️ Impossible de compter les cours :", countError.message);
  }

  const { data: coursesWithoutFolder, error: folderCheckError } = await supabase
    .from("courses")
    .select("id,title,level,subject")
    .is("folder_id", null);

  if (folderCheckError) {
    console.warn(
      "⚠️ Impossible de vérifier les folder_id :",
      folderCheckError.message,
    );
  }

  console.log("");
  console.log("══════════════════════════════════════════════");
  console.log(" IMPORT EDUCALCUL TERMINÉ");
  console.log("══════════════════════════════════════════════");
  console.log("");
  console.log(`Créés      : ${inserted}`);
  console.log(`Mis à jour : ${updated}`);
  console.log(`Échecs     : ${failed}`);

  if (typeof count === "number") {
    console.log(`Cours en base : ${count}`);
  }

  console.log(`Sans folder_id : ${coursesWithoutFolder?.length ?? "?"}`);

  if (failures.length > 0) {
    console.log("");
    console.log("❌ ÉCHECS :");

    for (const failure of failures) {
      console.log(`- ${failure.title}: ${failure.error}`);
    }

    process.exitCode = 1;
  }

  if (coursesWithoutFolder && coursesWithoutFolder.length > 0) {
    console.log("");
    console.log("⚠️ Certains cours n'ont pas de dossier :");

    for (const course of coursesWithoutFolder) {
      console.log(
        `${course.id} | ${course.level} | ${course.subject} | ${course.title}`,
      );
    }

    process.exitCode = 1;
  }

  if (failed === 0 && (coursesWithoutFolder?.length ?? 0) === 0) {
    console.log("");
    console.log(
      "🎉 Tous les cours ont été importés et placés dans leur dossier.",
    );
  }

  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("💥 IMPORT ARRÊTÉ");
  console.error(error);
  console.error("");

  process.exit(1);
});
