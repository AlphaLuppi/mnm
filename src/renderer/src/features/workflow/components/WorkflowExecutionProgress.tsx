import type { WorkflowExecutionState } from '@shared/types/workflow.types'

type WorkflowExecutionProgressProps = {
  executionState: WorkflowExecutionState
  isCompleted: boolean
  hasError: boolean
}

export function WorkflowExecutionProgress({
  executionState,
  isCompleted,
  hasError
}: WorkflowExecutionProgressProps) {
  const statuses = Object.values(executionState.nodeStatuses)
  const total = statuses.length
  const done = statuses.filter((s) => s === 'done').length
  const ratio = total > 0 ? done / total : 0

  return (
    <div
      className="flex items-center gap-3 px-3 py-2"
      role="progressbar"
      aria-valuenow={done}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Progression du workflow: ${done} sur ${total} etapes completees`}
    >
      <div className="flex-1 h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${
            hasError
              ? 'bg-red-500'
              : isCompleted
                ? 'bg-green-500'
                : 'bg-[var(--color-accent)]'
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {done}/{total} etapes
      </span>
      {isCompleted && (
        <span className="text-xs text-green-400 font-medium">Termine</span>
      )}
      {hasError && (
        <span className="text-xs text-red-400 font-medium">Erreur</span>
      )}
    </div>
  )
}
