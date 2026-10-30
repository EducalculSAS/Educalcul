"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SUBJECT_AREAS } from "@/lib/subjectAreas";

let cached: string[] | null = null;

/** Liste des domaines modifiable par l'admin : les défauts s'affichent tout de suite, puis la liste enregistrée. */
export function useSubjectAreas() {
  const [areas, setAreasState] = useState<string[]>(cached ?? DEFAULT_SUBJECT_AREAS);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    fetch("/api/admin/subject-areas")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { areas?: string[] } | null) => {
        if (alive && data?.areas?.length) {
          cached = data.areas;
          setAreasState(data.areas);
        }
      })
      .catch(() => {
        // Défauts conservés.
      });
    return () => {
      alive = false;
    };
  }, []);

  const setAreas = useCallback((next: string[]) => {
    cached = next;
    setAreasState(next);
  }, []);

  return { areas, setAreas };
}
