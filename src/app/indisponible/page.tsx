import type { Metadata } from "next";
import UnavailableScreen from "@/components/UnavailableScreen";
import { getDisabledFeatures } from "@/lib/featureFlags";
import { FEATURE_BY_KEY } from "@/lib/featureCatalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Momentanément indisponible", robots: { index: false } };

export default async function UnavailablePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const feature = f ? FEATURE_BY_KEY.get(f) : undefined;
  const disabled = await getDisabledFeatures();
  const custom = feature ? disabled.get(feature.key) ?? (feature.parent ? disabled.get(feature.parent) : null) : null;
  return (
    <UnavailableScreen
      kind="feature"
      featureKey={feature?.key}
      title={feature ? `${feature.label} : momentanément indisponible` : "Momentanément indisponible"}
      message={custom || "Nous faisons une petite pause sur cette partie du site pour l'améliorer. Le reste d'Educalcul fonctionne normalement."}
    />
  );
}
