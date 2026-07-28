import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();

function resolveLocal(specifier) {
  if (!specifier.startsWith("@/")) return null;
  const base = path.join(root, "src", specifier.slice(2));
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  return found ? pathToFileURL(found).href : null;
}

export async function resolve(specifier, context, nextResolve) {
  const local = resolveLocal(specifier);
  if (local) return { url: local, shortCircuit: true };
  return nextResolve(specifier, context);
}
