import { afterEach, describe, expect, it, vi } from "vitest";
import { serverSecret } from "@/lib/serverSecret";

afterEach(() => vi.unstubAllEnvs());

describe("serverSecret", () => {
  it("utilise la clé de service quand elle existe", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE", "abc");
    expect(serverSecret()).toBe("abc");
  });
  it("lève une erreur en production si la clé manque (jamais de secret par défaut)", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => serverSecret()).toThrow();
  });
  it("accepte une valeur de développement hors production", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(serverSecret()).toBe("educalcul-dev-secret");
  });
});
