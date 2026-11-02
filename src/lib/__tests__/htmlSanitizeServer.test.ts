import { describe, expect, it } from "vitest";
import { sanitizeHtmlServer } from "@/lib/htmlSanitizeServer";

describe("sanitizeHtmlServer", () => {
  it("laisse passer le HTML de contenu courant", () => {
    const html = '<p>Un <strong>nombre</strong> <em>premier</em></p><ul><li>2</li><li>3</li></ul>';
    expect(sanitizeHtmlServer(html)).toBe(html);
  });
  it("retire les scripts avec leur contenu", () => {
    expect(sanitizeHtmlServer("<p>a</p><script>alert(1)</script>")).toBe("<p>a</p>");
  });
  it("retire les gestionnaires d'événements, même sans espace avant", () => {
    const out = sanitizeHtmlServer("<img/src=x/onerror=alert(1)>");
    expect(out.toLowerCase()).not.toMatch(/\sonerror\s*=/); // « onerror » ne doit pas rester un attribut
  });
  it("refuse les adresses javascript: (même codées)", () => {
    expect(sanitizeHtmlServer('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript:");
    expect(sanitizeHtmlServer('<a href="java&#x73;cript:alert(1)">x</a>')).not.toMatch(/href=/);
  });
  it("conserve les figures SVG (balises auto-fermantes)", () => {
    const svg = '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/><circle cx="5" cy="5" r="2"/></svg>';
    expect(sanitizeHtmlServer(svg)).toBe(svg);
  });
  it("retire les balises non autorisées (iframe, object)", () => {
    expect(sanitizeHtmlServer('<iframe src="https://x"></iframe><p>ok</p>')).toBe("<p>ok</p>");
  });
});
