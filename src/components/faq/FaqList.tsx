"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FAQ_DATA, type FAQSection } from "@/lib/faqData";

function useScrollVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function FaqItem({ id, question, answer, openItem, setOpenItem }: {
  id: string;
  question: string;
  answer: ReactNode;
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
}) {
  const isOpen = openItem === id;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(197,161,72,0.18)", background: "#fff" }}>
      <button
        type="button"
        onClick={() => setOpenItem(isOpen ? null : id)}
        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-[rgba(197,161,72,0.03)]"
      >
        <span className="font-[family-name:var(--font-display)] font-semibold text-sm" style={{ color: "var(--greek-blue)" }}>{question}</span>
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-light transition-transform duration-300"
          style={{ background: "rgba(197,161,72,0.10)", color: "var(--greek-gold)", transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >+</span>
      </button>
      <div style={{ maxHeight: isOpen ? "400px" : "0px", overflow: "hidden", transition: "max-height 0.3s ease" }}>
        <div className="px-6 pb-5 pt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {answer}
        </div>
      </div>
    </div>
  );
}

function FaqSection({ section, sIdx, openItem, setOpenItem }: {
  section: FAQSection;
  sIdx: number;
  openItem: string | null;
  setOpenItem: (id: string | null) => void;
}) {
  const { ref, visible } = useScrollVisible();
  return (
    <div ref={ref} className="mb-10">
      <div className="flex items-center gap-4 mb-5"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: "opacity 0.4s 0ms, transform 0.4s 0ms" }}>
        <div className="w-6 h-px opacity-60" style={{ background: "var(--greek-gold)" }} />
        <h2 className="font-[family-name:var(--font-display)] font-bold text-base text-[var(--greek-blue)] uppercase tracking-wider">{section.title}</h2>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <div className="space-y-2.5">
        {section.items.map((item, iIdx) => (
          <div key={`${sIdx}-${iIdx}`}
            style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)", transition: `opacity 0.4s ${50 + iIdx * 55}ms, transform 0.4s ${50 + iIdx * 55}ms` }}>
            <FaqItem id={`${sIdx}-${iIdx}`} question={item.question} answer={item.answer} openItem={openItem} setOpenItem={setOpenItem} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Liste FAQ + accordéon : seule partie réellement interactive de la page,
 * isolée en client island (état d'ouverture partagé entre sections + reveal
 * au scroll). Le reste de /faq est rendu côté serveur. */
export default function FaqList() {
  const [openItem, setOpenItem] = useState<string | null>(null);
  return (
    <>
      {FAQ_DATA.map((section, sIdx) => (
        <FaqSection key={sIdx} section={section} sIdx={sIdx} openItem={openItem} setOpenItem={setOpenItem} />
      ))}
    </>
  );
}
