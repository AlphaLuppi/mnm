import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SoundSettings, ToneKey } from "@mnm/shared";
import { DEFAULT_SOUND_SETTINGS } from "@mnm/shared";
import { useCompany } from "./CompanyContext";
import { soundSettingsApi, type UploadedSound } from "../api/sound-settings";
import { queryKeys } from "../lib/queryKeys";
import { BUILTIN_SOUNDS, builtinSoundUrl } from "../sounds/manifest";
import { shouldPlay, resolveSoundUrl } from "../sounds/play";

const THROTTLE_MS = 300;

/** Settings volume (0..100) → HTMLMediaElement volume (0..1); NaN-safe. */
export function toAudioVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(1, Math.max(0, volume / 100));
}

interface SoundSettingsContextValue {
  settings: SoundSettings;
  sounds: UploadedSound[];
  play: (tone: ToneKey) => void;
}

const SoundSettingsContext = createContext<SoundSettingsContextValue | null>(null);

export function SoundSettingsProvider({ children }: { children: React.ReactNode }) {
  const { selectedCompanyId } = useCompany();

  const { data } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.soundSettings.me(selectedCompanyId)
      : ["sound-settings", "none"],
    queryFn: () => soundSettingsApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const settings = data?.settings ?? DEFAULT_SOUND_SETTINGS;
  const sounds = useMemo(() => data?.sounds ?? [], [data]);

  // Keep latest settings in a ref so the stable `play` callback reads fresh values.
  // `null` until the user's settings are loaded: never fall back to the (enabled)
  // defaults, otherwise a muted user would hear sounds during loading / on error.
  const settingsRef = useRef<SoundSettings | null>(null);
  settingsRef.current = data?.settings ?? null;
  // Throttle per tone so a distinct cue (e.g. error) is never swallowed by a
  // recent one of another tone (e.g. success) firing within the window.
  const lastPlayedRef = useRef<Record<ToneKey, number>>({ info: 0, success: 0, warn: 0, error: 0 });
  const unlockedRef = useRef(false);

  // Browser autoplay policy: unlock audio on first user gesture.
  useEffect(() => {
    const unlock = () => {
      unlockedRef.current = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const play = useCallback(
    (tone: ToneKey) => {
      const s = settingsRef.current;
      if (!s) return; // settings not loaded yet
      if (!unlockedRef.current) return; // autoplay blocked pre-gesture
      if (!selectedCompanyId) return;
      if (!shouldPlay(s, tone)) return;

      const now = Date.now();
      if (now - lastPlayedRef.current[tone] < THROTTLE_MS) return;

      const url = resolveSoundUrl(s.tones[tone], {
        companyId: selectedCompanyId,
        builtins: BUILTIN_SOUNDS,
        builtinUrl: builtinSoundUrl,
      });
      if (!url) return; // graceful fallback (missing builtin / deleted asset)

      lastPlayedRef.current[tone] = now;
      // A sound failure must never break the caller (e.g. a toast's dismiss timer).
      try {
        const audio = new Audio(url);
        audio.volume = toAudioVolume(s.volume);
        audio.play().catch(() => {
          /* autoplay denied or asset gone — ignore */
        });
      } catch {
        /* Audio unsupported or invalid volume — ignore */
      }
    },
    [selectedCompanyId],
  );

  const value = useMemo(() => ({ settings, sounds, play }), [settings, sounds, play]);
  return <SoundSettingsContext.Provider value={value}>{children}</SoundSettingsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSoundSettings(): SoundSettingsContextValue {
  const ctx = useContext(SoundSettingsContext);
  if (!ctx) {
    // Tolerate use outside the provider: no-op (keeps ToastContext safe).
    return { settings: DEFAULT_SOUND_SETTINGS, sounds: [], play: () => {} };
  }
  return ctx;
}
