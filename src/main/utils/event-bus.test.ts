import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eventBus } from './event-bus'

describe('TypedEventBus', () => {
  beforeEach(() => {
    eventBus.removeAllListeners()
  })

  it('should emit and receive typed events', () => {
    const handler = vi.fn()
    eventBus.on('agent:output', handler)

    const payload = { agentId: 'agent-1', data: 'hello', timestamp: Date.now() }
    eventBus.emit('agent:output', payload)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith(payload)
  })

  it('should support multiple listeners', () => {
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    eventBus.on('file:changed', handler1)
    eventBus.on('file:changed', handler2)

    const payload = { path: '/test.ts', type: 'modify' as const }
    eventBus.emit('file:changed', payload)

    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
  })

  it('should unsubscribe with off()', () => {
    const handler = vi.fn()
    eventBus.on('agent:status', handler)
    eventBus.off('agent:status', handler)

    eventBus.emit('agent:status', { agentId: 'a1', status: 'ACTIVE' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('should fire once() listener only once', () => {
    const handler = vi.fn()
    eventBus.once('git:commit', handler)

    const payload = { hash: 'abc123', message: 'test commit' }
    eventBus.emit('git:commit', payload)
    eventBus.emit('git:commit', payload)

    expect(handler).toHaveBeenCalledOnce()
  })

  it('should remove all listeners for a specific event', () => {
    const handler = vi.fn()
    eventBus.on('drift:detected', handler)
    eventBus.removeAllListeners('drift:detected')

    eventBus.emit('drift:detected', {
      id: 'd1',
      severity: 'warning',
      documents: ['a.md', 'b.md']
    })

    expect(handler).not.toHaveBeenCalled()
  })
})
