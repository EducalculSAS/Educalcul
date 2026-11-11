import Link from "@/components/AppLink";
import PageHero from "@/components/PageHero";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Lock } from "lucide-react";
import StreakFlame from "@/components/StreakFlame";
import Emblem3D from "@/components/Emblem3D";
import { getServerUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { checkMinigamesAccess } from "@/lib/checkSubscription";
import { loadMinigamesHub } from "@/lib/minigames/hub";
import { GAME_BY_KEY, UPCOMING_GAME, formatDuration, scoreLabel } from "@/lib/minigames/catalog";
import MinigamesLeaderboard from "@/components/minigames/MinigamesLeaderboard";
import { NextSheetCountdown } from "@/components/minigames/GameShell";

const CARD = "bg-white rounded-[20px] p-6 shadow-sm border border-[rgba(197,161,72,0.25)]";
const DAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];

export default async function MinigamesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/auth/connexion");
  if (authUser.role !== "child") redirect("/dashboard");

  const { data: me } = await supabaseAdmin.from("users").select("grade_level").eq("id", authUser.id).maybeSingle();
  const [hub, access] = await Promise.all([loadMinigamesHub(authUser.id, me?.grade_level ?? null), checkMinigamesAccess(authUser.authId)]);
  const allDone = hub.availableCount > 0 && hub.doneToday >= hub.availableCount;
  const pct = hub.availableCount > 0 ? Math.round((hub.doneToday / hub.availableCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-[var(--greek-cream)]">
      <PageHero
        back={{ href: "/child/dashboard", label: "Tableau de bord" }}
        emblem="gamepad"
        title="Mini-jeux"
        badge="Chaque jour"
        subtitle="Une nouvelle fiche par jeu tous les jours. Joue, garde ta série et grimpe au classement."
        actions={(
          <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-[rgba(197,161,72,0.25)]">
            <div className="text-center px-3 border-r border-[rgba(197,161,72,0.25)]">
              <div className="text-2xl font-bold text-[var(--greek-gold)] tabular-nums">{hub.doneToday}/{hub.availableCount}</div>
              <div className="text-xs uppercase tracking-wider opacity-80">Aujourd&apos;hui</div>
            </div>
            <div className="text-center px-3 border-r border-[rgba(197,161,72,0.25)]">
              <div className="text-2xl font-bold text-[var(--greek-gold)] tabular-nums">{hub.bestStreak}</div>
              <div className="text-xs uppercase tracking-wider opacity-80">Série</div>
            </div>
            <div className="text-center px-3">
              <div className="text-2xl font-bold text-[var(--greek-gold)] tabular-nums">{hub.weekPoints}</div>
              <div className="text-xs uppercase tracking-wider opacity-80">Points · 7 j</div>
            </div>
          </div>
        )}
      />

      <div className="container mx-auto max-w-6xl px-4 pb-12 space-y-8">
        {/* Le point du jour */}
        <section className={CARD}>
          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <Emblem3D kind="gamepad" size={28} float={false} />
                <h2 className="text-xl font-bold text-[var(--greek-blue)]">{allDone ? "Tout est fait pour aujourd'hui" : "Tes jeux du jour"}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                {allDone
                  ? "Bravo, tu as terminé toutes tes fiches. Reviens demain pour garder ta série."
                  : `${hub.doneToday} jeu${hub.doneToday > 1 ? "x" : ""} terminé${hub.doneToday > 1 ? "s" : ""} sur ${hub.availableCount}.${access.remaining >= 0 ? ` Il te reste ${access.remaining} partie${access.remaining > 1 ? "s" : ""} aujourd'hui.` : ""}`}
              </p>
              <div className="h-2 rounded-full bg-[rgba(197,161,72,0.18)] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Jeux terminés aujourd'hui">
                <div className={`h-full rounded-full ${allDone ? "bg-green-600" : "bg-[var(--greek-gold)]"}`} style={{ width: `${pct}%` }} />
              </div>
              <NextSheetCountdown className="text-sm text-gray-600 mt-3" />
            </div>
            {/* Les 7 derniers jours */}
            <ol className="flex items-end justify-between md:justify-end gap-2" aria-label="Tes parties des 7 derniers jours">
              {hub.last7.map((d) => (
                <li key={d.day} className="flex flex-col items-center gap-1">
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${d.plays > 0 ? "bg-[var(--greek-blue)] text-[var(--greek-gold)]" : "bg-[rgba(15,30,58,0.06)] text-gray-400"} ${d.day === hub.day ? "ring-2 ring-[var(--greek-gold)] ring-offset-2" : ""}`}
                    title={`${d.plays} partie${d.plays > 1 ? "s" : ""}`}
                  >
                    {d.plays > 0 ? d.plays : ""}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-500">{DAY_LETTER[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Les jeux */}
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hub.games.map((g) => {
            const info = GAME_BY_KEY[g.gameType];
            const done = g.today;
            const time = done ? formatDuration(done.durationSeconds) : null;
            const body = (
              <div className={`${CARD} h-full flex flex-col ${g.available ? "hover:shadow-xl hover:-translate-y-1 transition-[transform,box-shadow] duration-300" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className={`transition-transform duration-300 ${g.available ? "group-hover:scale-110" : "grayscale"}`}><Emblem3D kind={info.emblem} size={72} float={false} /></span>
                  {!g.available ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500"><Lock className="w-3.5 h-3.5" /> Plus tard</span>
                  ) : done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-bold text-green-700"><Check className="w-3.5 h-3.5" /> Fait</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-[var(--greek-gold)] px-3 py-1 text-xs font-bold text-[var(--greek-blue)]">À jouer</span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-1">{info.label}</h3>
                <p className="text-gray-600 text-sm mb-4">{g.available ? info.pitch : "Ce jeu arrive plus tard dans le programme."}</p>
                <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-[rgba(197,161,72,0.2)]">
                  {g.available ? (
                    <span className="text-sm font-bold text-[var(--greek-blue)] inline-flex items-center gap-1 min-w-0">
                      <span className="truncate">{done ? `${scoreLabel(info, done.score, done.maxScore)}${time ? ` · ${time}` : ""}` : "Jouer"}</span>
                      <ArrowRight className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                    </span>
                  ) : <span />}
                  {g.available && <StreakFlame lit={g.streak > 0} count={g.streak} size={40} animate={false} />}
                </div>
              </div>
            );
            return (
              <li key={g.gameType}>
                {g.available
                  ? <Link href={`/child/minigames/${info.slug}`} className="group block h-full" aria-label={`${info.label}${done ? ", fait aujourd'hui" : ", à jouer"}`}>{body}</Link>
                  : body}
              </li>
            );
          })}
          <li>
            <div className={`${CARD} h-full flex flex-col opacity-70`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="grayscale"><Emblem3D kind={UPCOMING_GAME.emblem} size={72} float={false} /></span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500"><Lock className="w-3.5 h-3.5" /> Bientôt</span>
              </div>
              <h3 className="text-xl font-bold text-[var(--greek-blue)] mb-1">{UPCOMING_GAME.label}</h3>
              <p className="text-gray-600 text-sm">{UPCOMING_GAME.pitch}</p>
            </div>
          </li>
        </ul>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
          <MinigamesLeaderboard gameType="mathador" selectable />

          <section className={CARD}>
            <div className="flex items-center gap-3 mb-4">
              <Emblem3D kind="compass" size={28} float={false} />
              <h2 className="text-xl font-bold text-[var(--greek-blue)]">Comment ça marche</h2>
            </div>
            <ol className="space-y-4">
              {[
                ["Une fiche par jour", "Chaque jeu propose une nouvelle fiche tous les jours, la même pour tous les élèves de ton niveau."],
                ["Une seule tentative", "Tu joues chaque fiche une fois. Prends ton temps : seul le score compte, le temps est affiché à côté."],
                ["Une série à garder", "Joue un jeu plusieurs jours de suite pour faire grandir sa flamme."],
                ["Un classement par niveau", "Tes points s'additionnent sur 7 jours et depuis toujours."],
              ].map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span className="w-7 h-7 shrink-0 rounded-full bg-[var(--greek-blue)] text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="text-sm font-bold text-[var(--greek-blue)]">{title}</p>
                    <p className="text-sm text-gray-600">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
