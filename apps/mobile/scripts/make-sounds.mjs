// Writes the app's sound effects to assets/sounds as small mono WAV files: `node scripts/make-sounds.mjs`.
//
// Everything is synthesised here, so there are no third-party recordings to license. The notes sit
// between about 400 Hz and 1.3 kHz, where older ears hear best, and carry bright overtones so that
// small phone speakers (which hardly play anything below 400 Hz) still sound full. Every file is
// normalised, so effects are clearly audible at a normal media volume. Nothing is harsh: a miss is a
// soft falling pair, never a buzzer.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

const NOTE = {
  G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
  A5: 880.0, B5: 987.77, C6: 1046.5, D6: 1174.66, E6: 1318.51,
};

/** A bell/mallet note: fundamental plus overtones that fade faster, soft attack, exponential decay. */
function note(buffer, start, freq, { length = 0.6, gain = 1, decay = 6, attack = 0.004, bright = 1 } = {}) {
  const from = Math.round(start * RATE);
  const count = Math.round(length * RATE);
  for (let i = 0; i < count && from + i < buffer.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    const tone =
      Math.sin(2 * Math.PI * freq * t) +
      bright * 0.5 * Math.exp(-3 * t) * Math.sin(2 * Math.PI * freq * 2 * t) +
      bright * 0.28 * Math.exp(-6 * t) * Math.sin(2 * Math.PI * freq * 3 * t) +
      bright * 0.15 * Math.exp(-18 * t) * Math.sin(2 * Math.PI * freq * 4.2 * t);
    buffer[from + i] += gain * env * tone;
  }
}

/** A short wooden knock: a note whose pitch drops a little while it fades. */
function knock(buffer, start, freq, { length = 0.12, gain = 1, decay = 30 } = {}) {
  const from = Math.round(start * RATE);
  const count = Math.round(length * RATE);
  let phase = 0;
  for (let i = 0; i < count && from + i < buffer.length; i++) {
    const t = i / RATE;
    const f = freq * (1 + 0.25 * Math.exp(-40 * t));
    phase += (2 * Math.PI * f) / RATE;
    const env = Math.min(1, t / 0.002) * Math.exp(-decay * t);
    buffer[from + i] += gain * env * (Math.sin(phase) + 0.35 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase));
  }
}

/** A soft "swish" (a card turning): noise swept through a resonant band-pass. */
function swish(buffer, start, { length = 0.14, gain = 1, from = 900, to = 2400 } = {}) {
  const begin = Math.round(start * RATE);
  const count = Math.round(length * RATE);
  let seed = 12345;
  let low = 0;
  let band = 0;
  for (let i = 0; i < count && begin + i < buffer.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const noise = seed / 0x3fffffff - 1;
    const p = i / count;
    const f = from + (to - from) * p;
    const k = 2 * Math.sin((Math.PI * f) / RATE);
    low += k * band;
    const high = noise - low - 0.35 * band;
    band += k * high;
    const env = Math.sin(Math.PI * p) ** 2;
    buffer[begin + i] += gain * env * band;
  }
}

function render(seconds, level, draw) {
  const buffer = new Float32Array(Math.round(seconds * RATE));
  draw(buffer);
  let peak = 0;
  for (const s of buffer) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? level / peak : 0;
  const fade = Math.round(0.012 * RATE);
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] *= scale;
    if (i >= buffer.length - fade) buffer[i] *= (buffer.length - 1 - i) / fade;
  }
  return buffer;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const arpeggio = (b, notes, step, opts) => notes.forEach((f, i) => note(b, i * step, f, opts));

const SOUNDS = {
  // ── Everywhere ────────────────────────────────────────────────────────────
  // A wooden "tock" for any button: short, so frequent taps never get tiring.
  tap: render(0.1, 0.6, (b) => knock(b, 0, NOTE.A5, { length: 0.1 })),
  // Something worked: two rising notes.
  success: render(0.6, 0.9, (b) => arpeggio(b, [NOTE.C5, NOTE.G5], 0.11, { length: 0.5, decay: 7 })),
  // Not quite: a gentle falling pair, a little softer than success.
  miss: render(0.55, 0.75, (b) => arpeggio(b, [NOTE.G5, NOTE.E5], 0.14, { length: 0.42, decay: 8, bright: 0.6 })),
  // A task done or a game won: a rising arpeggio that rings out.
  celebrate: render(1.6, 0.95, (b) => {
    arpeggio(b, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.11, { length: 1.2, decay: 3.2 });
    note(b, 0.5, NOTE.E6, { length: 1.0, gain: 0.35, decay: 4 });
  }),
  // Chat: a message sent, and one arrived (when Aurélia's voice is off).
  send: render(0.6, 0.85, (b) => arpeggio(b, [NOTE.C5, NOTE.E5], 0.12, { length: 0.45, decay: 7 })),
  receive: render(0.8, 0.9, (b) => arpeggio(b, [NOTE.G5, NOTE.C5], 0.16, { length: 0.6, decay: 5 })),
  // SOS: the family was told. A calm, warm chord: help is on the way.
  sosSent: render(1.6, 0.9, (b) => [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f) => note(b, 0, f, { length: 1.6, decay: 2.2, gain: 0.7 }))),

  // ── All games ─────────────────────────────────────────────────────────────
  // A game begins: "ready… go".
  start: render(0.7, 0.9, (b) => {
    note(b, 0, NOTE.G5, { length: 0.25, decay: 12 });
    note(b, 0.22, NOTE.C6, { length: 0.45, decay: 6 });
  }),
  // The game ended without a win: a warm closing cadence, not a "game over" buzz.
  gameOver: render(1.2, 0.85, (b) => arpeggio(b, [NOTE.G5, NOTE.E5, NOTE.C5], 0.18, { length: 0.8, decay: 4, bright: 0.7 })),

  // ── Memory: cards ─────────────────────────────────────────────────────────
  flip: render(0.18, 0.8, (b) => {
    swish(b, 0, { length: 0.12, from: 1200, to: 3000 });
    knock(b, 0.09, NOTE.E6, { length: 0.08, gain: 0.5, decay: 50 });
  }),
  flipBack: render(0.16, 0.6, (b) => swish(b, 0, { length: 0.14, from: 2400, to: 900 })),
  // A pair found: a quick sparkle.
  match: render(0.8, 0.9, (b) => arpeggio(b, [NOTE.G5, NOTE.C6, NOTE.E6], 0.07, { length: 0.6, decay: 6 })),

  // ── Sequence: one note per colour, a cue when it is the player's turn, a step up per round ──
  pad0: render(0.5, 0.9, (b) => note(b, 0, NOTE.C5, { length: 0.5, decay: 5 })),
  pad1: render(0.5, 0.9, (b) => note(b, 0, NOTE.E5, { length: 0.5, decay: 5 })),
  pad2: render(0.5, 0.9, (b) => note(b, 0, NOTE.G5, { length: 0.5, decay: 5 })),
  pad3: render(0.5, 0.9, (b) => note(b, 0, NOTE.C6, { length: 0.5, decay: 5 })),
  yourTurn: render(0.5, 0.7, (b) => note(b, 0, NOTE.A5, { length: 0.5, decay: 7, bright: 0.5 })),
  levelUp: render(0.8, 0.9, (b) => arpeggio(b, [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], 0.08, { length: 0.5, decay: 6 })),

  // ── Tic-tac-toe: the elder's mark and the phone's mark sound different ──
  placeX: render(0.18, 0.85, (b) => knock(b, 0, NOTE.E5, { length: 0.18, decay: 18 })),
  placeO: render(0.18, 0.7, (b) => knock(b, 0, NOTE.A4, { length: 0.18, decay: 18 })),
  draw: render(0.7, 0.8, (b) => arpeggio(b, [NOTE.E5, NOTE.E5], 0.2, { length: 0.45, decay: 7, bright: 0.6 })),

  // ── Crossword: a letter tile, a hint ──
  key: render(0.08, 0.55, (b) => knock(b, 0, NOTE.C6, { length: 0.08, decay: 45 })),
  hint: render(0.7, 0.8, (b) => arpeggio(b, [NOTE.E5, NOTE.A5, NOTE.D6], 0.06, { length: 0.5, decay: 7, bright: 0.5 })),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) writeFileSync(join(OUT, `${name}.wav`), wav(samples));
console.log(`Wrote ${Object.keys(SOUNDS).length} sounds to ${OUT}`);
