"use client";

/**
 * Cadre « Flamme » : un vrai feu animé en direct, entièrement créé ici (aucune image). Une couronne de langues de feu est dessinée tout autour
 * de l'avatar : chaque langue est une goutte effilée qui grandit, rétrécit et se courbe en continu (bruit de sinus), en trois couches
 * (rouge-orange, orange-jaune, cœur blanc-jaune) avec dégradé du pied vers la pointe ; hautes en haut, penchées sur les côtés, courtes en
 * bas, plus une bande lumineuse jaune-orange collée à l'avatar, un halo et des étincelles qui montent. Le feu ne déborde jamais sur l'avatar.
 * Économe : une seule boucle par avatar, ~45 images/s, en pause hors écran / onglet masqué / « réduire les animations » (image fixe).
 * À réserver aux grands avatars (le composant parent ne l'utilise que pour lg, xl, 2xl).
 */
import { useEffect, useRef } from "react";

interface Props {
  /** Taille du bloc avatar + cadre (px) et position/taille de l'avatar dans ce bloc. */
  total: number;
  inset: number; // marge entre le bord du bloc et l'avatar
  avatar: number; // côté de l'avatar
  radius: number; // rayon des coins de l'avatar
}

export default function FlameFire({ total, inset, avatar, radius }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const padX = total * 0.3, padTop = total * 0.62, padBottom = total * 0.24;
  const W = total + padX * 2, H = total + padTop + padBottom;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Avatar dans le repère du canvas
    const ax = padX + inset, ay = padTop + inset, aw = avatar, rr = Math.min(radius, aw / 2);
    const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r);
      c.closePath();
    };
    // point sur le contour de l'avatar (sens horaire) + normale sortante
    const side = aw - 2 * rr, arc = (Math.PI / 2) * rr, L = 4 * side + 4 * arc;
    const pointAt = (t: number) => {
      let d = t * L, x = 0, y = 0, nx = 0, ny = 0;
      const seg = (len: number) => (d <= len ? true : ((d -= len), false));
      const arcAt = (cx: number, cy: number, from: number) => { const f = from + (d / arc) * (Math.PI / 2); nx = Math.cos(f); ny = Math.sin(f); x = cx + rr * nx; y = cy + rr * ny; };
      if (seg(side)) { x = ax + rr + d; y = ay; ny = -1; }
      else if (seg(arc)) arcAt(ax + aw - rr, ay + rr, -Math.PI / 2);
      else if (seg(side)) { x = ax + aw; y = ay + rr + d; nx = 1; }
      else if (seg(arc)) arcAt(ax + aw - rr, ay + aw - rr, 0);
      else if (seg(side)) { x = ax + aw - rr - d; y = ay + aw; ny = 1; }
      else if (seg(arc)) arcAt(ax + rr, ay + aw - rr, Math.PI / 2);
      else if (seg(side)) { x = ax; y = ay + aw - rr - d; nx = -1; }
      else arcAt(ax + rr, ay + rr, Math.PI);
      return { x, y, nx, ny };
    };

    const u = total / 100; // unité d'échelle
    const TONGUES = 22;
    // étincelles qui montent
    const MAX = 26;
    const px = new Float32Array(MAX), py = new Float32Array(MAX), pvx = new Float32Array(MAX), pvy = new Float32Array(MAX), page = new Float32Array(MAX);
    const alive = new Uint8Array(MAX);
    const emit = () => {
      for (let i = 0; i < MAX; i++) {
        if (alive[i]) continue;
        const q = pointAt(Math.random() * 0.62 - 0.06 + (Math.random() < 0.5 ? 0 : 0.0));
        px[i] = q.x + q.nx * u * 3; py[i] = q.y + q.ny * u * 3;
        pvx[i] = (Math.random() - 0.5) * u * 10; pvy[i] = -u * (22 + Math.random() * 28); page[i] = 0; alive[i] = 1;
        return;
      }
    };

    const base = () => {
      // bande lumineuse jaune-orange collée à l'avatar (comme l'anneau de référence) + halo
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); roundRect(ctx, ax, ay, aw, aw, rr); ctx.clip("evenodd");
      const flick = 0.85 + Math.random() * 0.15;
      ctx.lineJoin = "round";
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = "rgba(255,110,10,0.9)"; ctx.shadowBlur = u * 7;
      ctx.strokeStyle = `rgba(255,${150 + 40 * flick | 0},20,0.95)`; ctx.lineWidth = u * 7.5;
      ctx.beginPath(); roundRect(ctx, ax - u * 1.2, ay - u * 1.2, aw + u * 2.4, aw + u * 2.4, rr + u * 1.2); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255,236,120,${0.85 * flick})`; ctx.lineWidth = u * 3.4;
      ctx.beginPath(); roundRect(ctx, ax - u * 0.4, ay - u * 0.4, aw + u * 0.8, aw + u * 0.8, rr + u * 0.4); ctx.stroke();
      ctx.restore();
    };

    type Tongue = { bx: number; by: number; tx: number; ty: number; dx: number; dy: number; span: number; h: number; top: number; bottom: boolean };
    const tongues: Tongue[] = [];
    for (let i = 0; i < TONGUES; i++) {
      const q = pointAt((i + 0.5) / TONGUES);
      const top = Math.max(0, -q.ny), bottom = q.ny > 0.45;
      // direction : le feu monte ; en bas il file vers l'extérieur
      let dx = q.nx * (bottom ? 1 : 0.5), dy = q.ny * (bottom ? 1 : 0.5) + (bottom ? 0 : -0.88);
      const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
      const centre = Math.exp(-(((q.x - (ax + aw / 2)) / (aw * 0.2)) ** 2)) * (q.y < ay + aw * 0.3 ? 1 : 0);
      tongues.push({ bx: q.x, by: q.y, tx: -q.ny, ty: q.nx, dx, dy, span: (L / TONGUES) * 1.55, h: u * (bottom ? 11 : 21 + (1 - (q.y - ay) / aw) * 12 + top * 6 + centre * 12), top, bottom });
    }
    const tongue = (t: Tongue, i: number, time: number, kh: number, kw: number, c0: string, c1: string, c2: string) => {
      // hauteur et courbure animées en continu : chaque langue vit sa vie
      const n1 = Math.sin(time * (2.3 + 0.21 * (i % 5)) + i * 2.1), n2 = Math.sin(time * (3.7 + 0.13 * (i % 7)) + i * 0.9), n3 = Math.sin(time * 1.4 + i * 1.3);
      const h = t.h * kh * (0.74 + 0.2 * n1 + 0.09 * n2);
      const sway = (n2 * 0.5 + n3 * 0.5) * h * 0.28;
      const wd = t.span * kw * (0.92 + 0.08 * n3);
      const lx = t.bx - t.tx * wd / 2, ly = t.by - t.ty * wd / 2, rx = t.bx + t.tx * wd / 2, ry = t.by + t.ty * wd / 2;
      const tipx = t.bx + t.dx * h + t.tx * sway, tipy = t.by + t.dy * h + t.ty * sway;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.bezierCurveTo(lx + t.dx * h * 0.62 - t.tx * wd * 0.12, ly + t.dy * h * 0.62 - t.ty * wd * 0.12, tipx - t.dx * h * 0.28 - t.tx * wd * 0.3 + t.tx * sway * 0.3, tipy - t.dy * h * 0.28 - t.ty * wd * 0.3 + t.ty * sway * 0.3, tipx, tipy);
      ctx.bezierCurveTo(tipx - t.dx * h * 0.22 + t.tx * wd * 0.22 + t.tx * sway * 0.2, tipy - t.dy * h * 0.22 + t.ty * wd * 0.22 + t.ty * sway * 0.2, rx + t.dx * h * 0.5 + t.tx * wd * 0.1, ry + t.dy * h * 0.5 + t.ty * wd * 0.1, rx, ry);
      ctx.closePath();
      const g = ctx.createLinearGradient(t.bx, t.by, tipx, tipy);
      g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fill();
    };

    const draw = (dt: number, time: number) => {
      ctx.clearRect(0, 0, W, H);
      base();
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); roundRect(ctx, ax, ay, aw, aw, rr); ctx.clip("evenodd");
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowColor = "rgba(255,90,0,0.55)"; ctx.shadowBlur = u * 5;
      // du plus grand au plus petit : couche rouge-orange, puis orange-jaune, puis cœur clair
      for (let i = 0; i < tongues.length; i++) tongue(tongues[i], i, time, 1, 1, "#ff9a1a", "#ff5a0a", "#d62a08");
      ctx.shadowBlur = 0;
      for (let i = 0; i < tongues.length; i++) tongue(tongues[i], i, time + 0.5, 0.78, 0.7, "#ffd23a", "#ff9a1a", "#ff6a10");
      for (let i = 0; i < tongues.length; i++) tongue(tongues[i], i, time + 1.1, 0.5, 0.42, "#fffbe0", "#fff07a", "#ffc928");
      // étincelles
      for (let i = 0; i < MAX; i++) {
        if (!alive[i]) continue;
        page[i] += dt * 0.9;
        if (page[i] >= 1) { alive[i] = 0; continue; }
        px[i] += (pvx[i] + Math.sin(time * 6 + i) * u * 6) * dt; py[i] += pvy[i] * dt;
        ctx.fillStyle = `rgba(255,${(200 - page[i] * 90) | 0},40,${1 - page[i]})`;
        ctx.beginPath(); ctx.arc(px[i], py[i], u * (1.1 - page[i] * 0.7), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    };

    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0, time = 0, visible = true, acc = 0;
    const step = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now; time += dt; acc += dt;
      if (acc >= 1 / 46) {
        if (Math.random() < acc * 14) emit();
        draw(acc, time);
        acc = 0;
      }
      raf = requestAnimationFrame(step);
    };
    const start = () => { if (!raf && !reduce) { last = performance.now(); raf = requestAnimationFrame(step); } };

    // Image fixe pour « réduire les animations » : on fait tourner la simulation un instant puis on s'arrête
    if (reduce) { for (let k = 0; k < 6; k++) { emit(); time += 0.1; draw(0.1, time); } }
    else start();

    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } });
    io.observe(canvas);
    const onVis = () => { if (!document.hidden) start(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, [total, inset, avatar, radius, W, H, padX, padTop]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "absolute", left: -padX, top: -padTop, width: W, height: H, pointerEvents: "none" }}
    />
  );
}
