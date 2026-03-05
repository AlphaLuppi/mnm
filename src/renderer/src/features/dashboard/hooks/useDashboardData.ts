import { useMemo } from 'react'
import { useAgentsStore } from '@renderer/features/agents/agents.store'
import { useDriftStore } from '@renderer/features/drift/drift.store'
import type { DashboardData, ProjectHealth } from '../dashboard.types'

function computeHealth(
  agents: DashboardData['agentsSummary'],
  drifts: DashboardData['driftSummary']
): ProjectHealth {
  if (agents.blocked > 0 || drifts.critical > 0) return 'critical'
  if (drifts.warning > 0) return 'warning'
  return 'healthy'
}

export function useDashboardData(): DashboardData {
  const agents = useAgentsStore((s) => s.agents)
  const driftAlerts = useDriftStore((s) => s.alerts)

  return useMemo(() => {
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

    const storiesSummary = { total: 0, completed: 0, inProgress: 0, ratio: 0 }

    return {
      health: computeHealth(agentsSummary, driftSummary),
      agentsSummary,
      driftSummary,
      storiesSummary
    }
  }, [agents, driftAlerts])
}
