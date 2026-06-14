/**
 * Tests unitaires de cybersécurité — nettoyage anti-XSS du HTML rendu.
 *
 * Reproduit la configuration EXACTE de sanitizeHtml() de src/lib/katexLoader.ts
 * et vérifie que :
 *   - les vecteurs XSS (script, on*, javascript:, iframe…) sont neutralisés ;
 *   - le rendu légitime (KaTeX, graphiques SVG, mise en forme) est conservé.
 *
 * Lancer :  node --test tests/security-sanitizer.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";
import katex from "katex";

const { window } = new JSDOM("<!doctype html><html><body></body></html>");
const DOMPurify = createDOMPurify(window);

// Doit rester identique à src/lib/katexLoader.ts → sanitizeHtml()
function sanitize(html) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
    ADD_ATTR: ["target"],
  });
}

test("retire les balises <script>", () => {
  const out = sanitize('Bonjour<script>alert(document.cookie)</script> !');
  assert.ok(!/script/i.test(out), out);
  assert.ok(out.includes("Bonjour"));
});

test("retire les gestionnaires d'événements inline (onerror, onclick)", () => {
  const out = sanitize('<img src="x" onerror="alert(1)"><div onclick="steal()">x</div>');
  assert.ok(!/onerror/i.test(out), out);
  assert.ok(!/onclick/i.test(out), out);
});

test("neutralise les URLs javascript:", () => {
  const out = sanitize('<a href="javascript:alert(1)">clic</a>');
  assert.ok(!/javascript:/i.test(out), out);
});

test("retire les <iframe> / <object> / <embed>", () => {
  const out = sanitize('<iframe src="//evil"></iframe><object data="x"></object><embed src="x">');
  assert.ok(!/<iframe|<object|<embed/i.test(out), out);
});

test("conserve le rendu KaTeX (formule mathématique)", () => {
  const katexHtml = katex.renderToString("f(x) = x^2 + 6x + 4", { throwOnError: false });
  const out = sanitize(`<p>Voici une formule : ${katexHtml}</p>`);
  assert.ok(out.includes("katex"), "la classe katex doit survivre");
  // KaTeX émet du MathML (<math>…</math>) qui doit être préservé
  assert.ok(/<math|<span/i.test(out), out);
});

test("conserve les graphiques SVG et leurs attributs data-*", () => {
  const svg =
    '<figure class="math-graph"><svg viewBox="0 0 10 10" data-points="[[0,0],[1,1]]">' +
    '<path class="g-curve" d="M0,0 L1,1"/><circle cx="1" cy="1" r="2"/><text x="1" y="2">0</text>' +
    "</svg><figcaption>f(x)</figcaption></figure>";
  const out = sanitize(svg);
  assert.ok(out.includes("<svg"), "le svg doit survivre");
  assert.ok(out.includes("<path"), "le tracé doit survivre");
  assert.ok(out.includes("data-points"), "les data-* (interactivité) doivent survivre");
});

test("conserve la mise en forme du cours (titres, listes, tableaux, gras)", () => {
  const html =
    "<h3>Titre</h3><p><strong>important</strong> <em>note</em></p>" +
    "<ul><li>a</li></ul><table><thead><tr><th>x</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>";
  const out = sanitize(html);
  for (const tag of ["<h3", "<strong", "<em", "<ul", "<li", "<table", "<td"]) {
    assert.ok(out.includes(tag), `${tag} doit survivre — ${out}`);
  }
});

test("attaque mixte : neutralise le script mais garde la formule", () => {
  const katexHtml = katex.renderToString("\\frac{1}{2}", { throwOnError: false });
  const out = sanitize(`${katexHtml}<img src=x onerror=alert(1)><script>evil()</script>`);
  assert.ok(out.includes("katex"));
  assert.ok(!/onerror|<script/i.test(out), out);
});
