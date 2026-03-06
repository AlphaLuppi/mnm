import { useEffect, useMemo } from 'react'
import { useWorkflowStore } from '../workflow.store'
import { WorkflowCanvas } from './WorkflowCanvas'
import { layoutWorkflowGraph } from '../hooks/useWorkflowLayout'

export function WorkflowEditor() {
  const workflows = useWorkflowStore((s) => s.workflows)
  const selectedWorkflowId = useWorkflowStore((s) => s.selectedWorkflowId)
  const selectWorkflow = useWorkflowStore((s) => s.selectWorkflow)
  const selectNode = useWorkflowStore((s) => s.selectNode)
  const loadWorkflows = useWorkflowStore((s) => s.loadWorkflows)

  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  const selectedGraph = useMemo(() => {
    if (workflows.status !== 'success') return null
    return workflows.data.find((w) => w.id === selectedWorkflowId) ?? null
  }, [workflows, selectedWorkflowId])

  const layout = useMemo(() => {
    if (!selectedGraph) return null
    return layoutWorkflowGraph(selectedGraph)
  }, [selectedGraph])

  if (workflows.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <div className="animate-pulse">Chargement des workflows...</div>
      </div>
    )
  }

  if (workflows.status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-sm text-red-400">{workflows.error.message}</div>
        <button
          onClick={() => loadWorkflows()}
          className="text-sm text-[var(--color-accent)] hover:opacity-80"
        >
          Reessayer
        </button>
      </div>
    )
  }

  if (workflows.status !== 'success' || workflows.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-[var(--color-text-muted)]">
        <span className="text-sm">Aucun workflow detecte</span>
        <span className="text-xs">Les workflows sont detectes dans le repertoire _bmad/</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {workflows.data.length > 1 && (
        <div className="flex gap-2 p-2 border-b border-[var(--color-border)]">
          {workflows.data.map((w) => (
            <button
              key={w.id}
              onClick={() => selectWorkflow(w.id)}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                w.id === selectedWorkflowId
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1">
        {layout && (
          <WorkflowCanvas
            nodes={layout.nodes}
            edges={layout.edges}
            onNodeSelect={(id) => selectNode(id)}
          />
        )}
      </div>
    </div>
  )
}
