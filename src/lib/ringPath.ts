/** Géométrie des cadres d'avatar : points sur un carré aux coins arrondis, dans le repère 100 × 100 qui recouvre l'avatar. */
export type RingPoint = { x: number; y: number; nx: number; ny: number; ang: number };

/** Point d'abscisse curviligne `t` (0–1, sens horaire, départ en haut à gauche) avec la normale sortante (`ang` en degrés, 0 = droite, 90 = bas). */
export function pointAt(t: number, inset: number, r: number): RingPoint {
  const a = inset, b = 100 - inset, side = b - a - 2 * r, arc = (Math.PI / 2) * r, L = 4 * side + 4 * arc;
  let d = (((t % 1) + 1) % 1) * L;
  let x = 0, y = 0, nx = 0, ny = 0;
  const seg = (len: number) => { if (d <= len) return true; d -= len; return false; };
  const arcAt = (cx: number, cy: number, from: number) => { const f = from + (d / arc) * (Math.PI / 2); nx = Math.cos(f); ny = Math.sin(f); x = cx + r * nx; y = cy + r * ny; };
  if (seg(side)) { x = a + r + d; y = a; ny = -1; }
  else if (seg(arc)) arcAt(b - r, a + r, -Math.PI / 2);
  else if (seg(side)) { x = b; y = a + r + d; nx = 1; }
  else if (seg(arc)) arcAt(b - r, b - r, 0);
  else if (seg(side)) { x = b - r - d; y = b; ny = 1; }
  else if (seg(arc)) arcAt(a + r, b - r, Math.PI / 2);
  else if (seg(side)) { x = a; y = b - r - d; nx = -1; }
  else arcAt(a + r, a + r, Math.PI);
  return { x, y, nx, ny, ang: (Math.atan2(ny, nx) * 180) / Math.PI };
}
