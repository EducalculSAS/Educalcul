// Validation du catalogue éditorial 2026-2027 (catalogue_educalcul_2026_2027.txt)
// importé dans public.courses / public.course_folders / public.catalogue_import_queue.
//
// Usage : node scripts/validate-catalogue.mjs
//
// Vérifie : 16 niveaux, 113 thèmes, 360 chapitres, exactement 902 cours,
// aucun titre/description/contenu vide, slugs uniques, ordres cohérents et
// sans doublon dans un chapitre, aucune relation orpheline, un bilan par
// thème et toujours en dernière position.

import fs from "node:fs";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE;
const headers = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` };

const LEVEL_FOLDER_IDS = [18, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39];

async function fetchAll(table, select, filter = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}&limit=5000`, { headers });
  return res.json();
}

async function main() {
  const failures = [];
  const warn = (msg) => failures.push(msg);

  const courses = await fetchAll(
    "courses",
    "id,slug,title,description,content_json,level,subject,folder_id,chapter_name,theme_order,chapter_order,lesson_order,is_theme_summary",
  );
  const folders = await fetchAll("course_folders", "id,name,parent_id");
  const queue = await fetchAll("catalogue_import_queue", "id,slug,status,attempts,last_error");

  console.log(`Cours en base : ${courses.length}`);
  console.log(`Dossiers : ${folders.length}`);
  console.log(`File d'import : ${queue.length} (statuts : ${Object.entries(
    queue.reduce((acc, q) => ((acc[q.status] = (acc[q.status] || 0) + 1), acc), {}),
  ).map(([k, v]) => `${k}=${v}`).join(", ")})`);

  // 1) Exactement 902 cours
  if (courses.length !== 902) warn(`Attendu 902 cours, trouvé ${courses.length}.`);

  // 2) 16 niveaux
  const levels = new Set(courses.map((c) => c.level));
  if (levels.size !== 16) warn(`Attendu 16 niveaux distincts, trouvé ${levels.size} (${[...levels].join(", ")}).`);

  // 3) Thèmes = dossiers enfants directs des 16 niveaux
  const themeFolders = folders.filter((f) => LEVEL_FOLDER_IDS.includes(f.parent_id));
  if (themeFolders.length !== 113) warn(`Attendu 113 dossiers thème, trouvé ${themeFolders.length}.`);

  // 4) 360 chapitres = nombre de (folder_id, chapter_name) distincts hors bilans
  const chapterKeys = new Set(
    courses.filter((c) => !c.is_theme_summary).map((c) => `${c.folder_id}|||${c.chapter_name}`),
  );
  if (chapterKeys.size !== 360) warn(`Attendu 360 chapitres distincts, trouvé ${chapterKeys.size}.`);

  // 5) Aucun titre/description/contenu vide
  for (const c of courses) {
    if (!c.title?.trim()) warn(`Cours #${c.id} (slug ${c.slug}) : titre vide.`);
    if (!c.description?.trim()) warn(`Cours #${c.id} (slug ${c.slug}) : description vide.`);
    const text = JSON.stringify(c.content_json || {});
    if (!c.content_json || text.length < 200) warn(`Cours #${c.id} (slug ${c.slug}) : contenu vide ou trop court.`);
    if (/\bTODO\b/i.test(text) || /lorem ipsum/i.test(text)) warn(`Cours #${c.id} (slug ${c.slug}) : contenu suspect (TODO/Lorem ipsum).`);
  }

  // 6) Slugs uniques
  const slugCounts = {};
  for (const c of courses) slugCounts[c.slug] = (slugCounts[c.slug] || 0) + 1;
  for (const [slug, count] of Object.entries(slugCounts)) {
    if (count > 1) warn(`Slug dupliqué : ${slug} (${count} fois).`);
  }

  // 7) Aucune relation orpheline (folder_id doit exister)
  const folderIds = new Set(folders.map((f) => f.id));
  for (const c of courses) {
    if (!folderIds.has(c.folder_id)) warn(`Cours #${c.id} (slug ${c.slug}) : folder_id ${c.folder_id} introuvable.`);
  }

  // 8) Aucun ordre de leçon dupliqué dans un même thème (folder)
  const byFolder = {};
  for (const c of courses) (byFolder[c.folder_id] ||= []).push(c);
  for (const [folderId, list] of Object.entries(byFolder)) {
    const orders = {};
    for (const c of list) orders[c.lesson_order] = (orders[c.lesson_order] || 0) + 1;
    for (const [order, count] of Object.entries(orders)) {
      if (count > 1) warn(`Dossier ${folderId} : lesson_order ${order} dupliqué (${count} cours).`);
    }
  }

  // 9) Chaque thème (dossier) possède exactement un bilan, et c'est le dernier
  for (const [folderId, list] of Object.entries(byFolder)) {
    const bilans = list.filter((c) => c.is_theme_summary);
    if (bilans.length !== 1) warn(`Dossier ${folderId} : ${bilans.length} bilan(s) trouvé(s) (attendu exactement 1).`);
    const sorted = [...list].sort((a, b) => a.lesson_order - b.lesson_order);
    const last = sorted[sorted.length - 1];
    if (bilans.length === 1 && last?.id !== bilans[0].id) {
      warn(`Dossier ${folderId} : le bilan (#${bilans[0].id}) n'est pas la dernière leçon du thème.`);
    }
  }

  // 10) File d'import : tout doit être "done"
  const notDone = queue.filter((q) => q.status !== "done");
  if (notDone.length > 0) {
    warn(`${notDone.length} leçon(s) de la file ne sont pas "done" : ${notDone.slice(0, 10).map((q) => `${q.slug}(${q.status})`).join(", ")}${notDone.length > 10 ? "…" : ""}`);
  }

  // Tableau des compteurs par niveau
  console.log("\nCompteurs par niveau :");
  const byLevel = {};
  for (const c of courses) (byLevel[c.level] ||= []).push(c);
  for (const [level, list] of Object.entries(byLevel).sort()) {
    const themes = new Set(list.map((c) => c.folder_id)).size;
    console.log(`  ${level.padEnd(30)} ${String(list.length).padStart(4)} cours, ${themes} thèmes`);
  }

  console.log(`\n${failures.length === 0 ? "✅ VALIDATION OK" : `❌ ${failures.length} PROBLÈME(S)`}`);
  for (const f of failures.slice(0, 50)) console.log(`  - ${f}`);
  if (failures.length > 50) console.log(`  … et ${failures.length - 50} de plus.`);

  process.exit(failures.length === 0 ? 0 : 1);
}

main();
