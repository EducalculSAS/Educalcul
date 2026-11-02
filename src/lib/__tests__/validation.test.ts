import { describe, expect, it } from "vitest";
import { isValidEmail, isValidUUID, escapeHtml } from "@/lib/validation";

describe("validation", () => {
  it("valide les e-mails", () => {
    expect(isValidEmail("parent@educalcul.com")).toBe(true);
    expect(isValidEmail("pas-un-mail")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
  it("valide les UUID v4", () => {
    expect(isValidUUID("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(isValidUUID("123")).toBe(false);
  });
  it("échappe le HTML", () => {
    expect(escapeHtml('<b a="x">&')).not.toMatch(/[<>"]/);
  });
});
