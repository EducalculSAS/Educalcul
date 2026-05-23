"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie, X, Check } from "lucide-react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  const accept = () => {
    localStorage.setItem("cookie_consent", "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem("cookie_consent", "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-[var(--greek-blue)] text-white px-4 py-4 shadow-2xl">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="w-5 h-5 text-[var(--greek-gold)] shrink-0 mt-0.5" />
          <p className="text-sm text-white/90 leading-relaxed">
            Nous utilisons des cookies essentiels au fonctionnement du site. En continuant, vous acceptez notre{" "}
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
          <button
            onClick={decline}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white/70 hover:text-white border border-white/30 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" /> Refuser
          </button>
          <button
            onClick={accept}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-[var(--greek-gold)] text-white rounded-lg hover:opacity-90 transition-all"
          >
            <Check className="w-4 h-4" /> Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
