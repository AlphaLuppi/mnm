import { Handle, Position } from '@xyflow/react'

type StepNodeData = {
  label: string
  role?: string
}

export function BmadStepNode({ data, selected }: { data: StepNodeData; selected?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 min-w-[200px] bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] ${selected ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30' : ''} transition-colors duration-200`}
      role="button"
      tabIndex={0}
      aria-label={`Etape: ${data.label}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--color-accent)]" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-accent)]">STEP</span>
        {data.role && (
          <span className="text-xs bg-[var(--color-bg-elevated)] px-1.5 py-0.5 rounded text-[var(--color-text-tertiary)]">
            {data.role}
          </span>
        )}
      </div>
      <div className="text-sm font-medium mt-1">{data.label}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--color-accent)]" />
    </div>
  )
}
