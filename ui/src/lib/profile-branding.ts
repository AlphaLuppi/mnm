/**
 * Deterministic visual branding per connection profile.
 *
 * Profiles only store `displayName` + `apiBaseUrl` today — no per-instance
 * color or logo is persisted. To still give users at-a-glance recognition
 * of which instance they are looking at (the Slack-style affordance), we
 * derive a stable accent color from the profile id and use the first
 * grapheme of the display name as an avatar letter.
 *
 * Stability: the same id always produces the same hue, so the color
 * follows the profile across sessions without requiring a schema change.
 * We pick from a fixed HSL palette rather than hashing directly into
 * rgb() so that every color is readable on both light and dark shells.
 */

/**
 * 12 accent hues, evenly spaced around the color wheel, tuned for a
 * dark-mode chrome. The saturation/lightness stays constant so every
 * bubble has the same visual weight regardless of hue.
 */
const ACCENT_HUES = [
  212, // sky
  262, // violet
  330, // pink
  0, // red
  24, // orange
  42, // amber
  72, // lime
  142, // emerald
  170, // teal
  190, // cyan
  230, // indigo
  290, // fuchsia
] as const;

/** FNV-1a 32-bit string hash — plenty for a 12-way bucket. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime modulo 2^32. Mask with >>> 0 after the shift
    // to keep the result unsigned.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export interface ProfileAccent {
  /** HSL background color. Use for solid avatar bubble. */
  background: string;
  /** Slightly darker/desaturated ring color for the focus/hover state. */
  ring: string;
  /** Readable foreground color for text rendered on top. */
  foreground: string;
}

/**
 * Returns the deterministic accent palette for a given profile id. The
 * palette is intentionally small (12 hues) and fixed — changing this
 * table between releases would re-color every user's profiles, which we
 * treat as a minor identity shift the same way Slack does.
 */
export function profileAccent(profileId: string): ProfileAccent {
  const bucket = hashString(profileId) % ACCENT_HUES.length;
  const hue = ACCENT_HUES[bucket]!;
  return {
    background: `hsl(${hue}, 68%, 48%)`,
    ring: `hsl(${hue}, 68%, 38%)`,
    // Pure white with slight tint so it reads cleanly on every hue.
    foreground: "hsl(0, 0%, 98%)",
  };
}

/**
 * Returns the first "letter" of the display name, upper-cased and safe
 * for a tiny badge. Falls back to "?" for empty names and strips
 * leading whitespace. We take a single UTF-16 unit which is fine for
 * the vast majority of human-language display names; complex grapheme
 * clusters (flags, some emoji) may render as the first unit, which
 * matches Slack / Linear behavior.
 */
export function profileInitial(displayName: string): string {
  const trimmed = displayName.trim();
  if (trimmed.length === 0) return "?";
  return trimmed.charAt(0).toUpperCase();
}
