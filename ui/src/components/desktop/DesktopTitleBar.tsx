/**
 * Fixed-position title-bar overlay for packaged desktop builds.
 *
 * Tauri's `titleBarStyle: "Overlay"` (see `tauri.conf.json`) lets the
 * native macOS traffic lights float on top of the webview content —
 * giving us an ~28px strip along the top of the window that we own.
 * This component claims that strip as a draggable region and embeds
 * the `ProfileSwitcher` right after the reserved traffic-lights area.
 *
 * Only mounts inside a Tauri webview AND outside dev mode. In web /
 * Tauri dev the file is still imported but `DesktopTitleBar` returns
 * null, keeping the Vite HMR flow untouched.
 *
 * The component relies on the `.tauri-shell` class stamped on `<html>`
 * at boot by `main.tsx`. That class is also the trigger for the
 * `padding-top` rule in `index.css` that pushes app content below the
 * title bar so the switcher never overlaps meaningful UI.
 */
import type { ReactElement } from "react";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { isTauri } from "@/lib/runtime";

export const DESKTOP_TITLE_BAR_HEIGHT_PX = 36;

/** Reserved on the left for the macOS traffic lights. */
const TRAFFIC_LIGHTS_PX = 76;

export function DesktopTitleBar(): ReactElement | null {
  if (!isTauri() || import.meta.env.DEV) return null;

  return (
    <div
      data-tauri-drag-region
      data-testid="desktop-title-bar"
      className="fixed inset-x-0 top-0 z-[60] flex items-center border-b border-border/40 bg-background/80 backdrop-blur"
      style={{ height: `${DESKTOP_TITLE_BAR_HEIGHT_PX}px` }}
    >
      <div
        data-tauri-drag-region
        className="flex h-full flex-1 items-center gap-2 pr-2"
        style={{ paddingLeft: `${TRAFFIC_LIGHTS_PX}px` }}
      >
        <ProfileSwitcher />
      </div>
    </div>
  );
}
