import React, { useEffect, useState } from 'react';
import { Trophy, Users, Share2 } from 'lucide-react';
import { getLeaderboard, getGlobalStats, WaitlistEntry } from '../lib/waitlist';

type LeaderboardStats = {
  totalSignups: number;
  totalReferrals: number;
  topReferrer: WaitlistEntry | null;
};

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats>({ totalSignups: 0, totalReferrals: 0, topReferrer: null });

  useEffect(() => {
    setLeaderboard(getLeaderboard());
    setStats(getGlobalStats());
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10">
      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Inscrits', value: stats.totalSignups, color: 'text-[var(--greek-blue)]', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Parrainages', value: stats.totalReferrals, color: 'text-[var(--greek-gold)]', bg: 'bg-yellow-50 border-yellow-100' },
          { label: 'Communauté', value: Math.max(stats.totalSignups, 1), color: 'text-green-600', bg: 'bg-green-50 border-green-100' },
        ].map((s, i) => (
          <div key={i} className={`border rounded-2xl p-6 text-center shadow-sm ${s.bg}`}>
            <p className="text-gray-500 text-sm font-semibold uppercase tracking-widest mb-2">{s.label}</p>
            <p className={`text-4xl font-bold font-[family-name:var(--font-display)] ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold mb-6 text-[var(--greek-blue)] flex items-center gap-3">
        <Trophy className="w-7 h-7 text-[var(--greek-gold)]" />
        Top 10 Ambassadeurs
      </h2>

      {leaderboard.length > 0 ? (
        <div className="space-y-3">
          {leaderboard.map((user, index) => (
            <div key={user.id} className={`bg-white border rounded-2xl p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-all ${
              index === 0 ? 'border-[var(--greek-gold)] ring-1 ring-[var(--greek-gold)]' : 'border-[rgba(197,161,72,0.2)]'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm font-[family-name:var(--font-display)] ${
                  index === 0 ? 'bg-[var(--greek-gold)] text-white' :
                  index === 1 ? 'bg-gray-300 text-gray-700' :
                  index === 2 ? 'bg-amber-600 text-white' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <p className="font-bold text-[var(--greek-blue)]">{user.firstName} {user.lastName}</p>
                  <p className="text-sm text-gray-400">{user.email}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">{user.referrals}</p>
                <p className="text-xs text-gray-400">parrainage{user.referrals > 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-[rgba(197,161,72,0.2)]">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg">Le classement est vide pour le moment.</p>
          <p className="text-sm mt-2">Soyez le premier à vous inscrire et commencer le parrainage.</p>
        </div>
      )}
    </div>
  );
}
