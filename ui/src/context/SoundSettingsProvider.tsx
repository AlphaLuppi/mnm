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
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastPlayedRef = useRef(0);
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
      if (!unlockedRef.current) return; // autoplay blocked pre-gesture
      if (!selectedCompanyId) return;
      if (!shouldPlay(s, tone)) return;

      const now = Date.now();
      if (now - lastPlayedRef.current < THROTTLE_MS) return;

      const url = resolveSoundUrl(s.tones[tone], {
        companyId: selectedCompanyId,
        builtins: BUILTIN_SOUNDS,
        builtinUrl: builtinSoundUrl,
      });
      if (!url) return; // graceful fallback (missing builtin / deleted asset)

      lastPlayedRef.current = now;
      const audio = new Audio(url);
      audio.volume = Math.min(1, Math.max(0, s.volume / 100));
      audio.play().catch(() => {
        /* autoplay denied or asset gone — ignore */
      });
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
