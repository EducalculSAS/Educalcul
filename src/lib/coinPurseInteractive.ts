/**
 * Porte-monnaie interactif : cliquer une pièce/billet l'ajoute ou le retire
 * du total affiché. Le tracé (pièces/billets) reste celui compile côté
 * serveur — jamais recalcule ici — meme pattern que enhanceClocks.
 */

function formatCentimes(centimes: number): string {
  if (centimes % 100 === 0) return `${centimes / 100} €`;
  if (centimes >= 100) return `${(centimes / 100).toFixed(2).replace(".", ",")} €`;
  return `${centimes} c`;
}

function wireCoinPurse(figure: HTMLElement) {
  const items = figure.querySelectorAll<HTMLElement>(".coin-item");
  const totalValueEl = figure.querySelector<HTMLElement>(".coin-purse-total-value");
  const totalEl = figure.querySelector<HTMLElement>(".coin-purse-total");
  const resetBtn = figure.querySelector<HTMLButtonElement>(".coin-purse-reset");
  if (!items.length || !totalValueEl || !totalEl || resetBtn?.dataset.wired) return;
  if (resetBtn) resetBtn.dataset.wired = "1";

  const target = Number(totalEl.dataset.target ?? "0");
  const selected = new Set<HTMLElement>();

  const update = () => {
    let total = 0;
    selected.forEach((el) => {
      total += Number(el.dataset.value ?? "0");
    });
    totalValueEl.textContent = formatCentimes(total);
    totalEl.classList.toggle("coin-purse-total-match", total === target && total > 0);
  };

  items.forEach((item) => {
    const toggle = () => {
      if (selected.has(item)) {
        selected.delete(item);
        item.classList.remove("coin-item-selected");
      } else {
        selected.add(item);
        item.classList.add("coin-item-selected");
      }
      update();
    };
    item.addEventListener("click", toggle);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });

  resetBtn?.addEventListener("click", () => {
    selected.forEach((el) => el.classList.remove("coin-item-selected"));
    selected.clear();
    update();
  });

  update();
}

export function enhanceCoinPurses(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;
  root.querySelectorAll<HTMLElement>(".course-figure-coin-purse").forEach(wireCoinPurse);
}
