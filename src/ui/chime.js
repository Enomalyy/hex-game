// chime.js
// The sound of finding something. Synthesised, so there is no asset to ship:
// a few sine partials with a quick attack and a long tail, like a struck glass.
// Better finds ring more notes. Quiet by design; it is a cue, not a fanfare.

// Browsers refuse to start audio before the player has touched the page, and
// complain if asked. So nothing is made until the first click or key; a find
// in the first seconds after loading simply goes unheard.
let ac = null;
let allowed = false;
if (typeof window !== 'undefined') {
  const allow = () => { allowed = true; };
  window.addEventListener('pointerdown', allow, { once: true, capture: true });
  window.addEventListener('keydown', allow, { once: true, capture: true });
}

function audio() {
  if (ac || !allowed) return ac;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ac = new Ctx();
  return ac;
}

// A pentatonic run upward from A4, so any subset sounds intended.
const SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

const PHRASES = {
  tick: [[5]],
  copper: [[2], [4]],
  silver: [[2], [4], [6]],
  gold: [[0], [2], [4], [7, 5]],
  achievement: [[1], [4, 6]],
  village: [[0], [3]],
  meditate: [[0, 4], [2, 6], [4, 7]],
  // Low and falling: something is wrong.
  raid: [[3], [1], [0]],
};

function bell(ctx, freq, at, gain) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(gain, at + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
  out.connect(ctx.destination);
  // A fundamental and a quiet inharmonic partial: the partial is what makes it
  // read as a bell rather than a beep.
  for (const [mult, amp] of [[1, 1], [2.76, 0.18]]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    g.gain.value = amp;
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 1.5);
  }
}

/** Play the phrase for a kind of moment. Silently does nothing without audio. */
export function chime(kind, volume = 0.08) {
  try {
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const phrase = PHRASES[kind] || PHRASES.copper;
    const t0 = ctx.currentTime + 0.02;
    phrase.forEach((notes, i) => {
      for (const n of notes) bell(ctx, SCALE[n], t0 + i * 0.11, volume / notes.length);
    });
  } catch { /* sound is a nicety; never let it break the game */ }
}

let hum = null;

/**
 * Sustain or fade out a soft warm harmonic drone while the player meditates.
 * Safe when WebAudio is blocked or unavailable.
 */
export function updateMeditationHum(active, progress = 0) {
  try {
    if (!active) {
      if (!hum) return;
      const { ctx, master, oscs } = hum;
      hum = null;
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(0.0001, now, 0.08);
      for (const o of oscs) o.stop(now + 0.35);
      return;
    }
    const ctx = audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;
    const p = Math.max(0, Math.min(1, progress));

    if (!hum) {
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.connect(ctx.destination);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(560, now);
      filter.connect(master);

      const voices = [
        { type: 'sine', freq: 220, amp: 0.55 },
        { type: 'triangle', freq: 329.63, amp: 0.25 },
        { type: 'sine', freq: 440, amp: 0.12 },
      ];
      const oscs = [];
      for (const v of voices) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = v.type;
        o.frequency.setValueAtTime(v.freq, now);
        g.gain.setValueAtTime(v.amp, now);
        o.connect(g).connect(filter);
        o.start(now);
        oscs.push(o);
      }
      hum = { ctx, master, filter, oscs };
    }

    const breath = 0.85 + 0.15 * Math.sin(now * 2.4);
    const targetGain = (0.006 + p * 0.03) * breath;
    hum.master.gain.setTargetAtTime(targetGain, now, 0.12);
    hum.filter.frequency.setTargetAtTime(480 + p * 420, now, 0.15);
  } catch { /* sound is a nicety; never let it break the game */ }
}
