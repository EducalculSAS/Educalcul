"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, Check, MousePointerClick } from "lucide-react";
import GlassButton from "@/components/ui/GlassButton";
import Emblem3D from "@/components/Emblem3D";
import { updateMyProfile } from "@/lib/updateMyProfile";
import { TOURS, nextStepIndex, tourStorageKey, type TourRole } from "@/lib/tour/steps";

/**
 * Tutoriel guidé de première visite. L'écran est grisé, sauf la zone à regarder ou à cliquer ; une bulle explique quoi
 * faire, et l'utilisateur navigue lui-même de page en page (créer un enfant, ouvrir l'abonnement…). On n'en sort que
 * par le petit bouton en bas à droite, ou en allant au bout. L'avancement est gardé dans le navigateur (le tutoriel
 * reprend après un rechargement) et la fin est enregistrée sur le compte (`tour_completed`).
 */

interface Box { x: number; y: number; w: number; h: number }

const PAD = 8;
/** Délai avant de conclure qu'une cible n'existe pas sur la page (le menu et les données se chargent après le HTML). */
const MISSING_AFTER_MS = 2600;

function visibleBox(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  const s = getComputedStyle(el);
  if (s.visibility === "hidden" || s.display === "none") return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/** Premier élément visible parmi ceux qui correspondent au sélecteur (un même lien peut exister en version repliée). */
function findVisible(selector: string | undefined): { el: Element; box: Box } | null {
  if (!selector) return null;
  for (const el of Array.from(document.querySelectorAll(selector))) {
    const box = visibleBox(el);
    if (box) return { el, box };
  }
  return null;
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1);

export default function GuidedTour({ role, onDone }: { role: TourRole; onDone?: () => void }) {
  const steps = TOURS[role];
  const pathname = usePathname();
  const router = useRouter();
  const tu = role === "child";

  const [index, setIndex] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(tourStorageKey(role)));
      return Number.isInteger(saved) && saved > 0 && saved < steps.length ? saved : 0;
    } catch { return 0; }
  });
  const [closed, setClosed] = useState(false);
  /** Zone éclairée (cible, ou bouton du menu quand la cible est repliée). */
  const [box, setBox] = useState<Box | null>(null);
  const [onOpener, setOnOpener] = useState(false);
  /** La cible n'existe pas sur la page : la bulle propose de continuer sans elle. */
  const [missing, setMissing] = useState(false);
  /** Clic fait sur la zone éclairée : on attend la page suivante sans rien afficher par-dessus. */
  const [leaving, setLeaving] = useState(false);
  /** Transition douce de la zone éclairée juste après un changement d'étape. */
  const [gliding, setGliding] = useState(true);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const tipRef = useRef<HTMLDivElement>(null);
  const [tipH, setTipH] = useState(160);

  const step = steps[index];
  const targetRef = useRef<Element | null>(null);

  const finish = useCallback(() => {
    setClosed(true);
    try { localStorage.removeItem(tourStorageKey(role)); } catch {}
    void updateMyProfile({ tour_completed: true });
    onDone?.();
  }, [role, onDone]);

  const goTo = useCallback((i: number) => {
    if (i >= steps.length) { finish(); return; }
    try { localStorage.setItem(tourStorageKey(role), String(i)); } catch {}
    setBox(null); setOnOpener(false); setMissing(false); setLeaving(false); setGliding(true);
    setIndex(i);
  }, [steps.length, role, finish]);

  // ── Suivi de la page : une étape « clic » ou « formulaire » se termine en arrivant sur sa page d'arrivée ;
  // une étape liée à une page y ramène si on n'y est pas (rechargement, lien direct).
  useEffect(() => {
    if (closed || !step) return;
    if (step.to && pathname === step.to && step.path !== step.to) { goTo(index + 1); return; }
    if (step.path && pathname !== step.path) {
      const wanted = step.path;
      router.replace(wanted);
      // La page refuse l'accès ou renvoie ailleurs : on n'insiste pas, le tutoriel reprendra à la prochaine visite.
      const giveUp = setTimeout(() => { if (window.location.pathname !== wanted) setClosed(true); }, 6000);
      return () => clearTimeout(giveUp);
    }
    return undefined;
  }, [pathname, step, index, closed, goTo, router]);

  // ── Position de la cible, suivie à chaque image (défilement, ouverture du menu, redimensionnement).
  useEffect(() => {
    if (closed || !step) return;
    let raf = 0;
    let scrolled = false;
    const startedAt = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      setVp((v) => (v.w === window.innerWidth && v.h === window.innerHeight ? v : { w: window.innerWidth, h: window.innerHeight }));
      if (!step.target || (step.path && window.location.pathname !== step.path)) { targetRef.current = null; setBox((b) => (b ? null : b)); return; }
      const hit = findVisible(step.target);
      if (hit) {
        targetRef.current = hit.el;
        // Cible hors de l'écran ou plus haute que lui : on l'amène une fois en vue. Une grande zone (liste, formulaire)
        // est calée en haut, sous la barre de navigation ; une petite est centrée.
        const tall = step.action === "form" || hit.box.h > window.innerHeight * 0.5;
        if (!scrolled && (hit.box.y < 72 || hit.box.y + Math.min(hit.box.h, 200) > window.innerHeight - 40)) {
          if (tall) window.scrollTo({ top: window.scrollY + hit.box.y - (step.action === "form" ? 250 : 96), behavior: "smooth" });
          else hit.el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        scrolled = true;
        setOnOpener(false); setMissing(false);
        setBox((b) => (sameBox(b, hit.box) ? b : hit.box));
        return;
      }
      targetRef.current = null;
      const exists = !!document.querySelector(step.target);
      const opener = exists ? findVisible(step.opener) : null;
      if (opener) {
        targetRef.current = opener.el;
        setOnOpener(true); setMissing(false);
        setBox((b) => (sameBox(b, opener.box) ? b : opener.box));
        return;
      }
      setBox((b) => (b ? null : b));
      if (performance.now() - startedAt > MISSING_AFTER_MS) {
        if (!exists && step.optional) { cancelAnimationFrame(raf); goTo(nextStepIndex(steps, index, true)); }
        else setMissing(true);
      }
    };
    raf = requestAnimationFrame(tick);
    const glide = setTimeout(() => setGliding(false), 450);
    return () => { cancelAnimationFrame(raf); clearTimeout(glide); };
  }, [step, index, steps, closed, goTo]);

  // ── Clic sur la zone éclairée d'une étape « clic » : on masque la bulle le temps que la page suivante arrive.
  useEffect(() => {
    if (closed || !step || step.action !== "click") return;
    const onClick = (e: MouseEvent) => {
      const t = targetRef.current;
      if (!t || onOpener || !(e.target instanceof Node) || !t.contains(e.target)) return;
      setLeaving(true);
      setTimeout(() => setLeaving(false), 6000);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, closed, onOpener]);

  const hasBox = box !== null;
  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  }, [index, onOpener, missing, hasBox, vp.w]);

  if (closed || !step || vp.w === 0) return null;
  // Entre deux pages (clic fait, ou redirection en cours) : écran simplement grisé, sans bulle.
  const offPage = !!step.path && pathname !== step.path;
  if (leaving || offPage) return <div className="fixed inset-0 z-[9990] bg-[rgba(8,15,30,0.45)]" aria-hidden="true" />;

  const waiting = !!step.target && !box && !missing; // cible attendue, pas encore affichée
  const isForm = step.action === "form" && !missing;
  const interactive = !!box && (onOpener || step.action === "click" || step.action === "form");

  // Zone éclairée, bornée à l'écran. Une zone très haute (une liste entière) n'est éclairée que sur son début, pour
  // garder l'effet de projecteur et la place de la bulle ; un formulaire, lui, reste éclairé en entier.
  const top = box ? Math.max(4, box.y - PAD) : 0;
  const lit = box && {
    x: Math.max(4, box.x - PAD),
    y: top,
    r: Math.min(vp.w - 4, box.x + box.w + PAD),
    b: Math.min(vp.h - 4, box.y + box.h + PAD, step.action === "form" ? Infinity : top + Math.max(120, vp.h * 0.5)),
  };
  // Cible sortie de l'écran (défilement) : voile plein plutôt qu'une zone écrasée.
  const hole = lit && lit.b - lit.y >= 16 && lit.r - lit.x >= 16 ? lit : null;
  const centered = !step.target || missing || !hole;

  // Bulle : sous la cible si la place le permet, sinon au-dessus, sinon en bas de l'écran. Pour un formulaire,
  // elle reste en haut, sous la barre de navigation, pour ne pas gêner la saisie.
  const tipW = Math.min(360, vp.w - 24);
  let tipStyle: React.CSSProperties;
  if (centered || !hole) {
    tipStyle = { left: (vp.w - tipW) / 2, top: Math.max(16, (vp.h - tipH) / 2) };
  } else if (isForm) {
    tipStyle = { left: (vp.w - tipW) / 2, top: 72 };
  } else {
    const cx = (hole.x + hole.r) / 2;
    const left = Math.min(vp.w - tipW - 12, Math.max(12, cx - tipW / 2));
    if (hole.b + 12 + tipH < vp.h - 60) tipStyle = { left, top: hole.b + 12 };
    else if (hole.y - 12 - tipH > 8) tipStyle = { left, top: hole.y - 12 - tipH };
    else tipStyle = { left: (vp.w - tipW) / 2, top: Math.max(8, vp.h - tipH - 64) };
  }

  const last = index === steps.length - 1;
  const title = onOpener ? "Le menu" : step.title;
  const text = missing
    ? (tu ? "Cette étape n'est pas disponible pour le moment. On continue ?" : "Cette étape n'est pas disponible pour le moment. Continuons.")
    : onOpener ? (step.openerText || (tu ? "Ouvre le menu." : "Ouvrez le menu.")) : step.text;

  const next = () => {
    // Cible introuvable sur une étape qui mène ailleurs : on y va directement, l'étape se valide à l'arrivée.
    if (missing && step.to && pathname !== step.to) { router.push(step.to); return; }
    goTo(index + 1);
  };
  const later = () => { if (step.to) router.push(step.to); else goTo(index + 1); };

  const blocker = "fixed z-[9990] bg-transparent";
  return (
    <div data-tour-root aria-live="polite">
      {hole ? (
        <>
          {/* Voile : une ombre immense autour de la zone éclairée. */}
          <div
            aria-hidden="true"
            className={`tour-hole fixed z-[9990] pointer-events-none rounded-2xl ${gliding ? "tour-hole-glide" : ""}`}
            style={{ left: hole.x, top: hole.y, width: hole.r - hole.x, height: hole.b - hole.y }}
          />
          {/* Quatre panneaux invisibles bloquent les clics hors de la zone ; un cinquième la couvre quand il n'y a rien à cliquer. */}
          <div className={blocker} style={{ left: 0, top: 0, width: vp.w, height: hole.y }} />
          <div className={blocker} style={{ left: 0, top: hole.b, width: vp.w, height: Math.max(0, vp.h - hole.b) }} />
          <div className={blocker} style={{ left: 0, top: hole.y, width: hole.x, height: hole.b - hole.y }} />
          <div className={blocker} style={{ left: hole.r, top: hole.y, width: Math.max(0, vp.w - hole.r), height: hole.b - hole.y }} />
          {!interactive && <div className={blocker} style={{ left: hole.x, top: hole.y, width: hole.r - hole.x, height: hole.b - hole.y }} />}
        </>
      ) : (
        <div className="fixed inset-0 z-[9990] bg-[rgba(8,15,30,0.62)]" aria-hidden="true" />
      )}

      {!waiting && (
        <div
          ref={tipRef}
          role="dialog"
          aria-label={title}
          className="tour-tip fixed z-[9992] bg-white rounded-[20px] p-5 shadow-2xl border border-[rgba(197,161,72,0.45)]"
          style={{ width: tipW, ...tipStyle }}
        >
          {/* Accueil et fin du tutoriel : une illustration en relief (boussole au départ, trophée à l'arrivée). */}
          {!step.target && (index === 0 || last) && (
            <div className="flex justify-center mb-2"><Emblem3D kind={last ? "trophy" : "compass"} size={84} /></div>
          )}
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--greek-gold-text)] mb-1">
            Étape {index + 1} sur {steps.length}
          </p>
          <h2 className="text-lg font-bold text-[var(--greek-blue)] mb-1">{title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            {interactive && !missing ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--greek-blue)]">
                <MousePointerClick className="w-4 h-4 text-[var(--greek-gold)]" aria-hidden="true" />
                {isForm ? (tu ? "Remplis le formulaire" : "Remplissez le formulaire") : (tu ? "Clique sur la zone éclairée" : "Cliquez sur la zone éclairée")}
              </p>
            ) : <span />}
            {isForm && step.skipLabel && <GlassButton onClick={later} variant="ghost" size="sm">{step.skipLabel}</GlassButton>}
            {(!interactive || missing) && (
              <GlassButton onClick={last ? finish : next} variant="navy" size="sm">
                {last ? <>Terminer <Check className="w-4 h-4" /></> : <>{missing ? "Continuer" : "Suivant"} <ArrowRight className="w-4 h-4" /></>}
              </GlassButton>
            )}
          </div>
        </div>
      )}

      {/* Seule sortie possible avant la fin. Calia (même coin) remonte d'un cran pour ne pas se retrouver dessous. */}
      <CaliaLift />
      <div className="fixed z-[9993] bottom-4 right-4">
        <GlassButton onClick={finish} variant="navy" size="sm" className="!text-xs">
          {tu ? "Quitter le tuto" : "Quitter le tutoriel"}
        </GlassButton>
      </div>
    </div>
  );
}

function CaliaLift() {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--calia-lift", "48px");
    return () => { root.style.removeProperty("--calia-lift"); };
  }, []);
  return null;
}
