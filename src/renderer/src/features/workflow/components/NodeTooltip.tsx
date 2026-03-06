type NodeTooltipProps = {
  label: string
  instructions?: string
  sourceFile?: string
  sourceLine?: number
  role?: string
  visible: boolean
}

export function NodeTooltip({ label, instructions, sourceFile, sourceLine, role, visible }: NodeTooltipProps) {
  if (!visible) return null

  return (
    <div
      className="absolute z-50 max-w-xs p-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-active)] text-[var(--color-text-primary)] shadow-lg"
      role="tooltip"
    >
      <div className="text-sm font-medium mb-1">{label}</div>
      {role && (
        <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Role: {role}</div>
      )}
      {instructions && (
        <div className="text-xs text-[var(--color-text-secondary)] mb-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
          {instructions}
        </div>
      )}
      {sourceFile && (
        <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
          {sourceFile}{sourceLine != null ? `:${sourceLine}` : ''}
        </div>
      )}
    </div>
  )
}
