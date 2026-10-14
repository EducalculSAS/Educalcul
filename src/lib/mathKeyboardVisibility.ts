// Bus partagé : signale au reste de la page qu'un clavier mathématique est ouvert, pour que d'autres éléments
// flottants (ex : la bulle Calia en bas à droite) s'effacent tant qu'il occupe le bas de l'écran. Compteur, pas un
// simple booléen : plusieurs champs peuvent exister sur une page, et le focus peut passer directement de l'un à
// l'autre sans jamais repasser par « aucun clavier ouvert » entre les deux.
//
// Fichier à part (et non dans MathInput) : la bulle Calia est sur TOUTES les pages élève, et importer MathInput
// aurait chargé MathLive (800 Ko) partout, même sans champ de réponse.
type MathKeyboardVisibilityListener = (visible: boolean) => void;
const mathKeyboardListeners = new Set<MathKeyboardVisibilityListener>();
let mathKeyboardOpenCount = 0;
export function incrementMathKeyboardOpen() {
  mathKeyboardOpenCount += 1;
  mathKeyboardListeners.forEach((l) => l(mathKeyboardOpenCount > 0));
}
export function decrementMathKeyboardOpen() {
  mathKeyboardOpenCount = Math.max(0, mathKeyboardOpenCount - 1);
  mathKeyboardListeners.forEach((l) => l(mathKeyboardOpenCount > 0));
}
/** Pour savoir si un clavier mathématique est actuellement ouvert quelque part sur la page. */
export function subscribeMathKeyboardVisibility(listener: MathKeyboardVisibilityListener): () => void {
  mathKeyboardListeners.add(listener);
  listener(mathKeyboardOpenCount > 0);
  return () => {
    mathKeyboardListeners.delete(listener);
  };
}
