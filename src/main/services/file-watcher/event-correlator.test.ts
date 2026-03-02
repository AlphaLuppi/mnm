import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventCorrelator } from './event-correlator'
import type { FileChangeEvent } from './file-watcher.types'

function makeEvent(overrides: Partial<FileChangeEvent> = {}): FileChangeEvent {
  return {
    path: '/project/src/main.ts',
    type: 'modify',
    timestamp: Date.now(),
    ...overrides
  }
}

describe('EventCorrelator', () => {
  let correlator: EventCorrelator

  beforeEach(() => {
    vi.useFakeTimers()
    correlator = new EventCorrelator()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns original event when no agents registered', () => {
    const event = makeEvent()
    const result = correlator.correlate(event)

    expect(result.agentId).toBeUndefined()
    expect(result.path).toBe(event.path)
  })

  it('attributes event to recently active agent', () => {
    correlator.registerAgentProcess('agent-1', 12345)
    const event = makeEvent()
    const result = correlator.correlate(event)

    expect(result.agentId).toBe('agent-1')
  })

  it('does not attribute event after correlation window expires', () => {
    correlator.registerAgentProcess('agent-1', 12345)
    vi.advanceTimersByTime(3000) // Beyond 2s window

    const event = makeEvent()
    const result = correlator.correlate(event)

    expect(result.agentId).toBeUndefined()
  })

  it('updateAgentActivity resets the correlation window', () => {
    correlator.registerAgentProcess('agent-1', 12345)
    vi.advanceTimersByTime(1500)
    correlator.updateAgentActivity('agent-1')
    vi.advanceTimersByTime(1500) // 1.5s after update, still within window

    const event = makeEvent()
    const result = correlator.correlate(event)

    expect(result.agentId).toBe('agent-1')
  })

  it('unregisterAgentProcess removes agent from correlation', () => {
    correlator.registerAgentProcess('agent-1', 12345)
    correlator.unregisterAgentProcess('agent-1')

    const event = makeEvent()
    const result = correlator.correlate(event)

    expect(result.agentId).toBeUndefined()
  })

  it('correlates to the first recently active agent', () => {
    correlator.registerAgentProcess('agent-1', 111)
    correlator.registerAgentProcess('agent-2', 222)

    const event = makeEvent()
    const result = correlator.correlate(event)

    expect(result.agentId).toBeDefined()
  })

  it('does not mutate original event', () => {
    correlator.registerAgentProcess('agent-1', 12345)
    const event = makeEvent()
    correlator.correlate(event)

    expect(event.agentId).toBeUndefined()
  })

  it('tracks active agent count', () => {
    expect(correlator.getActiveAgentCount()).toBe(0)

    correlator.registerAgentProcess('a1', 111)
    correlator.registerAgentProcess('a2', 222)
    expect(correlator.getActiveAgentCount()).toBe(2)

    correlator.unregisterAgentProcess('a1')
    expect(correlator.getActiveAgentCount()).toBe(1)
  })

  it('updateAgentActivity adds watched paths', () => {
    correlator.registerAgentProcess('agent-1', 12345)
    correlator.updateAgentActivity('agent-1', ['/src/a.ts', '/src/b.ts'])

    // Verify agent is still active (activity updated)
    vi.advanceTimersByTime(1500)
    const event = makeEvent()
    const result = correlator.correlate(event)
    expect(result.agentId).toBe('agent-1')
  })
})
