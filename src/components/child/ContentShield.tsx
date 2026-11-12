"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getMyProfile } from "@/lib/updateMyProfile";

/**
 * Protection des contenus (cours, exercices, quiz, révisions) contre l'export et la triche à l'IA, dans l'espace élève.
 *
 * Ce qui est réellement empêché : copier, couper, glisser le texte ou les images, ouvrir le menu contextuel, imprimer
 * ou enregistrer la page, et coller une réponse toute faite dans un champ d'exercice ou de quiz.
 * Ce qui est seulement découragé : la capture d'écran. Aucun site web ne peut l'interdire (ni la photo prise avec un
 * téléphone), ni savoir qu'elle a lieu. On la rend traçable : un filigrane au nom de l'élève couvre la page, trop pâle
 * pour être vu à la lecture, mais présent dans toute capture (il ressort dès qu'on pousse le contraste de l'image).
 *
 * La sélection du texte reste possible dans les cours : elle sert à demander une explication à Calia.
 * Monté dans le layout élève ; inactif hors des pages de contenu et pour un admin qui prévisualise.
 */
const CONTENT_PATH = /^\/child\/(cours|exercises|quiz)\/[^/]+|^\/child\/revisions/;
const ANSWER_PATH = /^\/child\/(exercises|quiz)\/[^/]+|^\/child\/revisions/;

const isField = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export default function ContentShield() {
  const pathname = usePathname() || "";
  const active = CONTENT_PATH.test(pathname);
  const answers = ANSWER_PATH.test(pathname);
  const [who, setWho] = useState<string | null>(null);

  // Qui regarde : seul un élève est concerné ; son pseudo sert au filigrane.
  useEffect(() => {
    if (!active || who !== null) return;
    let alive = true;
    void getMyProfile<{ role?: string; child_username?: string | null; first_name?: string | null; id?: number }>().then((p) => {
      if (!alive) return;
      setWho(p?.role === "child" ? `${p.child_username || p.first_name || "élève"} · n° ${p.id ?? ""}` : "");
    });
    return () => { alive = false; };
  }, [active, who]);

  const on = active && !!who;

  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    root.setAttribute("data-shield", answers ? "answers" : "course");

    const block = (e: Event) => { e.preventDefault(); };
    // Copier / couper : interdit sur le contenu, permis dans un champ (l'élève peut reprendre ce qu'il a tapé).
    const onCopy = (e: ClipboardEvent) => { if (!isField(e.target)) e.preventDefault(); };
    // Coller dans un champ de réponse : interdit (réponse d'une IA collée telle quelle).
    const onPaste = (e: ClipboardEvent) => { if (answers && isField(e.target)) e.preventDefault(); };
    const onDrop = (e: DragEvent) => { if (answers && isField(e.target)) e.preventDefault(); };
    const onContext = (e: MouseEvent) => { if (!isField(e.target)) e.preventDefault(); };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "p" || k === "s" || (k === "c" && !isField(e.target)))) e.preventDefault();
    };
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("dragstart", block, true);
    document.addEventListener("contextmenu", onContext, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    return () => {
      root.removeAttribute("data-shield");
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("dragstart", block, true);
      document.removeEventListener("contextmenu", onContext, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
    };
  }, [on, answers]);

  if (!on) return null;
  return (
    <>
      {/* Filigrane : le nom de l'élève, répété en diagonale, presque invisible à la lecture mais présent sur toute capture. */}
      <div aria-hidden="true" className="content-watermark" style={{ ["--wm" as string]: `"${who!.replace(/["\\]/g, "")}"` }}>
        {Array.from({ length: 48 }).map((_, i) => <span key={i} />)}
      </div>
    </>
  );
}
