import type { Metadata } from "next";
import UnavailableScreen from "@/components/UnavailableScreen";
import { getDisabledFeatures } from "@/lib/featureFlags";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Maintenance", robots: { index: false } };

export default async function MaintenancePage() {
  const disabled = await getDisabledFeatures();
  return (
    <UnavailableScreen
      kind="maintenance"
      title="Educalcul fait peau neuve"
      message={
        disabled.get("maintenance") ||
        "Nous effectuons une courte maintenance pour améliorer le site. Tout sera de retour dans quelques instants."
      }
    />
  );
}
