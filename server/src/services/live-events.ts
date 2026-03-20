import { EventEmitter } from "node:events";
import type { LiveEvent, LiveEventType } from "@mnm/shared";

type LiveEventPayload = Record<string, unknown>;
type LiveEventListener = (event: LiveEvent) => void;

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

// DASH-S03: Global listeners receive every live event regardless of companyId.
const globalListeners = new Set<LiveEventListener>();

let nextEventId = 0;

function toLiveEvent(input: {
  companyId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
}): LiveEvent {
  nextEventId += 1;
  return {
    id: nextEventId,
    companyId: input.companyId,
    type: input.type,
    createdAt: new Date().toISOString(),
    payload: input.payload ?? {},
  };
}

export function publishLiveEvent(input: {
  companyId: string;
  type: LiveEventType;
  payload?: LiveEventPayload;
}) {
  const event = toLiveEvent(input);
  emitter.emit(input.companyId, event);
  // DASH-S03: Notify global listeners (e.g. dashboard-refresh debouncer).
  for (const listener of globalListeners) {
    listener(event);
  }
  return event;
}

export function subscribeCompanyLiveEvents(companyId: string, listener: LiveEventListener) {
  emitter.on(companyId, listener);
  return () => emitter.off(companyId, listener);
}

/**
 * DASH-S03: Subscribe a listener that receives every published live event,
 * regardless of company. Returns an unsubscribe function.
 */
export function subscribeAllLiveEvents(listener: LiveEventListener): () => void {
  globalListeners.add(listener);
  return () => { globalListeners.delete(listener); };
}
