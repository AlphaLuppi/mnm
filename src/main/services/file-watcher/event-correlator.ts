import type { FileChangeEvent } from './file-watcher.types'

type AgentActivity = {
  agentId: string
  pid: number
  lastActivityTimestamp: number
  watchedPaths: Set<string>
}

const CORRELATION_WINDOW_MS = 2000

export class EventCorrelator {
  private activeAgents: Map<string, AgentActivity> = new Map()

  registerAgentProcess(agentId: string, pid: number): void {
    this.activeAgents.set(agentId, {
      agentId,
      pid,
      lastActivityTimestamp: Date.now(),
      watchedPaths: new Set()
    })
  }

  unregisterAgentProcess(agentId: string): void {
    this.activeAgents.delete(agentId)
  }

  updateAgentActivity(agentId: string, paths?: string[]): void {
    const agent = this.activeAgents.get(agentId)
    if (agent) {
      agent.lastActivityTimestamp = Date.now()
      if (paths) {
        for (const p of paths) {
          agent.watchedPaths.add(p)
        }
      }
    }
  }

  correlate(event: FileChangeEvent): FileChangeEvent {
    const now = Date.now()

    for (const [, agent] of this.activeAgents) {
      const timeDelta = now - agent.lastActivityTimestamp
      if (timeDelta <= CORRELATION_WINDOW_MS) {
        return { ...event, agentId: agent.agentId }
      }
    }

    return event
  }

  getActiveAgentCount(): number {
    return this.activeAgents.size
  }
}
