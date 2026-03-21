"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { User, Lock, Save, Key, Eye, Crown, Shield } from "lucide-react";

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
    avatar: "avatar1.png",
    name_animation: "soft-sparkle",
    avatar_border: "border-admin",
  });


  // Avatars list (matching PHP config)
  const avatars = [
    "avatar1.png",
    "avatar2.png",
    "avatar3.png",
    "avatar4.png",
    "avatar5.png",
    "avatar6.png",
    "avatar7.png",
    "avatar8.png",
  ];

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("auth_id", session.user.id)
        .single();

      if (error) throw error;

      setUser(data);
      setFormData({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        child_username: data.child_username || "",
        email: data.email || session.user.email || "",
        avatar: data.avatar || "avatar1.png",
        name_animation: data.name_animation || "soft-sparkle",
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



  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--greek-blue)]"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <style jsx global>{`
        /* Replicated Animations and Styles */
        @keyframes adminGlow {
          0%,
          100% {
            box-shadow: 0 0 40px rgba(255, 107, 107, 0.8),
              0 0 60px rgba(78, 205, 196, 0.7),
              inset 0 0 35px rgba(255, 234, 167, 0.4);
          }
          50% {
            box-shadow: 0 0 60px rgba(255, 107, 107, 1),
              0 0 80px rgba(78, 205, 196, 0.9),
              inset 0 0 50px rgba(255, 234, 167, 0.6);
          }
        }
        @keyframes adminRotate {
          0% {
            filter: hue-rotate(0deg);
          }
          100% {
            filter: hue-rotate(360deg);
          }
        }
        @keyframes adminHalo {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes crownFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }
        @keyframes goldPulse {
          0%,
          100% {
            box-shadow: 0 0 25px rgba(255, 215, 0, 0.8);
          }
          50% {
            box-shadow: 0 0 35px rgba(255, 215, 0, 1);
          }
        }
        @keyframes platinumShimmer {
          0%,
          100% {
            box-shadow: 0 0 30px rgba(229, 228, 226, 0.9);
          }
          50% {
            box-shadow: 0 0 40px rgba(229, 228, 226, 1);
          }
        }
        @keyframes diamondSparkle {
          0%,
          100% {
            filter: hue-rotate(0deg);
          }
          50% {
            filter: hue-rotate(180deg);
          }
        }
        @keyframes soft-sparkle {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.2);
          }
        }
        @keyframes adminTextGlow {
          0% {
            filter: brightness(1) saturate(1);
          }
          100% {
            filter: brightness(1.3) saturate(1.5);
          }
        }

        /* Border Classes */
        .avatar-border-basic {
          border: 3px solid #4a90e2;
          box-shadow: 0 0 10px rgba(74, 144, 226, 0.5);
        }
        .avatar-border-bronze {
          border: 4px solid #cd7f32;
          box-shadow: 0 0 15px rgba(205, 127, 50, 0.6);
        }
        .avatar-border-silver {
          border: 5px solid #c0c0c0;
          box-shadow: 0 0 20px rgba(192, 192, 192, 0.7);
        }
        .avatar-border-gold {
          border: 6px solid #ffd700;
          box-shadow: 0 0 25px rgba(255, 215, 0, 0.8);
          animation: goldPulse 3s ease-in-out infinite;
        }
        .avatar-border-platinum {
          border: 7px solid #e5e4e2;
          box-shadow: 0 0 30px rgba(229, 228, 226, 0.9);
          animation: platinumShimmer 4s ease-in-out infinite;
        }
        .avatar-border-diamond {
          border: 8px solid transparent;
          background: linear-gradient(45deg, #b9f2ff, #66d9ef, #a8e6cf, #dcedc1)
            border-box;
          box-shadow: 0 0 35px rgba(185, 242, 255, 0.9);
          animation: diamondSparkle 2.5s ease-in-out infinite;
        }
        .avatar-border-admin {
          position: relative;
          border: 10px solid transparent;
          background: linear-gradient(
                45deg,
                #ff6b6b,
                #4ecdc4,
                #45b7d1,
                #96ceb4,
                #ffeaa7,
                #dda0dd
              )
              border-box,
            linear-gradient(white, white) padding-box;
          box-shadow: 0 0 40px rgba(255, 107, 107, 0.8);
          animation: adminGlow 2s ease-in-out infinite,
            adminRotate 8s linear infinite;
        }
        .avatar-border-admin::after {
          content: "👑";
          position: absolute;
          top: -20px;
          right: -10px;
          font-size: 24px;
          animation: crownFloat 2s ease-in-out infinite;
          z-index: 10;
        }

        /* Text Classes */
        .text-basic {
          color: #333333 !important;
        }
        .text-bronze {
          color: #cd7f32 !important;
          text-shadow: 1px 1px 3px rgba(205, 127, 50, 0.5) !important;
          font-weight: 600 !important;
        }
        .text-silver {
          color: #c0c0c0 !important;
          text-shadow: 1px 1px 4px rgba(192, 192, 192, 0.6) !important;
          font-weight: 600 !important;
        }
        .text-gold {
          color: #ffd700 !important;
          text-shadow: 2px 2px 5px rgba(255, 215, 0, 0.7) !important;
          font-weight: 700 !important;
        }
        .text-platinum {
          color: #e5e4e2 !important;
          text-shadow: 2px 2px 6px rgba(229, 228, 226, 0.6) !important;
          font-weight: 700 !important;
        }
        .text-diamond {
          color: #b9f2ff !important;
          text-shadow: 2px 2px 8px rgba(185, 242, 255, 0.7) !important;
          font-weight: 700 !important;
        }
        .text-admin {
          background: linear-gradient(
            45deg,
            #ff6b6b,
            #4ecdc4,
            #45b7d1,
            #96ceb4,
            #ffeaa7,
            #dda0dd
          ) !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          font-weight: 700 !important;
          animation: adminTextGlow 3s ease-in-out infinite alternate !important;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white rounded-[20px] shadow-sm border border-[var(--greek-gold)]/30 p-8 relative overflow-hidden mb-8">
        <div className="absolute inset-0 opacity-5 pattern-grid-lg pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-[var(--greek-blue)] mb-2 font-[family-name:var(--font-display)] flex items-center gap-3">
            <Crown className="text-[var(--greek-gold)]" size={32} />
            Identité de Professeur
          </h1>
          <p className="text-[var(--greek-bronze)] text-lg">
            Gérez votre image publique et comment les héros vous voient dans le sanctuaire.
          </p>
        </div>
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
          <div className="bg-white rounded-[20px] shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-[var(--greek-blue)]/5 px-8 py-6 border-b border-gray-100 flex items-center gap-3">
              <User className="text-[var(--greek-blue)]" size={24} />
              <h2 className="text-xl font-bold text-[var(--greek-blue)] font-[family-name:var(--font-display)]">
                Branding Public
              </h2>
            </div>
            <div className="p-8">
              <form onSubmit={handleUpdateProfile}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nom de Professeur (Public) *
                    </label>
                    <input
                      type="text"
                      value={formData.child_username}
                      onChange={(e) =>
                        setFormData({ ...formData, child_username: e.target.value })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all font-bold"
                      placeholder="Ex: Prof. Archimède"
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
                      className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-gray-50 text-gray-400 outline-none cursor-not-allowed"
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all appearance-none bg-white"
                      >
                        <option value="none">Aucun style</option>
                        <optgroup label="🎮 Styles Gaming">
                          <option value="text-basic">🔵 Texte Basique</option>
                          <option value="text-bronze">🥉 Texte Bronze</option>
                          <option value="text-silver">🥈 Texte Argent</option>
                          <option value="text-gold">🥇 Texte Or</option>
                          <option value="text-platinum">💎 Texte Platine</option>
                          <option value="text-diamond">💠 Texte Diamant</option>
                          <option value="text-admin">
                            👑 Texte Admin Suprême
                          </option>
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
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all appearance-none bg-white"
                      >
                        <option value="none">Aucun contour</option>
                        <optgroup label="🎮 Contours Gaming">
                          <option value="border-basic">🔵 Contour Basique</option>
                          <option value="border-bronze">🥉 Contour Bronze</option>
                          <option value="border-silver">🥈 Contour Argent</option>
                          <option value="border-gold">🥇 Contour Or</option>
                          <option value="border-platinum">
                            💎 Contour Platine
                          </option>
                          <option value="border-diamond">
                            💠 Contour Diamant
                          </option>
                          <option value="border-admin">
                            👑 Contour Admin Suprême
                          </option>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[var(--greek-blue)] focus:border-transparent outline-none transition-all"
                    required
                  />
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-semibold text-gray-700 mb-4">
                    Avatar
                  </label>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                    {avatars.map((avatar) => (
                      <div
                        key={avatar}
                        onClick={() => setFormData({ ...formData, avatar })}
                        className={`cursor-pointer p-1 border-2 rounded-2xl transition-all hover:bg-[var(--greek-blue)]/5 ${formData.avatar === avatar
                          ? "border-[var(--greek-blue)] bg-[var(--greek-blue)]/5 scale-105"
                          : "border-transparent hover:border-[var(--greek-gold)]/50"
                          }`}
                      >
                        <img
                          src={`/avatars/${avatar}`}
                          alt={avatar}
                          className="w-full h-auto rounded-full border-2 border-white shadow-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full md:w-auto px-8 py-3 bg-[var(--greek-blue)] text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-[var(--greek-blue)] focus:ring-opacity-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Save size={20} />
                  {saving ? "Enregistrement..." : "Sauvegarder l'identité"}
                </button>
              </form>
            </div>
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
              <div className="flex justify-center mb-6 relative">
                <div className={`w-32 h-32 rounded-full overflow-hidden transition-all duration-300 ${formData.avatar_border}`}>
                  <img
                    src={`/avatars/${formData.avatar}`}
                    alt="Aperçu"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <h4
                className={`text-2xl mb-4 transition-all duration-300 font-bold ${formData.name_animation}`}
              >
                {formData.child_username || "Nom de Professeur"}
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
