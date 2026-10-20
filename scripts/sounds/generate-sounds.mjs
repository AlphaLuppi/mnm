#!/usr/bin/env node
/**
 * Generator for MnM's built-in notification sounds.
 *
 * These sounds are AUTHORED here (additive sine synthesis) rather than sourced
 * externally, so the repository owns them outright — no third-party license is
 * pulled into this public/open-source repo.
 *
 * Output: short WAV files (PCM 16-bit, mono, 44.1 kHz) in `ui/public/sounds/`.
 * WAV is used on purpose: at sub-second durations the files stay tiny (< 200 KB)
 * and play with zero priming latency, unlike MP3 — which matters for a snappy
 * UI cue. Each file must be registered in `ui/src/sounds/manifest.ts`.
 *
 * This generator only emits the synthesized WAV baseline. Built-in sounds are NOT
 * limited to WAV, though: a ready-made `.mp3` / `.ogg` / `.webm` can simply be
 * dropped into `ui/public/sounds/` and registered in the manifest (no script).
 *
 * Deterministic: no randomness, so re-running regenerates byte-identical files.
 *
 *   node scripts/sounds/generate-sounds.mjs        (or: bun run sounds:generate)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const PEAK = 0.7; // ≈ -3 dBFS — leaves headroom, avoids clipping post-mix
const ATTACK_S = 0.004; // 4 ms ramp-in to avoid a click at note start
const FADE_OUT_S = 0.004; // 4 ms ramp-out to avoid a click at sound end

// Equal-temperament reference frequencies (Hz).
const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
  C6: 1046.5,
};

/**
 * A voice = one note: a fundamental plus harmonic partials, with an exponential
 * decay envelope. `partials` are [ratio, amplitude] pairs (ratio 1 = fundamental;
 * non-integer ratios give a bell-like, slightly inharmonic shimmer).
 */
function renderVoice(buf, { freq, start, dur, amp, tau, partials }) {
  const startSample = Math.round(start * SAMPLE_RATE);
  const n = Math.round(dur * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Attack / exponential-decay / final fade-out envelope.
    let env;
    if (t < ATTACK_S) env = t / ATTACK_S;
    else env = Math.exp(-(t - ATTACK_S) / tau);
    const remaining = dur - t;
    if (remaining < FADE_OUT_S) env *= remaining / FADE_OUT_S;

    let s = 0;
    for (const [ratio, pamp] of partials) {
      s += pamp * Math.sin(2 * Math.PI * freq * ratio * t);
    }
    const idx = startSample + i;
    if (idx < buf.length) buf[idx] += amp * env * s;
  }
}

/** Render a sound (list of voices) to a normalized Float64Array of samples. */
function renderSound(voices) {
  const end = Math.max(...voices.map((v) => v.start + v.dur));
  const buf = new Float64Array(Math.ceil(end * SAMPLE_RATE));
  for (const v of voices) renderVoice(buf, v);
  // Peak-normalize to PEAK so every sound shares a consistent ceiling.
  let peak = 0;
  for (const x of buf) peak = Math.max(peak, Math.abs(x));
  if (peak > 0) {
    const g = PEAK / peak;
    for (let i = 0; i < buf.length; i++) buf[i] *= g;
  }
  return buf;
}

/** Encode mono Float64 samples [-1, 1] as a 16-bit PCM WAV Buffer. */
function encodeWav(samples) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28); // byte rate
  buf.writeUInt16LE(bytesPerSample, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }
  return buf;
}

const soft = [[1, 1.0], [2, 0.12]]; // pure-ish: fundamental + faint octave
const bright = [[1, 1.0], [2, 0.18], [3, 0.06]]; // a touch more presence
const bell = [[1, 1.0], [2, 0.5], [3, 0.25], [4.2, 0.1]]; // inharmonic shimmer

// Each sound is a list of voices. Tuned to feel soft and minimal; retune freely.
const SOUNDS = {
  // info — single soft mid note, neutral and unobtrusive.
  pop: [{ freq: NOTE.D5, start: 0, dur: 0.13, amp: 1, tau: 0.045, partials: soft }],

  // alternative — tiny high blip.
  ping: [{ freq: NOTE.B5, start: 0, dur: 0.1, amp: 1, tau: 0.035, partials: soft }],

  // alternative — gentle bell with a long shimmering decay.
  chime: [{ freq: NOTE.A5, start: 0, dur: 0.7, amp: 1, tau: 0.28, partials: bell }],

  // success — rising major arpeggio (C–E–G–C), bright and positive.
  success: [
    { freq: NOTE.C5, start: 0.0, dur: 0.18, amp: 1, tau: 0.1, partials: bright },
    { freq: NOTE.E5, start: 0.09, dur: 0.18, amp: 1, tau: 0.1, partials: bright },
    { freq: NOTE.G5, start: 0.18, dur: 0.2, amp: 1, tau: 0.11, partials: bright },
    { freq: NOTE.C6, start: 0.27, dur: 0.24, amp: 0.9, tau: 0.13, partials: bright },
  ],

  // warn — two-tone descending step, attention without alarm.
  warn: [
    { freq: NOTE.A5, start: 0.0, dur: 0.16, amp: 1, tau: 0.1, partials: bright },
    { freq: NOTE.F5, start: 0.14, dur: 0.18, amp: 1, tau: 0.1, partials: bright },
  ],

  // error — low descending step, negative but soft (not a harsh buzzer).
  error: [
    { freq: NOTE.G4, start: 0.0, dur: 0.2, amp: 1, tau: 0.14, partials: bright },
    { freq: NOTE.C4, start: 0.16, dur: 0.24, amp: 1, tau: 0.16, partials: bright },
  ],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../../ui/public/sounds");
mkdirSync(outDir, { recursive: true });

for (const [id, voices] of Object.entries(SOUNDS)) {
  const wav = encodeWav(renderSound(voices));
  const file = resolve(outDir, `${id}.wav`);
  writeFileSync(file, wav);
  console.log(`  ${id}.wav  ${(wav.length / 1024).toFixed(1)} KB`);
}
console.log(`Generated ${Object.keys(SOUNDS).length} sounds → ${outDir}`);
