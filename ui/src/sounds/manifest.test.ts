import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SOUND_SETTINGS, TONE_KEYS, soundRefSchema } from "@mnm/shared";
import { BUILTIN_SOUNDS } from "./manifest";

const soundsDir = join(dirname(fileURLToPath(import.meta.url)), "../../public/sounds");
const MAX_BYTES = 200 * 1024; // README contract: built-in files stay small

// Browser-supported formats the app accepts (matches the upload MIME whitelist).
const ALLOWED_EXT = [".wav", ".mp3", ".ogg", ".webm"];

/** Best-effort magic-byte sniff for the audio containers browsers play. */
function looksLikeAudio(buf: Buffer): boolean {
  const tag = (start: number, len: number) => buf.toString("ascii", start, start + len);
  if (tag(0, 4) === "RIFF" && tag(8, 4) === "WAVE") return true; // WAV
  if (tag(0, 4) === "OggS") return true; // Ogg (Vorbis/Opus)
  if (tag(0, 3) === "ID3") return true; // MP3 with ID3 tag
  if (buf[0] === 0xff && (buf[1]! & 0xe0) === 0xe0) return true; // MP3 frame sync
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true; // WebM/Matroska (EBML)
  return false;
}

describe("BUILTIN_SOUNDS manifest", () => {
  it("has at least one sound per default tone", () => {
    expect(BUILTIN_SOUNDS.length).toBeGreaterThanOrEqual(4);
  });

  it("has unique ids", () => {
    const ids = BUILTIN_SOUNDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BUILTIN_SOUNDS)("$id: valid builtin id, supported file present on disk", (s) => {
    expect(soundRefSchema.safeParse(`builtin:${s.id}`).success).toBe(true);
    expect(ALLOWED_EXT, `${s.file}: unsupported extension`).toContain(extname(s.file).toLowerCase());
    expect(existsSync(join(soundsDir, s.file)), `${s.file} missing in ui/public/sounds`).toBe(true);
  });

  it.each(BUILTIN_SOUNDS)("$id: non-empty recognized audio under 200 KB", (s) => {
    const buf = readFileSync(join(soundsDir, s.file));
    expect(buf.length).toBeGreaterThan(64); // not a stub/placeholder
    expect(buf.length).toBeLessThan(MAX_BYTES);
    expect(looksLikeAudio(buf), `${s.file}: unrecognized audio header`).toBe(true);
  });
});

describe("DEFAULT_SOUND_SETTINGS tone mapping", () => {
  const builtinIds = new Set(BUILTIN_SOUNDS.map((s) => s.id));

  it.each(TONE_KEYS)("%s default ref is valid and resolves to a present builtin", (tone) => {
    const ref = DEFAULT_SOUND_SETTINGS.tones[tone];
    expect(soundRefSchema.safeParse(ref).success).toBe(true);
    if (ref.startsWith("builtin:")) {
      expect(builtinIds.has(ref.slice("builtin:".length))).toBe(true);
    }
  });
});
