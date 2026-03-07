import { EventEmitter } from 'node:events'
import type { WorkflowGraph, WorkflowNodeStatus } from '@shared/types/workflow.types'

type ExecutionState = {
  workflowId: string
  nodeStatuses: Map<string, WorkflowNodeStatus>
  nodeLabels: Map<string, string>
  startedAt: number
}

export class WorkflowExecutionTracker {
  private executions = new Map<string, ExecutionState>()

  constructor(private eventBus: EventEmitter) {
    this.handleAgentOutput = this.handleAgentOutput.bind(this)
    this.eventBus.on('agent:output', this.handleAgentOutput)
  }

  startTracking(workflowId: string, graph: WorkflowGraph): void {
    const nodeStatuses = new Map<string, WorkflowNodeStatus>()
    const nodeLabels = new Map<string, string>()

    for (const node of graph.nodes) {
      nodeStatuses.set(node.id, 'pending')
      nodeLabels.set(node.label.toLowerCase(), node.id)
    }

    // Set entry node as active
    const entryId = graph.entryNodeId ?? graph.nodes[0]?.id
    if (entryId) {
      nodeStatuses.set(entryId, 'active')
      this.emitNodeStatus(workflowId, entryId, 'active')
    }

    this.executions.set(workflowId, {
      workflowId,
      nodeStatuses,
      nodeLabels,
      startedAt: Date.now()
    })
  }

  stopTracking(workflowId: string): void {
    this.executions.delete(workflowId)
  }

  updateNodeStatus(
    workflowId: string,
    nodeId: string,
    status: WorkflowNodeStatus,
    error?: string
  ): void {
    const execution = this.executions.get(workflowId)
    if (!execution) return

    execution.nodeStatuses.set(nodeId, status)
    this.emitNodeStatus(workflowId, nodeId, status, error)

    // Check completion
    const allDone = Array.from(execution.nodeStatuses.values()).every((s) => s === 'done')
    if (allDone) {
      this.eventBus.emit('workflow:completed', {
        workflowId,
        duration: Date.now() - execution.startedAt
      })
    }
  }

  private handleAgentOutput(data: { agentId: string; data: string }): void {
    // Try to correlate output to a workflow step
    const output = data.data.toLowerCase()
    for (const [, execution] of this.executions) {
      for (const [label, nodeId] of execution.nodeLabels) {
        if (output.includes(label)) {
          const currentStatus = execution.nodeStatuses.get(nodeId)
          if (currentStatus === 'pending') {
            this.updateNodeStatus(execution.workflowId, nodeId, 'active')
          }
        }
      }
    }
  }

  private emitNodeStatus(
    workflowId: string,
    nodeId: string,
    status: WorkflowNodeStatus,
    error?: string
  ): void {
    this.eventBus.emit('workflow:node-status', {
      workflowId,
      nodeId,
      status,
      error,
      timestamp: Date.now()
    })
  }

  getExecutionState(workflowId: string): Map<string, WorkflowNodeStatus> | null {
    return this.executions.get(workflowId)?.nodeStatuses ?? null
  }

  dispose(): void {
    this.eventBus.off('agent:output', this.handleAgentOutput)
    this.executions.clear()
  }
}
