import type { ProjectHealth, DashboardData } from '../dashboard.types'

type ProjectHealthSummaryProps = {
  health: ProjectHealth
  agents: DashboardData['agentsSummary']
  drifts: DashboardData['driftSummary']
  stories: DashboardData['storiesSummary']
}

const HEALTH_COLORS: Record<ProjectHealth, string> = {
  healthy: 'bg-green-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500'
}

const HEALTH_LABELS: Record<ProjectHealth, string> = {
  healthy: 'Projet sain',
  warning: 'Attention requise',
  critical: 'Action urgente'
}

export function ProjectHealthSummary({
  health,
  agents,
  drifts,
  stories
}: ProjectHealthSummaryProps) {
  return (
    <div className="flex items-center gap-6 rounded-lg bg-[var(--color-surface)] p-4 border border-[var(--color-border)]">
      <div className="flex items-center gap-3">
        <div
          className={`h-4 w-4 rounded-full ${HEALTH_COLORS[health]}`}
          role="img"
          aria-label={HEALTH_LABELS[health]}
        />
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {HEALTH_LABELS[health]}
        </span>
      </div>

      <div className="flex gap-6 ml-auto" aria-live="polite">
        <SummaryBadge label="Agents actifs" value={agents.active} />
        <SummaryBadge
          label="Bloques"
          value={agents.blocked}
          critical={agents.blocked > 0}
        />
        <SummaryBadge
          label="Alertes drift"
          value={drifts.total}
          critical={drifts.critical > 0}
        />
        <SummaryBadge
          label="Stories"
          value={stories.total > 0 ? `${Math.round(stories.ratio * 100)}%` : '—'}
        />
      </div>
    </div>
  )
}

type SummaryBadgeProps = {
  label: string
  value: number | string
  critical?: boolean
}

function SummaryBadge({ label, value, critical = false }: SummaryBadgeProps) {
  const textColor =
    critical && value !== 0
      ? 'text-red-400'
      : 'text-[var(--color-text-primary)]'

  return (
    <div className="flex flex-col items-center">
      <span className={`text-lg font-semibold ${textColor}`}>{value}</span>
      <span className="text-[10px] text-[var(--color-text-tertiary)]">{label}</span>
    </div>
  )
}
