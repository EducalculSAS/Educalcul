import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { FakeDb } from "@/test/fakeDb";

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

const db = new FakeDb();
const sent: { toEmail: string; subject: string }[] = [];
const notified: { type: string }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseClient", () => ({ supabaseAdmin: { from: (t: string) => db.from(t), rpc: () => db.rpc() } }));
vi.mock("@/lib/mailer", () => ({ sendEmail: async (m: { toEmail: string; subject: string }) => { sent.push(m); return { success: true }; } }));
vi.mock("@/lib/notify", () => ({ notify: async (n: { type: string }) => { notified.push(n); } }));

const stripe = new Stripe("sk_test_dummy");
const post = async (event: unknown, opts: { badSignature?: boolean } = {}) => {
  const { POST } = await import("@/app/api/webhooks/stripe/route");
  const payload = JSON.stringify(event);
  const signature = opts.badSignature ? "t=1,v1=deadbeef" : stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_test_secret" });
  return POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: payload, headers: { "stripe-signature": signature } }));
};
const evt = (id: string, type: string, object: unknown) => ({ id, object: "event", type, api_version: "2025-02-24.acacia", created: 1, data: { object } });

beforeEach(() => {
  db.tables = {};
  db.unique = { stripe_processed_events: "event_id" };
  sent.length = 0; notified.length = 0;
  db.rows("users").push({ id: 7, auth_id: "auth-1", first_name: "Paul", email: "paul@example.com" });
  db.rows("subscription_plans").push({ id: 3, name: "Famille" });
  db.rows("subscriptions").push({ id: 1, user_id: "auth-1", plan_id: 3, stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", status: "active" });
});

describe("webhook Stripe", () => {
  it("refuse une signature invalide (400) sans rien écrire", async () => {
    const res = await post(evt("evt_bad", "invoice.payment_failed", { customer: "cus_1" }), { badSignature: true });
    expect(res.status).toBe(400);
    expect(db.rows("stripe_processed_events")).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("paiement échoué : abonnement « past_due », e-mail et notification au parent", async () => {
    const res = await post(evt("evt_1", "invoice.payment_failed", { id: "in_1", customer: "cus_1", subscription: "sub_1" }));
    expect(res.status).toBe(200);
    expect(db.rows("subscriptions")[0].status).toBe("past_due");
    expect(sent).toHaveLength(1);
    expect(sent[0].toEmail).toBe("paul@example.com");
    expect(sent[0].subject.length).toBeGreaterThan(3);
    expect(notified.map((n) => n.type)).toContain("payment_failed");
  });

  it("nouvelle API Stripe : l'abonnement est lu sous parent.subscription_details", async () => {
    await post(evt("evt_2", "invoice.payment_failed", { id: "in_2", customer: "cus_1", parent: { subscription_details: { subscription: "sub_1" } } }));
    expect(db.rows("subscriptions")[0].status).toBe("past_due");
  });

  it("le même événement livré deux fois n'est traité qu'une fois (pas de 2e e-mail)", async () => {
    const e = evt("evt_dup", "invoice.payment_failed", { id: "in_3", customer: "cus_1", subscription: "sub_1" });
    expect((await post(e)).status).toBe(200);
    const second = await post(e);
    expect(await second.json()).toMatchObject({ duplicate: true });
    expect(sent).toHaveLength(1);
  });

  it("abonnement résilié : statut « cancelled » et e-mail de fin", async () => {
    const res = await post(evt("evt_4", "customer.subscription.deleted", { id: "sub_1", object: "subscription", metadata: {} }));
    expect(res.status).toBe(200);
    expect(db.rows("subscriptions")[0].status).toBe("cancelled");
    expect(sent).toHaveLength(1);
  });

  it("rétractation : pas d'e-mail « abonnement terminé » (il a déjà été envoyé)", async () => {
    await post(evt("evt_5", "customer.subscription.deleted", { id: "sub_1", object: "subscription", metadata: { withdrawn: "true" } }));
    expect(sent).toHaveLength(0);
  });

  it("événement inconnu : accepté sans effet", async () => {
    const res = await post(evt("evt_6", "some.unknown.event", {}));
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(0);
  });
});
