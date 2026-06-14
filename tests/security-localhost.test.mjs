/**
 * Tests d'intégration de cybersécurité contre le serveur local (localhost:3000).
 * Démarre d'abord le serveur :  npm run dev
 * Puis lance :  node --test tests/security-localhost.test.mjs
 *
 * Vérifie :
 *   - l'authentification est exigée sur les routes /api/admin/* (middleware) ;
 *   - les routes IA (qui consomment des crédits) sont protégées ;
 *   - les en-têtes de sécurité sont présents ;
 *   - la validation des entrées rejette les valeurs invalides (pas de 500).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL || "http://localhost:3000";

async function req(path, init = {}) {
  return fetch(`${BASE}${path}`, init);
}

test("GET /api/admin/users sans token → 401", async () => {
  const r = await req("/api/admin/users");
  assert.equal(r.status, 401);
});

test("POST /api/admin/ai-edit sans token → 401 (protège les crédits IA)", async () => {
  const r = await req("/api/admin/ai-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "lesson", instruction: "x", content: { id: "1" } }),
  });
  assert.equal(r.status, 401);
});

test("POST /api/admin/upload sans token → 401", async () => {
  const r = await req("/api/admin/upload", { method: "POST" });
  assert.equal(r.status, 401);
});

test("token Bearer invalide → 401 (pas de contournement)", async () => {
  const r = await req("/api/admin/users", {
    headers: { Authorization: "Bearer not.a.real.token" },
  });
  assert.equal(r.status, 401);
});

test("en-têtes de sécurité présents sur /", async () => {
  const r = await req("/");
  assert.match(r.headers.get("content-security-policy") || "", /default-src 'self'/);
  assert.ok(r.headers.get("strict-transport-security"), "HSTS manquant");
  assert.equal(r.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("validation d'entrée : /api/child/folders?type=invalide → 400 (pas 500)", async () => {
  const r = await req("/api/child/folders?type=__pwn__");
  assert.equal(r.status, 400);
});

test("injection dans un paramètre numérique ne provoque pas d'erreur serveur (pas de 500)", async () => {
  const r = await req("/api/child/folders?type=course&parent_id=1;DROP%20TABLE%20users");
  assert.notEqual(r.status, 500);
});

test("la page d'accueil répond (smoke test)", async () => {
  const r = await req("/");
  assert.equal(r.status, 200);
});
