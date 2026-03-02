import { create } from 'zustand'
import type { AgentInfo, BlockingContext } from '@shared/types/agent.types'
import { AgentStatus } from '@shared/types/agent.types'

export type HealthColor = 'green' | 'orange' | 'red' | 'gray'

type StatusExtra = {
  lastError?: string
  progress?: { completed: number; total: number }
  blockingContext?: BlockingContext
}

type AgentsState = {
  agents: Map<string, AgentInfo>
  blockingContexts: Map<string, BlockingContext>
  stallThresholdMs: number
  _tick: number

  setAgents: (agents: AgentInfo[]) => void
  addAgent: (agent: AgentInfo) => void
  updateStatus: (agentId: string, status: AgentStatus, extra?: StatusExtra) => void
  updateLastOutput: (agentId: string, timestamp: number) => void
  removeAgent: (agentId: string) => void
  setStallThreshold: (ms: number) => void
  getHealthColor: (agentId: string) => HealthColor
  getBlockedAgents: () => AgentInfo[]
}

const DEFAULT_STALL_THRESHOLD_MS = 30_000

export const useAgentsStore = create<AgentsState>((set, get) => ({
  agents: new Map(),
  blockingContexts: new Map(),
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

  updateStatus: (agentId, status, extra) =>
    set((state) => {
      const nextAgents = new Map(state.agents)
      const agent = nextAgents.get(agentId)
      if (agent) {
        nextAgents.set(agentId, {
          ...agent,
          status,
          lastError: extra?.lastError ?? agent.lastError,
          progress: extra?.progress ?? agent.progress,
          stoppedAt:
            status === AgentStatus.STOPPED || status === AgentStatus.CRASHED
              ? Date.now()
              : agent.stoppedAt
        })
      }

      const nextBlocking = new Map(state.blockingContexts)
      if (extra?.blockingContext) {
        nextBlocking.set(agentId, extra.blockingContext)
      } else if (status !== AgentStatus.BLOCKED) {
        nextBlocking.delete(agentId)
      }

      return { agents: nextAgents, blockingContexts: nextBlocking }
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
      const nextBlocking = new Map(state.blockingContexts)
      nextBlocking.delete(agentId)
      return { agents: next, blockingContexts: nextBlocking }
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
  },

  getBlockedAgents: () => {
    const state = get()
    return Array.from(state.agents.values()).filter((a) => a.status === AgentStatus.BLOCKED)
  }
}))
