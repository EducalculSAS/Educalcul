import React, { useState, useEffect, useRef } from 'react';
import { Gift, Users, Trophy, Zap, ArrowRight, CheckCircle, Sparkles, Star, Brain, BookOpen, Play } from 'lucide-react';
import Navbar, { type View } from './components/Navbar';
import Footer from './components/Footer';
import WaitlistForm from './components/WaitlistForm';
import UserDashboard from './components/UserDashboard';
import Leaderboard from './components/Leaderboard';
import Offres from './pages/Offres';
import Tarifs from './pages/Tarifs';
import FAQ from './pages/FAQ';
import Contact from './pages/Contact';
import { getCurrentUser } from './lib/waitlist';

/* ─── Section Vidéos ─────────────────────────────────────────────────────── */
const VIDEOS = [
  { src: "/videos/demo-principal.mp4", label: "Présentation générale", span: "md:col-span-2", aspect: "aspect-video" },
  { src: "/videos/demo-exercices.mp4", label: "Exercices & corrections IA", span: "", aspect: "aspect-video" },
  { src: "/videos/demo-dashboard.mp4", label: "Espace parent & suivi", span: "", aspect: "aspect-video" },
];

function VideoCard({ src, label, isMain }: { src: string; label: string; isMain?: boolean }) {
  const [playing, setPlaying] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const ref = React.useRef<HTMLVideoElement>(null);

  const toggle = () => {
    if (!ref.current) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play(); setPlaying(true); }
  };

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden shadow-lg cursor-pointer select-none ${
        isMain ? "shadow-2xl" : ""
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={toggle}
      style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)" }}
    >
      {/* Fond décoratif animé visible quand pas de vidéo */}
      {!playing && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10 bg-[var(--greek-gold)]"
            style={{ animation: "pulse 3s ease-in-out infinite" }}
          />
          <div
            className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full opacity-10 bg-[var(--greek-gold)]"
            style={{ animation: "pulse 3s ease-in-out infinite 1.5s" }}
          />
          {/* Lignes décoratives */}
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, #c5a148 0, #c5a148 1px, transparent 0, transparent 50%)", backgroundSize: "20px 20px" }}
          />
        </div>
      )}

      {/* Video */}
      <video
        ref={ref}
        className={`w-full h-full object-cover transition-opacity duration-500 ${playing ? "opacity-100" : "opacity-0 absolute inset-0"}`}
        onEnded={() => setPlaying(false)}
        preload="none"
      >
        <source src={src} type="video/mp4" />
      </video>

      {/* Placeholder aspect ratio */}
      {!playing && <div className={isMain ? "aspect-video" : "aspect-video"} />}

      {/* Overlay play button */}
      {!playing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div
            className="relative flex items-center justify-center"
            style={{ transition: "transform 0.3s ease", transform: hovered ? "scale(1.1)" : "scale(1)" }}
          >
            {/* Halo animé */}
            <div
              className="absolute w-20 h-20 rounded-full bg-[var(--greek-gold)] opacity-20"
              style={{ animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite" }}
            />
            <div
              className={`relative z-10 flex items-center justify-center rounded-full bg-[var(--greek-gold)] shadow-xl text-white transition-all duration-300 ${
                isMain ? "w-20 h-20" : "w-14 h-14"
              }`}
            >
              <Play className={`${isMain ? "w-8 h-8" : "w-6 h-6"} ml-1`} fill="white" />
            </div>
          </div>
          <p className={`text-white/70 font-medium ${isMain ? "text-sm" : "text-xs"}`}>{label}</p>
        </div>
      )}

      {/* Barre de label en bas quand lecture */}
      {playing && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 pointer-events-none">
          <p className="text-white/80 text-xs font-medium">{label}</p>
        </div>
      )}
    </div>
  );
}

function VideoSection() {
  return (
    <section className="py-24 px-6 bg-white border-t border-[rgba(197,161,72,0.12)]">
      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
        @keyframes pulse { 0%,100%{opacity:.1} 50%{opacity:.2} }
      `}</style>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--greek-blue)] mb-3">
            Découvrez la plateforme
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto text-sm">
            Un aperçu de ce qui vous attend dès l'ouverture.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <VideoCard src="/videos/demo-principal.mp4" label="Présentation générale" isMain />
          </div>
          <VideoCard src="/videos/demo-exercices.mp4" label="Exercices & corrections IA" />
          <VideoCard src="/videos/demo-dashboard.mp4" label="Espace parent & suivi" />
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [view, setView] = useState<View>('landing');

  useEffect(() => {
    const user = getCurrentUser();
    if (user) setCurrentUser(user.email);
  }, []);

  const handleSignup = (email: string) => {
    setCurrentUser(email);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('educalcul_waitlist');
    setCurrentUser(null);
    setView('landing');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--greek-cream)]">
      <Navbar currentView={view} onViewChange={setView} isLoggedIn={!!currentUser} />

      <main className="flex-grow pt-[64px]">

        {/* ── LANDING ── */}
        {view === 'landing' && (
          <div>
            {/* Hero */}
            <section className="relative bg-[var(--greek-blue)] text-white overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none select-none">
                <span className="absolute top-10 left-10 text-7xl font-bold font-[family-name:var(--font-display)]">∑</span>
                <span className="absolute top-32 right-20 text-5xl font-bold">π</span>
                <span className="absolute bottom-20 left-1/4 text-6xl font-bold">√</span>
                <span className="absolute bottom-10 right-1/3 text-4xl font-bold">∫</span>
                <span className="absolute top-1/2 right-10 text-5xl font-bold">Δ</span>
              </div>
              <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
                <div className="inline-flex items-center gap-2 bg-[var(--greek-gold)] text-[var(--greek-blue)] text-sm font-bold px-4 py-1.5 rounded-full mb-6 shadow-md">
                  <Sparkles className="w-4 h-4" />
                  Bientôt disponible — Rejoignez la liste d'attente
                </div>
                <h1 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl font-bold mb-6 leading-tight">
                  La plateforme de maths<br />
                  <span className="text-[var(--greek-gold)]">qui motive vraiment</span>
                </h1>
                <p className="text-xl text-white/85 mb-10 max-w-2xl mx-auto leading-relaxed">
                  Educalcul accompagne vos enfants du CE1 à la 3ème avec des cours, exercices corrigés et une IA pédagogique. Sérieux et amusant à la fois.
                </p>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-xl mx-auto border border-white/20 shadow-xl" id="waitlist">
                  <p className="text-sm font-semibold text-[var(--greek-gold)] mb-4 uppercase tracking-widest">
                    Accès anticipé — Gratuit
                  </p>
                  <WaitlistForm onSuccess={handleSignup} />
                  <p className="text-white/50 text-xs mt-3">Déjà plus de 200 familles inscrites · Pas de spam · Désabonnement en 1 clic</p>
                </div>
              </div>
            </section>

            {/* Stats */}
            <section className="bg-white border-b border-[rgba(197,161,72,0.15)] py-10">
              <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                {[
                  { val: "CE1 → 3ème", label: "Niveaux couverts" },
                  { val: "200+", label: "Familles en attente" },
                  { val: "Athéna", label: "Votre IA pédagogique" },
                  { val: "100%", label: "Sans publicité" },
                ].map((s, i) => (
                  <div key={i}>
                    <div className="text-2xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">{s.val}</div>
                    <div className="text-sm text-gray-500 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Features */}
            <section className="py-20 px-6">
              <div className="max-w-5xl mx-auto">
                <div className="text-center mb-14">
                  <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-bold text-[var(--greek-blue)] mb-3">
                    Tout ce dont vos enfants ont besoin
                  </h2>
                  <p className="text-gray-500 max-w-xl mx-auto">Une plateforme pensée pour l'apprentissage réel, pas juste pour les notes.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    { icon: <BookOpen className="w-7 h-7" />, color: "bg-blue-50 text-blue-600", title: "Cours adaptés au niveau", desc: "Des leçons du CE1 à la 3ème, alignées sur les programmes officiels avec formules et exemples." },
                    { icon: <Brain className="w-7 h-7" />, color: "bg-purple-50 text-purple-600", title: "IA Athéna", desc: "Notre assistante guide l'élève sans donner la réponse — elle aide à comprendre vraiment." },
                    { icon: <Trophy className="w-7 h-7" />, color: "bg-yellow-50 text-yellow-600", title: "Badges & progression", desc: "XP, badges, niveaux et défis hebdomadaires pour maintenir la motivation au quotidien." },
                    { icon: <Users className="w-7 h-7" />, color: "bg-indigo-50 text-indigo-600", title: "Espace parent", desc: "Suivez la progression, consultez les rapports et gérez les accès depuis un dashboard dédié." },
                    { icon: <Zap className="w-7 h-7" />, color: "bg-orange-50 text-orange-600", title: "Exercices corrigés", desc: "Des milliers d'exercices progressifs avec correction détaillée par l'IA." },
                    { icon: <Star className="w-7 h-7" />, color: "bg-green-50 text-green-600", title: "Forum communautaire", desc: "Espace sécurisé pour s'entraider, poser des questions et partager des astuces." },
                  ].map((f, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.2)] p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>{f.icon}</div>
                      <h3 className="font-bold text-[var(--greek-blue)] mb-2">{f.title}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── VIDÉOS ── */}
            <VideoSection />

            {/* Pourquoi la waitlist */}
            <section className="py-16 px-6 bg-[var(--greek-blue)] text-white">
              <div className="container mx-auto max-w-5xl">
                <h2 className="text-center mb-10 font-[family-name:var(--font-display)] font-bold text-3xl md:text-4xl">
                  Pourquoi rejoindre la waitlist ?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { icon: <Zap className="w-10 h-10 text-[var(--greek-gold)]" />, title: "Accès Anticipé", desc: "Soyez le premier à découvrir toutes les fonctionnalités de la plateforme avant tout le monde." },
                    { icon: <Users className="w-10 h-10 text-[var(--greek-gold)]" />, title: "Parrainez et Gagnez", desc: "Chaque ami invité vous rapporte des récompenses exclusives et des mois gratuits d'accès." },
                    { icon: <Trophy className="w-10 h-10 text-[var(--greek-gold)]" />, title: "Devenir Ambassadeur", desc: "Montez en rang en parrainant, débloquez des statuts exclusifs et des avantages spéciaux." },
                  ].map((b, i) => (
                    <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:-translate-y-1 hover:bg-white/15 transition-all text-center">
                      <div className="flex justify-center mb-4">{b.icon}</div>
                      <h5 className="text-xl font-bold mb-3 font-[family-name:var(--font-display)]">{b.title}</h5>
                      <p className="text-white/75 text-sm leading-relaxed">{b.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Comment ça marche */}
            <section className="py-20 px-6">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-center mb-12 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl md:text-4xl flex items-center justify-center gap-3">
                  <ArrowRight className="w-8 h-8 text-[var(--greek-gold)]" />
                  Comment ça fonctionne ?
                </h2>
                <div className="space-y-6">
                  {[
                    { n: '01', title: 'Inscrivez-vous', desc: 'Remplissez le formulaire avec votre prénom, nom et email' },
                    { n: '02', title: 'Recevez votre code', desc: 'Obtenez votre code de parrainage unique dès l\'inscription' },
                    { n: '03', title: 'Partagez', desc: 'Invitez vos amis avec votre code personnel' },
                    { n: '04', title: 'Débloquez des récompenses', desc: 'Gagnez des mois gratuits à chaque ami inscrit via votre code' },
                  ].map((s, i) => (
                    <div key={i} className="flex gap-6 items-start">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--greek-gold)] text-white font-bold font-[family-name:var(--font-display)] flex items-center justify-center text-lg">
                        {s.n}
                      </div>
                      <div className="pt-1">
                        <h3 className="text-lg font-bold text-[var(--greek-blue)]">{s.title}</h3>
                        <p className="mt-1 text-gray-500 text-sm">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Système récompenses */}
            <section className="py-16 px-6 bg-[var(--greek-cream)] border-t border-[rgba(197,161,72,0.2)]">
              <div className="container mx-auto max-w-5xl">
                <h2 className="text-center mb-10 font-[family-name:var(--font-display)] font-bold text-[var(--greek-blue)] text-3xl flex items-center justify-center gap-3">
                  <Gift className="w-8 h-8 text-[var(--greek-gold)]" />
                  Système de Récompenses
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { num: '1', name: 'Pionnier', info: 'Inscription' },
                    { num: '2', name: 'Influenceur', info: '1 parrainage' },
                    { num: '3', name: 'Ambassadeur', info: '3 parrainages' },
                    { num: '4', name: 'Légende', info: '5 parrainages' },
                    { num: '5', name: 'Maître', info: '10 parrainages' },
                  ].map((r, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.2)] p-5 shadow-sm text-center hover:-translate-y-1 hover:shadow-md transition-all">
                      <div className="w-10 h-10 rounded-full bg-[var(--greek-gold)] text-white font-bold font-[family-name:var(--font-display)] flex items-center justify-center mx-auto mb-2">{r.num}</div>
                      <h4 className="font-bold text-[var(--greek-blue)] text-sm mb-1">{r.name}</h4>
                      <p className="text-xs text-gray-400">{r.info}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Témoignages */}
            <section className="py-20 px-6">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-center font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--greek-blue)] mb-12">
                  Ce qu'ils en pensent
                </h2>
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    { name: "Marie L.", role: "Maman de Lucas, 11 ans", text: "Mon fils a rattrapé son niveau en maths en 3 mois. Les explications d'Athéna sont bien meilleures qu'un manuel !" },
                    { name: "Thomas D.", role: "Papa de Chloé, 9 ans", text: "Chloé est impatiente de faire ses exercices le soir. Le système de badges fonctionne vraiment bien." },
                    { name: "Sophie M.", role: "Enseignante CM2", text: "Je recommande Educalcul à mes élèves. La progression est claire et les exercices sont de qualité." },
                  ].map((t, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.2)] p-6 shadow-sm">
                      <div className="flex gap-0.5 mb-4">
                        {Array.from({ length: 5 }).map((_, j) => <Star key={j} className="w-4 h-4 fill-[var(--greek-gold)] text-[var(--greek-gold)]" />)}
                      </div>
                      <p className="text-gray-600 text-sm italic mb-4">"{t.text}"</p>
                      <p className="font-bold text-[var(--greek-blue)] text-sm">{t.name}</p>
                      <p className="text-gray-400 text-xs">{t.role}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ── PAGES PUBLIQUES — copies exactes du site ── */}
        {view === 'offres' && <Offres onNavigate={setView} />}
        {view === 'tarifs' && <Tarifs onNavigate={setView} />}
        {view === 'faq' && <FAQ onNavigate={setView} />}
        {view === 'contact' && <Contact onNavigate={setView} />}

        {/* ── DASHBOARD & LEADERBOARD ── */}
        {view === 'dashboard' && currentUser && (
          <UserDashboard userEmail={currentUser} onLogout={handleLogout} />
        )}
        {view === 'leaderboard' && <Leaderboard />}
      </main>

      <Footer onNavigate={setView} />
    </div>
  );
}
