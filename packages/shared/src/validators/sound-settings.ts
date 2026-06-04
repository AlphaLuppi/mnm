import { z } from "zod";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const BUILTIN_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** A sound reference: "none" | "builtin:<id>" | "asset:<uuid>". */
export const soundRefSchema = z.string().refine((v) => {
  if (v === "none") return true;
  if (v.startsWith("builtin:")) return BUILTIN_RE.test(v.slice("builtin:".length));
  if (v.startsWith("asset:")) return UUID_RE.test(v.slice("asset:".length));
  return false;
}, "Invalid sound reference");

export const TONE_KEYS = ["info", "success", "warn", "error"] as const;
export type ToneKey = (typeof TONE_KEYS)[number];

export const tonesSchema = z.object({
  info: soundRefSchema,
  success: soundRefSchema,
  warn: soundRefSchema,
  error: soundRefSchema,
});
export type SoundTones = z.infer<typeof tonesSchema>;

/** PUT body — every field optional; tones may be partial. */
export const updateSoundSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  volume: z.number().int().min(0).max(100).optional(),
  tones: tonesSchema.partial().optional(),
});
export type UpdateSoundSettings = z.infer<typeof updateSoundSettingsSchema>;

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  tones: SoundTones;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 70,
  tones: { info: "none", success: "none", warn: "none", error: "none" },
};
