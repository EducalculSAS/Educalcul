import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "@/test/fakeDb";

const db = new FakeDb();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseClient", () => ({ supabaseAdmin: { from: (t: string) => db.from(t), rpc: () => db.rpc() } }));

const user = (id: number) => db.rows("users").find((u) => u.id === id)!;

beforeEach(() => {
  db.tables = {};
  db.rows("subscription_plans").push({ id: 3, features: { cosmetic_borders: ["flamme", "premium"], cosmetic_colors: ["flame", "premium"] } });
  db.rows("users").push(
    { id: 1, auth_id: "p-1", role: "parent", parent_id: null, equipped_border: "flamme", name_color: "flame" },
    { id: 2, auth_id: "c-2", role: "child", parent_id: 1, equipped_border: "premium", name_color: "premium" },
    { id: 3, auth_id: "c-3", role: "child", parent_id: 1, equipped_border: "flamme", name_color: "default" },
    { id: 9, auth_id: "a-9", role: "admin", parent_id: null, equipped_border: "elite", name_color: "elite" },
  );
});

describe("contours et couleurs de nom quand l'abonnement s'arrête", () => {
  it("abonnement actif : rien n'est retiré (parent et enfants)", async () => {
    db.rows("subscriptions").push({ id: 1, user_id: "p-1", plan_id: 3, status: "active", current_period_end: new Date(Date.now() + 864e5).toISOString() });
    const { reconcileCosmeticsForFamily } = await import("@/lib/cosmeticEntitlements");
    expect(await reconcileCosmeticsForFamily("p-1")).toBe(0);
    expect(user(1).equipped_border).toBe("flamme");
    expect(user(2).name_color).toBe("premium");
  });

  it("abonnement résilié : le parent ET ses enfants perdent contour et couleur", async () => {
    db.rows("subscriptions").push({ id: 1, user_id: "p-1", plan_id: 3, status: "cancelled" });
    const { reconcileCosmeticsForFamily } = await import("@/lib/cosmeticEntitlements");
    expect(await reconcileCosmeticsForFamily("p-1")).toBe(3);
    for (const id of [1, 2, 3]) {
      expect(user(id).equipped_border).toBe("none");
      expect(user(id).name_color).toBe("default");
    }
  });

  it("un cosmétique gagné (hors abonnement) reste porté", async () => {
    db.rows("subscriptions").push({ id: 1, user_id: "p-1", plan_id: 3, status: "cancelled" });
    db.rows("user_cosmetics").push({ user_id: 3, cosmetic_key: "flamme" });
    const { reconcileCosmeticsForFamily } = await import("@/lib/cosmeticEntitlements");
    await reconcileCosmeticsForFamily("p-1");
    expect(user(3).equipped_border).toBe("flamme");
    expect(user(2).equipped_border).toBe("none");
  });

  it("changement de formule : seul ce que la nouvelle formule n'inclut plus est retiré", async () => {
    db.rows("subscription_plans").push({ id: 4, features: { cosmetic_borders: ["premium"], cosmetic_colors: ["premium"] } });
    db.rows("subscriptions").push({ id: 1, user_id: "p-1", plan_id: 4, status: "active" });
    const { reconcileCosmeticsForFamily } = await import("@/lib/cosmeticEntitlements");
    await reconcileCosmeticsForFamily("p-1");
    expect(user(1).equipped_border).toBe("none");
    expect(user(1).name_color).toBe("default");
    expect(user(2).equipped_border).toBe("premium");
    expect(user(2).name_color).toBe("premium");
  });

  it("un administrateur n'est jamais touché", async () => {
    const { reconcileCosmeticsForUser } = await import("@/lib/cosmeticEntitlements");
    expect(await reconcileCosmeticsForUser(user(9) as never)).toEqual({});
    expect(user(9).equipped_border).toBe("elite");
  });

  it("l'abonnement qui prend fin via le webhook Stripe retire aussi les cosmétiques", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    vi.doMock("@/lib/mailer", () => ({ sendEmail: async () => ({ success: true }) }));
    vi.doMock("@/lib/notify", () => ({ notify: async () => undefined }));
    db.unique = { stripe_processed_events: "event_id" };
    db.rows("subscriptions").push({ id: 1, user_id: "p-1", plan_id: 3, stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1", status: "active" });
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe("sk_test_dummy");
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const payload = JSON.stringify({ id: "evt_end", object: "event", type: "customer.subscription.deleted", api_version: "2025-02-24.acacia", created: 1, data: { object: { id: "sub_1", object: "subscription", metadata: {} } } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
    const res = await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
    expect(res.status).toBe(200);
    expect(db.rows("subscriptions")[0].status).toBe("cancelled");
    expect(user(1).equipped_border).toBe("none");
    expect(user(2).name_color).toBe("default");
  });
});
