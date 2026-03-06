import { useCallback } from 'react'
import { useWorkflowStore } from '../workflow.store'

export type ConnectionParams = {
  source: string
  target: string
}

export function validateConnection(source: string, target: string): boolean {
  if (!source || !target) return false
  if (source === target) return false
  return true
}

export function useEdgeManagement() {
  const isEditMode = useWorkflowStore((s) => s.isEditMode)
  const addEdge = useWorkflowStore((s) => s.addEdge)
  const reconnectEdge = useWorkflowStore((s) => s.reconnectEdge)

  const handleConnect = useCallback(
    (params: ConnectionParams) => {
      if (!isEditMode) return
      if (!validateConnection(params.source, params.target)) return

      addEdge({
        id: `edge-${params.source}-${params.target}`,
        source: params.source,
        target: params.target,
        type: 'sequential'
      })
    },
    [isEditMode, addEdge]
  )

  const handleEdgeUpdate = useCallback(
    (edgeId: string, newSource: string, newTarget: string) => {
      if (!isEditMode) return
      if (!validateConnection(newSource, newTarget)) return

      reconnectEdge(edgeId, newSource, newTarget)
    },
    [isEditMode, reconnectEdge]
  )

  return { handleConnect, handleEdgeUpdate, isEditMode }
}
