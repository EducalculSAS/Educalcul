/**
 * Interactivite legere pour les nouveaux blocs pedagogiques (suite logique,
 * rapporteur, patron 3D, plan complexe). Meme convention que
 * clockInteractive.ts / trigCircleInteractive.ts : tracé statique compilé
 * côté serveur, DOM vanilla, idempotent via dataset.wired.
 */

function wirePatternMaker(figure: HTMLElement) {
  const buttons = figure.querySelectorAll<HTMLButtonElement>(".pattern-option");
  if (!buttons.length || figure.dataset.wired) return;
  figure.dataset.wired = "1";
  const correct = figure.dataset.correct ?? "";
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("pattern-option-correct", "pattern-option-wrong"));
      if (btn.dataset.answer === correct) {
        btn.classList.add("pattern-option-correct");
      } else {
        btn.classList.add("pattern-option-wrong");
      }
    });
  });
}

function wireProtractor(figure: HTMLElement) {
  const slider = figure.querySelector<HTMLInputElement>(".protractor-slider");
  const valueLabel = figure.querySelector<HTMLElement>(".protractor-value");
  const arm = figure.querySelector<SVGLineElement>(".protractor-arm");
  if (!slider || !arm || slider.dataset.wired) return;
  slider.dataset.wired = "1";
  const cx = 100, cy = 100, r = 65;
  const apply = (angleDeg: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    arm.setAttribute("x2", (cx - r * Math.cos(rad)).toFixed(1));
    arm.setAttribute("y2", (cy - r * Math.sin(rad)).toFixed(1));
    if (valueLabel) valueLabel.textContent = `${Math.round(angleDeg)}°`;
  };
  slider.addEventListener("input", () => apply(parseFloat(slider.value)));
  apply(parseFloat(slider.value));
}

function wireNetFolder(figure: HTMLElement) {
  const slider = figure.querySelector<HTMLInputElement>(".net-folder-slider");
  const cube = figure.querySelector<HTMLElement>(".nf-cube");
  if (!slider || !cube || slider.dataset.wired) return;
  slider.dataset.wired = "1";
  slider.addEventListener("input", () => {
    cube.style.setProperty("--fold", slider.value);
  });
}

function wireCompassTool(figure: HTMLElement) {
  const svg = figure.querySelector<SVGSVGElement>(".compass-svg");
  const handle = figure.querySelector<SVGCircleElement>(".compass-handle");
  const circle = figure.querySelector<SVGCircleElement>(".compass-circle");
  const radiusLine = figure.querySelector<SVGLineElement>(".compass-radius-line");
  if (!svg || !handle || !circle || !radiusLine || svg.dataset.wired) return;
  svg.dataset.wired = "1";

  const vb = svg.viewBox.baseVal;
  const cx = vb.width / 2;
  const cy = vb.height / 2;
  const scale = parseFloat(svg.dataset.scale || "15");
  const maxR = parseFloat(svg.dataset.maxR || "82");
  let dragging = false;

  const apply = (r: number) => {
    const clamped = Math.max(8, Math.min(maxR, r));
    circle.setAttribute("r", clamped.toFixed(1));
    handle.setAttribute("cx", (cx + clamped).toFixed(1));
    radiusLine.setAttribute("x2", (cx + clamped).toFixed(1));
  };

  const pointToRadius = (clientX: number, clientY: number) => {
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * vb.width;
    const y = ((clientY - rect.top) / rect.height) * vb.height;
    void scale;
    return Math.hypot(x - cx, y - cy);
  };

  const onDown = (e: PointerEvent) => {
    dragging = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    apply(pointToRadius(e.clientX, e.clientY));
  };
  const onUp = () => { dragging = false; };

  handle.style.cursor = "grab";
  handle.addEventListener("pointerdown", onDown);
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerup", onUp);
  svg.addEventListener("pointerleave", onUp);
}

function wireScientificNotation(figure: HTMLElement) {
  const svg = figure.querySelector<SVGSVGElement>(".sci-notation-svg");
  const handle = figure.querySelector<SVGCircleElement>(".sci-notation-handle");
  const expEl = figure.querySelector<HTMLElement>(".sci-notation-exp");
  if (!svg || !handle || !expEl || svg.dataset.wired) return;
  svg.dataset.wired = "1";

  const minExp = parseFloat(svg.dataset.minExp || "-6");
  const maxExp = parseFloat(svg.dataset.maxExp || "6");
  const width = parseFloat(svg.dataset.width || "260");
  const value = parseFloat(figure.dataset.value || "1");
  let dragging = false;

  const apply = (exp: number) => {
    const clamped = Math.max(minExp, Math.min(maxExp, Math.round(exp)));
    const x = 20 + ((clamped - minExp) / (maxExp - minExp)) * (width - 40);
    handle.setAttribute("cx", x.toFixed(1));
    expEl.textContent = String(clamped);
    void value;
  };

  const xToExp = (clientX: number) => {
    const rect = svg.getBoundingClientRect();
    const scaleFactor = width / rect.width;
    const x = (clientX - rect.left) * scaleFactor;
    return minExp + ((x - 20) / (width - 40)) * (maxExp - minExp);
  };

  const onDown = (e: PointerEvent) => {
    dragging = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    apply(xToExp(e.clientX));
  };
  const onUp = () => { dragging = false; };

  handle.style.cursor = "grab";
  handle.addEventListener("pointerdown", onDown);
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerup", onUp);
  svg.addEventListener("pointerleave", onUp);
}

function wireComplexToggle(figure: HTMLElement) {
  const toggle = figure.querySelector<HTMLElement>(".complex-toggle");
  const btn = figure.querySelector<HTMLButtonElement>(".complex-toggle-btn");
  const valueEl = figure.querySelector<HTMLElement>(".complex-toggle-value");
  if (!toggle || !btn || !valueEl || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  let showingAlgebraic = true;
  btn.addEventListener("click", () => {
    showingAlgebraic = !showingAlgebraic;
    valueEl.textContent = showingAlgebraic
      ? toggle.dataset.algebraic ?? ""
      : toggle.dataset.polar ?? "";
  });
}

export function enhanceNewPlugins(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;
  root.querySelectorAll<HTMLElement>(".course-figure-pattern-maker").forEach(wirePatternMaker);
  root.querySelectorAll<HTMLElement>(".course-figure-protractor").forEach(wireProtractor);
  root.querySelectorAll<HTMLElement>(".course-figure-net-folder").forEach(wireNetFolder);
  root.querySelectorAll<HTMLElement>(".course-figure-compass").forEach(wireCompassTool);
  root.querySelectorAll<HTMLElement>(".course-figure-sci-notation").forEach(wireScientificNotation);
  root.querySelectorAll<HTMLElement>(".course-figure-graph .complex-toggle").forEach((el) =>
    wireComplexToggle(el.closest(".course-figure") as HTMLElement ?? el),
  );
}
