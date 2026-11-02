#!/usr/bin/env node
/**
 * Vérifie, APRÈS `next build`, qu'aucune page pré-rendue (○, HTML identique pour tous) n'est dans la liste des pages à CSP stricte
 * avec nonce (src/lib/csp.ts) : sur une page pré-rendue, le nonce ne peut pas exister et la page cesserait de fonctionner.
 */
import { readFileSync } from "node:fs";

const csp = readFileSync("src/lib/csp.ts", "utf8");
const match = csp.match(/STRICT_CSP_PREFIXES\s*=\s*\[([^\]]*)\]/);
if (!match) { console.error("STRICT_CSP_PREFIXES introuvable dans src/lib/csp.ts"); process.exit(2); }
const prefixes = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const strict = (p) => prefixes.some((x) => (x.endsWith("/") ? p.startsWith(x) : p === x || p.startsWith(`${x}/`)));

const manifest = JSON.parse(readFileSync(".next/prerender-manifest.json", "utf8"));
const bad = Object.keys(manifest.routes).filter((r) => !r.startsWith("/api/") && strict(r));
if (bad.length) {
  console.error("Pages pré-rendues placées en CSP stricte (elles seraient bloquées) :", bad.join(", "));
  process.exit(1);
}
console.log(`CSP : ${Object.keys(manifest.routes).length} routes pré-rendues, aucune en CSP stricte.`);
