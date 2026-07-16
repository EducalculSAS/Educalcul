"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Star, Trophy, BookOpen, CheckCircle, Zap, Loader2, Flag, X, AlertTriangle } from "lucide-react";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { getNameColor } from "@/lib/badgeStyles";
import Navbar from "@/components/Navbar";

const ICON_MAP: Record<string, any> = {
  pencil: Star, zap: Zap, flame: Star, star: Star, crown: Star,
  check: CheckCircle, trophy: Trophy, brain: Star, sparkles: Star,
  graduation: Star, book: BookOpen, map: Star, library: BookOpen,
  sword: Star, swords: Star, medal: Trophy, gem: Star, crystal: Star,
  divine: Star, shield: CheckCircle, bullseye: Star, bookmark: BookOpen,
  scroll: BookOpen, owl: Star, universe: Star,
};

function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportMessage, setReportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase
        .from("user_public_profiles")
        .select("id, first_name, last_name, child_username, avatar, equipped_border, name_color, featured_badges, role, grade_level")
        .eq("id", id)
        .maybeSingle();

      if (!u) { setLoading(false); return; }
      setUser(u);

      // Fetch featured badge details
      if (u.featured_badges?.length) {
        const { data: fb } = await supabase.from("badges").select("*").in("id", u.featured_badges.filter(Boolean));
        setBadges(fb || []);
      }

      // Fetch all earned badges
      const { data: ub } = await supabase
        .from("user_badges")
        .select("badge:badges(id, name, icon, color, category)")
        .eq("user_id", u.id);
      setAllBadges((ub || []).map((e: any) => e.badge).filter(Boolean));

      // Stats
      const [{ count: exos }, { count: quiz }, { count: cours }] = await Promise.all([
        supabase.from("user_exercise_attempts").select("*", { count: "exact", head: true }).eq("user_id", u.id),
        supabase.from("user_quiz_attempts").select("*", { count: "exact", head: true }).eq("user_id", u.id),
        supabase.from("user_course_progress").select("*", { count: "exact", head: true }).eq("user_id", u.id),
      ]);
      setStats({ exos: exos ?? 0, quiz: quiz ?? 0, cours: cours ?? 0 });
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" /></div>;
  if (!user) return <div className="p-8 text-center text-gray-500">Profil introuvable.</div>;

  const nameColor = getNameColor(user.name_color || "default");
  const displayName = user.child_username || `${user.first_name || ""} ${user.last_name || ""}`.trim();
  const returnTo = searchParams.get("returnTo");

  const submitReport = async () => {
    if (!reportReason.trim()) return;

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;
    if (!authUser) {
      setReportMessage({ type: "error", text: "Tu dois être connecté pour signaler un profil." });
      return;
    }

    const { data: reporter } = await supabase.from("users").select("id").eq("auth_id", authUser.id).single();
    if (!reporter) {
      setReportMessage({ type: "error", text: "Profil utilisateur introuvable." });
      return;
    }

    const { error } = await supabase.from("forum_reports").insert({
      reporter_id: reporter.id,
      reported_user_id: user.id,
      reason: reportReason.trim(),
    });

    if (error) {
      setReportMessage({ type: "error", text: error.message || "Impossible d'envoyer le signalement." });
      return;
    }

    setReportOpen(false);
    setReportReason("");
    setReportMessage({ type: "success", text: "Profil signalé. L'administration va le consulter." });
  };

  const handleBack = () => {
    if (returnTo) {
      router.push(returnTo);
      return;
    }
    router.back();
  };

  return (
    <div className="min-h-screen bg-[var(--greek-cream)] pb-12">
      <Navbar />
      <div className="bg-[var(--greek-blue)] text-white pt-24 pb-16 px-4 rounded-b-[40px] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="container mx-auto max-w-2xl relative z-10">
          <div className="flex items-start justify-between gap-4 mb-6">
            <button onClick={handleBack} className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
            {user.role !== "admin" && (
              <button
                onClick={() => setReportOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Flag className="w-4 h-4" /> Signaler le profil
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <AvatarWithBorder avatar={user.avatar} equippedBorder={user.equipped_border} name={displayName} size="xl" bgClass="#ffffff30" />
            <div className="mt-1">
              <h1 className={`text-3xl font-bold font-[family-name:var(--font-display)] ${nameColor.cls}`}>{displayName}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${user.role === "admin" ? "bg-red-500 text-white" : user.role === "parent" ? "bg-blue-400 text-white" : "bg-green-400 text-white"}`}>
                  {user.role === "admin" ? "Admin" : user.role === "parent" ? "Parent" : "Élève"}
                </span>
                {user.grade_level && <span className="text-white/70 text-sm">{user.grade_level}</span>}
              </div>
              {/* Featured badges */}
              {badges.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {badges.map(b => {
                    const Icon = ICON_MAP[b.icon] || Star;
                    return (
                      <div key={b.id} title={b.name} className="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/20">
                        <Icon className="w-3.5 h-3.5" style={{ color: b.color }} />
                        <span className="text-xs font-bold text-white/90">{b.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-2xl px-4 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Exercices", value: stats.exos, color: "text-orange-600", bg: "bg-orange-50" },
              { label: "Quiz", value: stats.quiz, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Cours", value: stats.cours, color: "text-blue-600", bg: "bg-blue-50" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* All earned badges */}
        {allBadges.length > 0 && (
          <div className="bg-white rounded-2xl border border-[rgba(197,161,72,0.25)] shadow-sm p-5">
            <h2 className="font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)] mb-4 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[var(--greek-gold)]" />
              Badges obtenus ({allBadges.length})
            </h2>
            <div className="flex flex-wrap gap-2">
              {allBadges.map(b => {
                const Icon = ICON_MAP[b.icon] || Star;
                return (
                  <div key={b.id} title={b.name} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold"
                    style={{ backgroundColor: b.color + "15", borderColor: b.color + "40", color: b.color }}>
                    <Icon className="w-3 h-3" />
                    {b.name}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reportMessage && (
          <div className={`p-4 rounded-xl flex items-center justify-between gap-3 border ${reportMessage.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              {reportMessage.type === "error" ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              <span>{reportMessage.text}</span>
            </div>
            <button onClick={() => setReportMessage(null)} className="font-bold">&times;</button>
          </div>
        )}
      </div>

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-[var(--greek-gold)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-[var(--greek-blue)]">Signaler le profil</h2>
                <p className="text-sm text-gray-500">Explique brièvement pourquoi tu signales ce profil.</p>
              </div>
              <button onClick={() => setReportOpen(false)} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="h-36 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--greek-blue)]/20"
                placeholder="Ex : contenu inapproprié, usurpation, harcèlement..."
              />
              <div className="flex gap-3">
                <button onClick={() => setReportOpen(false)} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Annuler
                </button>
                <button onClick={submitReport} className="flex-1 rounded-xl bg-[var(--greek-blue)] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800">
                  Signaler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--greek-blue)]" /></div>}>
      <PublicProfile />
    </Suspense>
  );
}
