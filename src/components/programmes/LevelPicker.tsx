"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { SCHOOL_LEVELS } from "@/lib/constants";
import { supabase } from "@/lib/supabaseClient";
import { getClientCookie, setClientCookie } from "@/lib/clientCookie";

export const GOTO_LEVEL_EVENT = "programmes:goto-level";

/** Émis à l'initialisation (niveau déterminé) et à chaque changement manuel :
 * LevelGroupsList (autre client island, rendu plus bas dans une section au
 * fond différent) écoute cet évènement pour ouvrir/surligner/scroller vers
 * la bonne carte, sans état React partagé entre les deux composants. */
function announceLevel(level: string) {
  window.dispatchEvent(new CustomEvent(GOTO_LEVEL_EVENT, { detail: level }));
}

/** Sélecteur "Mon niveau" du hero. Isolé en client island : le reste du hero
 * (titre, description, décor) reste rendu côté serveur. */
export default function LevelPicker() {
  const [myLevel, setMyLevel] = useState("");

  useEffect(() => {
    const init = async () => {
      const stored = getClientCookie("programmes-my-level");
      if (stored) {
        setMyLevel(stored);
        announceLevel(stored);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: userData } = await supabase
            .from("users")
            .select("grade_level")
            .eq("auth_id", session.user.id)
            .maybeSingle();
          if (userData?.grade_level) {
            setMyLevel(userData.grade_level);
            announceLevel(userData.grade_level);
          }
        }
      } catch {}
    };
    init();
  }, []);

  const goToLevel = (level: string) => {
    setMyLevel(level);
    setClientCookie("programmes-my-level", level);
    announceLevel(level);
  };

  return (
    <div className="flex items-center justify-center gap-3 mb-10 flex-wrap">
      <label htmlFor="my-level" className="flex items-center gap-2 text-sm font-semibold text-white/70 font-[family-name:var(--font-display)]">
        <GraduationCap size={18} style={{ color: "var(--greek-gold)" }} />
        Mon niveau
      </label>
      <select
        id="my-level"
        value={myLevel}
        onChange={(e) => goToLevel(e.target.value)}
        className="px-4 py-2 rounded-xl text-sm font-bold bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[var(--greek-gold)]/50"
        style={{ colorScheme: "dark" }}
      >
        <option value="" disabled>Choisir mon niveau...</option>
        {SCHOOL_LEVELS.map((l) => (
          <option key={l.value} value={l.value} style={{ color: "#1a1008" }}>{l.label}</option>
        ))}
      </select>
    </div>
  );
}
