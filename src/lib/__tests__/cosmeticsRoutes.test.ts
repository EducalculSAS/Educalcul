import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "@/test/fakeDb";
import type { ActivityCounts } from "@/lib/cosmetics/stats";

const db = new FakeDb();
const notified: { title: string }[] = [];
let counts: ActivityCounts = { exoCount: 0, correctCount: 0, quizCount: 0, courseCount: 0, perfectQuizzes: 0, mathadorPoints: 0, minigamesCount: 0 };

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseClient", () => ({ supabaseAdmin: { from: (t: string) => db.from(t), rpc: () => db.rpc() } }));
vi.mock("@/lib/notify", () => ({ notify: async (n: { title: string }) => { notified.push(n); } }));
vi.mock("@/lib/apiAuth", () => ({
  getAuthenticatedUser: async () => ({ authId: "c-2", id: 2, role: "child" }),
  canActOnAuthId: async () => true,
}));
vi.mock("@/lib/cosmetics/stats", async (orig) => ({ ...(await orig<typeof import("@/lib/cosmetics/stats")>()), loadActivityCounts: async () => counts }));

const json = (body: unknown) => new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const FUTURE = () => new Date(Date.now() + 864e5).toISOString();

beforeEach(() => {
  db.tables = {};
  notified.length = 0;
  counts = { exoCount: 0, correctCount: 0, quizCount: 0, courseCount: 0, perfectQuizzes: 0, mathadorPoints: 0, minigamesCount: 0 };
  db.rows("subscription_plans").push({ id: 3, features: { cosmetic_borders: ["premium"], cosmetic_colors: ["premium"] } });
  db.rows("users").push(
    { id: 1, auth_id: "p-1", role: "parent", parent_id: null, equipped_border: "none", name_color: "default", login_count: 0, login_streak: 0 },
    { id: 2, auth_id: "c-2", role: "child", parent_id: 1, equipped_border: "none", name_color: "default", login_count: 20, login_streak: 15 },
  );
});

describe("POST /api/child/equip", () => {
  const equip = async (body: Record<string, unknown>) => (await import("@/app/api/child/equip/route")).POST(json({ authId: "c-2", ...body }));

  it("refuse un contour non débloqué (403) sans rien écrire", async () => {
    const res = await equip({ equipped_border: "foudre" });
    expect(res.status).toBe(403);
    expect(db.rows("users")[1].equipped_border).toBe("none");
  });

  it("refuse l'ancien contour « admin » et le titre « admin », même à un administrateur", async () => {
    expect((await equip({ equipped_border: "admin" })).status).toBe(403);
    expect((await equip({ name_color: "admin" })).status).toBe(403);
  });

  it("accepte un contour gagné par mission", async () => {
    db.rows("user_cosmetics").push({ user_id: 2, cosmetic_key: "foudre" });
    expect((await equip({ equipped_border: "foudre", name_color: "foudre" })).status).toBe(200);
    expect(db.rows("users")[1]).toMatchObject({ equipped_border: "foudre", name_color: "foudre" });
  });

  it("accepte un contour d'abonnement tant que celui du parent est actif, puis le refuse", async () => {
    db.rows("subscriptions").push({ id: 1, user_id: "p-1", plan_id: 3, status: "active", current_period_end: FUTURE() });
    expect((await equip({ equipped_border: "premium" })).status).toBe(200);
    db.rows("subscriptions")[0].status = "cancelled";
    expect((await equip({ equipped_border: "premium" })).status).toBe(403);
  });

  it("« aucun contour » est toujours accepté", async () => {
    db.rows("users")[1].equipped_border = "foudre";
    expect((await equip({ equipped_border: "none", name_color: "default" })).status).toBe(200);
    expect(db.rows("users")[1].equipped_border).toBe("none");
  });
});

describe("POST /api/child/check-badges (missions)", () => {
  const check = async () => (await import("@/app/api/child/check-badges/route")).POST(json({ authId: "c-2" }));

  it("attribue les missions accomplies, une seule fois, avec une notification", async () => {
    counts = { ...counts, exoCount: 30, courseCount: 6, quizCount: 20 };
    const res = await check();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.newCosmetics.sort()).toEqual(["aurore", "bronze"]); // aurore : 15 jours de série, 20 connexions
    expect(db.rows("user_cosmetics").map((c) => c.cosmetic_key).sort()).toEqual(["aurore", "bronze"]);
    expect(notified.filter((n) => n.title.startsWith("Mission accomplie"))).toHaveLength(2);

    notified.length = 0;
    const again = await (await check()).json();
    expect(again.newCosmetics).toEqual([]);
    expect(db.rows("user_cosmetics")).toHaveLength(2);
    expect(notified).toHaveLength(0);
  });

  it("n'attribue rien quand rien n'est accompli et renvoie l'avancement", async () => {
    counts = { ...counts, correctCount: 100 };
    db.rows("users")[1].login_streak = 0;
    db.rows("users")[1].login_count = 0;
    const body = await (await check()).json();
    expect(body.newCosmetics).toEqual([]);
    expect(body.progress.foudre).toMatchObject({ unlocked: false, met: 0, total: 1 });
    expect(db.rows("user_cosmetics")).toHaveLength(0);
  });

  it("les badges comptent pour la mission « Rubis »", async () => {
    db.rows("badges").push(...Array.from({ length: 12 }, (_, i) => ({ id: i + 1, requirement_type: "exercise_count", requirement_value: 1, name: `B${i}`, description: "", is_active: true })));
    counts = { ...counts, exoCount: 1 };
    const body = await (await check()).json();
    expect(body.awarded).toBe(12);
    expect(body.newCosmetics).toContain("rubis");
  });
});
