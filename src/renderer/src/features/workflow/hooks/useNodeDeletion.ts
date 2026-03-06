import { useCallback, useState } from 'react'
import { useWorkflowStore } from '../workflow.store'

export function useNodeDeletion() {
  const isEditMode = useWorkflowStore((s) => s.isEditMode)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const removeNode = useWorkflowStore((s) => s.removeNode)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const requestDelete = useCallback(
    (nodeId?: string) => {
      if (!isEditMode) return
      const targetId = nodeId ?? selectedNodeId
      if (targetId) {
        setPendingDeleteId(targetId)
      }
    },
    [isEditMode, selectedNodeId]
  )

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) {
      removeNode(pendingDeleteId)
      setPendingDeleteId(null)
    }
  }, [pendingDeleteId, removeNode])

  const cancelDelete = useCallback(() => {
    setPendingDeleteId(null)
  }, [])

  return {
    pendingDeleteId,
    requestDelete,
    confirmDelete,
    cancelDelete,
    isEditMode
  }
}
