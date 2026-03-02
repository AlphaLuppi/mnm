import type { BlockingContext } from '@shared/types/agent.types'

type BlockedBadgeProps = {
  context: BlockingContext
  className?: string
}

const REASON_LABELS: Record<BlockingContext['reason'], string> = {
  timeout: 'Timeout',
  'error-pattern': 'Erreur',
  'stderr-error': 'Erreur stderr'
}

export function BlockedBadge({ context, className = '' }: BlockedBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md bg-status-red/15 px-2 py-0.5 ${className}`}
      title={context.lastMessage || context.stderrSnippet}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-status-red animate-pulse-alert" />
      <span className="font-mono text-xs text-status-red">
        {REASON_LABELS[context.reason]}
      </span>
    </div>
  )
}

export type { BlockedBadgeProps }
