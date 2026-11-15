// explorer.js
// Exploring by standing still.
//
// There is no Explore button. Stop on a hex you have not explored and a ticker
// starts running round its edge; when the hex is done, it pings. Better places
// take longer, and the glow tells you so as it goes: every hex runs a pale first
// circuit, and a scenic one keeps going, turning copper, then silver, then gold,
// for as many circuits as it has earned. You learn how good a place is by
// watching it, never before you have stopped there.
//
// Pure timing, no drawing: render/discovery_fx.js draws `charge`.

import { EXPLORE_SECONDS, MEDITATION_SECONDS, TIERS, exploreSeconds, scenicOf, isExplored, isMeditated } from './discovery.js';

/** Where each circuit of the ticker starts and ends, in seconds. */
export const PHASE_ENDS = [EXPLORE_SECONDS];

/**
 * Which circuit the ticker is on at `t` seconds, and how far round it is.
 * @returns {{phase:number, frac:number}}
 */
export function phaseAt(t) {
  return { phase: 0, frac: Math.max(0, Math.min(1, t / EXPLORE_SECONDS)) };
}

export class Explorer {
  constructor(map, state) {
    this.map = map;
    this.state = state;
    this.charge = null;      // { q, r, t, duration, tier }
    this.meditation = null;  // { q, r, t, duration, tier, name }
  }

  /**
   * Advance the clock.
   * @param {number} dt seconds
   * @param {{q,r,moving}} player
   * @param {boolean} canDwell  false while busy with something else
   * @returns {{q,r,tier}|null} the hex, the moment it finishes exploring
   */
  update(dt, player, canDwell) {
    if (!canDwell || player.moving || isExplored(this.state, player.q, player.r)) {
      this.charge = null;
      return null;
    }
    const col = this.map.get(player.q, player.r);
    if (!col) { this.charge = null; return null; }

    if (!this.charge || this.charge.q !== col.q || this.charge.r !== col.r) {
      this.charge = {
        q: col.q, r: col.r, t: 0,
        duration: exploreSeconds(this.map, col),
        tier: scenicOf(this.map, col).tier,
      };
    }

    this.charge.t += dt;
    if (this.charge.t < this.charge.duration) return null;

    const done = { q: col.q, r: col.r, tier: this.charge.tier };
    this.charge = null;
    return done;
  }

  /** Begin meditating on an explored scenic hex while seated. */
  startMeditation(q, r) {
    const col = this.map.get(q, r);
    if (!col || !isExplored(this.state, q, r) || isMeditated(this.state, q, r)) return false;
    const { tier, name } = scenicOf(this.map, col);
    if (!tier) return false;
    if (this.meditation && this.meditation.q === q && this.meditation.r === r) return true;
    this.meditation = { q, r, t: 0, duration: MEDITATION_SECONDS, tier, name };
    return true;
  }

  /** Advance active meditation; cancels cleanly if the player moves or gets up. */
  updateMeditation(dt, player, canDwell) {
    if (!this.meditation) return null;
    if (!canDwell || player.moving || !player.seated
      || player.q !== this.meditation.q || player.r !== this.meditation.r
      || isMeditated(this.state, player.q, player.r)) {
      this.meditation = null;
      return null;
    }
    this.meditation.t += dt;
    if (this.meditation.t < this.meditation.duration) return null;
    const done = {
      q: this.meditation.q,
      r: this.meditation.r,
      tier: this.meditation.tier,
      name: this.meditation.name,
    };
    this.meditation = null;
    return done;
  }
}
