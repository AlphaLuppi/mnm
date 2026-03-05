import type { DriftSeverity } from '@shared/types/drift.types'
import { DriftSeverityBadge } from './DriftSeverityBadge'
import { ConfidenceScore } from './ConfidenceScore'

type DriftAlertCardProps = {
  id: string
  severity: DriftSeverity
  summary: string
  documents: [string, string]
  confidence: number
  isNew: boolean
  onView: (id: string) => void
  onFix: (id: string) => void
  onIgnore: (id: string) => void
}

const borderColors: Record<DriftSeverity, string> = {
  critical: 'border-l-red-500',
  warning: 'border-l-amber-500',
  info: 'border-l-[var(--color-border)]'
}

export function DriftAlertCard({
  id,
  severity,
  summary,
  documents,
  confidence,
  isNew,
  onView,
  onFix,
  onIgnore
}: DriftAlertCardProps) {
  const fileName = (path: string) => path.split('/').pop() ?? path

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-lg border border-[var(--color-border)] border-l-4 ${borderColors[severity]} p-3 space-y-2 drift-alert-enter ${
        isNew ? 'bg-[var(--color-bg-hover)]' : 'bg-[var(--color-surface)]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DriftSeverityBadge severity={severity} />
          {isNew && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
              Nouveau
            </span>
          )}
        </div>
        <ConfidenceScore value={confidence} />
      </div>

      <div className="text-xs font-medium text-[var(--color-text-primary)]">
        {fileName(documents[0])} ↔ {fileName(documents[1])}
      </div>

      <p className="text-xs text-[var(--color-text-secondary)]">{summary}</p>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onView(id)}
          className="px-2 py-1 text-[10px] rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
        >
          Voir
        </button>
        <button
          onClick={() => onFix(id)}
          className="px-2 py-1 text-[10px] rounded bg-[var(--color-accent)] text-white hover:opacity-90"
        >
          Corriger
        </button>
        <button
          onClick={() => onIgnore(id)}
          className="px-2 py-1 text-[10px] rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
        >
          Ignorer
        </button>
      </div>
    </div>
  )
}
