import { AgentHarnessService } from './agent-harness.service'
import type { AgentHarnessConfig } from './agent-harness.service'

let instance: AgentHarnessService | null = null

export function initAgentHarness(config: AgentHarnessConfig): AgentHarnessService {
  instance = new AgentHarnessService(config)
  return instance
}

export function getAgentHarness(): AgentHarnessService | null {
  return instance
}
