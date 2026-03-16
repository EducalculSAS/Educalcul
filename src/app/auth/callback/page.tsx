'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Traitement de la réponse...');

  useEffect(() => {
    // Handle error in hash
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1)); // remove #
      const errorDescription = params.get('error_description');
      setStatus(`Erreur: ${errorDescription?.replace(/\+/g, ' ') || 'Erreur inconnue'}`);
      // Redirect back to profile after a delay
      setTimeout(() => {
        router.push('/'); // Fallback
      }, 3000);
      return;
    }

    const handleAuth = async () => {
      // Check if session exists (Supabase client handles hash automatically on init)
      const { data: { session }, error } = await supabase.auth.getSession();

      if (session) {
        setStatus('Connexion réussie. Redirection...');
        const role = session.user.user_metadata?.role;

        let path = '/profile'; // Default
        if (role === 'admin') path = '/admin/profile';
        else if (role === 'parent') path = '/parent/profile';
        else if (role === 'child') path = '/child/profile';

        router.push(path);
      } else {
        // Wait for auth state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || session) {
            setStatus('Connexion réussie. Redirection...');
            const role = session?.user?.user_metadata?.role;

            let path = '/profile'; // Default
            if (role === 'admin') path = '/admin/profile';
            else if (role === 'parent') path = '/parent/profile';
            else if (role === 'child') path = '/child/profile';

            router.push(path);
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
