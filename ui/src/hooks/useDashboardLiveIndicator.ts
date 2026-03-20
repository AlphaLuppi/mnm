import { useCallback, useEffect, useRef, useState } from "react";

/**
 * DASH-S03: Hook to manage the dashboard live indicator state.
 *
 * Listens for the custom DOM event `dashboard:refresh` dispatched by
 * LiveUpdatesProvider when a `dashboard.refresh` live event arrives.
 *
 * Returns:
 * - `isLive` — always true while the component is mounted (WebSocket is assumed connected)
 * - `isFlashing` — true for 2 seconds after a dashboard refresh event
 * - `lastRefreshAt` — Date of the last refresh, or null if none received yet
 */
export function useDashboardLiveIndicator() {
  const [isFlashing, setIsFlashing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRefresh = useCallback(() => {
    setLastRefreshAt(new Date());
    setIsFlashing(true);

    // Clear any existing flash timer
    if (flashTimerRef.current !== null) {
      clearTimeout(flashTimerRef.current);
    }

    // Flash for 2 seconds
    flashTimerRef.current = setTimeout(() => {
      setIsFlashing(false);
      flashTimerRef.current = null;
    }, 2_000);
  }, []);

  useEffect(() => {
    const listener = () => handleRefresh();
    window.addEventListener("dashboard:refresh", listener);
    return () => {
      window.removeEventListener("dashboard:refresh", listener);
      if (flashTimerRef.current !== null) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, [handleRefresh]);

  return {
    isLive: true,
    isFlashing,
    lastRefreshAt,
  };
}
