'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    const verifySession = async () => {
      try {
        const response = await fetch('/api/verify-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (data.status === 'success') {
          setStatus('success');
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
      }
    };

    verifySession();
  }, [sessionId]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-16 h-16 text-[var(--greek-blue)] animate-spin mb-4" />
        <h2 className="text-2xl font-bold text-gray-700">Vérification du paiement...</h2>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Une erreur est survenue</h2>
        <p className="text-gray-600 mb-6">Nous n'avons pas pu vérifier votre paiement. Veuillez contacter le support si vous avez été débité.</p>
        <Link 
          href="/parent/subscription" 
          className="px-6 py-3 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
        >
          Retour aux abonnements
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <CheckCircle className="w-20 h-20 text-green-500 mb-6" />
      <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2">Paiement réussi !</h1>
      <p className="text-xl text-gray-600 mb-8">Merci pour votre abonnement. Votre compte a été mis à jour.</p>
      
      <div className="flex gap-4">
        <Link 
          href="/parent/dashboard" 
          className="px-6 py-3 bg-[var(--greek-blue)] text-white rounded-lg hover:bg-opacity-90 transition-colors font-semibold"
        >
          Aller au tableau de bord
        </Link>
        <Link 
          href="/parent/subscription" 
          className="px-6 py-3 border border-[rgba(197,161,72,0.25)] text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Voir mon abonnement
        </Link>
      </div>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <Suspense fallback={
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="w-12 h-12 animate-spin text-gray-400" />
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
