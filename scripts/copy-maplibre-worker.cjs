// Copie le worker de maplibre-gl dans public/ : la carte admin (UserMap) le charge depuis /maplibre-gl-worker.mjs.
// Turbopack ne sait pas servir ce fichier tout seul (le worker échouait en « Failed to load module script »). Copié à
// l'installation pour toujours suivre la version de maplibre-gl installée ; le fichier copié n'est pas versionné.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const dest = path.join(__dirname, "..", "public", "maplibre-gl-worker.mjs");
if (!fs.existsSync(src)) {
  console.warn("[maplibre] worker introuvable, carte admin indisponible :", src);
  process.exit(0);
}
fs.copyFileSync(src, dest);
