import { Handle, Position } from '@xyflow/react'
import type { WorkflowNodeStatus } from '@shared/types/workflow.types'
import { ExecutionStatusIcon } from './ExecutionStatusIcon'

type ActionNodeData = {
  label: string
  instructions?: string
  executionStatus?: WorkflowNodeStatus
  executionError?: string
}

const statusStyles: Record<WorkflowNodeStatus, string> = {
  pending: 'opacity-60',
  active: 'border-[var(--color-accent)] shadow-[0_0_8px_2px_rgba(59,130,246,0.3)] motion-reduce:shadow-none',
  done: 'border-green-500',
  error: 'border-red-500'
}

export function BmadActionNode({ data, selected }: { data: ActionNodeData; selected?: boolean }) {
  const execClass = data.executionStatus ? statusStyles[data.executionStatus] : ''

  return (
    <div
      className={`rounded-md border-2 border-dashed px-4 py-3 min-w-[200px] bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] ${selected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30' : ''} ${execClass} transition-all duration-200`}
      role="button"
      tabIndex={0}
      aria-label={`Action: ${data.label}${data.executionStatus ? ` — ${data.executionStatus}` : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--color-accent)]" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-green-400">ACTION</span>
        {data.executionStatus && data.executionStatus !== 'pending' && (
          <ExecutionStatusIcon status={data.executionStatus} />
        )}
      </div>
      <div className="text-sm font-medium mt-1">{data.label}</div>
      {data.executionStatus === 'error' && data.executionError && (
        <div className="text-xs text-red-400 mt-1 truncate" title={data.executionError}>
          {data.executionError}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--color-accent)]" />
    </div>
  )
}
