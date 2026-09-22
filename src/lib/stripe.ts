// Garde-fou : ce module manipule une clé secrète. Importé par erreur depuis
// un composant client, la COMPILATION échoue au lieu d'exposer la clé dans
// le bundle du navigateur.
import "server-only";
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia' as any,
  typescript: true,
});
