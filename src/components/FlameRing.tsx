/**
 * Cadre « Flamme » : l'anneau de feu de l'illustration de référence (détourée : fond et centre retirés, voir public/avatar-frames/flamme.png).
 * Il remplace le cadre rigide : la bande de feu entoure l'avatar, avec la grande langue du dessus, les langues recourbées des côtés et la
 * bande jaune collée à l'avatar. Il vacille doucement (CSS, classes `rf-*` de globals.css) et des braises montent.
 * Composant sans état, dans le repère 100 × 100 de l'avatar ; `inset` = marge entre le bord de l'avatar et le bord du repère (même unité).
 */
const IMG_W = 432, IMG_H = 424; // taille de l'image
const HOLE_CX = 222, HOLE_CY = 266, HOLE_W = 260, HOLE_H = 240; // trou central de l'image (là où se place l'avatar)

export default function FlameRing({ inset }: { inset: number }) {
  const side = (100 - 2 * inset) * 1.0; // côté de l'avatar dans le repère
  const sx = side / HOLE_W, sy = side / HOLE_H;
  return (
    <g className="rf-fire">
      <g className="rf-flame-img">
        <image href="/avatar-frames/flamme.png" x={50 - HOLE_CX * sx} y={50 - HOLE_CY * sy} width={IMG_W * sx} height={IMG_H * sy} preserveAspectRatio="none" />
      </g>
      {[28, 44, 58, 72].map((x, i) => <circle key={x} className="rf-ember" style={{ animationDelay: `${-i * 0.5}s` }} cx={x} cy={50 - HOLE_CY * sy + 14} r={1} fill="#ffd23f" />)}
    </g>
  );
}
