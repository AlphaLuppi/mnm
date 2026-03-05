import { WidgetCard } from './WidgetCard'
import { AnimatedCounter } from './AnimatedCounter'
import { useAgentsSummary } from '../hooks/useAgentsSummary'
import { useCockpitNavigation } from '../hooks/useCockpitNavigation'
import { HealthIndicator } from '@renderer/features/agents/components/HealthIndicator'

export function AgentsSummaryWidget() {
  const summary = useAgentsSummary()
  const { goToAgent } = useCockpitNavigation()

  if (summary.total === 0) {
    return (
      <WidgetCard title="Agents">
        <div role="status" className="flex flex-col items-center gap-3 py-6 text-[var(--color-text-muted)]">
          <span className="text-sm">Aucun agent actif</span>
          <button className="text-sm text-[var(--color-accent)] hover:opacity-80 transition-colors">
            Lancer un agent
          </button>
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Agents">
      <div className="flex gap-4 mb-3" aria-live="polite">
        <StatusCount label="Actifs" count={summary.active} color="text-green-400" />
        <StatusCount label="Bloques" count={summary.blocked} color="text-red-400" />
        <StatusCount label="Termines" count={summary.terminated} color="text-[var(--color-text-tertiary)]" />
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto" role="list">
        {summary.agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => goToAgent(agent.id)}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--color-bg-elevated)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            role="listitem"
            aria-label={`Naviguer vers l'agent ${agent.id}: ${agent.task}`}
          >
            <HealthIndicator color={agent.healthColor} size={8} />
            <span className="text-sm text-[var(--color-text-primary)] truncate font-medium">
              {agent.id}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] truncate ml-auto">
              {agent.task}
            </span>
          </button>
        ))}
      </div>
    </WidgetCard>
  )
}

type StatusCountProps = {
  label: string
  count: number
  color: string
}

function StatusCount({ label, count, color }: StatusCountProps) {
  return (
    <div className="flex items-center gap-1.5" role="status">
      <AnimatedCounter value={count} className={`text-md font-semibold ${color}`} />
      <span className="text-xs text-[var(--color-text-tertiary)]">{label}</span>
    </div>
  )
}
