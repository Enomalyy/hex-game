// resources.js
// Drawing the things on a hex that you can work: rocks, fallen branches, reed
// beds, berry bushes, a rabbit, the rings a fish leaves on the water.
//
// Where they are and whether they are ready is game/nodes.js; this is only what
// each looks like. Rocks, branches and bushes come off the artist's prop sheet.
// The rest the sheet does not have, so they are drawn here in its idiom: a dark
// outline, a few tones, light from the top left, whole pixels.
//
// Three small motions do the explaining that text used to:
//   a thing you are pointing at lifts a pixel and gets a pale rim, which is how
//     you learn that it is a thing and not scenery
//   a thing newly found grows in, rather than appearing
//   a wood you push at shakes

import { tileCenter, neighbors } from '../world/hexgrid.js';
import { TERRAIN } from '../world/tileset.js';
import { isKnown } from '../game/discovery.js';
import { drawSprite } from './decor.js';
import { litImage } from './columns.js';
import { nodesAt, rabbitMotion, beeOffset } from '../game/nodes.js';

const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
const mod = (n, m) => ((n % m) + m) % m;

const BUSH_SPRITES = ['bush_0', 'bush_1', 'bush_2'];

/** How long a newly found thing takes to grow in, and a pushed wood to settle. */
export const GROW_MS = 700;
export const SHAKE_MS = 420;

/**
 * Passing state for the props: what is being pointed at, what was just found,
 * what was just shaken. Owned by main.js, read here and by decor.js.
 */
export function createFx() {
  return { hover: null, found: new Map(), shake: new Map(), version: 0, cache: new Map() };
}

/**
 * A hex's nodes, remembered for half a second. Every visible column asks every
 * frame, and the answer changes only when something is taken (main.js bumps
 * `fx.version`) or regrows.
 */
export function nodesFor(map, state, col, now, fx) {
  const stamp = `${fx.version}|${Math.floor(now / 500)}`;
  const k = `${col.q},${col.r}`;
  const hit = fx.cache.get(k);
  if (hit && hit.stamp === stamp) return hit.nodes;
  if (fx.cache.size > 4000) fx.cache.clear();
  const nodes = nodesAt(map, state, col);
  fx.cache.set(k, { stamp, nodes });
  return nodes;
}

const sameNode = (a, b) => !!a && !!b && a.kind === b.kind && a.q === b.q && a.r === b.r && a.dx === b.dx && a.dy === b.dy;

function pebble(ctx, x, y, variant) {
  ctx.fillStyle = 'rgba(33, 24, 27, 0.22)';
  ctx.fillRect(x - 2, y, 5, 1);
  if (variant % 2 === 0) {
    // 5x3 low fieldstone in Decor.png slate palette
    px(ctx, '#606479', x - 2, y - 2, 5, 2);
    px(ctx, '#8885a6', x - 2, y - 3, 4, 2);
    px(ctx, '#969cbc', x - 1, y - 3, 2, 1);
    px(ctx, '#a1a6c3', x - 1, y - 3, 1, 1);
  } else {
    // 6x3 twin river-stone cluster
    px(ctx, '#606479', x - 3, y - 2, 6, 2);
    px(ctx, '#8885a6', x - 2, y - 3, 3, 2);
    px(ctx, '#969cbc', x - 2, y - 3, 2, 1);
    px(ctx, '#a1a6c3', x + 1, y - 2, 1, 1);
  }
}

function cattails(ctx, x, y, variant, t) {
  const sway = Math.sin(t * 1.4 + x * 0.7) > 0.35 ? 1 : 0;
  ctx.fillStyle = 'rgba(33, 24, 27, 0.18)';
  ctx.fillRect(x - 3, y, 6, 1);
  const stalks = variant ? [[-2, 5], [0, 6], [2, 4]] : [[-2, 6], [1, 5], [3, 4]];
  for (let i = 0; i < stalks.length; i++) {
    const [dx, h] = stalks[i];
    const tipX = x + dx + (i < 2 ? sway : 0);
    px(ctx, '#525a14', x + dx, y - h + 2, 1, h - 2);
    px(ctx, '#677313', tipX, y - h, 1, 3);
    px(ctx, '#8c9b21', tipX, y - h, 1, 1);
    // slender 1px russet cattail spike on the taller two stalks
    if (i < 2) {
      px(ctx, '#703b1f', tipX, y - h - 1, 1, 2);
      px(ctx, '#904110', tipX, y - h - 2, 1, 1);
      px(ctx, '#d39a70', tipX, y - h - 3, 1, 1);
    }
  }
  px(ctx, '#98a538', x - 3, y - 2, 1, 2);
  px(ctx, '#677313', x + 3, y - 2, 1, 2);
}

function stubble(ctx, x, y) {
  for (const dx of [-2, 0, 2]) {
    px(ctx, '#525a14', x + dx, y - 2 + (dx & 1), 1, 2);
    px(ctx, '#8c9b21', x + dx, y - 2 + (dx & 1), 1, 1);
  }
}

function berries(ctx, x, y) {
  for (const [dx, dy] of [[-2, -4], [1, -5], [2, -2], [-1, -2], [0, -3]]) {
    px(ctx, '#8b2004', x + dx, y + dy, 2, 1);
    px(ctx, '#e3380b', x + dx, y + dy - 1, 1, 1);
    px(ctx, '#e64c24', x + dx, y + dy - 1, 1, 1);
  }
}

// Strictly 1px-thin sweeping wisps [dx, dy, style] across the hex top face.
const WISPY_GRASS_PATCHES = [
  [
    [-7, -5, 0], [1, -6, 1], [7, -4, 2],
    [-10, -1, 2], [-3, -1, 0], [4, -1, 1], [10, 0, 0],
    [-7, 3, 1], [0, 3, 2], [6, 3, 0],
    [-3, 6, 0], [4, 6, 1],
  ],
  [
    [-5, -6, 1], [4, -5, 0], [-9, -2, 0], [-1, -2, 2], [7, -2, 1],
    [-10, 2, 1], [-4, 2, 0], [3, 2, 2], [9, 2, 0],
    [-6, 5, 2], [1, 6, 0], [6, 5, 1],
  ],
  [
    [-6, -5, 2], [2, -6, 0], [8, -3, 1],
    [-10, 0, 0], [-3, 0, 1], [4, 0, 2],
    [-8, 4, 1], [-1, 3, 0], [6, 4, 1],
    [-4, 6, 0], [3, 6, 2],
  ],
  [
    [-4, -6, 0], [5, -5, 2], [-9, -3, 1],
    [-2, -1, 1], [6, -1, 0], [-10, 1, 0],
    [-5, 3, 2], [2, 3, 1], [8, 3, 0],
    [-6, 6, 0], [0, 6, 1], [5, 6, 2],
  ],
];

function tallGrass(ctx, x, y, variant, ready, t, grow = 1) {
  const wisps = WISPY_GRASS_PATCHES[Math.abs(variant) % WISPY_GRASS_PATCHES.length];
  for (let i = 0; i < wisps.length; i++) {
    // Stagger each wisp's upward sprout from its ground anchor during explore grow-in
    const g = grow >= 1 ? 1 : Math.max(0, Math.min(1, grow * 1.35 - (i / wisps.length) * 0.35));
    if (g <= 0.08) continue;

    const [dx, dy, style] = wisps[i];
    const bx = x + dx;
    const by = y + dy;
    const wave = Math.sin(t * 1.8 + bx * 0.15 + by * 0.09);
    const sway = wave > 0.35 ? 1 : 0;

    if (!ready) {
      // Sparse 2px clipped wisps in the native #8a9533 turf detail color
      if (i % 2 === 0) {
        px(ctx, '#8a9533', bx, by, 1, 1);
        if (g > 0.5) px(ctx, '#8a9533', bx + (style === 1 ? -1 : 1), by - 1, 1, 1);
      }
      continue;
    }

    if (style === 0) {
      // Open V-wisp: two slender 1px blades arching apart with turf breathing between them
      px(ctx, '#7f8b2d', bx - 1, by, 1, 1);
      px(ctx, '#7f8b2d', bx + 1, by, 1, 1);
      if (g > 0.42) {
        px(ctx, '#8a9533', bx - 1, by - 2, 1, 2);
        px(ctx, '#8a9533', bx + 2, by - 2, 1, 2);
      }
      if (g > 0.78) {
        px(ctx, '#8a9533', bx - 2 + sway, by - 4, 1, 2);
        px(ctx, '#92a034', bx + 2 + sway, by - 3, 1, 1);
      }
    } else if (style === 1) {
      // Tall right-sweeping seed wisp + short left companion blade
      px(ctx, '#7f8b2d', bx - 2, by, 1, 1);
      px(ctx, '#7f8b2d', bx, by, 1, 2);
      if (g > 0.42) {
        px(ctx, '#8a9533', bx - 2, by - 2, 1, 2);
        px(ctx, '#8a9533', bx + 1, by - 3, 1, 2);
      }
      if (g > 0.78) {
        px(ctx, '#8a9533', bx + 1, by - 4, 1, 1);
        px(ctx, '#b8bc44', bx + 2 + sway, by - 5, 1, 1);
        px(ctx, '#c6c852', bx + 2 + sway, by - 6, 1, 1);
      }
    } else {
      // Tall left-sweeping seed wisp + short right companion blade
      px(ctx, '#7f8b2d', bx, by, 1, 2);
      px(ctx, '#7f8b2d', bx + 2, by, 1, 1);
      if (g > 0.42) {
        px(ctx, '#8a9533', bx - 1, by - 3, 1, 2);
        px(ctx, '#8a9533', bx + 2, by - 2, 1, 2);
      }
      if (g > 0.78) {
        px(ctx, '#8a9533', bx - 1, by - 4, 1, 1);
        px(ctx, '#b8bc44', bx - 2 + sway, by - 5, 1, 1);
        px(ctx, '#c6c852', bx - 1 + sway, by - 6, 1, 1);
        px(ctx, '#92a034', bx + 3 + sway, by - 3, 1, 1);
      }
    }
  }
}

function herb(ctx, x, y) {
  // Dark earthy shadow under the neat green rosette
  px(ctx, '#2a3810', x - 1, y, 3, 1);
  // Crisp layered green herb leaves
  px(ctx, '#435e17', x - 3, y - 1, 2, 1);
  px(ctx, '#435e17', x + 2, y - 1, 2, 1);
  px(ctx, '#5c7d22', x - 2, y - 2, 5, 1);
  px(ctx, '#5c7d22', x, y - 4, 1, 3);
  px(ctx, '#7ba132', x - 2, y - 3, 2, 1);
  px(ctx, '#7ba132', x + 1, y - 3, 2, 1);
  px(ctx, '#9ec24c', x, y - 4, 1, 1);
  px(ctx, '#9ec24c', x - 1, y - 2, 1, 1);
  px(ctx, '#9ec24c', x + 1, y - 2, 1, 1);
}

function bee(ctx, x, y, n, t) {
  const { ox, oy } = beeOffset(n.variant, t);
  const bx = x + ox, by = y + oy;
  ctx.fillStyle = 'rgba(33, 24, 27, 0.16)';
  ctx.fillRect(bx, y, 2, 1);
  // Dark head/tail and golden stripe
  px(ctx, '#241c14', bx, by, 1, 1);
  px(ctx, '#f2c138', bx + 1, by, 1, 1);
  // Rapidly fluttering pale wings
  if (Math.floor(t * 18) % 2) {
    px(ctx, '#f5f9ff', bx, by - 1, 1, 1);
    px(ctx, '#d7e6f7', bx + 1, by - 1, 1, 1);
  } else {
    px(ctx, '#f5f9ff', bx + 1, by - 1, 1, 1);
  }
}

function flint(ctx, x, y, t) {
  ctx.fillStyle = 'rgba(33, 24, 27, 0.22)';
  ctx.fillRect(x - 2, y, 5, 1);
  px(ctx, '#474b5e', x - 2, y - 2, 5, 2);
  px(ctx, '#606479', x - 2, y - 3, 4, 2);
  px(ctx, '#8885a6', x - 1, y - 3, 2, 1);
  px(ctx, '#a1a6c3', x - 1, y - 2, 1, 1);
  // subtle pale glint on the knapped edge
  if (mod(t * 0.8 + x * 0.21, 3) < 0.22) {
    px(ctx, '#e6eaf5', x, y - 3, 1, 1);
    px(ctx, '#e6eaf5', x - 1, y - 4, 1, 1);
    px(ctx, '#e6eaf5', x + 1, y - 4, 1, 1);
  } else {
    px(ctx, '#e6eaf5', x, y - 3, 1, 1);
  }
}

function clay(ctx, x, y) {
  ctx.fillStyle = 'rgba(33, 24, 27, 0.18)';
  ctx.fillRect(x - 4, y, 8, 1);
  px(ctx, '#703b1f', x - 4, y - 2, 8, 2);
  px(ctx, '#904110', x - 3, y - 3, 6, 2);
  px(ctx, '#a75f3d', x - 3, y - 3, 4, 1);
  px(ctx, '#d39a70', x - 2, y - 3, 2, 1);
}

function rabbit(ctx, x, y, m) {
  const f = m.facing || 1;
  const ry = y - m.hop;
  const dot = (c, dx, dy, w = 1, h = 1) => {
    const pxX = f > 0 ? x + dx : x - dx - (w - 1);
    px(ctx, c, pxX, ry + dy, w, h);
  };
  ctx.fillStyle = 'rgba(33, 24, 27, 0.22)';
  ctx.fillRect(x - 3, y, m.hop > 0 ? 5 : 6, 1);

  // fluffy cotton tail
  dot('#f4e8d6', -3, -3, 1, 2);
  // body & russet-tawny fur
  dot('#703b1f', -2, -4, 3, 1);
  dot('#a75f3d', -2, -3, 4, 2);
  dot('#c48252', -1, -3, 2, 1);
  dot('#d39a70', 0, -2, 2, 1);

  // legs (extending while hopping, tucked when nibbling)
  if (m.moving) {
    const stride = m.legPhase > 0.2 ? 1 : m.legPhase < -0.2 ? -1 : 0;
    dot('#703b1f', -2 - (stride > 0 ? 1 : 0), -1, 2, 1);
    dot('#a75f3d', 1 + (stride > 0 ? 1 : 0), -1, 1, 1);
  } else {
    dot('#703b1f', -2, -1, 2, 1);
    dot('#a75f3d', 1, -1, 1, 1);
  }

  // head & dark eye
  dot('#a75f3d', 1, -5, 2, 2);
  dot('#c48252', 2, -4, 2, 1);
  dot('#d39a70', 3, -4, 1, 1);
  dot('#3b2114', 2, -5, 1, 1);

  // slender ears: tilted back during hops, upright & twitching while paused
  if (m.moving) {
    dot('#703b1f', 0, -7, 1, 2);
    dot('#a75f3d', 1, -6, 1, 1);
    dot('#d39a70', 1, -7, 1, 1);
  } else {
    dot('#703b1f', 1, -8, 1, 1);
    dot('#a75f3d', 1, -7, 1, 2);
    dot('#703b1f', 2, -8 + m.earTwitch, 1, 1);
    dot('#d39a70', 2, -7 + m.earTwitch, 1, 2);
  }
}

/** Rings where a fish rose, on the water beside the bank you would fish from. */
function fishRings(ctx, x, y, t) {
  const k = mod(t * 0.55 + x * 0.07, 1);
  ctx.save();
  ctx.lineWidth = 1;
  for (const phase of [0, 0.45]) {
    const p = mod(k + phase, 1);
    ctx.strokeStyle = `rgba(236, 244, 255, ${(1 - p) * 0.75})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + p * 7, 1 + p * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (k < 0.12) px(ctx, '#e9f2ff', x, y - 2, 1, 2);
}

/** The pale rim under a thing you are pointing at. */
function rim(ctx, x, y, w = 6) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 248, 220, 0.9)';
  ctx.fillStyle = 'rgba(255, 248, 220, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawNode(ctx, res, sheet, n, x, y, t, motion, grow = 1) {
  switch (n.kind) {
    case 'stone': pebble(ctx, x, y + 1, n.variant); break;
    case 'branch': drawSprite(ctx, res.decor, 'log_0', x, y + 2, sheet); break;
    case 'reeds': if (n.ready) cattails(ctx, x, y, n.variant, t); else stubble(ctx, x, y); break;
    case 'berries':
      drawSprite(ctx, res.decor, BUSH_SPRITES[n.variant % BUSH_SPRITES.length], x, y + 2, sheet);
      if (n.ready) berries(ctx, x, y);
      break;
    case 'grain': tallGrass(ctx, x, y, n.variant, n.ready, t, grow); break;
    case 'herb': herb(ctx, x, y); break;
    case 'bee': bee(ctx, x, y, n, t); break;
    case 'flint': flint(ctx, x, y, t); break;
    case 'clay': clay(ctx, x, y); break;
    case 'game': rabbit(ctx, x, y, motion); break;
    default: break;
  }
}

/**
 * Draw what stands on one column. Called by the renderer straight after the
 * column itself, so it is hidden by whatever stands in front, like the column.
 *
 * @param mode  how the column was drawn: '', 'dim' or 'dormant'
 */
export function drawColumnNodes(ctx, res, map, state, col, now, fx, mode = '') {
  if (!res.decor) return;
  const t = now / 1000;
  const k = `${col.q},${col.r}`;
  const born = fx.found.get(k);
  const grow = born != null ? Math.min(1, (now - born) / GROW_MS) : 1;

  // Fish belong to a bank but are drawn on the water beside it.
  if (TERRAIN[col.terrain]?.water) {
    for (const nb of neighbors(col.q, col.r)) {
      if (!isKnown(state, nb.q, nb.r)) continue;
      const bank = map.get(nb.q, nb.r);
      if (!bank) continue;
      for (const n of nodesFor(map, state, bank, now, fx)) {
        if (!n.on || n.on.q !== col.q || n.on.r !== col.r) continue;
        const { cx, cy } = tileCenter(col.q, col.r, col.h);
        if (sameNode(fx.hover, n)) rim(ctx, cx, cy, 9);
        fishRings(ctx, Math.round(cx), Math.round(cy), t);
      }
    }
    return;
  }

  // Ground resources only appear on explored/known hexes.
  if (!isKnown(state, col.q, col.r)) return;

  const nodes = nodesFor(map, state, col, now, fx);
  if (!nodes.length) return;
  const { cx, cy } = tileCenter(col.q, col.r, col.h);
  if (col.feature?.type === 'field' && col.feature?.kind === 'herb' && col.feature.ripe) {
    herb(ctx, Math.round(cx - 5), Math.round(cy - 1));
    herb(ctx, Math.round(cx + 5), Math.round(cy - 1));
    herb(ctx, Math.round(cx), Math.round(cy + 3));
  }
  const sheet = litImage(res, 'decor', res.decor.image, col.h, mode);
  const items = [];
  for (const n of nodes) {
    if (n.on || n.kind === 'tree' || n.kind === 'field') continue;
    const motion = n.kind === 'game' ? rabbitMotion(col, n.variant, t) : null;
    const dx = motion ? motion.dx : n.dx;
    const dy = motion ? motion.dy : n.dy;
    const sortY = n.kind === 'grain' ? -20 : dy;
    items.push({ n, motion, dx, dy, sortY });
  }
  items.sort((a, b) => a.sortY - b.sortY);

  for (const { n, motion, dx, dy } of items) {
    const x = Math.round(cx + dx), y = Math.round(cy + dy);
    const hot = sameNode(fx.hover, n);
    if (hot && n.kind !== 'grain') rim(ctx, x, y + 1);
    if (grow < 1) {
      if (n.kind === 'grain') {
        drawNode(ctx, res, sheet, n, x, y, t, motion, grow);
      } else {
        const s = 0.25 + 0.75 * grow * (2 - grow);
        ctx.save();
        ctx.translate(x, y + 2); ctx.scale(s, s); ctx.translate(-x, -(y + 2));
        drawNode(ctx, res, sheet, n, x, y, t, motion);
        ctx.restore();
      }
    } else {
      drawNode(ctx, res, sheet, n, x, y - (hot && n.kind !== 'grain' ? 1 : 0), t, motion);
    }
  }
}

/** Campfire at the starting clearing: cold stones & charred logs, or crackling flame once lit. */
export function drawCampfire(ctx, x, y, hot = false, lit = false, t = 0) {
  if (hot) rim(ctx, x, y + 1, 8);
  ctx.fillStyle = lit ? 'rgba(235, 130, 40, 0.24)' : 'rgba(33, 24, 27, 0.22)';
  ctx.beginPath(); ctx.ellipse(x, y + 1, lit ? 9 : 7, lit ? 4 : 3, 0, 0, Math.PI * 2); ctx.fill();
  const stones = [[-5, 0], [-3, 2], [0, 3], [3, 2], [5, 0], [3, -2], [-3, -2], [0, -3]];
  const drawStone = (dx, dy) => {
    px(ctx, '#606479', x + dx - 1, y + dy - 1, 2, 2);
    px(ctx, '#8885a6', x + dx - 1, y + dy - 1, 1, 1);
    px(ctx, '#969cbc', x + dx, y + dy, 1, 1);
  };
  for (const [dx, dy] of stones) if (dy <= 0) drawStone(dx, dy);
  if (lit) {
    const f1 = Math.sin(t * 7.3) * 0.9;
    const f2 = Math.cos(t * 9.7) * 0.8;
    px(ctx, '#4a3525', x - 3, y, 6, 2);
    px(ctx, '#b8421b', x - 2, y - 1, 5, 2);
    px(ctx, '#eb7b24', x - 2 + Math.round(f1 * 0.5), y - 4, 4, 4);
    px(ctx, '#f2b644', x - 1 + Math.round(f2 * 0.5), y - 5, 2, 4);
    px(ctx, '#fff0a8', x + Math.round(f1 * 0.4), y - 6 - (Math.sin(t * 11) > 0.2 ? 1 : 0), 1, 2);
    const sparkY = Math.round(((t * 6) % 7));
    if (sparkY > 1) px(ctx, '#ffd275', x + Math.round(Math.sin(t * 5 + sparkY) * 1.5), y - 4 - sparkY, 1, 1);
  } else {
    px(ctx, '#4a3525', x - 2, y - 1, 5, 2);
    px(ctx, '#703b1f', x - 1, y - 1, 2, 1);
    px(ctx, '#8885a6', x - 1, y, 2, 1);
    px(ctx, '#4a3525', x + 1, y - 1, 2, 1);
  }
  for (const [dx, dy] of stones) if (dy > 0) drawStone(dx, dy);
}
