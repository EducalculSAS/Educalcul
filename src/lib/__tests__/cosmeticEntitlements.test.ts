import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "@/test/fakeDb";
import { planGrants, resolveUnlocked } from "@/lib/cosmetics/entitlements";

const db = new FakeDb();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseClient", () => ({ supabaseAdmin: { from: (t: string) => db.from(t), rpc: () => db.rpc() } }));

const user = (id: number) => db.rows("users").find((u) => u.id === id)!;
const FUTURE = () => new Date(Date.now() + 864e5).toISOString();

describe("règle de droits (fonction pure)", () => {
  it("toujours : aucun contour et couleur par défaut", () => {
    const u = resolveUnlocked({ missionIds: [] });
    expect([...u.borders]).toEqual(["none"]);
    expect([...u.colors]).toEqual(["default"]);
  });

  it("missions + formule s'additionnent ; seule la formule disparaît avec l'abonnement", () => {
    const features = { cosmetic_borders: ["flamme", "premium"], cosmetic_colors: ["flame", "premium"] };
    const avec = resolveUnlocked({ missionIds: ["bronze"], planFeatures: features });
    expect([...avec.borders].sort()).toEqual(["bronze", "flamme", "none", "premium"]);
    const sans = resolveUnlocked({ missionIds: ["bronze"], planFeatures: null });
    expect([...sans.borders].sort()).toEqual(["bronze", "none"]);
    expect([...sans.colors].sort()).toEqual(["bronze", "default"]);
  });

  it("une formule ne peut donner que ce que le catalogue autorise (jamais « admin », jamais une mission)", () => {
    const g = planGrants({ cosmetic_borders: ["admin", "foudre", "premium", 12], cosmetic_colors: ["admin", "rubis", "premium"] }, 1);
    expect(g).toEqual({ borders: ["premium"], colors: ["premium"] });
  });

  it("repli historique par numéro de formule quand les caractéristiques ne listent rien", () => {
    expect(planGrants({}, 3).borders).toEqual(["famille", "flamme"]);
    expect(planGrants(null, 999)).toEqual({ borders: [], colors: [] });
  });

  it("Brasier : donné par une mission (à vie) ET par l'abonnement (tant qu'il dure)", () => {
    const planOnly = resolveUnlocked({ missionIds: [], planFeatures: { cosmetic_borders: ["flamme"], cosmetic_colors: ["flame"] } });
    expect(planOnly.borders.has("flamme")).toBe(true);
    const missionOnly = resolveUnlocked({ missionIds: ["flamme"] });
    expect(missionOnly.borders.has("flamme")).toBe(true);
    expect(missionOnly.colors.has("flame")).toBe(true);
    expect(resolveUnlocked({ missionIds: [] }).borders.has("flamme")).toBe(false);
  });
});

beforeEach(() => {
  db.tables = {};
  db.rows("subscription_plans").push({ id: 3, features: { cosmetic_borders: ["flamme", "premium"], cosmetic_colors: ["flame", "premium"] } });
  db.rows("users").push(
    { id: 1, auth_id: "p-1", role: "parent", parent_id: null, equipped_border: "flamme", name_color: "flame" },
    { id: 2, auth_id: "c-2", role: "child", parent_id: 1, equipped_border: "premium", name_color: "premium" },
    { id: 3, auth_id: "c-3", role: "child", parent_id: 1, equipped_border: "flamme", name_color: "default" },
    { id: 9, auth_id: "a-9", role: "admin", parent_id: null, equipped_border: "admin", name_color: "admin" },
  );
});

describe("quand l'abonnement s'arrête", () => {
  it("abonnement actif : rien n'est retiré (parent et enfants)", async () => {
    db.rows("subscriptions").push({ id: 1, user_id: "p-1", plan_id: 3, status: "active", current_period_end: FUTURE() });
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

  it("une mission accomplie reste portée (le Brasier gagné à la série ne part pas)", async () => {
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
});

describe("contour des administrateurs", () => {
  it("règle pure : un administrateur n'a qu'un contour, « Égide » ; les autres ne l'ont jamais", () => {
    const admin = resolveUnlocked({ missionIds: ["bronze"], planFeatures: { cosmetic_borders: ["premium"] }, isAdmin: true });
    expect([...admin.borders]).toEqual(["admin"]);
    expect(admin.colors.has("bronze")).toBe(true); // les titres suivent la règle commune
    const child = resolveUnlocked({ missionIds: ["bronze"], planFeatures: { cosmetic_borders: ["premium", "admin"] } });
    expect(child.borders.has("admin")).toBe(false);
  });

  it("un administrateur qui porte un autre contour est remis sur « Égide »", async () => {
    user(9).equipped_border = "rubis";
    db.rows("user_cosmetics").push({ user_id: 9, cosmetic_key: "rubis" });
    const { reconcileCosmeticsForUser } = await import("@/lib/cosmeticEntitlements");
    expect((await reconcileCosmeticsForUser(user(9) as never)).border).toBe("rubis");
    expect(user(9).equipped_border).toBe("admin");
  });

  it("un administrateur sans contour reçoit « Égide »", async () => {
    user(9).equipped_border = "none";
    user(9).name_color = "default";
    const { reconcileCosmeticsForUser } = await import("@/lib/cosmeticEntitlements");
    await reconcileCosmeticsForUser(user(9) as never);
    expect(user(9).equipped_border).toBe("admin");
  });

  it("un enfant qui porterait « Égide » le perd", async () => {
    user(2).equipped_border = "admin";
    const { reconcileCosmeticsForUser } = await import("@/lib/cosmeticEntitlements");
    await reconcileCosmeticsForUser(user(2) as never);
    expect(user(2).equipped_border).toBe("none");
  });

  it("le titre « admin » n'existe plus : retiré", async () => {
    const { reconcileCosmeticsForUser } = await import("@/lib/cosmeticEntitlements");
    expect((await reconcileCosmeticsForUser(user(9) as never)).color).toBe("admin");
    expect(user(9).name_color).toBe("default");
    expect(user(9).equipped_border).toBe("admin");
  });

  it("une clé inconnue du catalogue ne peut jamais être portée, même avec un abonnement", async () => {
    db.rows("subscriptions").push({ id: 1, user_id: "p-1", plan_id: 3, status: "active", current_period_end: FUTURE() });
    user(1).equipped_border = "inconnu";
    const { reconcileCosmeticsForUser } = await import("@/lib/cosmeticEntitlements");
    expect((await reconcileCosmeticsForUser(user(1) as never)).border).toBe("inconnu");
    expect(user(1).equipped_border).toBe("none");
  });
});

describe("l'abonnement qui prend fin par Stripe", () => {
  it("le webhook retire aussi les cosmétiques", async () => {
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
