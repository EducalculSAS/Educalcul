"use client";

import GlassSwitch from "@/components/ui/GlassSwitch";
import ThemeToggle from "@/components/ThemeToggle";
import { AccessibilityCard } from "@/components/AccessibilityPanel";
import AvatarPicker from "@/components/AvatarPicker";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  User, Trophy, Shield, School, BookOpen, Mail,
  CheckCircle, AlertCircle, Trash2,
  Camera, Bell, Brain, Gamepad2, Volume2,
} from "lucide-react";
import { getNameColor } from "@/lib/badgeStyles";
import { updateMyProfile } from "@/lib/updateMyProfile";
import AvatarWithBorder from "@/components/AvatarWithBorder";
import { getSimpleLevelLabel } from "@/lib/constants";
import GlassButton from "@/components/ui/GlassButton";
import GlassIconButton from "@/components/ui/GlassIconButton";
import UserSessionsList from "@/components/UserSessionsList";
import TwoFactorToggle from "@/components/TwoFactorToggle";
import WebAuthnCard from "@/components/WebAuthnCard";
import GlassSegmentedControl from "@/components/ui/GlassSegmentedControl";
import { CALIA_VOICES, DEFAULT_CALIA_VOICE, isCaliaVoice, type CaliaVoiceId } from "@/lib/caliaVoices";
import { errMessage } from "@/lib/safeError";

const GoogleIcon = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

interface ChildUser {
  first_name: string;
  last_name: string;
  email?: string;
  child_username?: string;
  avatar?: string;
  equipped_border?: string;
  name_color?: string;
  grade_level?: string;
  notif_weekly_reports?: boolean;
  notif_offers_news?: boolean;
  calia_voice?: string | null;
}

/** Toutes les actions (upload avatar, lier/délier Google, notifications,
 * suppression de compte) : mutations pures, isolées en client island. Les
 * données initiales (utilisateur, activités) arrivent déjà chargées du
 * serveur. */
export default function ChildProfileSettings({
  user, googleLinked: initialGoogleLinked, activityCounts,
}: {
  user: ChildUser;
  googleLinked: boolean;
  activityCounts: { courses: number; exercises: number; badges: number; minigames: number };
}) {
  const [avatar, setAvatar] = useState(user.avatar || "/avatars/avatar1.png");
  const [googleLinked, setGoogleLinked] = useState(initialGoogleLinked);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [notifications, setNotifications] = useState({
    notif_weekly_reports: user.notif_weekly_reports ?? false,
    notif_offers_news: user.notif_offers_news ?? false,
  });
  const [caliaVoice, setCaliaVoice] = useState<CaliaVoiceId>(
    isCaliaVoice(user.calia_voice) ? user.calia_voice : DEFAULT_CALIA_VOICE,
  );
  const changeCaliaVoice = (id: string) => {
    if (!isCaliaVoice(id)) return;
    const previous = caliaVoice;
    setCaliaVoice(id); // optimiste : le choix s'affiche sans attendre le réseau
    void playVoicePreview(id);
    void updateMyProfile({ calia_voice: id }).then((res) => {
      if (!res.ok) setCaliaVoice(previous);
    });
  };
  // Aperçu : une courte phrase dite avec la voix choisie (même synthèse que
  // Calia en classe). Un nouveau choix coupe l'aperçu précédent.
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const playVoicePreview = async (voice: string) => {
    try {
      previewAudioRef.current?.pause();
      const res = await fetch(`/api/calia/tts?text=${encodeURIComponent("Salut ! Je suis Calia, on travaille ensemble ?")}&voice=${encodeURIComponent(voice)}`);
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      const audio = (previewAudioRef.current ??= new Audio());
      audio.onended = () => URL.revokeObjectURL(url);
      audio.src = url;
      await audio.play();
    } catch {
      /* aperçu facultatif */
    }
  };
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const handleLinkGoogle = async () => {
    try {
      const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (error) throw error;
    } catch (err: unknown) { setMessage({ type: "error", text: errMessage(err) }); }
  };

  const handleUnlinkGoogle = async () => {
    try {
      const { data: { user: au } } = await supabase.auth.getUser();
      const identity = au?.identities?.find((id) => id.provider === "google");
      if (!identity) throw new Error("Aucun compte Google lié.");
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;
      setGoogleLinked(false);
      setMessage({ type: "success", text: "Compte Google délié." });
    } catch (err: unknown) { setMessage({ type: "error", text: errMessage(err) }); }
  };


  return (
    <>
      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium mb-6 ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.type === "success" ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          {message.text}
          <button className="ml-auto font-bold text-lg leading-none" onClick={() => setMessage(null)} aria-label="Fermer le message">×</button>
        </div>
      )}

      {/* ── Avatar + identité ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] overflow-hidden mb-6">
        <div className="h-24 bg-[var(--greek-blue)] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0,rgba(255,255,255,0.05) 1px,transparent 0,transparent 50%)", backgroundSize: "12px 12px" }} />
        </div>
        <div className="relative -mt-12 flex flex-col items-center gap-3 px-6 pb-6 text-center">
          <div className="relative">
            <AvatarWithBorder avatar={avatar} equippedBorder={user.equipped_border} name={user.first_name || "?"} size="xl" />
            <button
              type="button"
              onClick={() => setAvatarPickerOpen(v => !v)}
              className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-transform hover:scale-110"
              style={{ background: "var(--greek-blue)" }}
              aria-label="Choisir un avatar"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${getNameColor(user.name_color || "default").cls}`}>{user.first_name} {user.last_name}</h2>
            <p className="text-sm font-bold flex items-center justify-center gap-1.5" style={{ color: "var(--greek-gold)" }}>
              <Shield className="w-4 h-4" />{user.child_username}
            </p>
          </div>

          {avatarPickerOpen && (
            <div className="mt-2 w-full max-w-sm">
              <AvatarPicker
                value={avatar}
                columns={4}
                onChange={async (a) => {
                  const previous = avatar;
                  setAvatar(a);
                  setAvatarPickerOpen(false);
                  const r = await updateMyProfile({ avatar: a });
                  if (!r.ok) setAvatar(previous);
                  setMessage(r.ok ? { type: "success", text: "Avatar mis à jour." } : { type: "error", text: r.error || "Échec." });
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Stats rapides ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { icon: School, label: "Niveau", value: user.grade_level ? getSimpleLevelLabel(user.grade_level) : "-", color: "#3b82f6" },
          { icon: Trophy, label: "Trophées", value: `${activityCounts.badges}`, color: "var(--greek-gold)" },
          { icon: BookOpen, label: "Cours suivis", value: `${activityCounts.courses}`, color: "#a855f7" },
          { icon: Brain, label: "Exercices", value: `${activityCounts.exercises}`, color: "#10b981" },
          { icon: Gamepad2, label: "Mini-jeux", value: `${activityCounts.minigames}`, color: "#ec4899" },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 border border-[rgba(197,161,72,0.2)] flex flex-col gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <p className="text-xl font-bold" style={{ color: "var(--greek-blue)" }}>{value}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {/* ── Infos personnelles ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] p-6">
          <h2 className="text-lg font-bold mb-5 flex items-center gap-2 font-[family-name:var(--font-display)]" style={{ color: "var(--greek-blue)" }}>
            <User className="w-5 h-5 text-[var(--greek-gold)]" />
            Informations personnelles
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: "var(--greek-blue)" }}>Pseudo</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input type="text" value={user.child_username || ""} disabled
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none opacity-70 cursor-not-allowed"
                  style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)" }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: "var(--greek-blue)" }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input type="email" value={user.email || ""} disabled
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none opacity-70 cursor-not-allowed"
                  style={{ background: "var(--greek-cream)", border: "1.5px solid rgba(197,161,72,0.25)" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* ── Comptes liés ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] p-6">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2 font-[family-name:var(--font-display)]" style={{ color: "var(--greek-blue)" }}>
              <Mail className="w-5 h-5 text-[var(--greek-gold)]" />
              Comptes liés
            </h2>
            <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: "var(--greek-cream)", border: "1px solid rgba(197,161,72,0.2)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm"><GoogleIcon /></div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--greek-blue)" }}>Google</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{googleLinked ? "Compte lié" : "Non lié"}</p>
                </div>
              </div>
              {googleLinked ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Lié</span>
                  <GlassIconButton icon={Trash2} onClick={handleUnlinkGoogle} color="red" size="sm" aria-label="Supprimer le lien Google" />
                </div>
              ) : (
                <GlassButton onClick={handleLinkGoogle} variant="outline" size="sm">
                  Lier
                </GlassButton>
              )}
            </div>
          </div>

          {/* ── Notifications ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] p-6">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2 font-[family-name:var(--font-display)]" style={{ color: "var(--greek-blue)" }}>
              <Bell className="w-5 h-5 text-[var(--greek-gold)]" />
              Notifications
            </h2>
            <div className="space-y-4">
              {([
                { key: "notif_weekly_reports", label: "Rapports de progression", desc: "Recevoir un résumé hebdomadaire" },
                { key: "notif_offers_news", label: "Offres et nouveautés", desc: "Actualités et promotions Educalcul" },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--greek-blue)" }}>{label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
                  </div>
                  <GlassSwitch
                    checked={notifications[key]}
                    label={label}
                    onChange={(next) => {
                      setNotifications({ ...notifications, [key]: next });
                      void updateMyProfile({ [key]: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <ThemeToggle />
        <AccessibilityCard />

        {/* ── Voix de Calia en classe ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] p-6">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2 font-[family-name:var(--font-display)]" style={{ color: "var(--greek-blue)" }}>
            <Volume2 className="w-5 h-5 text-[var(--greek-gold)]" />
            Voix de Calia en classe
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            {CALIA_VOICES.find((v) => v.id === caliaVoice)?.description}, la voix qui te lit le cours quand tu lances Calia.
          </p>
          <GlassSegmentedControl
            options={CALIA_VOICES.map((v) => ({ id: v.id, label: v.label }))}
            value={caliaVoice}
            onChange={changeCaliaVoice}
          />
        </div>

        <TwoFactorToggle />

        <WebAuthnCard />

        {/* ── Appareils connectés ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-[rgba(197,161,72,0.2)] p-6">
          <UserSessionsList />
        </div>
      </div>

    </>
  );
}
