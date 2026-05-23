// Gestion locale de la waitlist (localStorage)

export interface WaitlistEntry {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  timestamp: number;
  referralCode: string;
  referrals: number;
  rewards: string[]; // Types de récompenses gagnées
  position: number;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  icon: string;
  trigger: string; // 'signup' | 'referral_1' | 'referral_3' | 'referral_5'
  badge: string;
}

export const REWARDS: Reward[] = [
  {
    id: 'early_adopter',
    name: 'Pionnnier',
    description: 'Vous étiez parmi les premiers inscrits',
    icon: '⭐',
    trigger: 'signup',
    badge: 'Pionnnier'
  },
  {
    id: 'referral_1',
    name: 'Influenceur',
    description: '1 ami invité = 1 mois gratuit',
    icon: '👥',
    trigger: 'referral_1',
    badge: 'Influenceur'
  },
  {
    id: 'referral_3',
    name: 'Ambassadeur',
    description: '3 amis invités = 3 mois gratuits',
    icon: '🚀',
    trigger: 'referral_3',
    badge: 'Ambassadeur'
  },
  {
    id: 'referral_5',
    name: 'Légende',
    description: '5 amis invités = 6 mois gratuits',
    icon: '👑',
    trigger: 'referral_5',
    badge: 'Légende'
  },
  {
    id: 'referral_10',
    name: 'Maître du Réseau',
    description: '10 amis invités = Abonnement Platinum gratuit à vie',
    icon: '💎',
    trigger: 'referral_10',
    badge: 'Maître du Réseau'
  }
];

const STORAGE_KEY = 'educalcul_waitlist';
const GLOBAL_WAITLIST_KEY = 'educalcul_global_waitlist';

// Génère un code de parrainage unique
function generateReferralCode(): string {
  return 'EDU' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Ajouter un utilisateur à la waitlist
export function addToWaitlist(email: string, firstName: string, lastName: string): WaitlistEntry {
  // Récupérer la waitlist globale
  const globalWaitlist = getGlobalWaitlist();
  
  // Vérifier si l'email existe déjà
  const existingEntry = globalWaitlist.find(entry => entry.email.toLowerCase() === email.toLowerCase());
  if (existingEntry) {
    return existingEntry;
  }

  // Créer une nouvelle entrée
  const newEntry: WaitlistEntry = {
    id: Math.random().toString(36).substr(2, 9),
    email,
    firstName,
    lastName,
    timestamp: Date.now(),
    referralCode: generateReferralCode(),
    referrals: 0,
    rewards: ['early_adopter'], // Récompense pour inscription
    position: globalWaitlist.length + 1
  };

  // Ajouter à la waitlist globale
  globalWaitlist.push(newEntry);
  localStorage.setItem(GLOBAL_WAITLIST_KEY, JSON.stringify(globalWaitlist));

  // Sauvegarder aussi localement
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntry));

  return newEntry;
}

// Récupérer le profil actuel
export function getCurrentUser(): WaitlistEntry | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  
  const entry = JSON.parse(stored) as WaitlistEntry;
  
  // Mettre à jour la position en fonction de la waitlist globale
  const globalWaitlist = getGlobalWaitlist();
  const updatedPosition = globalWaitlist.findIndex(e => e.id === entry.id) + 1;
  
  if (updatedPosition !== entry.position) {
    entry.position = updatedPosition;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  }

  return entry;
}

// Récupérer la waitlist globale
export function getGlobalWaitlist(): WaitlistEntry[] {
  const stored = localStorage.getItem(GLOBAL_WAITLIST_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Valider et ajouter un parrainage
export function addReferral(referralCode: string): { success: boolean; message: string; newReferrals?: number } {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    return { success: false, message: 'Veuillez d\'abord vous inscrire' };
  }

  const globalWaitlist = getGlobalWaitlist();
  const referrer = globalWaitlist.find(e => e.referralCode === referralCode);

  if (!referrer) {
    return { success: false, message: 'Code de parrainage invalide' };
  }

  if (referrer.id === currentUser.id) {
    return { success: false, message: 'Vous ne pouvez pas utiliser votre propre code' };
  }

  // Ajouter le parrainage
  referrer.referrals++;

  // Mettre à jour les récompenses du parrain
  const newRewards = [...referrer.rewards];
  if (referrer.referrals === 1 && !newRewards.includes('referral_1')) newRewards.push('referral_1');
  if (referrer.referrals === 3 && !newRewards.includes('referral_3')) newRewards.push('referral_3');
  if (referrer.referrals === 5 && !newRewards.includes('referral_5')) newRewards.push('referral_5');
  if (referrer.referrals === 10 && !newRewards.includes('referral_10')) newRewards.push('referral_10');

  referrer.rewards = newRewards;

  // Sauvegarder la waitlist mise à jour
  localStorage.setItem(GLOBAL_WAITLIST_KEY, JSON.stringify(globalWaitlist));

  return { 
    success: true, 
    message: `Parrainage accepté! ${referrer.firstName} a maintenant ${referrer.referrals} parrainage(s)`,
    newReferrals: referrer.referrals
  };
}

// Obtenir les récompenses débloquées
export function getUnlockedRewards(user: WaitlistEntry): Reward[] {
  return REWARDS.filter(reward => user.rewards.includes(reward.id));
}

// Obtenir les prochaines récompenses possibles
export function getNextRewards(user: WaitlistEntry): Reward[] {
  return REWARDS.filter(reward => !user.rewards.includes(reward.id));
}

// Calculer les bénéfices totaux en mois gratuits
export function calculateTotalBenefit(user: WaitlistEntry): number {
  let months = 0;
  if (user.rewards.includes('referral_1')) months += 1;
  if (user.rewards.includes('referral_3')) months += 3;
  if (user.rewards.includes('referral_5')) months += 6;
  if (user.rewards.includes('referral_10')) months = 999; // À vie
  return months;
}

// Obtenir le classement
export function getLeaderboard(): WaitlistEntry[] {
  return getGlobalWaitlist()
    .sort((a, b) => b.referrals - a.referrals)
    .slice(0, 10);
}

// Obtenir les stats globales
export function getGlobalStats() {
  const waitlist = getGlobalWaitlist();
  return {
    totalSignups: waitlist.length,
    totalReferrals: waitlist.reduce((sum, entry) => sum + entry.referrals, 0),
    topReferrer: waitlist.length > 0 
      ? waitlist.reduce((prev, current) => current.referrals > prev.referrals ? current : prev)
      : null
  };
}
