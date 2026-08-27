// Petit bus partagé : signale au reste de la page qu'un CustomMathKeyboard
// (MathInput.tsx) est actuellement ouvert, pour que d'autres éléments flottants
// (ex: la bulle Epsi/AITutor en bas à droite) s'effacent pendant que le
// clavier occupe le bas de l'écran, et reviennent dès qu'il se ferme.
// Compteur (pas un simple booléen) : plusieurs champs MathInput peuvent
// exister sur une même page, et le focus peut passer directement de l'un à
// l'autre (blur de l'ancien + focus du nouveau) sans jamais repasser par
// "aucun clavier ouvert" entre les deux.
type Listener = (visible: boolean) => void;

const listeners = new Set<Listener>();
let openCount = 0;

function notify() {
  const visible = openCount > 0;
  listeners.forEach((l) => l(visible));
}

export function incrementMathKeyboardOpen() {
  openCount += 1;
  notify();
}

export function decrementMathKeyboardOpen() {
  openCount = Math.max(0, openCount - 1);
  notify();
}

export function subscribeMathKeyboardVisibility(listener: Listener): () => void {
  listeners.add(listener);
  listener(openCount > 0);
  return () => {
    listeners.delete(listener);
  };
}
