import { useCallback, useEffect, useState } from 'react'
import type { WorkflowNode, WorkflowNodeType } from '@shared/types/workflow.types'
import { useWorkflowStore } from '../workflow.store'

type NodePropertiesPanelProps = {
  node: WorkflowNode
  onClose: () => void
}

type ValidationErrors = {
  label?: string
  instructions?: string
}

function validate(node: WorkflowNode): ValidationErrors {
  const errors: ValidationErrors = {}
  if (!node.label.trim()) {
    errors.label = 'Le titre est requis'
  } else if (node.label.length > 100) {
    errors.label = 'Maximum 100 caracteres'
  }
  if (node.instructions && node.instructions.length > 2000) {
    errors.instructions = 'Maximum 2000 caracteres'
  }
  return errors
}

export function NodePropertiesPanel({ node, onClose }: NodePropertiesPanelProps) {
  const updateNode = useWorkflowStore((s) => s.updateNode)
  const [errors, setErrors] = useState<ValidationErrors>({})

  const handleChange = useCallback(
    (field: keyof WorkflowNode, value: string) => {
      const updated = { ...node, [field]: value }
      setErrors(validate(updated))
      updateNode(node.id, { [field]: value })
    },
    [node, updateNode]
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <aside
      className="w-80 border-l border-[var(--color-border)] bg-[var(--color-surface)] p-4 overflow-y-auto"
      role="complementary"
      aria-label={`Proprietes du noeud: ${node.label}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-medium text-[var(--color-text-primary)]">Proprietes</h3>
        <button
          onClick={onClose}
          aria-label="Fermer le panneau"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-[var(--color-text-secondary)] block mb-1">Titre</label>
          <input
            type="text"
            value={node.label}
            onChange={(e) => handleChange('label', e.target.value)}
            maxLength={100}
            required
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text-primary)] text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
          />
          {errors.label && (
            <p className="text-xs text-red-400 mt-1">{errors.label}</p>
          )}
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)] block mb-1">Type</label>
          <select
            value={node.type}
            onChange={(e) => handleChange('type', e.target.value as WorkflowNodeType)}
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text-primary)] text-sm"
          >
            <option value="step">Etape</option>
            <option value="check">Verification</option>
            <option value="action">Action</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)] block mb-1">Role</label>
          <input
            type="text"
            value={node.role ?? ''}
            onChange={(e) => handleChange('role', e.target.value)}
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text-primary)] text-sm focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
          />
        </div>

        <div>
          <label className="text-sm text-[var(--color-text-secondary)] block mb-1">
            Instructions
          </label>
          <textarea
            value={node.instructions ?? ''}
            onChange={(e) => handleChange('instructions', e.target.value)}
            maxLength={2000}
            rows={6}
            className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text-primary)] text-sm resize-y focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
          />
          {errors.instructions && (
            <p className="text-xs text-red-400 mt-1">{errors.instructions}</p>
          )}
        </div>

        {node.type === 'check' && (
          <div>
            <label className="text-sm text-[var(--color-text-secondary)] block mb-1">
              Conditions
            </label>
            <textarea
              value={node.conditions ?? ''}
              onChange={(e) => handleChange('conditions', e.target.value)}
              rows={4}
              className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text-primary)] text-sm resize-y focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] outline-none"
            />
          </div>
        )}
      </div>
    </aside>
  )
}
