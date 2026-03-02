import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentsStore } from './agents.store'
import { AgentStatus } from '@shared/types/agent.types'
import type { AgentInfo } from '@shared/types/agent.types'

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    id: 'agent-1',
    task: 'Fix the bug',
    status: AgentStatus.ACTIVE,
    contextFiles: [],
    startedAt: Date.now(),
    ...overrides
  }
}

describe('useAgentsStore', () => {
  beforeEach(() => {
    useAgentsStore.setState({
      agents: new Map(),
      blockingContexts: new Map(),
      stallThresholdMs: 30_000,
      _tick: 0
    })
  })

  it('setAgents populates the Map', () => {
    const agents = [makeAgent({ id: 'a1' }), makeAgent({ id: 'a2' })]
    useAgentsStore.getState().setAgents(agents)

    const state = useAgentsStore.getState()
    expect(state.agents.size).toBe(2)
    expect(state.agents.get('a1')).toBeTruthy()
    expect(state.agents.get('a2')).toBeTruthy()
  })

  it('addAgent adds a new agent', () => {
    useAgentsStore.getState().addAgent(makeAgent({ id: 'new-agent' }))

    expect(useAgentsStore.getState().agents.size).toBe(1)
    expect(useAgentsStore.getState().agents.get('new-agent')?.task).toBe('Fix the bug')
  })

  it('updateStatus changes agent status', () => {
    useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
    useAgentsStore.getState().updateStatus('a1', AgentStatus.STOPPED)

    const agent = useAgentsStore.getState().agents.get('a1')
    expect(agent?.status).toBe(AgentStatus.STOPPED)
    expect(agent?.stoppedAt).toBeGreaterThan(0)
  })

  it('updateStatus sets lastError', () => {
    useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
    useAgentsStore.getState().updateStatus('a1', AgentStatus.CRASHED, { lastError: 'OOM killed' })

    const agent = useAgentsStore.getState().agents.get('a1')
    expect(agent?.status).toBe(AgentStatus.CRASHED)
    expect(agent?.lastError).toBe('OOM killed')
  })

  it('updateStatus sets stoppedAt for terminal states', () => {
    useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
    useAgentsStore.getState().updateStatus('a1', AgentStatus.CRASHED)

    expect(useAgentsStore.getState().agents.get('a1')?.stoppedAt).toBeGreaterThan(0)
  })

  it('updateStatus does not set stoppedAt for non-terminal states', () => {
    useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
    useAgentsStore.getState().updateStatus('a1', AgentStatus.ACTIVE)

    expect(useAgentsStore.getState().agents.get('a1')?.stoppedAt).toBeUndefined()
  })

  it('updateLastOutput updates timestamp', () => {
    useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
    useAgentsStore.getState().updateLastOutput('a1', 999999)

    expect(useAgentsStore.getState().agents.get('a1')?.lastOutputAt).toBe(999999)
  })

  it('removeAgent removes from Map', () => {
    useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
    useAgentsStore.getState().removeAgent('a1')

    expect(useAgentsStore.getState().agents.size).toBe(0)
  })

  describe('getHealthColor', () => {
    it('returns green for ACTIVE with recent output', () => {
      useAgentsStore
        .getState()
        .addAgent(makeAgent({ id: 'a1', status: AgentStatus.ACTIVE, lastOutputAt: Date.now() }))

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('green')
    })

    it('returns green for ACTIVE with no lastOutputAt', () => {
      useAgentsStore
        .getState()
        .addAgent(makeAgent({ id: 'a1', status: AgentStatus.ACTIVE }))

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('green')
    })

    it('returns orange for ACTIVE with stale output', () => {
      useAgentsStore.getState().addAgent(
        makeAgent({
          id: 'a1',
          status: AgentStatus.ACTIVE,
          lastOutputAt: Date.now() - 60_000
        })
      )

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('orange')
    })

    it('returns orange for LAUNCHING', () => {
      useAgentsStore
        .getState()
        .addAgent(makeAgent({ id: 'a1', status: AgentStatus.LAUNCHING }))

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('orange')
    })

    it('returns orange for STOPPING', () => {
      useAgentsStore
        .getState()
        .addAgent(makeAgent({ id: 'a1', status: AgentStatus.STOPPING }))

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('orange')
    })

    it('returns red for CRASHED', () => {
      useAgentsStore
        .getState()
        .addAgent(makeAgent({ id: 'a1', status: AgentStatus.CRASHED }))

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('red')
    })

    it('returns red for BLOCKED', () => {
      useAgentsStore
        .getState()
        .addAgent(makeAgent({ id: 'a1', status: AgentStatus.BLOCKED }))

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('red')
    })

    it('returns gray for STOPPED', () => {
      useAgentsStore
        .getState()
        .addAgent(makeAgent({ id: 'a1', status: AgentStatus.STOPPED }))

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('gray')
    })

    it('returns gray for unknown agentId', () => {
      expect(useAgentsStore.getState().getHealthColor('nonexistent')).toBe('gray')
    })

    it('respects custom stall threshold', () => {
      useAgentsStore.getState().setStallThreshold(5_000)
      useAgentsStore.getState().addAgent(
        makeAgent({
          id: 'a1',
          status: AgentStatus.ACTIVE,
          lastOutputAt: Date.now() - 6_000
        })
      )

      expect(useAgentsStore.getState().getHealthColor('a1')).toBe('orange')
    })
  })

  describe('progress and blocking', () => {
    it('updateStatus stores progress info', () => {
      useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
      useAgentsStore.getState().updateStatus('a1', AgentStatus.ACTIVE, {
        progress: { completed: 3, total: 10 }
      })

      const agent = useAgentsStore.getState().agents.get('a1')
      expect(agent?.progress).toEqual({ completed: 3, total: 10 })
    })

    it('updateStatus stores blocking context', () => {
      useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
      useAgentsStore.getState().updateStatus('a1', AgentStatus.BLOCKED, {
        blockingContext: {
          lastMessage: 'rate limit',
          timestamp: Date.now(),
          reason: 'error-pattern'
        }
      })

      const ctx = useAgentsStore.getState().blockingContexts.get('a1')
      expect(ctx).toBeTruthy()
      expect(ctx!.reason).toBe('error-pattern')
    })

    it('clears blocking context when status is not BLOCKED', () => {
      useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
      useAgentsStore.getState().updateStatus('a1', AgentStatus.BLOCKED, {
        blockingContext: {
          lastMessage: 'timeout',
          timestamp: Date.now(),
          reason: 'timeout'
        }
      })
      expect(useAgentsStore.getState().blockingContexts.has('a1')).toBe(true)

      useAgentsStore.getState().updateStatus('a1', AgentStatus.ACTIVE)
      expect(useAgentsStore.getState().blockingContexts.has('a1')).toBe(false)
    })

    it('getBlockedAgents returns only blocked agents', () => {
      useAgentsStore.getState().addAgent(makeAgent({ id: 'a1', status: AgentStatus.ACTIVE }))
      useAgentsStore.getState().addAgent(makeAgent({ id: 'a2', status: AgentStatus.BLOCKED }))
      useAgentsStore.getState().addAgent(makeAgent({ id: 'a3', status: AgentStatus.STOPPED }))

      const blocked = useAgentsStore.getState().getBlockedAgents()
      expect(blocked).toHaveLength(1)
      expect(blocked[0].id).toBe('a2')
    })

    it('removeAgent also removes blocking context', () => {
      useAgentsStore.getState().addAgent(makeAgent({ id: 'a1' }))
      useAgentsStore.getState().updateStatus('a1', AgentStatus.BLOCKED, {
        blockingContext: {
          lastMessage: 'error',
          timestamp: Date.now(),
          reason: 'stderr-error'
        }
      })
      useAgentsStore.getState().removeAgent('a1')

      expect(useAgentsStore.getState().blockingContexts.has('a1')).toBe(false)
    })
  })
})
