import { Handle, Position } from '@xyflow/react'

type CheckNodeData = {
  label: string
  conditions?: string
}

export function BmadCheckNode({ data, selected }: { data: CheckNodeData; selected?: boolean }) {
  return (
    <div
      className={`w-[100px] h-[100px] rotate-45 flex items-center justify-center border bg-[var(--color-surface)] border-[var(--color-border)] ${selected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30' : ''} transition-colors duration-200`}
      role="button"
      tabIndex={0}
      aria-label={`Decision: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--color-accent)]" />
      <div className="-rotate-45 text-center px-1">
        <span className="text-xs text-amber-400">CHECK</span>
        <div className="text-[10px] text-[var(--color-text-primary)] font-medium leading-tight mt-0.5">
          {data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--color-accent)]" />
    </div>
  )
}
