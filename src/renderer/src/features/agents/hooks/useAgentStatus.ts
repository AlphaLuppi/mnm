import { useAgentsStore } from '../agents.store'
import type { AgentInfo } from '@shared/types/agent.types'
import type { HealthColor } from '../agents.store'

type AgentStatusResult = {
  agent: AgentInfo | undefined
  healthColor: HealthColor
}

export function useAgentStatus(agentId: string): AgentStatusResult {
  const agent = useAgentsStore((state) => state.agents.get(agentId))
  const healthColor = useAgentsStore((state) => state.getHealthColor(agentId))

  return { agent, healthColor }
}
