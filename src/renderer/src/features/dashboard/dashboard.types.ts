export type ProjectHealth = 'healthy' | 'warning' | 'critical'

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
