import { useMemo } from 'react'
import { useAgentsStore } from '@renderer/features/agents/agents.store'
import { AgentStatus } from '@shared/types/agent.types'
import type { AgentsSummary } from '../dashboard.types'

export function useAgentsSummary(): AgentsSummary {
  const agents = useAgentsStore((s) => s.agents)
  const getHealthColor = useAgentsStore((s) => s.getHealthColor)

  return useMemo(() => {
    const agentsList = Array.from(agents.values())

    const activeOrBlocked = agentsList.filter(
      (a) => a.status === AgentStatus.ACTIVE || a.status === AgentStatus.BLOCKED || a.status === AgentStatus.LAUNCHING
    )

    const items = activeOrBlocked.map((agent) => ({
      id: agent.id,
      task: agent.task,
      healthColor: getHealthColor(agent.id)
    }))

    return {
      total: agentsList.length,
      active: agentsList.filter((a) => a.status === AgentStatus.ACTIVE).length,
      blocked: agentsList.filter((a) => a.status === AgentStatus.BLOCKED).length,
      terminated: agentsList.filter(
        (a) => a.status === AgentStatus.STOPPED || a.status === AgentStatus.CRASHED
      ).length,
      agents: items
    }
  }, [agents, getHealthColor])
}
