/**
 * Cadre « Flamme » animé : l'anneau de feu (public/avatar-frames/flamme.png, détouré de l'illustration de référence) sert de corps, mais il
 * n'est pas figé — les langues ondulent pour de vrai grâce à un filtre SVG (bruit qui se déforme en continu), une deuxième couche
 * décalée en fondu additif donne la profondeur du feu qui coule, le halo respire et des braises montent.
 * Sur les petits avatars (listes), l'image reste fixe (léger vacillement CSS seulement) : le filtre animé coûterait trop cher en série.
 * Composant sans état, dans le repère 100 × 100 de l'avatar ; `inset` = marge entre le bord de l'avatar et le bord du repère.
 */
const IMG_W = 432, IMG_H = 424; // taille de l'image
const HOLE_CX = 222, HOLE_CY = 266, HOLE_W = 260, HOLE_H = 240; // trou central de l'image (là où se place l'avatar)
const FIT = 0.88; // l'anneau mord un peu sur l'avatar : plus compact

export default function FlameRing({ inset, animated }: { inset: number; animated: boolean }) {
  const side = (100 - 2 * inset) * FIT;
  const sx = side / HOLE_W, sy = side / HOLE_H;
  const img = { href: "/avatar-frames/flamme.png", x: 50 - HOLE_CX * sx, y: 50 - HOLE_CY * sy, width: IMG_W * sx, height: IMG_H * sy, preserveAspectRatio: "none" as const };
  const top = 50 - HOLE_CY * sy;
  return (
    <g className="rf-fire">
      {animated && (
        <defs>
          <filter id="fr-wave" x="-12%" y="-22%" width="124%" height="144%" primitiveUnits="userSpaceOnUse">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.085" numOctaves="2" seed="4" result="n">
              <animate attributeName="baseFrequency" dur="2.6s" values="0.05 0.085;0.068 0.12;0.05 0.085" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="fr-wave2" x="-12%" y="-22%" width="124%" height="144%" primitiveUnits="userSpaceOnUse">
            <feTurbulence type="fractalNoise" baseFrequency="0.07 0.11" numOctaves="2" seed="11" result="n">
              <animate attributeName="baseFrequency" dur="1.9s" values="0.07 0.11;0.055 0.085;0.07 0.11" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4.6" xChannelSelector="G" yChannelSelector="R" />
          </filter>
        </defs>
      )}
      <g className="rf-flame-img">
        <image {...img} filter={animated ? "url(#fr-wave)" : undefined} />
      </g>
      {animated && (
        <g className="rf-flame-over">
          <image {...img} filter="url(#fr-wave2)" />
        </g>
      )}
      {animated && [24, 36, 48, 60, 72].map((x, i) => (
        <circle key={x} className="rf-ember" style={{ animationDelay: `${-i * 0.37}s` }} cx={x + (i % 2 ? 3 : -3)} cy={top + 14 + (i % 3) * 3} r={0.9 + (i % 2) * 0.4} fill="#ffd23f" />
      ))}
    </g>
  );
}
