import { create } from 'zustand'
import type { TimelineEvent } from '@shared/types/timeline.types'

const AGENT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1' // indigo
]

type TimelineState = {
  events: TimelineEvent[]
  viewWindow: { start: number; end: number }
  selectedEventId: string | null
  agentColorMap: Map<string, string>

  addEvent: (event: TimelineEvent) => void
  setViewWindow: (start: number, end: number) => void
  selectEvent: (eventId: string | null) => void
  clearEvents: () => void

  getEventsInView: () => TimelineEvent[]
  getAgentColor: (agentId: string) => string
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  events: [],
  viewWindow: {
    start: Date.now() - 60 * 60 * 1000,
    end: Date.now()
  },
  selectedEventId: null,
  agentColorMap: new Map(),

  addEvent: (event) =>
    set((state) => {
      const newEvents = [...state.events, event].sort((a, b) => a.timestamp - b.timestamp)

      const colorMap = new Map(state.agentColorMap)
      if (!colorMap.has(event.agentId)) {
        const colorIndex = colorMap.size % AGENT_COLORS.length
        colorMap.set(event.agentId, AGENT_COLORS[colorIndex])
      }

      let { start, end } = state.viewWindow
      if (event.timestamp > end) {
        end = event.timestamp + 60_000
      }
      if (event.timestamp < start) {
        start = event.timestamp - 60_000
      }

      return {
        events: newEvents,
        agentColorMap: colorMap,
        viewWindow: { start, end }
      }
    }),

  setViewWindow: (start, end) => set({ viewWindow: { start, end } }),

  selectEvent: (eventId) => set({ selectedEventId: eventId }),

  clearEvents: () => set({ events: [], selectedEventId: null }),

  getEventsInView: () => {
    const { events, viewWindow } = get()
    return events.filter((e) => e.timestamp >= viewWindow.start && e.timestamp <= viewWindow.end)
  },

  getAgentColor: (agentId) => {
    const colorMap = get().agentColorMap
    return colorMap.get(agentId) ?? AGENT_COLORS[0]
  }
}))

export { AGENT_COLORS }
