"use client";

import { Printer } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

/** Ouvre la fenêtre d'impression du navigateur : « Enregistrer au format PDF ». */
export default function PrintButton() {
  return (
    <GlassButton onClick={() => window.print()} variant="navy" size="sm">
      <Printer className="w-4 h-4" /> Télécharger en PDF
    </GlassButton>
  );
}
