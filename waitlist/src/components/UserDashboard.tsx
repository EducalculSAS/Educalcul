import React, { useState, useEffect } from 'react';
import { Copy, Check, Gift, Users, LogOut } from 'lucide-react';
import {
  getCurrentUser,
  addReferral,
  getUnlockedRewards,
  getNextRewards,
  calculateTotalBenefit,
  WaitlistEntry,
  Reward
} from '../lib/waitlist';

interface UserDashboardProps {
  userEmail: string;
  onLogout: () => void;
}

export default function UserDashboard({ userEmail, onLogout }: UserDashboardProps) {
  const [user, setUser] = useState<WaitlistEntry | null>(null);
  const [unlockedRewards, setUnlockedRewards] = useState<Reward[]>([]);
  const [nextRewards, setNextRewards] = useState<Reward[]>([]);
  const [referralCode, setReferralCode] = useState('');
  const [referralMessage, setReferralMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setUnlockedRewards(getUnlockedRewards(currentUser));
      setNextRewards(getNextRewards(currentUser));
    }
  }, []);

  const handleCopyCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddReferral = (e: React.FormEvent) => {
    e.preventDefault();
    const result = addReferral(referralCode);
    setReferralMessage(result.message);
    if (result.success) {
      setReferralCode('');
      const updatedUser = getCurrentUser();
      if (updatedUser) {
        setUser(updatedUser);
        setUnlockedRewards(getUnlockedRewards(updatedUser));
        setNextRewards(getNextRewards(updatedUser));
      }
      setTimeout(() => { setReferralMessage(''); setShowReferralForm(false); }, 3000);
    }
  };

  const totalBenefit = user ? calculateTotalBenefit(user) : 0;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="bg-[var(--greek-blue)] text-white p-8 rounded-2xl mb-8 shadow-lg">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold mb-1">
              {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-white/70">{user?.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl transition text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Position', value: `#${user?.position}` },
            { label: 'Parrainages', value: user?.referrals ?? 0 },
            { label: 'Mois gratuits', value: totalBenefit === 999 ? 'Vie' : totalBenefit },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
              <p className="text-white/60 text-xs uppercase tracking-widest mb-1">{s.label}</p>
              <p className="font-[family-name:var(--font-display)] text-3xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Récompenses */}
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold mb-5 text-[var(--greek-blue)] flex items-center gap-2">
            <Gift className="w-5 h-5 text-[var(--greek-gold)]" /> Vos Récompenses
          </h2>

          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">Débloquées</h3>
            <div className="space-y-2">
              {unlockedRewards.length > 0 ? (
                unlockedRewards.map(reward => (
                  <div key={reward.id} className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{reward.name}</p>
                      <p className="text-xs text-gray-500">{reward.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm italic">Aucune récompense débloquée pour le moment</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">À débloquer</h3>
            <div className="space-y-2">
              {nextRewards.length > 0 ? (
                nextRewards.map(reward => (
                  <div key={reward.id} className="bg-gray-50 border border-gray-200 p-4 rounded-xl flex items-start gap-3 opacity-60">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                      <Gift className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-600 text-sm">{reward.name}</p>
                      <p className="text-xs text-gray-400">{reward.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm italic">Toutes les récompenses sont débloquées.</p>
              )}
            </div>
          </div>
        </div>

        {/* Parrainage */}
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold mb-5 text-[var(--greek-blue)] flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--greek-gold)]" /> Parrainage
          </h2>

          {/* Mon Code */}
          <div className="bg-[var(--greek-cream)] border border-[rgba(197,161,72,0.25)] p-6 rounded-2xl mb-5">
            <h3 className="font-bold text-[var(--greek-blue)] text-sm mb-3">Mon Code de Parrainage</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={user?.referralCode || ''}
                readOnly
                className="flex-1 px-4 py-2 bg-white border border-[rgba(197,161,72,0.3)] rounded-xl font-mono font-bold text-center text-[var(--greek-blue)] tracking-widest"
              />
              <button
                onClick={handleCopyCode}
                className="px-4 py-2 bg-[var(--greek-blue)] hover:opacity-90 text-white rounded-xl font-bold transition flex items-center gap-2"
              >
                {copied ? <><Check className="w-4 h-4" /> Copié</> : <><Copy className="w-4 h-4" /> Copier</>}
              </button>
            </div>
            <p className="text-xs text-gray-500">Partagez ce code — chaque ami inscrit débloque des récompenses.</p>
          </div>

          {/* Ajouter un Parrainage */}
          <div className="bg-white border border-[rgba(197,161,72,0.2)] p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-[var(--greek-blue)] text-sm mb-4">
              Utiliser un code de parrainage
              {(user?.referrals ?? 0) > 0 && (
                <span className="ml-2 text-[var(--greek-gold)]">({user!.referrals} parrainage{user!.referrals > 1 ? 's' : ''})</span>
              )}
            </h3>

            {!showReferralForm ? (
              <button
                onClick={() => setShowReferralForm(true)}
                className="w-full btn-primary-greek text-center"
              >
                + Saisir un code
              </button>
            ) : (
              <form onSubmit={handleAddReferral} className="space-y-3">
                <input
                  type="text"
                  placeholder="Code de parrainage"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl font-mono font-bold tracking-widest focus:outline-none focus:border-[var(--greek-blue)] uppercase"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition">Valider</button>
                  <button type="button" onClick={() => setShowReferralForm(false)} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold transition">Annuler</button>
                </div>
                {referralMessage && (
                  <div className={`p-3 rounded-xl text-sm font-semibold ${
                    referralMessage.includes('invalide') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
                  }`}>
                    {referralMessage}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-10 bg-[var(--greek-blue)] text-white p-8 rounded-2xl text-center">
        <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold mb-2">Parrainez et gagnez des mois gratuits</h3>
        <p className="text-white/70 mb-4">Plus vous parrainez, plus vous accumulez de mois gratuits lors du lancement.</p>
        <p className="text-white/90 text-lg font-semibold">
          Vous avez actuellement <span className="font-[family-name:var(--font-display)] text-3xl text-[var(--greek-gold)]">{totalBenefit === 999 ? 'Vie' : totalBenefit}</span> mois de gratuité
        </p>
      </div>
    </div>
  );
}
