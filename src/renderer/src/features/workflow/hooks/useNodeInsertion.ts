import { useCallback } from 'react'
import { useWorkflowStore } from '../workflow.store'
import type { WorkflowNodeType } from '@shared/types/workflow.types'

let nodeCounter = 0

export function generateNodeId(): string {
  return `node-${Date.now()}-${++nodeCounter}`
}

export function useNodeInsertion() {
  const isEditMode = useWorkflowStore((s) => s.isEditMode)
  const addNode = useWorkflowStore((s) => s.addNode)

  const insertNode = useCallback(
    (splitEdgeId: string, type: WorkflowNodeType, label: string) => {
      if (!isEditMode) return

      const nodeId = generateNodeId()
      addNode(
        {
          id: nodeId,
          label,
          type,
          sourceFile: 'editor'
        },
        splitEdgeId
      )
    },
    [isEditMode, addNode]
  )

  return { insertNode, isEditMode }
}
