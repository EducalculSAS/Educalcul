/**
 * Aiguilles d'horloge déplaçables : glisser l'aiguille des heures ou des
 * minutes affiche l'heure lue en direct. Le cadran statique (cercle,
 * graduations, chiffres) reste celui déjà compilé côté serveur — jamais
 * recalculé ici — même pattern que enhanceTrigCircles
 * (src/lib/trigCircleInteractive.ts) : vanilla DOM, idempotent via
 * dataset.wired, câblé depuis le useEffect de CourseViewer.
 */

const CLOCK_CENTER_X = 100;
const CLOCK_CENTER_Y = 100;
const HOUR_HAND_LENGTH = 41;
const MINUTE_HAND_LENGTH = 64;

function angleFromPointer(svg: SVGSVGElement, clientX: number, clientY: number): number {
  const rect = svg.getBoundingClientRect();
  const viewBoxScale = 200 / rect.width;
  const x = (clientX - rect.left) * viewBoxScale - CLOCK_CENTER_X;
  const y = (clientY - rect.top) * viewBoxScale - CLOCK_CENTER_Y;
  const deg = (Math.atan2(x, -y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function pointOnHand(angleDeg: number, length: number): { x: number; y: number } {
  const radians = (angleDeg * Math.PI) / 180;
  return {
    x: CLOCK_CENTER_X + length * Math.sin(radians),
    y: CLOCK_CENTER_Y - length * Math.cos(radians),
  };
}

function formatReading(hours: number, minutes: number): string {
  const h = String(hours % 12 === 0 ? 12 : hours % 12).padStart(2, "0");
  const m = String(minutes).padStart(2, "0");
  return `${h} h ${m}`;
}

function wireClock(figure: HTMLElement) {
  const svg = figure.querySelector<SVGSVGElement>("svg.clock-svg");
  const hourHand = figure.querySelector<SVGLineElement>(".clock-hour-hand");
  const minuteHand = figure.querySelector<SVGLineElement>(".clock-minute-hand");
  const reading = figure.querySelector<HTMLElement>(".clock-reading");
  if (!svg || !hourHand || !minuteHand || svg.dataset.wired) return;
  svg.dataset.wired = "1";

  let hours = Number(svg.dataset.hours ?? "3");
  let minutes = Number(svg.dataset.minutes ?? "0");

  const render = () => {
    const hourAngle = (hours % 12) * 30 + minutes * 0.5;
    const minuteAngle = minutes * 6;
    const hp = pointOnHand(hourAngle, HOUR_HAND_LENGTH);
    const mp = pointOnHand(minuteAngle, MINUTE_HAND_LENGTH);
    hourHand.setAttribute("x2", hp.x.toFixed(1));
    hourHand.setAttribute("y2", hp.y.toFixed(1));
    minuteHand.setAttribute("x2", mp.x.toFixed(1));
    minuteHand.setAttribute("y2", mp.y.toFixed(1));
    if (reading) reading.textContent = formatReading(hours, minutes);
  };

  let dragging: "hour" | "minute" | null = null;

  const onPointerDown = (hand: "hour" | "minute") => (event: PointerEvent) => {
    dragging = hand;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    const angle = angleFromPointer(svg, event.clientX, event.clientY);
    if (dragging === "minute") {
      const next = Math.round(angle / 6) % 60;
      // Faire un tour complet de la grande aiguille avance (ou recule)
      // l'heure : sans ça, l'heure lue restait figée quand l'élève tournait
      // les minutes au-delà de 60.
      if (minutes >= 45 && next <= 15) {
        hours = (hours % 12) + 1;
      } else if (minutes <= 15 && next >= 45) {
        hours = ((hours + 10) % 12) + 1;
      }
      minutes = next;
    } else {
      hours = Math.round(angle / 30) % 12;
      if (hours === 0) hours = 12;
    }
    render();
  };

  const onPointerUp = () => {
    dragging = null;
  };

  hourHand.style.cursor = "grab";
  minuteHand.style.cursor = "grab";
  hourHand.addEventListener("pointerdown", onPointerDown("hour"));
  minuteHand.addEventListener("pointerdown", onPointerDown("minute"));
  svg.addEventListener("pointermove", onPointerMove);
  svg.addEventListener("pointerup", onPointerUp);
  svg.addEventListener("pointerleave", onPointerUp);

  render();
}

export function enhanceClocks(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;
  root.querySelectorAll<HTMLElement>(".course-figure-clock-interactive").forEach(wireClock);
}
