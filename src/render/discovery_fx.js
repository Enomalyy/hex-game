// discovery_fx.js
// The visible half of exploring: the ticker that runs round a hex while you
// stand on it, the ping when it finishes, and the eye view's resource icons.
//
// Tiers carry a colour everywhere they show up, the same in the glow, the ping
// and the banner (ui.css repeats them): pale for ordinary ground, then copper,
// silver and gold.

import { tileCenter, topFaceCorners, traceTopFace } from '../world/hexgrid.js';
import { phaseAt } from '../game/explorer.js';
import { HIDDEN, resourcesAt, isKnown, isMeditated } from '../game/discovery.js';

export const TIER_COLORS = [
  [255, 246, 220],   // common: warm white
  [214, 137, 82],    // copper
  [206, 218, 236],   // silver
  [246, 204, 82],    // gold
];

const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

/** Corners of a hex top face as a closed loop, with each edge's length. */
function perimeter(cx, cy) {
  const pts = topFaceCorners(cx, cy);
  const loop = [...pts, pts[0]];
  const lens = [];
  for (let i = 0; i < pts.length; i++) {
    lens.push(Math.hypot(loop[i + 1].x - loop[i].x, loop[i + 1].y - loop[i].y));
  }
  return { loop, lens, total: lens.reduce((s, l) => s + l, 0) };
}

/**
 * Stroke the first `frac` of the way round a hex's edge.
 * @returns {{x,y}} where the stroke ended, for the ticker's head
 */
function strokePartial(ctx, cx, cy, frac) {
  const { loop, lens, total } = perimeter(cx, cy);
  let left = total * Math.max(0, Math.min(1, frac));
  let head = { x: loop[0].x, y: loop[0].y };
  ctx.beginPath();
  ctx.moveTo(loop[0].x, loop[0].y);
  for (let i = 0; i < lens.length && left > 0; i++) {
    const t = Math.min(1, left / lens[i]);
    head = { x: loop[i].x + (loop[i + 1].x - loop[i].x) * t, y: loop[i].y + (loop[i + 1].y - loop[i].y) * t };
    ctx.lineTo(head.x, head.y);
    left -= lens[i];
  }
  ctx.stroke();
  return head;
}

/**
 * The hex you are standing on, exploring. A glow on the top face that deepens
 * as the clock runs, the finished circuits as a solid ring, and the circuit in
 * progress as a bright ticker.
 */
export function drawExploreCharge(ctx, map, charge, now) {
  if (!charge) return;
  const h = Math.max(0, map.surfaceAt(charge.q, charge.r));
  const { cx, cy } = tileCenter(charge.q, charge.r, h);
  const { phase, frac } = phaseAt(charge.t);
  const color = TIER_COLORS[phase];
  const pulse = 0.5 + 0.5 * Math.sin(now / 160);

  ctx.save();
  // Drawn a little inside the face. This is painted with its own hex, before
  // the hexes in front of it, and a ring on the very edge would have its lower
  // half painted over by them.
  ctx.translate(cx, cy);
  ctx.scale(0.9, 0.9);
  ctx.translate(-cx, -cy);
  // The glow grows across the whole dwell, not per circuit, so a long one
  // visibly builds.
  traceTopFace(ctx, cx, cy);
  ctx.fillStyle = rgba(color, 0.1 + Math.min(0.3, charge.t * 0.05) + pulse * 0.05);
  ctx.fill();

  if (phase > 0) {
    // The circuit just completed, held as a ring in its own colour.
    traceTopFace(ctx, cx, cy);
    ctx.strokeStyle = rgba(TIER_COLORS[phase - 1], 0.85);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // The ticker: a soft wide stroke under a sharp one, and a bright head.
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(color, 0.35);
  ctx.lineWidth = 3;
  strokePartial(ctx, cx, cy, frac);
  ctx.strokeStyle = rgba(color, 1);
  ctx.lineWidth = 1;
  const head = strokePartial(ctx, cx, cy, frac);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.fillRect(Math.round(head.x) - 1, Math.round(head.y) - 1, 2, 2);

  // Motes of light drifting up off the hex, more of them each circuit.
  const motes = 3 + phase * 4;
  for (let i = 0; i < motes; i++) {
    const period = 1.1 + (i % 3) * 0.25;
    const k = ((now / 1000 + i * 0.37) % period) / period;
    const x = cx + (((i * 7919) % 23) - 11);
    const y = cy + 6 - (((i * 104729) % 7)) - k * (12 + phase * 3);
    ctx.fillStyle = rgba(color, (1 - k) * 0.9);
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  ctx.restore();
}

/**
 * Serene breathing glow, concentric ripples, and rising spiral motes around a
 * seated player meditating at a scenic spot.
 */
export function drawMeditationGlow(ctx, map, meditation, now) {
  if (!meditation) return;
  const h = Math.max(0, map.surfaceAt(meditation.q, meditation.r));
  const { cx, cy } = tileCenter(meditation.q, meditation.r, h);
  const frac = Math.max(0, Math.min(1, meditation.t / Math.max(0.01, meditation.duration)));
  const t = now / 1000;
  const breath = 0.5 + 0.5 * Math.sin(t * 2.4);

  // Blend smoothly from misty cyan-lavender to warm golden-white as the mind clears.
  const c0 = [150, 215, 240];
  const c1 = [246, 214, 120];
  const col = [
    Math.round(c0[0] + (c1[0] - c0[0]) * frac),
    Math.round(c0[1] + (c1[1] - c0[1]) * frac),
    Math.round(c0[2] + (c1[2] - c0[2]) * frac),
  ];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(0.92, 0.92);
  ctx.translate(-cx, -cy);
  traceTopFace(ctx, cx, cy);
  ctx.fillStyle = rgba(col, 0.14 + frac * 0.22 + breath * 0.06);
  ctx.fill();
  traceTopFace(ctx, cx, cy);
  ctx.strokeStyle = rgba(col, 0.45 + frac * 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Concentric breathing ripple rings around the seated figure.
  ctx.save();
  ctx.lineWidth = 1;
  for (const offset of [0, 0.5]) {
    const p = (t * 0.55 + offset) % 1;
    ctx.strokeStyle = rgba(col, (1 - p) * (0.4 + frac * 0.35));
    ctx.beginPath();
    ctx.ellipse(cx, cy - 1, 3 + p * 11, 1.5 + p * 5.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Slow luminous motes spiralling upward as clarity builds.
  const count = 5 + Math.round(frac * 5);
  for (let i = 0; i < count; i++) {
    const period = 2.0 + (i % 3) * 0.4;
    const p = ((t + i * 0.43) % period) / period;
    const ang = t * 1.4 + i * ((Math.PI * 2) / count) + p * 2.2;
    const r = (1 - p * 0.4) * (5 + (i % 3) * 2.5);
    const mx = cx + Math.cos(ang) * r;
    const my = cy - 2 + Math.sin(ang) * r * 0.35 - p * 14;
    ctx.fillStyle = rgba(col, Math.sin(p * Math.PI) * 0.9);
    ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
  }
  ctx.restore();
}

// --------------------------------------------------------------------- pings

/**
 * The flash when a hex finishes: a ring that spreads and fades, and for a
 * scenic find a column of sparks going up. Keeps its own list; call `addPing`
 * and then `drawPings` every frame.
 */
export class Pings {
  constructor() { this.list = []; }

  add(q, r, tier, now) {
    const sparks = [];
    const n = tier ? 6 + tier * 6 : 0;
    for (let i = 0; i < n; i++) {
      sparks.push({
        dx: (Math.random() - 0.5) * 22,
        dy: (Math.random() - 0.5) * 8,
        speed: 14 + Math.random() * 18 + tier * 6,
        delay: Math.random() * 0.35,
      });
    }
    this.list.push({ q, r, tier, born: now, sparks, life: tier ? 1.6 : 0.7 });
  }

  /**
   * Pings on hexes you cannot see, as entities for the renderer to sort in with
   * the columns, so the mountain in front hides them. `inView(q, r)` says which.
   */
  entities() {
    // Occluded pings are suppressed so their expanding ring does not peek out
    // around cliffs or mountain peaks standing in front.
    return [];
  }

  /**
   * Pings on hexes in plain view, over everything: the ring spreads across the
   * neighbouring hexes, which only an overlay can do.
   */
  draw(ctx, map, now, inView = () => true) {
    this.list = this.list.filter(p => (now - p.born) / 1000 < p.life);
    for (const p of this.list) if (inView(p.q, p.r)) this.drawOne(ctx, map, now, p);
  }

  drawOne(ctx, map, now, p) {
    {
      const age = (now - p.born) / 1000;
      if (age >= p.life) return;
      const k = age / p.life;
      const color = TIER_COLORS[p.tier];
      const h = Math.max(0, map.surfaceAt(p.q, p.r));
      const { cx, cy } = tileCenter(p.q, p.r, h);

      ctx.save();
      // The spreading ring. Drawn with a scaled transform so it stays a hex.
      const grow = 1 + k * (p.tier ? 1.1 : 0.6);
      ctx.translate(cx, cy);
      ctx.scale(grow, grow);
      ctx.translate(-cx, -cy);
      traceTopFace(ctx, cx, cy);
      ctx.strokeStyle = rgba(color, (1 - k) * 0.95);
      ctx.lineWidth = 1 / grow;
      ctx.stroke();
      ctx.restore();

      if (age < 0.25) {
        // A flash over the top face as it lands.
        ctx.save();
        traceTopFace(ctx, cx, cy);
        ctx.fillStyle = rgba(color, 0.45 * (1 - age / 0.25));
        ctx.fill();
        ctx.restore();
      }

      for (const s of p.sparks) {
        const t = age - s.delay;
        if (t <= 0) continue;
        const fade = Math.max(0, 1 - t / (p.life - s.delay));
        ctx.fillStyle = rgba(color, fade);
        ctx.fillRect(Math.round(cx + s.dx), Math.round(cy + s.dy - t * s.speed), 1, 1 + (p.tier >= 3 ? 1 : 0));
      }
    }
  }

  get active() { return this.list.length > 0; }
}

// ------------------------------------------------------------------ eye view

/** Load the resource icons the eye view draws, keyed by item id. */
export function loadResourceIcons() {
  const ids = new Set([...Object.values(HIDDEN).map(h => h.icon), 'ore']);
  const icons = {};
  for (const id of ids) {
    const img = new Image();
    img.src = `icons/${id}.svg`;
    icons[id] = img;
  }
  return icons;
}

/**
 * In the eye view, ring the scenic hexes you have explored in their tier's
 * colour. Drawn into the world buffer with the other overlays.
 */
export function drawScenicRings(ctx, map, state, view, inView = () => true) {
  const explored = state.mind?.explored || {};
  for (const [k, tier] of Object.entries(explored)) {
    if (!tier) continue;
    const [q, r] = k.split(',').map(Number);
    if (!inView(q, r)) continue;
    const h = Math.max(0, map.surfaceAt(q, r));
    const { cx, cy } = tileCenter(q, r, h);
    if (cx < view.left || cx > view.right || cy < view.top || cy > view.bottom) continue;
    const done = isMeditated(state, q, r);
    traceTopFace(ctx, cx, cy);
    ctx.strokeStyle = done ? rgba(TIER_COLORS[tier], 0.45) : rgba([168, 232, 248], 0.92);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * The eye view's icons: what each known hex has, glowing softly over it. Drawn
 * on the display canvas after the upscale, so the icons stay sharp.
 */
export function drawResourceIcons(ctx, camera, map, state, icons, now, inView = () => true) {
  const mind = state.mind;
  if (!mind) return;
  const size = Math.round(camera.scale * 7);
  const gap = Math.round(size * 0.1);
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const pulse = 0.75 + 0.25 * Math.sin(now / 420);

  const marks = new Map();   // "q,r" -> [{ id, alpha }]
  const push = (q, r, id, alpha = 1) => {
    const k = `${q},${r}`;
    if (!marks.has(k)) marks.set(k, []);
    marks.get(k).push({ id, alpha });
  };

  for (const k of Object.keys(mind.known)) {
    const [q, r] = k.split(',').map(Number);
    for (const id of resourcesAt(map, map.get(q, r))) push(q, r, HIDDEN[id].icon);
  }
  for (const col of map) {
    if (col.feature?.type === 'ore' && col.feature.known && col.feature.remaining > 0) push(col.q, col.r, 'ore');
  }
  // A trace of ore: faint, because it says "near here", not "here".
  for (const k of Object.keys(mind.oreSigns || {})) {
    const [q, r] = k.split(',').map(Number);
    if (isKnown(state, q, r)) push(q, r, 'ore', 0.4);
  }

  for (const [k, list] of marks) {
    const [q, r] = k.split(',').map(Number);
    if (!inView(q, r)) continue;
    const h = Math.max(0, map.surfaceAt(q, r));
    const { cx, cy } = tileCenter(q, r, h);
    const p = camera.worldToScreen(cx, cy);
    if (p.x < -size * 3 || p.y < -size * 3 || p.x > W + size * 3 || p.y > H + size * 3) continue;

    const width = list.length * size + (list.length - 1) * gap;
    let x = Math.round(p.x - width / 2);
    const y = Math.round(p.y - size * 0.75);
    for (const m of list) {
      const img = icons[m.id];
      const mx = x + size / 2, my = y + size / 2;
      // A soft halo, so the icon reads as light on the map and not a sticker,
      // over a dark disc that keeps it clear of the ground's own clutter.
      const g = ctx.createRadialGradient(mx, my, size * 0.3, mx, my, size * 0.95);
      g.addColorStop(0, `rgba(255, 228, 150, ${0.7 * pulse * m.alpha})`);
      g.addColorStop(1, 'rgba(255, 228, 150, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(mx - size, my - size, size * 2, size * 2);
      ctx.beginPath();
      ctx.arc(mx, my, size * 0.56, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(22, 18, 12, ${0.7 * m.alpha})`;
      ctx.fill();
      if (img?.complete && img.naturalWidth) {
        ctx.globalAlpha = m.alpha;
        ctx.drawImage(img, x, y, size, size);
        ctx.globalAlpha = 1;
      }
      x += size + gap;
    }
  }
}
