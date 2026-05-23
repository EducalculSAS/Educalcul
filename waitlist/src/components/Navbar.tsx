/* Copie exacte du Navbar du site — adapté SPA (Link → button, pas de auth) */
import { useState, useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";

export type View = "landing" | "offres" | "tarifs" | "faq" | "contact" | "dashboard" | "leaderboard";

interface NavbarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isLoggedIn?: boolean;
}

const SITE_URL = "https://educalcul.fr"; // URL du vrai site

export default function Navbar({ currentView, onViewChange, isLoggedIn }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!isOpen) return;
      if (navRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const nav = (view: View) => {
    onViewChange(view);
    setIsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const navBtn = (view: View, label: string) => (
    <button
      onClick={() => nav(view)}
      className="text-[var(--greek-cream)] hover:text-[var(--greek-gold)] font-[family-name:var(--font-display)] py-2 px-4 rounded-md transition-all duration-300 hover:translate-x-1 text-left bg-transparent border-none cursor-pointer w-full"
    >
      {label}
    </button>
  );

  return (
    <nav ref={navRef} className="fixed top-0 left-0 right-0 z-[1030] bg-[var(--greek-blue)] h-[64px] min-h-[64px] px-4 shadow-md">
      <div className="container mx-auto flex items-center justify-between h-full max-w-7xl">
        {/* Brand */}
        <button
          onClick={() => nav("landing")}
          className="flex items-center text-[var(--greek-cream)] hover:text-white transition-colors gap-2 font-[family-name:var(--font-display)] font-bold text-xl bg-transparent border-none cursor-pointer"
        >
          <img src="/logo.png" alt="logo" className="w-9 h-9 relative -top-0.5" onError={e => (e.currentTarget.style.display = 'none')} />
          <span>Educalcul</span>
        </button>

        {/* Menu Toggle */}
        <button
          className="p-2 text-[var(--greek-cream)] hover:text-[var(--greek-gold)] transition-colors flex items-center gap-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Dropdown — identique au site */}
        <div
          className={`absolute top-[64px] right-0 w-full sm:w-80 bg-[var(--greek-blue)] border-b sm:border-l sm:border-b border-[var(--greek-gold)] shadow-xl flex flex-col z-[1040] transition-all duration-300 ease-in-out origin-top ${
            isOpen ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0 pointer-events-none"
          }`}
        >
          {/* Navigation Links */}
          <div className="flex flex-col p-4 gap-2">
            {navBtn("offres", "Offres")}
            {navBtn("tarifs", "Tarifs")}
            {navBtn("faq", "FAQ")}
            {navBtn("contact", "Contact")}
            {isLoggedIn && (
              <>
                {navBtn("dashboard", "Mon Tableau")}
                {navBtn("leaderboard", "Classement")}
              </>
            )}
          </div>

          <div className="h-px bg-[var(--greek-gold)] opacity-30 mx-4"></div>

          {/* CTA */}
          <div className="flex flex-col p-4 gap-2">
            <button
              onClick={() => { nav("landing"); setTimeout(() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" }), 100); }}
              className="btn-primary-greek text-center block w-full hover:-translate-y-px"
            >
              Rejoindre la waitlist
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
