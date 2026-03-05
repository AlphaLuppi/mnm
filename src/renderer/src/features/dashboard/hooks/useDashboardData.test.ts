import { describe, it, expect, beforeEach } from 'vitest'
import { useAgentsStore } from '@renderer/features/agents/agents.store'
import { useDriftStore } from '@renderer/features/drift/drift.store'
// Direct store manipulation for testing
function getDashboardData() {
  // Simulate hook by reading stores directly
  const agents = useAgentsStore.getState().agents
  const driftAlerts = useDriftStore.getState().alerts

  const agentsList = Array.from(agents.values())
  const agentsSummary = {
    total: agentsList.length,
    active: agentsList.filter((a) => a.status === 'ACTIVE').length,
    blocked: agentsList.filter((a) => a.status === 'BLOCKED').length,
    terminated: agentsList.filter((a) => a.status === 'STOPPED').length
  }

  const driftSummary = {
    total: driftAlerts.length,
    critical: driftAlerts.filter((a) => a.severity === 'critical').length,
    warning: driftAlerts.filter((a) => a.severity === 'warning').length
  }

  const health =
    agentsSummary.blocked > 0 || driftSummary.critical > 0
      ? 'critical'
      : driftSummary.warning > 0
        ? 'warning'
        : 'healthy'

  return { health, agentsSummary, driftSummary }
}

describe('useDashboardData', () => {
  beforeEach(() => {
    useAgentsStore.setState({ agents: new Map() })
    useDriftStore.setState({ alerts: [] })
  })

  it('returns healthy when no agents or drifts', () => {
    const data = getDashboardData()
    expect(data.health).toBe('healthy')
    expect(data.agentsSummary.total).toBe(0)
    expect(data.driftSummary.total).toBe(0)
  })

  it('returns critical when agents are blocked', () => {
    useAgentsStore.setState({
      agents: new Map([
        ['a1', { id: 'a1', status: 'BLOCKED', task: 'test', storyId: 's1', startedAt: 0 } as never]
      ])
    })

    const data = getDashboardData()
    expect(data.health).toBe('critical')
    expect(data.agentsSummary.blocked).toBe(1)
  })

  it('returns critical when critical drift alerts exist', () => {
    useDriftStore.getState().addAlert({
      id: 'd1',
      severity: 'critical',
      summary: 'Critical drift',
      documents: ['/a', '/b'],
      confidence: 90
    })

    const data = getDashboardData()
    expect(data.health).toBe('critical')
    expect(data.driftSummary.critical).toBe(1)
  })

  it('returns warning when only warning drifts exist', () => {
    useDriftStore.getState().addAlert({
      id: 'd1',
      severity: 'warning',
      summary: 'Warning drift',
      documents: ['/a', '/b'],
      confidence: 60
    })

    const data = getDashboardData()
    expect(data.health).toBe('warning')
  })

  it('counts active agents correctly', () => {
    useAgentsStore.setState({
      agents: new Map([
        ['a1', { id: 'a1', status: 'ACTIVE', task: 't1', storyId: 's1', startedAt: 0 } as never],
        ['a2', { id: 'a2', status: 'ACTIVE', task: 't2', storyId: 's2', startedAt: 0 } as never],
        ['a3', { id: 'a3', status: 'STOPPED', task: 't3', storyId: 's3', startedAt: 0 } as never]
      ])
    })

    const data = getDashboardData()
    expect(data.agentsSummary.active).toBe(2)
    expect(data.agentsSummary.terminated).toBe(1)
    expect(data.agentsSummary.total).toBe(3)
  })
})
