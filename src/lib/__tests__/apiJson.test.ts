import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/apiJson";

const req = (body: string) => new Request("http://localhost/x", { method: "POST", body });

describe("readJsonBody", () => {
  it("lit un corps JSON valide", async () => {
    expect(await readJsonBody(req('{"a":1}'))).toEqual({ a: 1 });
  });
  it("renvoie {} pour un corps vide, tronqué ou invalide (jamais d'exception)", async () => {
    expect(await readJsonBody(req(""))).toEqual({});
    expect(await readJsonBody(req('{"a":'))).toEqual({});
    expect(await readJsonBody(req("pas du json"))).toEqual({});
  });
  it("renvoie {} pour null", async () => {
    expect(await readJsonBody(req("null"))).toEqual({});
  });
});
