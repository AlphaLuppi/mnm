import { WidgetCard } from './WidgetCard'
import { AnimatedCounter } from './AnimatedCounter'
import { useDriftSummary } from '../hooks/useDriftSummary'
import { useCockpitNavigation } from '../hooks/useCockpitNavigation'

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  warning: 'bg-amber-500/20 text-amber-400',
  info: 'bg-[var(--color-border)] text-[var(--color-text-tertiary)]'
}

export function DriftSummaryWidget() {
  const summary = useDriftSummary()
  const { goToDrift } = useCockpitNavigation()

  if (summary.total === 0) {
    return (
      <WidgetCard title="Drift">
        <div role="status" className="flex items-center gap-3 py-6 justify-center">
          <div
            className="h-3 w-3 rounded-full bg-green-500"
            role="img"
            aria-label="Aucun drift"
          />
          <span className="text-sm text-[var(--color-text-muted)]">Aucun drift detecte</span>
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard title="Drift">
      <div className="flex gap-4 mb-3" aria-live="polite">
        <div className="flex items-center gap-1.5" role="status">
          <AnimatedCounter
            value={summary.total}
            className="text-md font-semibold text-[var(--color-text-primary)]"
          />
          <span className="text-xs text-[var(--color-text-tertiary)]">total</span>
        </div>
        {summary.critical > 0 && (
          <div className="flex items-center gap-1.5" role="status">
            <AnimatedCounter value={summary.critical} className="text-md font-semibold text-red-400" />
            <span className="text-xs text-[var(--color-text-tertiary)]">critiques</span>
          </div>
        )}
        {summary.warning > 0 && (
          <div className="flex items-center gap-1.5" role="status">
            <AnimatedCounter value={summary.warning} className="text-md font-semibold text-amber-400" />
            <span className="text-xs text-[var(--color-text-tertiary)]">warnings</span>
          </div>
        )}
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto" role="list">
        {summary.alerts.map((alert) => (
          <button
            key={alert.id}
            onClick={() => goToDrift(alert.id)}
            className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--color-bg-elevated)] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            role="listitem"
            aria-label={`Voir le drift: ${alert.documentA} vs ${alert.documentB}, confiance ${alert.confidence}%`}
          >
            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${SEVERITY_STYLES[alert.severity] ?? ''}`}>
              {alert.severity}
            </span>
            <span className="text-sm text-[var(--color-text-primary)] truncate">
              {alert.documentA} / {alert.documentB}
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)] ml-auto font-mono shrink-0">
              {alert.confidence}%
            </span>
          </button>
        ))}
      </div>
    </WidgetCard>
  )
}
