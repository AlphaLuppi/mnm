import type { SoundSettings, ToneKey } from "@mnm/shared";
import type { BuiltinSound } from "./manifest";

export function shouldPlay(settings: SoundSettings, tone: ToneKey): boolean {
  if (!settings.enabled) return false;
  return settings.tones[tone] !== "none";
}

export interface ResolveCtx {
  companyId: string;
  builtins: BuiltinSound[];
  builtinUrl: (file: string) => string;
}

/** Returns a playable URL for a sound ref, or null if not resolvable. */
export function resolveSoundUrl(ref: string, ctx: ResolveCtx): string | null {
  if (ref === "none") return null;
  if (ref.startsWith("builtin:")) {
    const id = ref.slice("builtin:".length);
    const found = ctx.builtins.find((b) => b.id === id);
    return found ? ctx.builtinUrl(found.file) : null;
  }
  if (ref.startsWith("asset:")) {
    const id = ref.slice("asset:".length);
    return `/api/companies/${ctx.companyId}/assets/${id}/content`;
  }
  return null;
}
