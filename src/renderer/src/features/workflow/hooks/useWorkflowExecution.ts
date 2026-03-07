import { useCallback } from 'react'
import { useWorkflowStore } from '../workflow.store'
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream'
import type { WorkflowNodeStatus } from '@shared/types/workflow.types'

export function useWorkflowExecution() {
  const selectedWorkflowId = useWorkflowStore((s) => s.selectedWorkflowId)
  const executionState = useWorkflowStore((s) => s.executionState)
  const updateNodeStatus = useWorkflowStore((s) => s.updateNodeStatus)

  const handleStreamEvent = useCallback(
    (data: { workflowId: string; nodeId: string; status: WorkflowNodeStatus }) => {
      if (data.workflowId === selectedWorkflowId) {
        updateNodeStatus(data.nodeId, data.status)
      }
    },
    [selectedWorkflowId, updateNodeStatus]
  )

  useIpcStream('stream:workflow-node', handleStreamEvent)

  const isExecuting = executionState !== null &&
    Object.values(executionState.nodeStatuses).some((s) => s === 'active')

  const isCompleted = executionState !== null &&
    Object.values(executionState.nodeStatuses).every((s) => s === 'done')

  const hasError = executionState !== null &&
    Object.values(executionState.nodeStatuses).some((s) => s === 'error')

  return {
    executionState,
    isExecuting,
    isCompleted,
    hasError
  }
}
