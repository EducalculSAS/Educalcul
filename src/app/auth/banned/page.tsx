'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock, FileText, LogIn } from 'lucide-react';
import MathLoader from '@/components/MathLoader';

export default function BannedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [banData, setBanData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkBanStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Not logged in, redirect to login
          router.push('/auth/connexion');
          return;
        }

        // Check if user is banned
        const { data: userData } = await supabase
          .from('users')
          .select('id, status, first_name, last_name, ban_reason, ban_until')
          .eq('auth_id', user.id)
          .single();

        if (!userData) {
          setError('Utilisateur non trouvé');
          setLoading(false);
          return;
        }

        if (userData.status === 'inactive' || userData.ban_reason) {
          // User is banned
          setBanData({
            firstName: userData.first_name,
            lastName: userData.last_name,
            reason: userData.ban_reason || 'Votre compte a été suspendu par un administrateur.',
            banUntil: userData.ban_until,
          });
        } else {
          // User is not banned, redirect to dashboard
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Error checking ban status:', err);
        setError('Une erreur est survenue');
      } finally {
        setLoading(false);
      }
    };

    checkBanStatus();
  }, [router]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-700 mb-2">Erreur</h1>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!banData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <MathLoader />
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
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
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
              <div className="bg-red-50 border-l-4 border-red-600 p-6 rounded-lg">
                <p className="text-gray-800 leading-relaxed">
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
                <div className="bg-orange-50 border border-orange-200 p-6 rounded-lg">
                  <p className="text-gray-700">
                    Votre compte sera réactivé le <strong>{banEndDate}</strong>
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Vous pourrez vous reconnecter à cette date.
                  </p>
                </div>
              </div>
            )}

            {isBanPermanent && (
              <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
                <p className="text-red-800 font-medium">
                  ⚠️ Cette suspension est permanente.
                </p>
              </div>
            )}

            {/* Info Message */}
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
              <p className="text-blue-800">
                Si vous pensez que cette action est une erreur, contactez notre équipe de support via le formulaire de contact.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-8 py-6 flex gap-4 justify-between sm:justify-end">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-[var(--greek-blue)] text-white font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
            >
              <LogIn className="w-5 h-5" />
              Se déconnecter
            </button>
          </div>
        </div>

        {/* Contact Support Info */}
        <div className="mt-8 text-center text-gray-600">
          <p className="text-sm">
            Besoin d'aide ? <a href="/contact" className="text-[var(--greek-blue)] font-bold hover:underline">Contactez-nous</a>
          </p>
        </div>
      </div>
    </div>
  );
}
