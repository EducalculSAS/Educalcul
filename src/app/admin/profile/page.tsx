"use client";

import { useState, useEffect } from "react";
import PageLoader from "@/components/PageLoader";
import { supabase } from "@/lib/supabaseClient";
import { USER_SELECT_COLUMNS } from "@/lib/userColumns";
import { User, Save, Eye, Crown, Shield } from "lucide-react";
import { avatarUrl } from "@/lib/avatarUrl";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminTotpCard from "@/components/admin/AdminTotpCard";

const ADMIN_AVATAR = "/logo.png";

export default function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    child_username: "",
    email: "",
    avatar: ADMIN_AVATAR,
    name_animation: "text-admin",
    avatar_border: "border-admin",
  });


  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error }: any = await supabase
        .from("users")
        .select(USER_SELECT_COLUMNS)
        .eq("auth_id", session.user.id)
        .single();

      if (error) throw error;

      setUser(data);
      setFormData({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        child_username: data.child_username || "",
        email: data.email || session.user.email || "",
        avatar: ADMIN_AVATAR, // always locked to logo
        name_animation: data.name_animation || "text-admin",
        avatar_border: data.avatar_border || "border-admin",
      });
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      setMessage({
        text: "Erreur lors du chargement du profil.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_id: session.user.id,
          ...formData,
        }),
      });

      const result = await response.json();

      if (!response.ok)
        throw new Error(result.error || "Failed to update profile");

      setMessage({ text: "Profil public mis à jour avec succès !", type: "success" });
      fetchProfile(); // Refresh data
    } catch (error: any) {
      console.error("Error updating profile:", error);
      setMessage({
        text: error.message || "Erreur lors de la mise à jour.",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };



  if (loading) return <PageLoader className="min-h-screen" />;

  return (
    <div className="space-y-6">
      <style jsx global>{`
        /* === BORDER PREVIEW CLASSES (applied directly in admin profile) === */
        @keyframes adm-glow {
          0%,100% { box-shadow: 0 0 10px #ff6b6b88, 0 0 20px #4ecdc488; }
          50%      { box-shadow: 0 0 20px #ffd70099, 0 0 30px #8b5cf688; }
        }
        @keyframes adm-hue { 0%{filter:hue-rotate(0deg)} 100%{filter:hue-rotate(360deg)} }
        @keyframes adm-crown { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes adm-pulse-gold     { 0%,100%{box-shadow:0 0 20px #ffd70099} 50%{box-shadow:0 0 30px #ffd700cc} }
        @keyframes adm-pulse-diamond  { 0%,100%{filter:hue-rotate(0deg)} 50%{filter:hue-rotate(180deg)} }
        @keyframes adm-pulse-elite    { 0%{box-shadow:0 0 12px #7c3aed88,0 0 22px #4c1d9555} 50%{box-shadow:0 0 20px #0d9488aa,0 0 35px #e0e7ff44} 100%{box-shadow:0 0 12px #7c3aed88,0 0 22px #4c1d9555} }
        @keyframes adm-pulse-flame    { 0%,100%{box-shadow:0 0 10px #f9731666} 50%{box-shadow:0 0 20px #ef4444aa} }
        @keyframes adm-pulse-premium  { 0%,100%{box-shadow:0 0 10px #a855f777} 50%{box-shadow:0 0 20px #d946efaa} }

        .border-bronze  { border:4px solid #cd7f32; box-shadow:0 0 12px rgba(205,127,50,.5); }
        .border-silver  { border:5px solid #c0c0c0; box-shadow:0 0 15px rgba(192,192,192,.6); }
        .border-gold    { border:6px solid #ffd700; box-shadow:0 0 20px rgba(255,215,0,.7); animation:adm-pulse-gold 2.5s ease-in-out infinite; }
        .border-diamond { border:6px solid transparent; background:linear-gradient(45deg,#b9f2ff,#66d9ef,#a8e6cf,#dcedc1) border-box; box-shadow:0 0 25px #b9f2ff88; animation:adm-pulse-diamond 2s ease-in-out infinite; }
        .border-premium { border:5px solid #a855f7; box-shadow:0 0 18px rgba(168,85,247,.6); animation:adm-pulse-premium 2s ease-in-out infinite; }
        .border-famille { border:5px solid #14b8a6; box-shadow:0 0 18px rgba(20,184,166,.6); }
        .border-flamme  { border:5px solid #f97316; box-shadow:0 0 18px rgba(249,115,22,.7); animation:adm-pulse-flame 1s ease-in-out infinite; }
        .border-pro     { border:6px solid #f59e0b; box-shadow:0 0 20px rgba(245,158,11,.7); animation:adm-pulse-gold 2s ease-in-out infinite; }
        .border-elite   { border:6px solid #7c3aed; box-shadow:0 0 18px rgba(124,58,237,.6),0 0 30px rgba(13,148,136,.3); animation:adm-pulse-elite 3s ease-in-out infinite; }
        .border-admin {
          position:relative;
          border:8px solid transparent;
          background:linear-gradient(45deg,#ff6b6b,#ffd700,#4ecdc4,#8b5cf6,#ff6b6b) border-box, linear-gradient(white,white) padding-box;
          box-shadow:0 0 20px #ff6b6b77;
          animation:adm-glow 2s ease-in-out infinite, adm-hue 6s linear infinite;
        }
        .border-admin::after {
          content:"👑"; position:absolute; top:-18px; right:-8px;
          font-size:20px; animation:adm-crown 2s ease-in-out infinite; z-index:10;
        }

        /* Text class — admin rainbow */
        .text-admin {
          background:linear-gradient(90deg,#ff6b6b,#ffd700,#4ecdc4,#8b5cf6,#ff6b6b) !important;
          background-size:300% 100% !important;
          -webkit-background-clip:text !important; -webkit-text-fill-color:transparent !important;
          background-clip:text !important; font-weight:800 !important;
          animation:adm-hue 3s linear infinite !important;
        }
        .text-basic { color:#333 !important; }
      `}</style>

      <div className="mb-8">
        <AdminPageHeader
          icon={Crown}
          title="Mon Profil Admin"
          subtitle="Gérez votre apparence publique sur la plateforme."
        />
      </div>

      {message && (
        <div
          className={`p-4 mb-6 rounded-xl shadow-sm ${message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
            } flex items-center justify-between`}
        >
          <span className="flex items-center gap-2 font-medium">
            {message.type === "success" ? (
              <div className="w-2 h-2 rounded-full bg-green-500" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-red-500" />
            )}
            {message.text}
          </span>
          <button
            onClick={() => setMessage(null)}
            className="font-bold hover:bg-black/5 p-1 rounded-full transition-colors"
          >
            <div className="w-4 h-4 flex items-center justify-center">×</div>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column - Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* Personal Info Card */}
          <div className="bg-white rounded-[20px] shadow-sm border border-[rgba(197,161,72,0.25)] overflow-hidden">
            <div className="bg-[var(--greek-blue)]/5 px-8 py-6 border-b border-[rgba(197,161,72,0.25)] flex items-center gap-3">
              <User className="text-[var(--greek-blue)]" size={24} />
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                Profil public
              </h2>
            </div>
            <div className="p-8">
              <form onSubmit={handleUpdateProfile}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Pseudo public *
                    </label>
                    <input
                      type="text"
                      value={formData.child_username}
                      onChange={(e) =>
                        setFormData({ ...formData, child_username: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all font-bold"
                      placeholder="Ex: Admin Educalcul"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email de Contact
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      className="w-full px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl bg-gray-50 text-gray-400 outline-none cursor-not-allowed"
                      disabled
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Style du Texte
                    </label>
                    <div className="relative">
                      <select
                        value={formData.name_animation}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            name_animation: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all appearance-none bg-white"
                      >
                        <option value="none">Aucun style</option>
                        <optgroup label="✦ Admin exclusif">
                          <option value="text-admin">👑 Admin (arc-en-ciel)</option>
                        </optgroup>
                        <optgroup label="Abonnements">
                          <option value="name-elite">Élite (obsidian violet-cyan)</option>
                          <option value="name-flame">Flamme</option>
                          <option value="name-pro-animated">Annuel Pro (or)</option>
                          <option value="name-purple-animated">Premium (violet)</option>
                          <option value="name-teal-animated">Famille (turquoise)</option>
                        </optgroup>
                        <optgroup label="Badges">
                          <option value="name-diamond-animated">Diamant</option>
                          <option value="name-gold-animated">Or</option>
                          <option value="name-silver-animated">Argent</option>
                          <option value="name-bronze-animated">Bronze</option>
                        </optgroup>
                        <optgroup label="Autre">
                          <option value="text-basic">Texte Basique</option>
                        </optgroup>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2.5 4.5L6 8L9.5 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contour de l'Avatar
                    </label>
                    <div className="relative">
                      <select
                        value={formData.avatar_border}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            avatar_border: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all appearance-none bg-white"
                      >
                        <option value="none">Aucun contour</option>
                        <optgroup label="✦ Admin exclusif">
                          <option value="border-admin">👑 Admin (arc-en-ciel)</option>
                        </optgroup>
                        <optgroup label="Abonnements">
                          <option value="border-elite">Élite (obsidian violet)</option>
                          <option value="border-flamme">Flamme</option>
                          <option value="border-pro">Annuel Pro</option>
                          <option value="border-premium">Premium</option>
                          <option value="border-famille">Famille</option>
                        </optgroup>
                        <optgroup label="Badges">
                          <option value="border-diamond">Diamant</option>
                          <option value="border-gold">Or</option>
                          <option value="border-silver">Argent</option>
                          <option value="border-bronze">Bronze</option>
                        </optgroup>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2.5 4.5L6 8L9.5 4.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-[rgba(197,161,72,0.25)] rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>

                {/* Avatar bloqué — toujours logo.png */}
                <div className="mb-8 flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <img src={ADMIN_AVATAR} alt="Logo" className="w-12 h-12 rounded-xl object-contain" />
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Photo de profil</p>
                    <p className="text-xs text-gray-400 mt-0.5">Le logo du site est utilisé comme photo admin — non modifiable.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full md:w-auto px-8 py-3 bg-[var(--greek-blue)] text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)] focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Save size={20} />
                  {saving ? "Enregistrement..." : "Sauvegarder"}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-6">
            <AdminTotpCard />
          </div>
        </div>

        {/* Sidebar - Preview */}
        <div className="lg:col-span-1">
          <div className="bg-white/95 border-2 border-[var(--greek-gold)] rounded-2xl shadow-xl overflow-hidden sticky top-6">
            <div className="bg-[var(--greek-cream)] border-b-2 border-[var(--greek-gold)] p-4 font-serif font-bold text-[var(--greek-bronze)] flex items-center gap-2 text-xl">
              <Eye size={20} />
              Aperçu du Profil
            </div>
            <div className="p-6 text-center">
              <div className="flex justify-center mb-8 relative">
                {/* outer: border + animation — overflow:visible pour que ::after (couronne) soit visible */}
                <div className={`w-32 h-32 rounded-full transition-all duration-300 ${formData.avatar_border}`}
                     style={{ overflow: "visible" }}>
                  {/* inner: clip circulaire de l'image */}
                  <div className="w-full h-full rounded-full overflow-hidden bg-white">
                    <img
                      src={ADMIN_AVATAR}
                      alt="Logo admin"
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                </div>
              </div>

              <h4
                className={`text-2xl mb-4 transition-all duration-300 font-bold ${formData.name_animation}`}
              >
                {formData.child_username || "Pseudo admin"}
              </h4>

              <div className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[var(--greek-gold)] rounded-lg bg-[var(--greek-cream)] shadow-sm">
                <Shield className="text-[var(--greek-blue)] w-5 h-5" />
                <span className="font-serif font-bold text-[var(--greek-bronze)] text-sm">
                  Administrateur
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
