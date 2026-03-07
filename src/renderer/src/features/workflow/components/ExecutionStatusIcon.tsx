import type { WorkflowNodeStatus } from '@shared/types/workflow.types'

type ExecutionStatusIconProps = {
  status: WorkflowNodeStatus
}

export function ExecutionStatusIcon({ status }: ExecutionStatusIconProps) {
  switch (status) {
    case 'active':
      return (
        <span
          className="inline-block w-3 h-3 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin motion-reduce:animate-none motion-reduce:border-t-[var(--color-accent)]"
          aria-label="En cours"
        />
      )
    case 'done':
      return (
        <span className="text-green-400 text-xs" aria-label="Termine">
          ✓
        </span>
      )
    case 'error':
      return (
        <span className="text-red-400 text-xs" aria-label="Erreur">
          ✕
        </span>
      )
    default:
      return null
  }
}
