import { Handle, Position } from '@xyflow/react'

type ActionNodeData = {
  label: string
  instructions?: string
}

export function BmadActionNode({ data, selected }: { data: ActionNodeData; selected?: boolean }) {
  return (
    <div
      className={`rounded-md border-2 border-dashed px-4 py-3 min-w-[200px] bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] ${selected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30' : ''} transition-colors duration-200`}
      role="button"
      tabIndex={0}
      aria-label={`Action: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--color-accent)]" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-green-400">ACTION</span>
      </div>
      <div className="text-sm font-medium mt-1">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--color-accent)]" />
    </div>
  )
}
