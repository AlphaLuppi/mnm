import { Handle, Position } from '@xyflow/react'
import type { WorkflowNodeStatus } from '@shared/types/workflow.types'
import { ExecutionStatusIcon } from './ExecutionStatusIcon'

type CheckNodeData = {
  label: string
  conditions?: string
  executionStatus?: WorkflowNodeStatus
  executionError?: string
}

const statusStyles: Record<WorkflowNodeStatus, string> = {
  pending: 'opacity-60',
  active: 'border-[var(--color-accent)] shadow-[0_0_8px_2px_rgba(59,130,246,0.3)] motion-reduce:shadow-none',
  done: 'border-green-500',
  error: 'border-red-500'
}

export function BmadCheckNode({ data, selected }: { data: CheckNodeData; selected?: boolean }) {
  const execClass = data.executionStatus ? statusStyles[data.executionStatus] : ''

  return (
    <div
      className={`w-[100px] h-[100px] rotate-45 flex items-center justify-center border bg-[var(--color-surface)] border-[var(--color-border)] ${selected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30' : ''} ${execClass} transition-all duration-200`}
      role="button"
      tabIndex={0}
      aria-label={`Decision: ${data.label}${data.executionStatus ? ` — ${data.executionStatus}` : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--color-accent)]" />
      <div className="-rotate-45 text-center px-1">
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-amber-400">CHECK</span>
          {data.executionStatus && data.executionStatus !== 'pending' && (
            <ExecutionStatusIcon status={data.executionStatus} />
          )}
        </div>
        <div className="text-[10px] text-[var(--color-text-primary)] font-medium leading-tight mt-0.5">
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--color-accent)]" />
    </div>
  )
}
