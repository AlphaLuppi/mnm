export interface BuiltinSound {
  /** Stable id referenced as "builtin:<id>" in settings. */
  id: string;
  /** Human label shown in the UI. */
  label: string;
  /** Path under /public, served at runtime as `/sounds/<file>`. */
  file: string;
}

/**
 * Built-in sound library. Add entries here once audio files are dropped into
 * `ui/public/sounds/`. Empty is valid — the UI then only offers "Aucun".
 *
 * Example once files exist:
 *   { id: "chime", label: "Chime", file: "chime.mp3" },
 */
export const BUILTIN_SOUNDS: BuiltinSound[] = [];

export function builtinSoundUrl(file: string): string {
  return `/sounds/${file}`;
}
