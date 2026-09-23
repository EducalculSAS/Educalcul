import Image from "next/image";
import { Construction, PauseCircle } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import AutoReloadWhenBack from "@/components/AutoReloadWhenBack";

/**
 * Écran affiché à la place d'une page coupée depuis l'admin : maintenance du
 * site entier, ou fonctionnalité précise momentanément indisponible. Même
 * univers visuel que le site (bleu nuit, doré, apparition douce), et la page
 * se recharge d'elle-même dès que l'admin rouvre l'accès.
 */
export default function UnavailableScreen({
  kind,
  title,
  message,
  featureKey,
}: {
  kind: "maintenance" | "feature";
  title: string;
  message: string;
  featureKey?: string;
}) {
  const Icon = kind === "maintenance" ? Construction : PauseCircle;
  return (
    <main className="no-nav-offset min-h-[100dvh] flex items-center justify-center px-6 py-16 bg-[var(--greek-blue)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[var(--greek-gold)]/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl" aria-hidden="true" />

      <div className="relative z-10 max-w-lg w-full text-center animate-fade-up">
        <Image src="/logo.png" alt="Educalcul" width={150} height={86} className="mx-auto mb-10 w-auto h-20" priority />
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl flex items-center justify-center bg-[rgba(197,161,72,0.14)] border border-[rgba(197,161,72,0.35)]">
          <Icon className="w-8 h-8 text-[var(--greek-gold)]" aria-hidden="true" />
        </div>
        <h1 className="font-[family-name:var(--font-display)] font-bold text-3xl md:text-4xl text-[#f0ede8] mb-4">{title}</h1>
        <p className="text-base leading-relaxed text-[rgba(240,237,232,0.7)] mb-10 whitespace-pre-line">{message}</p>
        {kind === "feature" && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <GlassButton href="/dashboard" variant="gold">Retour à mon espace</GlassButton>
          </div>
        )}
        <p className="mt-10 text-xs text-[rgba(240,237,232,0.4)]">Cette page se rechargera d&apos;elle-même dès que ce sera de nouveau disponible.</p>
      </div>
      <AutoReloadWhenBack featureKey={kind === "maintenance" ? "maintenance" : featureKey} />
    </main>
  );
}
