export interface BuiltinSound {
  /** Stable id referenced as "builtin:<id>" in settings. */
  id: string;
  /** Human label shown in the UI. */
  label: string;
  /**
   * Filename under `ui/public/sounds/`, served at runtime as `/sounds/<file>`.
   * Any browser-supported audio format: `.wav`, `.mp3`, `.ogg`, or `.webm`.
   */
  file: string;
}

/**
 * Built-in sound library. Files live in `ui/public/sounds/` and may be any
 * browser-supported audio format (`.wav` / `.mp3` / `.ogg` / `.webm`).
 *
 * Two ways to add one:
 *  - Synthesized (zero-dependency, the default WAVs below): add a voice to
 *    `scripts/sounds/generate-sounds.mjs`, then `bun run sounds:generate`.
 *  - Ready-made (e.g. an MP3): drop the file into `ui/public/sounds/`.
 *
 * Either way, register it here. Ids must match the `builtin:<id>` validator
 * (lowercase a-z0-9_-).
 */
export const BUILTIN_SOUNDS: BuiltinSound[] = [
  { id: "pop", label: "Pop", file: "pop.wav" },
  { id: "ping", label: "Ping", file: "ping.wav" },
  { id: "chime", label: "Carillon", file: "chime.wav" },
  { id: "success", label: "Succès", file: "success.wav" },
  { id: "warn", label: "Alerte", file: "warn.wav" },
  { id: "error", label: "Erreur", file: "error.wav" },
  // Rendered from the earshot sound bank (MIT, pure DSP — no recorded audio) by
  // `scripts/sounds/render-earshot-sounds.py`.
  { id: "soft-pop", label: "Pop doux", file: "soft-pop.wav" },
  { id: "glass-ping", label: "Ping cristal", file: "glass-ping.wav" },
  { id: "bell-chime", label: "Cloche", file: "bell-chime.wav" },
  { id: "rise-chime", label: "Arpège montant", file: "rise-chime.wav" },
  { id: "double-ding", label: "Double ding", file: "double-ding.wav" },
  { id: "low-sweep", label: "Glissando grave", file: "low-sweep.wav" },
];

export function builtinSoundUrl(file: string): string {
  return `/sounds/${file}`;
}
