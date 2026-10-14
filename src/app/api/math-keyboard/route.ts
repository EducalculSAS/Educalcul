import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";

const DEFAULT_LEVEL = "6eme";

/** Config du clavier mathématique virtuel pour un niveau scolaire (repli sur
 * le niveau par défaut si non configuré). Lu par MathInput — avant, requête
 * `math_keyboards` directe depuis le navigateur. Cache HTTP court : c'est du
 * contenu de référence qui change rarement. */
export async function GET(req: Request) {
  try {
    const level = new URL(req.url).searchParams.get("level") || DEFAULT_LEVEL;

    // « all » (forum) : un clavier complet, toutes classes confondues — pour
    // chaque onglet, la version la plus fournie parmi les niveaux.
    if (level === "all") {
      const { data: rows } = await supabaseAdmin.from("math_keyboards").select("config");
      type Tab = { id: string; rows?: unknown[][]; special?: string };
      const best = new Map<string, { tab: Tab; size: number }>();
      let style: unknown = null;
      for (const r of rows ?? []) {
        const cfg = r.config as { tabs?: Tab[]; style?: unknown } | null;
        style ??= cfg?.style ?? null;
        for (const tab of cfg?.tabs ?? []) {
          const size = tab.special ? 1 : (tab.rows ?? []).reduce((n, row) => n + row.length, 0);
          const prev = best.get(tab.id);
          if (!prev || size > prev.size) best.set(tab.id, { tab, size });
        }
      }
      const ORDER = ["abc", "num", "alg", "geo", "fct", "ens", "unites"];
      const tabs = [...best.values()]
        .map((b) => b.tab)
        .sort((a, b) => (ORDER.indexOf(a.id) + 99) % 99 - (ORDER.indexOf(b.id) + 99) % 99);
      return NextResponse.json(
        { config: tabs.length ? { tabs, ...(style ? { style } : {}) } : null },
        { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
      );
    }

    let { data } = await supabaseAdmin
      .from("math_keyboards")
      .select("config")
      .eq("level", level)
      .maybeSingle();

    if (!data?.config && level !== DEFAULT_LEVEL) {
      ({ data } = await supabaseAdmin
        .from("math_keyboards")
        .select("config")
        .eq("level", DEFAULT_LEVEL)
        .maybeSingle());
    }

    return NextResponse.json(
      { config: data?.config ?? null },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
    );
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err) || "Erreur interne") }, { status: 500 });
  }
}
