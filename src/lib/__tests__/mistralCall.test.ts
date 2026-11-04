import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.MISTRAL_API_KEY = "test-key";
process.env.MISTRAL_MODEL = "test-model";
process.env.MISTRAL_FALLBACK_MODEL = "";

vi.mock("server-only", () => ({}));

const reply = (content: unknown, finish = "stop") => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: finish }] }), { status: 200 });
let calls: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
const stub = (...responses: Response[]) => {
  calls = [];
  const queue = [...responses];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
    return queue.shift() ?? new Response("épuisé", { status: 500 });
  }));
};

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("callMistral (réseau simulé)", () => {
  it("envoie la clé, le modèle et les messages, et renvoie le texte", async () => {
    stub(reply("  Bonjour !  "));
    const { callMistral } = await import("@/lib/llmCore");
    const out = await callMistral([{ role: "user", content: "Salut" }], 0.2, 100);
    expect(out).toBe("Bonjour !");
    expect(calls[0].url).toContain("mistral.ai");
    expect(calls[0].auth).toBe("Bearer test-key");
    expect(calls[0].body.model).toBe("test-model");
    expect(JSON.stringify(calls[0].body.messages)).toContain("Salut");
  });

  it("lit une réponse en morceaux de contenu", async () => {
    stub(reply([{ type: "text", text: "a" }, { type: "text", text: "b" }]));
    const { callMistral } = await import("@/lib/llmCore");
    expect(await callMistral([{ role: "user", content: "x" }])).toBe("ab");
  });

  it("réponse tronquée (max_tokens) : erreur explicite", async () => {
    stub(reply("début de réponse", "length"));
    const { callMistral } = await import("@/lib/llmCore");
    await expect(callMistral([{ role: "user", content: "x" }], 0.2, 5)).rejects.toThrow(/tronquée/);
  });

  it("429 puis succès : une nouvelle tentative réussit", async () => {
    stub(new Response("trop vite", { status: 429 }), reply("ok après attente"));
    const { callMistral } = await import("@/lib/llmCore");
    const pending = callMistral([{ role: "user", content: "x" }]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toBe("ok après attente");
  });

  it("panne durable : message clair, jamais le détail brut du fournisseur", async () => {
    stub(new Response("secret interne du fournisseur", { status: 500 }), new Response("encore", { status: 500 }), new Response("encore", { status: 500 }), new Response("encore", { status: 500 }));
    const { callMistral } = await import("@/lib/llmCore");
    const pending = callMistral([{ role: "user", content: "x" }]).catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(20000);
    const err = (await pending) as Error;
    expect(err.message).toMatch(/indisponible/);
    expect(err.message).not.toContain("secret interne");
  });
});
