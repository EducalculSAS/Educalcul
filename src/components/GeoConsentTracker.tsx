"use client";

import { useGeoConsent } from "@/hooks/useGeoConsent";

/** Composant sans rendu — déclenche la géoloc GPS si cookies acceptés */
export default function GeoConsentTracker() {
  useGeoConsent();
  return null;
}
