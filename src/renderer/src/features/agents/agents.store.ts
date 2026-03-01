import { create } from 'zustand'
import type { AgentInfo } from '@shared/types/agent.types'
import { AgentStatus } from '@shared/types/agent.types'

export type HealthColor = 'green' | 'orange' | 'red' | 'gray'

type AgentsState = {
  agents: Map<string, AgentInfo>
  stallThresholdMs: number
  _tick: number

  setAgents: (agents: AgentInfo[]) => void
  addAgent: (agent: AgentInfo) => void
  updateStatus: (agentId: string, status: AgentStatus, lastError?: string) => void
  updateLastOutput: (agentId: string, timestamp: number) => void
  removeAgent: (agentId: string) => void
  setStallThreshold: (ms: number) => void
  getHealthColor: (agentId: string) => HealthColor
}

const DEFAULT_STALL_THRESHOLD_MS = 30_000

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: new Map(),
  stallThresholdMs: DEFAULT_STALL_THRESHOLD_MS,
  _tick: 0,

  setAgents: (agents) =>
    set(() => {
      const map = new Map<string, AgentInfo>()
      for (const agent of agents) {
        map.set(agent.id, agent)
      }
      return { agents: map }
    }),

  addAgent: (agent) =>
    set((state) => {
      const next = new Map(state.agents)
      next.set(agent.id, agent)
      return { agents: next }
    }),

  updateStatus: (agentId, status, lastError) =>
    set((state) => {
      const next = new Map(state.agents)
      const agent = next.get(agentId)
      if (agent) {
        next.set(agentId, {
          ...agent,
          status,
          lastError: lastError ?? agent.lastError,
          stoppedAt:
            status === AgentStatus.STOPPED || status === AgentStatus.CRASHED
              ? Date.now()
              : agent.stoppedAt
        })
      }
      return { agents: next }
    }),

  updateLastOutput: (agentId, timestamp) =>
    set((state) => {
      const next = new Map(state.agents)
      const agent = next.get(agentId)
      if (agent) {
        next.set(agentId, { ...agent, lastOutputAt: timestamp })
      }
      return { agents: next }
    }),

  removeAgent: (agentId) =>
    set((state) => {
      const next = new Map(state.agents)
      next.delete(agentId)
      return { agents: next }
    }),

  setStallThreshold: (ms) => set({ stallThresholdMs: ms }),

  getHealthColor: (agentId) => {
    const state = get()
    const agent = state.agents.get(agentId)
    if (!agent) return 'gray'

    switch (agent.status) {
      case AgentStatus.CRASHED:
      case AgentStatus.BLOCKED:
        return 'red'
      case AgentStatus.STOPPED:
        return 'gray'
      case AgentStatus.LAUNCHING:
      case AgentStatus.STOPPING:
        return 'orange'
      case AgentStatus.ACTIVE: {
        if (agent.lastOutputAt) {
          const elapsed = Date.now() - agent.lastOutputAt
          if (elapsed > state.stallThresholdMs) {
            return 'orange'
          }
        }
        return 'green'
      }
      default:
        return 'gray'
    }
  }
}))
