'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, FileText, LogIn } from 'lucide-react';
import AppLoader from '@/components/AppLoader';
import GlassButton from '@/components/ui/GlassButton';

export default function BannedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [banData, setBanData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkBanStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/auth/connexion'); return; }

        const res = await fetch('/api/auth/ban-status');
        const userData = res.ok ? await res.json() : null;

        if (!userData) { setError('Utilisateur non trouvé'); setLoading(false); return; }

        if (userData.banned) {
          setBanData({
            firstName: userData.first_name,
            lastName: userData.last_name,
            reason: userData.ban_reason || 'Votre compte a été suspendu par un administrateur.',
            banUntil: userData.ban_until,
          });
          // Force sign-out pour empêcher toute navigation après
          await supabase.auth.signOut();
        } else {
          router.push('/dashboard');
        }
      } catch (err) {
        setError('Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    checkBanStatus();
  }, [router]);

  const handleLogout = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--greek-cream)" }}>
        <div className="max-w-md text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--greek-bronze)" }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--greek-blue)" }}>Erreur</h1>
          <p style={{ color: "var(--text-muted)" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!banData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AppLoader />
      </div>
    );
  }

  const isBanPermanent = !banData.banUntil;
  const banEndDate = banData.banUntil 
    ? new Date(banData.banUntil).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex items-center justify-center p-4 py-8 w-full">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white rounded-[20px] shadow-2xl border-2 border-red-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 px-8 py-12 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10">
              <AlertTriangle className="w-16 h-16 mb-4" />
              <h1 className="text-4xl font-bold font-[family-name:var(--font-display)] mb-2">
                Compte suspendu
              </h1>
              <p className="text-red-100 text-lg">
                {banData.firstName} {banData.lastName}
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 md:p-12 space-y-8">
            {/* Reason Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-6 h-6 text-red-600" />
                <h2 className="text-xl font-bold text-gray-900">Motif de la suspension</h2>
              </div>
              <div className="p-6 rounded-xl border" style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.2)" }}>
                <p className="leading-relaxed" style={{ color: "var(--text-dark)" }}>
                  {banData.reason}
                </p>
              </div>
            </div>

            {/* Duration Section */}
            {!isBanPermanent && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-6 h-6 text-orange-600" />
                  <h2 className="text-xl font-bold text-gray-900">Durée de la suspension</h2>
                </div>
                <div className="p-6 rounded-xl border" style={{ background: "rgba(197,161,72,0.08)", borderColor: "rgba(197,161,72,0.25)" }}>
                  <p style={{ color: "var(--text-dark)" }}>
                    Votre compte sera réactivé le <strong style={{ color: "var(--greek-blue)" }}>{banEndDate}</strong>
                  </p>
                  <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                    Vous pourrez vous reconnecter à cette date.
                  </p>
                </div>
              </div>
            )}

            {isBanPermanent && (
              <div className="p-6 rounded-xl border" style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.2)" }}>
                <p className="font-medium" style={{ color: "var(--greek-blue)" }}>
                  Cette suspension est permanente.
                </p>
              </div>
            )}

            {/* Info Message */}
            <div className="p-6 rounded-xl border" style={{ background: "rgba(197,161,72,0.06)", borderColor: "rgba(197,161,72,0.2)" }}>
              <p style={{ color: "var(--text-muted)" }}>
                Si vous pensez que cette action est une erreur, contactez notre équipe de support via le formulaire de contact.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 flex gap-4 justify-between sm:justify-end border-t" style={{ background: "var(--greek-cream)", borderColor: "var(--greek-border)" }}>
            <GlassButton onClick={handleLogout} variant="navy" size="sm">
              <LogIn className="w-5 h-5" />
              Se déconnecter
            </GlassButton>
          </div>
        </div>

        {/* Contact Support Info */}
        <div className="mt-8 text-center text-gray-600">
          <p className="text-sm">
            Besoin d&apos;aide ? <a href="/contact" className="text-[var(--greek-blue)] font-bold hover:underline">Contactez-nous</a>
          </p>
        </div>
      </div>
    </div>
  );
}


