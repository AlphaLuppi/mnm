import { useAgentsStore } from '../agents.store'
import { HealthIndicator } from './HealthIndicator'
import { AgentProgressBar } from './AgentProgressBar'
import { BlockedBadge } from './BlockedBadge'

type AgentCardProps = {
  agentId: string
  isSelected?: boolean
  onSelect?: (agentId: string) => void
  onDoubleClick?: (agentId: string) => void
}

export function AgentCard({ agentId, isSelected, onSelect, onDoubleClick }: AgentCardProps) {
  const agent = useAgentsStore((state) => state.agents.get(agentId))
  const healthColor = useAgentsStore((state) => state.getHealthColor(agentId))
  const blockingContext = useAgentsStore((state) => state.blockingContexts.get(agentId))

  if (!agent) return null

  const handleClick = () => onSelect?.(agentId)
  const handleDoubleClick = () => onDoubleClick?.(agentId)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onSelect?.(agentId)
    if (e.key === ' ') {
      e.preventDefault()
      onSelect?.(agentId)
    }
  }

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors duration-200 cursor-pointer bg-bg-surface hover:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-accent ${isSelected ? 'border-accent' : 'border-border-default'}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      aria-selected={isSelected}
    >
      <HealthIndicator color={healthColor} size={12} className="mt-1 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-md font-medium text-text-primary">
            Agent {agent.id.slice(0, 8)}
          </span>
          <span className="shrink-0 font-mono text-xs text-text-muted">
            {formatRelativeTime(agent.lastOutputAt ?? agent.startedAt)}
          </span>
        </div>

        <p className="mt-0.5 line-clamp-2 text-sm text-text-secondary">{agent.task}</p>

        {agent.progress && (
          <AgentProgressBar
            completed={agent.progress.completed}
            total={agent.progress.total}
            className="mt-1.5"
          />
        )}

        {blockingContext && <BlockedBadge context={blockingContext} className="mt-1.5" />}

        {agent.lastError && !blockingContext && (
          <p className="mt-1 line-clamp-1 font-mono text-xs text-status-red">
            {agent.lastError}
          </p>
        )}
      </div>
    </div>
  )
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

export type { AgentCardProps }
