import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/stripe", () => ({ stripe: {}, legacyPeriodField: () => undefined }));
vi.mock("@/lib/supabaseClient", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/notify", () => ({ notify: async () => undefined }));
import { REFERRAL_BONUS_DAYS, REFERRER_BONUS_DAYS } from "@/lib/referral";

describe("parrainage", () => {
  it("offre une semaine au filleul et une semaine au parrain", () => {
    expect(REFERRAL_BONUS_DAYS).toBe(7);
    expect(REFERRER_BONUS_DAYS).toBe(7);
  });
});
