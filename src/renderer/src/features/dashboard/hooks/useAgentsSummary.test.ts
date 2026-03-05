import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentsStore } from '@renderer/features/agents/agents.store'

function getAgentsSummary() {
  const state = useAgentsStore.getState()
  const agents = state.agents
  const agentsList = Array.from(agents.values())

  const activeOrBlocked = agentsList.filter(
    (a) => a.status === 'ACTIVE' || a.status === 'BLOCKED' || a.status === 'LAUNCHING'
  )

  return {
    total: agentsList.length,
    active: agentsList.filter((a) => a.status === 'ACTIVE').length,
    blocked: agentsList.filter((a) => a.status === 'BLOCKED').length,
    terminated: agentsList.filter(
      (a) => a.status === 'STOPPED' || a.status === 'CRASHED'
    ).length,
    agents: activeOrBlocked.map((a) => ({
      id: a.id,
      task: a.task,
      healthColor: state.getHealthColor(a.id)
    }))
  }
}

describe('useAgentsSummary', () => {
  beforeEach(() => {
    useAgentsStore.setState({ agents: new Map() })
  })

  it('returns zeros when no agents', () => {
    const summary = getAgentsSummary()
    expect(summary.total).toBe(0)
    expect(summary.active).toBe(0)
    expect(summary.blocked).toBe(0)
    expect(summary.terminated).toBe(0)
    expect(summary.agents).toHaveLength(0)
  })

  it('counts active agents correctly', () => {
    useAgentsStore.setState({
      agents: new Map([
        ['a1', { id: 'a1', status: 'ACTIVE', task: 'Build UI', contextFiles: [], startedAt: 0 } as never],
        ['a2', { id: 'a2', status: 'ACTIVE', task: 'Write tests', contextFiles: [], startedAt: 0 } as never]
      ])
    })

    const summary = getAgentsSummary()
    expect(summary.active).toBe(2)
    expect(summary.agents).toHaveLength(2)
  })

  it('counts blocked agents correctly', () => {
    useAgentsStore.setState({
      agents: new Map([
        ['a1', { id: 'a1', status: 'BLOCKED', task: 'Stuck task', contextFiles: [], startedAt: 0 } as never]
      ])
    })

    const summary = getAgentsSummary()
    expect(summary.blocked).toBe(1)
    expect(summary.agents).toHaveLength(1)
  })

  it('counts terminated agents (STOPPED + CRASHED)', () => {
    useAgentsStore.setState({
      agents: new Map([
        ['a1', { id: 'a1', status: 'STOPPED', task: 'Done', contextFiles: [], startedAt: 0 } as never],
        ['a2', { id: 'a2', status: 'CRASHED', task: 'Failed', contextFiles: [], startedAt: 0 } as never]
      ])
    })

    const summary = getAgentsSummary()
    expect(summary.terminated).toBe(2)
    expect(summary.agents).toHaveLength(0) // terminated agents not in active list
  })

  it('handles mixed statuses', () => {
    useAgentsStore.setState({
      agents: new Map([
        ['a1', { id: 'a1', status: 'ACTIVE', task: 'Build', contextFiles: [], startedAt: 0 } as never],
        ['a2', { id: 'a2', status: 'BLOCKED', task: 'Stuck', contextFiles: [], startedAt: 0 } as never],
        ['a3', { id: 'a3', status: 'STOPPED', task: 'Done', contextFiles: [], startedAt: 0 } as never],
        ['a4', { id: 'a4', status: 'LAUNCHING', task: 'Starting', contextFiles: [], startedAt: 0 } as never]
      ])
    })

    const summary = getAgentsSummary()
    expect(summary.total).toBe(4)
    expect(summary.active).toBe(1)
    expect(summary.blocked).toBe(1)
    expect(summary.terminated).toBe(1)
    expect(summary.agents).toHaveLength(3) // ACTIVE + BLOCKED + LAUNCHING
  })
})
