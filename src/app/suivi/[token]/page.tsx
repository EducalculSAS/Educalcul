import type { Metadata } from "next";
import { verifyShareToken } from "@/lib/shareToken";
import { buildBulletin } from "@/lib/bulletin";
import BulletinView from "@/components/bulletin/BulletinView";
import PrintButton from "@/components/bulletin/PrintButton";

// Lien privé : jamais indexé, jamais mis en cache.
export const metadata: Metadata = { title: "Suivi de l'élève · Educalcul", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SharedFollowUpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const childId = await verifyShareToken(decodeURIComponent(token));
  const bulletin = childId ? await buildBulletin(childId) : null;

  if (!bulletin) {
    return (
      <main className="min-h-screen bg-[var(--greek-cream)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] mb-2">Lien expiré ou révoqué</h1>
          <p className="text-gray-600">Ce lien de suivi n&apos;est plus valable. Demandez-en un nouveau au parent de l&apos;élève.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--greek-cream)] py-10 px-4">
      <style>{`@media print { .no-print { display: none !important; } .bulletin-sheet { border: none !important; box-shadow: none !important; max-width: none !important; padding: 0 !important; } @page { margin: 14mm; } }`}</style>
      <div className="no-print max-w-[820px] mx-auto mb-4 flex items-center justify-between gap-3 text-sm text-gray-500">
        <span>Suivi partagé par le parent de {bulletin.child.firstName} · lecture seule</span>
        <PrintButton />
      </div>
      <BulletinView bulletin={bulletin} shared />
    </main>
  );
}
