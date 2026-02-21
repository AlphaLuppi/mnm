"use client";

import { useEffect, useRef, useCallback } from "react";
import { mutate } from "swr";

type EventChannel =
  | "tasks"
  | "agents"
  | "drift"
  | "drift-status"
  | "cross-doc-drift"
  | "dashboard"
  | "workflows"
  | "discovery"
  | "projects";

/**
 * Map of event channels → SWR cache key patterns to invalidate.
 * When the server emits an event on a channel, all matching SWR keys are revalidated.
 */
const CHANNEL_KEYS: Record<EventChannel, (string | RegExp)[]> = {
  tasks: ["/api/tasks", /^\/api\/tasks\//],
  agents: ["/api/agents", /^\/api\/agents\//],
  drift: ["/api/drift", /^\/api\/drift\?/],
  "drift-status": ["/api/drift/status"],
  "cross-doc-drift": ["/api/drift/cross-doc"],
  dashboard: ["/api/dashboard"],
  workflows: ["/api/workflows", /^\/api\/workflows\//],
  discovery: ["/api/discovery/results", /^\/api\/discovery\/results\?/],
  projects: ["/api/projects"],
};

/**
 * Singleton EventSource connection shared by the entire app.
 * We only need one SSE connection regardless of how many hooks consume it.
 */
let globalES: EventSource | null = null;
let connectionCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Map<EventChannel, Set<() => void>>();

function getOrCreateConnection() {
  if (globalES && globalES.readyState !== EventSource.CLOSED) return;

  globalES = new EventSource("/api/events");

  globalES.onopen = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  globalES.onerror = () => {
    globalES?.close();
    globalES = null;
    // Exponential backoff reconnect
    if (!reconnectTimer && connectionCount > 0) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        getOrCreateConnection();
      }, 3000);
    }
  };

  // Listen to all channels using named events
  for (const channel of Object.keys(CHANNEL_KEYS) as EventChannel[]) {
    globalES.addEventListener(channel, () => {
      // Invalidate all SWR keys for this channel
      const keys = CHANNEL_KEYS[channel];
      for (const key of keys) {
        if (typeof key === "string") {
          mutate(key);
        } else {
          // Regex match — invalidate all matching SWR keys
          mutate((k) => typeof k === "string" && key.test(k));
        }
      }

      // Notify channel-specific listeners (for custom callbacks)
      const channelListeners = listeners.get(channel);
      if (channelListeners) {
        for (const cb of channelListeners) cb();
      }
    });
  }
}

function closeConnectionIfUnused() {
  if (connectionCount <= 0) {
    globalES?.close();
    globalES = null;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }
}

/**
 * Connect to the server event stream.
 * Call this once near the app root (e.g., in a layout component).
 * Manages a singleton EventSource that auto-invalidates SWR caches.
 */
export function useServerEvents() {
  useEffect(() => {
    connectionCount++;
    getOrCreateConnection();

    return () => {
      connectionCount--;
      // Delay close to handle React strict mode double-mount
      setTimeout(closeConnectionIfUnused, 100);
    };
  }, []);
}

/**
 * Subscribe to a specific event channel with a custom callback.
 * Useful for actions beyond SWR invalidation (e.g., showing a toast).
 */
export function useServerEvent(channel: EventChannel, callback: () => void) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const stableCallback = useCallback(() => {
    cbRef.current();
  }, []);

  useEffect(() => {
    if (!listeners.has(channel)) {
      listeners.set(channel, new Set());
    }
    listeners.get(channel)!.add(stableCallback);

    return () => {
      listeners.get(channel)?.delete(stableCallback);
    };
  }, [channel, stableCallback]);
}
