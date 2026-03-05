import type { HealthColor } from '@renderer/features/agents/agents.store'
import type { DriftSeverity } from '@shared/types/drift.types'

export type ProjectHealth = 'healthy' | 'warning' | 'critical'

export type AgentSummaryItem = {
  id: string
  task: string
  healthColor: HealthColor
}

export type AgentsSummary = {
  total: number
  active: number
  blocked: number
  terminated: number
  agents: AgentSummaryItem[]
}

export type DriftSummaryItem = {
  id: string
  documentA: string
  documentB: string
  confidence: number
  severity: DriftSeverity
  summary: string
}

export type DriftsSummary = {
  total: number
  critical: number
  warning: number
  alerts: DriftSummaryItem[]
}

export type DashboardData = {
  health: ProjectHealth
  agentsSummary: {
    total: number
    active: number
    blocked: number
    terminated: number
  }
  driftSummary: {
    total: number
    critical: number
    warning: number
  }
  storiesSummary: {
    total: number
    completed: number
    inProgress: number
    ratio: number
  }
}
