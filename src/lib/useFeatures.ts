"use client";

import { useEffect, useState } from "react";

/** Fonctionnalités coupées par l'admin, pour masquer liens et boutons.
 * Une seule requête partagée par tous les composants de la page (cache 30 s). */
let shared: { at: number; promise: Promise<Set<string>> } | null = null;

function load(): Promise<Set<string>> {
  if (shared && Date.now() - shared.at < 30_000) return shared.promise;
  const promise = fetch("/api/features")
    .then((r) => (r.ok ? r.json() : { disabled: [] }))
    .then((d: { disabled?: string[] }) => new Set(d.disabled ?? []))
    .catch(() => new Set<string>());
  shared = { at: Date.now(), promise };
  return promise;
}

/** `isOn("forum")` → false si l'admin a coupé le forum (ou son parent). */
export function useFeatures() {
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    load().then((d) => alive && setDisabled(d));
    return () => {
      alive = false;
    };
  }, []);
  return { isOn: (key: string, parent?: string) => !disabled.has(key) && !(parent && disabled.has(parent)) };
}
