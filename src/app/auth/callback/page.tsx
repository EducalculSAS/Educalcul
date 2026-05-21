'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getSiteUrl } from '../../../lib/siteUrl';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Traitement de la réponse...');

  useEffect(() => {
    // Handle error in hash
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1)); // remove #
      const errorDescription = params.get('error_description');
      setTimeout(() => {
        setStatus(`Erreur: ${errorDescription?.replace(/\+/g, ' ') || 'Erreur inconnue'}`);
      }, 0);
      // Redirect back to home after a delay
      setTimeout(() => {
        const siteUrl = getSiteUrl();
        router.push(siteUrl ? `${siteUrl}/` : '/'); // Fallback
      }, 3000);
      return;
    }

    const handleAuth = async () => {
      // Check if session exists (Supabase client handles hash automatically on init)
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setStatus('Authentification réussie. Redirection...');

        // Check if this is a signup flow (Google)
        const signupMode = sessionStorage.getItem('educalcul_signup_mode');
        const pendingRole = sessionStorage.getItem('educalcul_pending_role');

        if (signupMode === 'google' && pendingRole) {
          // Create minimal signup data for Google signup
          const googleSignupData = {
            role: pendingRole,
            firstName: session.user.user_metadata?.full_name?.split(' ')[0] || '',
            lastName: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
            email: session.user.email || '',
            password: '',
            childUsername: null,
            childAge: null,
            parentEmail: null,
            referralCode: null,
            referralStatus: 'idle',
          };
          sessionStorage.setItem('educalcul_signup_data', JSON.stringify(googleSignupData));
          router.push('/auth/inscription/select-plan');
        } else {
          // Normal login - redirect to dashboard
          router.push('/dashboard');
        }
      } else {
        // Wait for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || session) {
            setStatus('Authentification réussie. Redirection...');
            
            const signupMode = sessionStorage.getItem('educalcul_signup_mode');
            const pendingRole = sessionStorage.getItem('educalcul_pending_role');

            if (signupMode === 'google' && pendingRole && session) {
              const googleSignupData = {
                role: pendingRole,
                firstName: session.user.user_metadata?.full_name?.split(' ')[0] || '',
                lastName: session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
                email: session.user.email || '',
                password: '',
                childUsername: null,
                childAge: null,
                parentEmail: null,
                referralCode: null,
                referralStatus: 'idle',
              };
              sessionStorage.setItem('educalcul_signup_data', JSON.stringify(googleSignupData));
              router.push('/auth/inscription/select-plan');
            } else {
              router.push('/dashboard');
            }
          }
        });
        return () => subscription.unsubscribe();
      }
    };

    handleAuth();
  }, [router]);

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-xl text-center">
      <h2 className="text-2xl font-bold mb-4 text-[var(--greek-blue)]">Authentification</h2>
      <p className="text-gray-600 mb-4">{status}</p>
      <div className="flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--greek-blue)]"></div>
      </div>
    </div>
  );
}
