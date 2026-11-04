import { describe, expect, it } from "vitest";
import { classifySource, trackablePath } from "@/lib/trafficSources";

const OWN = ["educalcul.com", "localhost"];

describe("origine des visites", () => {
  it("reconnaît les assistants IA par le site référent", () => {
    expect(classifySource("https://chatgpt.com/", null, OWN)).toBe("chatgpt");
    expect(classifySource("https://www.perplexity.ai/search/x", null, OWN)).toBe("perplexity");
    expect(classifySource("https://copilot.microsoft.com/", null, OWN)).toBe("copilot");
    expect(classifySource("https://gemini.google.com/app", null, OWN)).toBe("gemini");
    expect(classifySource("https://claude.ai/chat", null, OWN)).toBe("claude");
  });
  it("reconnaît le paramètre utm_source ajouté par les assistants", () => {
    expect(classifySource("", "chatgpt.com", OWN)).toBe("chatgpt");
    expect(classifySource("https://www.google.com/", "chatgpt.com", OWN)).toBe("chatgpt");
  });
  it("distingue moteurs, réseaux et autres sites ; ignore le site lui-même", () => {
    expect(classifySource("https://www.google.fr/", null, OWN)).toBe("google");
    expect(classifySource("https://www.bing.com/", null, OWN)).toBe("bing");
    expect(classifySource("https://www.linkedin.com/feed", null, OWN)).toBe("reseaux");
    expect(classifySource("https://blog-prof.example/maths", null, OWN)).toBe("autre:blog-prof.example");
    expect(classifySource("https://educalcul.com/offres", null, OWN)).toBeNull();
    expect(classifySource("", null, OWN)).toBeNull();
  });
  it("ne compte que les pages publiques", () => {
    expect(trackablePath("/programmes/6eme?x=1")).toBe("/programmes/6eme");
    expect(trackablePath("/")).toBe("/");
    expect(trackablePath("/calia-tuteur-ia-maths/")).toBe("/calia-tuteur-ia-maths");
    for (const p of ["/api/x", "/admin/profile", "/parent/dashboard", "/child/badges", "/suivi/abc", "/u/12", "/auth/connexion", "//evil.com", "x", 12, "/a b"]) expect(trackablePath(p), String(p)).toBeNull();
  });
});
