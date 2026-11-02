'use client';

import type { Loose } from "@/types/loose";
import { useEffect } from "react";
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { resolveAuthDestination } from '@/lib/authRedirect';
import AppLoader from '@/components/AppLoader';
import { getSignupSession, patchSignupSession } from '@/lib/signupSession';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Erreur OAuth dans le hash
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDescription = params.get('error_description') || 'Erreur inconnue';
      router.push(`/auth/connexion?error=oauth&message=${encodeURIComponent(errorDescription.replace(/\+/g, ' '))}`);
      return;
    }

    // La résiliation de l'écoute d'authentification doit remonter jusqu'au nettoyage de l'effet : renvoyée depuis une fonction async,
    // elle se perdait dans une promesse oubliée et l'abonnement restait actif après avoir quitté la page.
    let unsubscribe: (() => void) | null = null;
    const handleAuth = async (): Promise<void> => {
      // Flow OAuth Google maison : tokens transmis dans le hash par /api/auth/google/callback
      if (hash && hash.includes('access_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          history.replaceState(null, '', window.location.pathname);
          const { data: { session } } = await supabase.auth.setSession({ access_token, refresh_token });
          if (session) { handleSession(session); return; }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Attendre que la session arrive (email confirmation, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
            handleSession(session);
          }
        });
        unsubscribe = () => subscription.unsubscribe();
        return;
      }

      handleSession(session);
    };

    const handleSession = async (session: Loose) => {

      // Méthode unique : resolveAuthDestination gère ban + role + first_name
      const dest = await resolveAuthDestination(session?.access_token);

      if (dest === 'banned') {
        router.push('/auth/banned');
        return;
      }

      // Compte complet existant → dashboard
      if (dest !== 'no_account' && dest !== 'incomplete') {
        await patchSignupSession({ mode: null, pendingRole: null });
        router.push(dest);
        return;
      }

      // Pas de compte ou compte incomplet → flow inscription Google
      const s = await getSignupSession();
      const authIntent = s.authIntent;
      const signupMode = s.mode;
      const pendingRole = s.pendingRole;
      await patchSignupSession({ authIntent: null });

      // Préparer les données Google pour complete-google
      const googleSignupData = {
        role: pendingRole || 'parent',
        firstName: session.user.user_metadata?.given_name || session.user.user_metadata?.full_name?.split(' ')[0] || '',
        lastName: session.user.user_metadata?.family_name || session.user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
        email: session.user.email || '',
        password: '', childUsername: null, childAge: null,
        parentEmail: null, referralCode: null, referralStatus: 'idle',
      };

      // Dans tous les cas (login ou signup), si pas de compte → inscription
      if (authIntent === 'login' || signupMode === 'google' || dest === 'incomplete') {
        await patchSignupSession({ data: googleSignupData, mode: 'google', pendingRole: pendingRole || 'parent' });
        router.push('/auth/inscription/complete-google');
        return;
      }

      // Fallback : déconnecter et erreur
      await supabase.auth.signOut();
      router.push('/auth/connexion?error=no_account');
    };

    handleAuth();
    return () => { unsubscribe?.(); };
  }, [router]);

  return <AppLoader />;
}
