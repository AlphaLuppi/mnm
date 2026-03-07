import { useCallback, useEffect, useMemo } from 'react'
import { useWorkflowStore } from '../workflow.store'
import { WorkflowCanvas } from './WorkflowCanvas'
import { NodePropertiesPanel } from './NodePropertiesPanel'
import { DeleteNodeDialog } from './DeleteNodeDialog'
import { NodeTypeSelector } from './NodeTypeSelector'
import { layoutWorkflowGraph } from '../hooks/useWorkflowLayout'
import { useNodeInsertion } from '../hooks/useNodeInsertion'
import { useNodeDeletion } from '../hooks/useNodeDeletion'
import { useEdgeManagement } from '../hooks/useEdgeManagement'
import { useWorkflowSave } from '../hooks/useWorkflowSave'
import { useState } from 'react'
import type { WorkflowNodeType } from '@shared/types/workflow.types'

export function WorkflowEditor() {
  const workflows = useWorkflowStore((s) => s.workflows)
  const selectedWorkflowId = useWorkflowStore((s) => s.selectedWorkflowId)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const isEditMode = useWorkflowStore((s) => s.isEditMode)
  const unsavedChanges = useWorkflowStore((s) => s.unsavedChanges)
  const selectWorkflow = useWorkflowStore((s) => s.selectWorkflow)
  const selectNode = useWorkflowStore((s) => s.selectNode)
  const loadWorkflows = useWorkflowStore((s) => s.loadWorkflows)
  const toggleEditMode = useWorkflowStore((s) => s.toggleEditMode)

  const { insertNode } = useNodeInsertion()
  const { pendingDeleteId, requestDelete, confirmDelete, cancelDelete } = useNodeDeletion()
  const { handleConnect, handleEdgeUpdate } = useEdgeManagement()
  const { save, isSaving } = useWorkflowSave()

  const [insertingEdgeId, setInsertingEdgeId] = useState<string | null>(null)

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

  const selectedNode = useMemo(() => {
    if (!selectedGraph || !selectedNodeId) return null
    return selectedGraph.nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [selectedGraph, selectedNodeId])

  const pendingDeleteNode = useMemo(() => {
    if (!selectedGraph || !pendingDeleteId) return null
    return selectedGraph.nodes.find((n) => n.id === pendingDeleteId) ?? null
  }, [selectedGraph, pendingDeleteId])

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      if (isEditMode) {
        setInsertingEdgeId(edgeId)
      }
    },
    [isEditMode]
  )

  const handleNodeTypeSelect = useCallback(
    (type: WorkflowNodeType) => {
      if (insertingEdgeId) {
        const defaultLabels: Record<WorkflowNodeType, string> = {
          step: 'Nouvelle etape',
          check: 'Nouvelle verification',
          action: 'Nouvelle action'
        }
        insertNode(insertingEdgeId, type, defaultLabels[type])
        setInsertingEdgeId(null)
      }
    },
    [insertingEdgeId, insertNode]
  )

  // Delete key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && isEditMode && selectedNodeId) {
        requestDelete()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditMode, selectedNodeId, requestDelete])

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
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-[var(--color-border)]">
        {workflows.data.length > 1 &&
          workflows.data.map((w) => (
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
        <div className="flex-1" />

        {isEditMode && unsavedChanges && (
          <button
            onClick={save}
            disabled={isSaving}
            className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white hover:opacity-80 disabled:opacity-50 transition-opacity"
          >
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        )}

        {isEditMode && selectedNodeId && (
          <button
            onClick={() => requestDelete()}
            className="text-xs px-3 py-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors"
          >
            Supprimer
          </button>
        )}

        {isEditMode && (
          <span className="text-xs px-2 py-1 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
            Edition
          </span>
        )}

        <button
          onClick={toggleEditMode}
          aria-pressed={isEditMode}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            isEditMode
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
          }`}
        >
          {isEditMode ? 'Mode Lecture' : 'Mode Edition'}
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {layout && (
            <WorkflowCanvas
              nodes={layout.nodes}
              edges={layout.edges}
              isEditMode={isEditMode}
              onNodeSelect={(id) => selectNode(id)}
              onEdgeClick={handleEdgeClick}
              onConnect={handleConnect}
              onEdgeUpdate={handleEdgeUpdate}
            />
          )}

          {/* Node type selector popover */}
          {insertingEdgeId && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <NodeTypeSelector
                onSelect={handleNodeTypeSelect}
                onCancel={() => setInsertingEdgeId(null)}
              />
            </div>
          )}
        </div>

        {/* Properties panel */}
        {isEditMode && selectedNode && (
          <NodePropertiesPanel node={selectedNode} onClose={() => selectNode(null)} />
        )}
      </div>

      {/* Delete confirmation dialog */}
      <DeleteNodeDialog
        open={pendingDeleteId !== null}
        nodeLabel={pendingDeleteNode?.label ?? ''}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  )
}
