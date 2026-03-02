import { describe, it, expect, beforeEach } from 'vitest'
import { useTimelineStore, AGENT_COLORS } from './timeline.store'
import type { TimelineEvent } from '@shared/types/timeline.types'

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: 'evt-1',
    agentId: 'agent-1',
    category: 'checkpoint',
    label: 'File modified via Write',
    timestamp: Date.now(),
    ...overrides
  }
}

describe('useTimelineStore', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      events: [],
      viewWindow: { start: Date.now() - 3_600_000, end: Date.now() },
      selectedEventId: null,
      agentColorMap: new Map()
    })
  })

  it('addEvent appends and sorts by timestamp', () => {
    const now = Date.now()
    useTimelineStore.getState().addEvent(makeEvent({ id: 'e2', timestamp: now + 1000 }))
    useTimelineStore.getState().addEvent(makeEvent({ id: 'e1', timestamp: now }))

    const events = useTimelineStore.getState().events
    expect(events).toHaveLength(2)
    expect(events[0].id).toBe('e1')
    expect(events[1].id).toBe('e2')
  })

  it('addEvent auto-assigns color to new agents', () => {
    useTimelineStore.getState().addEvent(makeEvent({ agentId: 'a1' }))
    useTimelineStore.getState().addEvent(makeEvent({ id: 'e2', agentId: 'a2' }))

    const colorMap = useTimelineStore.getState().agentColorMap
    expect(colorMap.get('a1')).toBe(AGENT_COLORS[0])
    expect(colorMap.get('a2')).toBe(AGENT_COLORS[1])
  })

  it('addEvent keeps same color for existing agent', () => {
    useTimelineStore.getState().addEvent(makeEvent({ agentId: 'a1' }))
    useTimelineStore.getState().addEvent(makeEvent({ id: 'e2', agentId: 'a1' }))

    const colorMap = useTimelineStore.getState().agentColorMap
    expect(colorMap.size).toBe(1)
    expect(colorMap.get('a1')).toBe(AGENT_COLORS[0])
  })

  it('addEvent auto-expands view window for future event', () => {
    const future = Date.now() + 10_000_000
    useTimelineStore.getState().addEvent(makeEvent({ timestamp: future }))

    const { viewWindow } = useTimelineStore.getState()
    expect(viewWindow.end).toBeGreaterThan(future)
  })

  it('addEvent auto-expands view window for past event', () => {
    const past = Date.now() - 10_000_000
    useTimelineStore.getState().addEvent(makeEvent({ timestamp: past }))

    const { viewWindow } = useTimelineStore.getState()
    expect(viewWindow.start).toBeLessThan(past)
  })

  it('setViewWindow updates start and end', () => {
    useTimelineStore.getState().setViewWindow(100, 200)

    const { viewWindow } = useTimelineStore.getState()
    expect(viewWindow.start).toBe(100)
    expect(viewWindow.end).toBe(200)
  })

  it('selectEvent sets selectedEventId', () => {
    useTimelineStore.getState().selectEvent('evt-1')
    expect(useTimelineStore.getState().selectedEventId).toBe('evt-1')
  })

  it('selectEvent with null clears selection', () => {
    useTimelineStore.getState().selectEvent('evt-1')
    useTimelineStore.getState().selectEvent(null)
    expect(useTimelineStore.getState().selectedEventId).toBeNull()
  })

  it('clearEvents removes all events and selection', () => {
    useTimelineStore.getState().addEvent(makeEvent())
    useTimelineStore.getState().selectEvent('evt-1')
    useTimelineStore.getState().clearEvents()

    expect(useTimelineStore.getState().events).toHaveLength(0)
    expect(useTimelineStore.getState().selectedEventId).toBeNull()
  })

  it('getEventsInView returns only events within view window', () => {
    const now = Date.now()
    useTimelineStore.setState({ viewWindow: { start: now - 1000, end: now + 1000 } })

    useTimelineStore.getState().addEvent(makeEvent({ id: 'in', timestamp: now }))
    useTimelineStore.getState().addEvent(makeEvent({ id: 'out', timestamp: now + 50_000_000 }))

    // After adding 'out', viewWindow auto-expanded, so reset it
    useTimelineStore.setState({ viewWindow: { start: now - 1000, end: now + 1000 } })

    const inView = useTimelineStore.getState().getEventsInView()
    expect(inView).toHaveLength(1)
    expect(inView[0].id).toBe('in')
  })

  it('getAgentColor returns consistent color', () => {
    useTimelineStore.getState().addEvent(makeEvent({ agentId: 'a1' }))

    const color1 = useTimelineStore.getState().getAgentColor('a1')
    const color2 = useTimelineStore.getState().getAgentColor('a1')
    expect(color1).toBe(color2)
    expect(color1).toBe(AGENT_COLORS[0])
  })

  it('getAgentColor returns default for unknown agent', () => {
    expect(useTimelineStore.getState().getAgentColor('unknown')).toBe(AGENT_COLORS[0])
  })

  it('color assignment wraps around palette', () => {
    for (let i = 0; i < AGENT_COLORS.length + 1; i++) {
      useTimelineStore.getState().addEvent(makeEvent({ id: `e${i}`, agentId: `a${i}` }))
    }

    const colorMap = useTimelineStore.getState().agentColorMap
    expect(colorMap.get(`a${AGENT_COLORS.length}`)).toBe(AGENT_COLORS[0])
  })
})
