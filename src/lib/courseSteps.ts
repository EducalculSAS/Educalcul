/**
 * Révélation progressive des démonstrations/preuves : l'IA écrit chaque
 * étape dans un <div class="course-step"> à l'intérieur d'un conteneur
 * <div class="course-steps">, et ce module ne montre les étapes qu'une par
 * une (bouton "Étape suivante"), plutôt que toute la démonstration d'un
 * coup — ça réduit la charge cognitive et laisse l'élève chercher la suite
 * avant de la voir.
 */
export function enhanceCourseSteps(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;

  root.querySelectorAll<HTMLElement>(".course-steps").forEach((container) => {
    if (container.dataset.enhanced) return;
    container.dataset.enhanced = "1";

    const steps = Array.from(
      container.querySelectorAll<HTMLElement>(":scope > .course-step"),
    );
    if (steps.length <= 1) return;

    steps.forEach((step, i) => {
      if (i > 0) step.classList.add("course-step-hidden");
    });

    const button = document.createElement("button");
    button.type = "button";
    button.className = "course-step-reveal-btn";

    let revealed = 1;
    const updateButton = () => {
      button.textContent = `Étape suivante (${revealed + 1}/${steps.length})`;
    };
    updateButton();

    button.addEventListener("click", () => {
      if (revealed >= steps.length) return;
      steps[revealed].classList.remove("course-step-hidden");
      steps[revealed].classList.add("course-step-enter");
      revealed++;
      if (revealed >= steps.length) {
        button.remove();
      } else {
        updateButton();
        steps[revealed - 1].insertAdjacentElement("afterend", button);
      }
    });

    steps[0].insertAdjacentElement("afterend", button);
  });
}
