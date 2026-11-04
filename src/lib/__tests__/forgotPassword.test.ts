import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "@/test/fakeDb";

const db = new FakeDb();
const sent: { toEmail: string; subject: string; textPart: string; htmlPart: string }[] = [];
let mailOk = true;
let rateAllowed = true;
let knownId: string | null = "auth-1";
const ACTION_LINK = "https://project.supabase.co/auth/v1/verify?token=xyz&type=recovery";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseClient", () => ({
  supabaseAdmin: {
    from: (t: string) => db.from(t),
    rpc: async () => ({ data: knownId, error: null }),
    auth: { admin: {
      getUserById: async () => ({ data: { user: { email: "paul@example.com", user_metadata: {} } }, error: null }),
      generateLink: async () => ({ data: { properties: { action_link: ACTION_LINK } }, error: null }),
    } },
  },
}));
vi.mock("@/lib/mailer", () => ({ sendEmail: async (m: (typeof sent)[number]) => { if (!mailOk) return { success: false, error: "smtp down" }; sent.push(m); return { success: true }; } }));
vi.mock("@/lib/rateLimitAdvanced", () => ({
  rateLimitWithBackoff: async () => ({ allowed: rateAllowed }),
  RATE_LIMITS: { "auth:forgot-password": { maxAttempts: 3, windowMs: 60000 } },
}));

const call = async (body: unknown) => {
  const { POST } = await import("@/app/api/auth/forgot-password/route");
  return POST(new Request("http://localhost/api/auth/forgot-password", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": "1.2.3.4" } }));
};

beforeEach(() => {
  db.tables = {}; sent.length = 0; mailOk = true; rateAllowed = true; knownId = "auth-1";
  db.rows("users").push({ id: 1, auth_id: "auth-1", first_name: "Paul" });
});

describe("mot de passe oublié", () => {
  it("compte connu : e-mail avec le lien de récupération, valable 1 h", async () => {
    const res = await call({ email: "  Paul@Example.com " });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].toEmail).toBe("paul@example.com");
    expect(sent[0].textPart).toContain(ACTION_LINK);
    expect(sent[0].htmlPart).toContain("token=xyz");
    expect(sent[0].textPart).toContain("1h");
  });
  it("compte inconnu : même réponse, aucun e-mail (on ne révèle rien)", async () => {
    knownId = null;
    const res = await call({ email: "inconnu@example.com" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(sent).toHaveLength(0);
  });
  it("trop de demandes : même réponse, aucun nouvel e-mail", async () => {
    rateAllowed = false;
    const res = await call({ email: "paul@example.com" });
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });
  it("e-mail manquant ou invalide : 400", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ email: 42 })).status).toBe(400);
  });
  it("envoi impossible : erreur 500 claire, pas de faux succès", async () => {
    mailOk = false;
    const res = await call({ email: "paul@example.com" });
    expect(res.status).toBe(500);
  });
});
