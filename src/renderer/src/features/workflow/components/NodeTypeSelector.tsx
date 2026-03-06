import type { WorkflowNodeType } from '@shared/types/workflow.types'

type NodeTypeSelectorProps = {
  onSelect: (type: WorkflowNodeType) => void
  onCancel: () => void
}

const nodeTypeOptions: { type: WorkflowNodeType; label: string; description: string }[] = [
  { type: 'step', label: 'Etape', description: 'Une etape du workflow' },
  { type: 'check', label: 'Verification', description: 'Un point de decision' },
  { type: 'action', label: 'Action', description: 'Une action a executer' }
]

export function NodeTypeSelector({ onSelect, onCancel }: NodeTypeSelectorProps) {
  return (
    <div
      className="absolute z-50 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-xl"
      role="listbox"
      aria-label="Type de noeud"
    >
      {nodeTypeOptions.map((opt) => (
        <button
          key={opt.type}
          onClick={() => onSelect(opt.type)}
          role="option"
          aria-selected={false}
          className="flex w-full flex-col px-3 py-2 text-left hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{opt.label}</span>
          <span className="text-xs text-[var(--color-text-secondary)]">{opt.description}</span>
        </button>
      ))}
      <div className="border-t border-[var(--color-border)] mt-1 pt-1">
        <button
          onClick={onCancel}
          className="w-full px-3 py-1.5 text-left text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] transition-colors"
        >
          Annuler
        </button>
      </div>
    </div>
  )
}
