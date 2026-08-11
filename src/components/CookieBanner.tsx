"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X, Check } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";

function getCookieConsent(): string | null {
  const match = document.cookie.match(/(?:^|; )cookie_consent=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Un vrai cookie (pas localStorage) : les `localStorage.clear()` des flux de
// déconnexion (Navbar, AdminSidebar, suppression de compte...) effaçaient ce
// choix avec le reste, faisant réapparaître la bannière après une simple
// déconnexion — un cookie dédié survit à tout ça naturellement, 1 an.
function setCookieConsent(value: "accepted" | "declined") {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `cookie_consent=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsent()) setVisible(true);
  }, []);

  const accept = () => {
    setCookieConsent("accepted");
    setVisible(false);
    window.dispatchEvent(new Event("cookie_consent_accepted"));
  };

  const decline = () => {
    setCookieConsent("declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-[var(--greek-blue)] text-white px-4 py-4 shadow-2xl">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="w-5 h-5 text-[var(--greek-gold)] shrink-0 mt-0.5" />
          <p className="text-sm text-white/90 leading-relaxed">
            Nous utilisons des cookies et données de navigation pour améliorer votre expérience. En continuant, vous acceptez notre{" "}
            <Link href="/politique-confidentialite" className="text-[var(--greek-gold)] underline hover:no-underline">
              politique de confidentialité
            </Link>{" "}
            et nos{" "}
            <Link href="/cgu" className="text-[var(--greek-gold)] underline hover:no-underline">
              CGU
            </Link>.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <GlassButton onClick={decline} variant="light" size="sm">
            <X className="w-4 h-4" /> Refuser
          </GlassButton>
          <GlassButton onClick={accept} variant="gold" size="sm">
            <Check className="w-4 h-4" /> Accepter
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
