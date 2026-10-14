"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { getCatalogLevelLabel } from "@/lib/constants";

export interface CourseOption {
  id: string | number;
  title: string;
  level?: string | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Choix du cours associé : une liste de plus de 700 cours n'est pas utilisable sans recherche. On tape quelques lettres
 * (sans accents ni majuscules), la liste se réduit ; chaque ligne porte son niveau pour distinguer les cours de même titre
 * (« Développer et réduire » existe en plusieurs niveaux). Le cours déjà choisi reste toujours dans la liste.
 */
export default function CourseSelect({ value, onChange, courses, noneLabel = "Aucun", className = "" }: {
  value: string | number | null | undefined;
  onChange: (id: string) => void;
  courses: CourseOption[];
  noneLabel?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const current = value == null ? "" : String(value);

  const options = useMemo(() => {
    const q = norm(query.trim());
    const label = (c: CourseOption) => (c.level ? `${c.title} · ${getCatalogLevelLabel(c.level)}` : c.title);
    const all = [...courses]
      .map((c) => ({ id: String(c.id), label: label(c) }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
    const filtered = q ? all.filter((o) => norm(o.label).includes(q)) : all;
    // Le cours déjà associé reste sélectionnable même s'il ne correspond pas à la recherche.
    if (current && !filtered.some((o) => o.id === current)) {
      const cur = all.find((o) => o.id === current);
      if (cur) filtered.unshift(cur);
    }
    return filtered;
  }, [courses, query, current]);

  return (
    <div className={className}>
      <div className="relative mb-1.5">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Rechercher parmi ${courses.length} cours…`}
          aria-label="Rechercher un cours"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-[rgba(197,161,72,0.25)] bg-white text-sm outline-none focus:border-[var(--greek-gold)]"
        />
      </div>
      <select value={current} onChange={(e) => onChange(e.target.value)} className="w-full bg-gray-50">
        <option value="">{noneLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
      {query.trim() && options.length === 0 && <p className="text-xs text-gray-400 mt-1">Aucun cours ne correspond.</p>}
    </div>
  );
}
