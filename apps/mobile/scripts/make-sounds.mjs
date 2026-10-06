// Writes the app's sound effects to assets/sounds as small mono WAV files: `node scripts/make-sounds.mjs`.
//
// Everything is synthesised here, so there are no third-party recordings to license. The tones are soft
// marimba-like notes between about 300 Hz and 1.1 kHz, where older ears hear best, with gentle attacks
// and no harsh "wrong answer" buzz: a miss is a soft falling pair, never a punishment.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');

const NOTE = { E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.5 };

/** One mallet note: fundamental plus a quiet, fast-fading overtone, soft attack, exponential decay. */
function note(buffer, start, freq, { length = 0.6, gain = 0.5, decay = 6, attack = 0.006 } = {}) {
  const from = Math.round(start * RATE);
  const count = Math.round(length * RATE);
  for (let i = 0; i < count && from + i < buffer.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    const tone =
      Math.sin(2 * Math.PI * freq * t) +
      0.25 * Math.exp(-14 * t) * Math.sin(2 * Math.PI * freq * 4 * t) +
      0.1 * Math.sin(2 * Math.PI * freq * 2 * t);
    buffer[from + i] += gain * env * tone;
  }
}

function render(seconds, draw) {
  const buffer = new Float32Array(Math.round(seconds * RATE));
  draw(buffer);
  // Short fade-out so no file ends on a click.
  const fade = Math.round(0.01 * RATE);
  for (let i = 0; i < fade; i++) buffer[buffer.length - 1 - i] *= i / fade;
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

const SOUNDS = {
  // A soft wooden "tock" for any button.
  tap: render(0.09, (b) => note(b, 0, NOTE.A4, { length: 0.09, gain: 0.32, decay: 45, attack: 0.002 })),
  // Turning a card over: shorter and a little higher.
  flip: render(0.08, (b) => note(b, 0, NOTE.D5, { length: 0.08, gain: 0.28, decay: 55, attack: 0.002 })),
  // Something worked: two rising notes.
  success: render(0.55, (b) => {
    note(b, 0, NOTE.C5, { length: 0.45, gain: 0.4, decay: 8 });
    note(b, 0.11, NOTE.G5, { length: 0.44, gain: 0.4, decay: 7 });
  }),
  // Not quite: a gentle falling pair, quieter than success.
  miss: render(0.5, (b) => {
    note(b, 0, NOTE.G4, { length: 0.4, gain: 0.3, decay: 9 });
    note(b, 0.13, NOTE.E4, { length: 0.37, gain: 0.3, decay: 9 });
  }),
  // A task done or a game won: a warm rising arpeggio that rings out.
  celebrate: render(1.5, (b) => {
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => note(b, i * 0.12, f, { length: 1.1, gain: 0.3, decay: 3.5 }));
  }),
  // A message sent / a message arrived (when Aurélia's voice is off).
  send: render(0.3, (b) => {
    note(b, 0, NOTE.E5, { length: 0.2, gain: 0.3, decay: 18 });
    note(b, 0.07, NOTE.G5, { length: 0.22, gain: 0.3, decay: 16 });
  }),
  receive: render(0.5, (b) => {
    note(b, 0, NOTE.G5, { length: 0.35, gain: 0.3, decay: 10 });
    note(b, 0.1, NOTE.E5, { length: 0.4, gain: 0.32, decay: 9 });
  }),
  // The sequence game's four pads, one note each (like the classic toy, but softer).
  pad0: render(0.45, (b) => note(b, 0, NOTE.E4, { length: 0.45, gain: 0.45, decay: 6 })),
  pad1: render(0.45, (b) => note(b, 0, NOTE.G4, { length: 0.45, gain: 0.45, decay: 6 })),
  pad2: render(0.45, (b) => note(b, 0, NOTE.C5, { length: 0.45, gain: 0.42, decay: 6 })),
  pad3: render(0.45, (b) => note(b, 0, NOTE.E5, { length: 0.45, gain: 0.4, decay: 6 })),
};

mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) writeFileSync(join(OUT, `${name}.wav`), wav(samples));
console.log(`Wrote ${Object.keys(SOUNDS).length} sounds to ${OUT}`);
