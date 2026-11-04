import Link from "next/link";
import { ChevronRight } from "lucide-react";
import JsonLd from "@/components/JsonLd";

const BASE = "https://educalcul.com";

export interface Crumb {
  name: string;
  href: string;
}

/** Fil d'Ariane visible + données structurées BreadcrumbList (mêmes libellés, mêmes liens). */
export default function Breadcrumbs({ items, tone = "light" }: { items: Crumb[]; tone?: "light" | "dark" }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${BASE}${c.href === "/" ? "" : c.href}` })),
  };
  const muted = tone === "light" ? "text-white/60 hover:text-white" : "text-gray-500 hover:text-[var(--greek-blue)]";
  const current = tone === "light" ? "text-white" : "text-[var(--greek-blue)]";
  return (
    <>
      <JsonLd data={data} />
      <nav aria-label="Fil d'Ariane" className="text-sm">
        <ol className="flex flex-wrap items-center justify-center gap-1.5">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={c.href} className="flex items-center gap-1.5">
                {last ? (
                  <span aria-current="page" className={`font-semibold ${current}`}>{c.name}</span>
                ) : (
                  <Link href={c.href} className={`transition-colors ${muted}`}>{c.name}</Link>
                )}
                {!last && <ChevronRight className={`w-3.5 h-3.5 ${tone === "light" ? "text-white/40" : "text-gray-400"}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
