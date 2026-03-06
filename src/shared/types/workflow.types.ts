export type WorkflowNodeType = 'step' | 'check' | 'action'

export type WorkflowEdgeType = 'sequential' | 'conditional'

export type WorkflowSourceFormat = 'yaml' | 'markdown'

export type WorkflowNodeStatus = 'pending' | 'active' | 'done' | 'error'

export type WorkflowNode = {
  id: string
  label: string
  type: WorkflowNodeType
  role?: string
  instructions?: string
  conditions?: string
  sourceFile: string
  sourceLine?: number
  metadata?: Record<string, unknown>
}

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  type: WorkflowEdgeType
  label?: string
}

export type WorkflowGraph = {
  id: string
  name: string
  sourceFile: string
  sourceFormat: WorkflowSourceFormat
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  entryNodeId?: string
  exitNodeIds?: string[]
  metadata?: Record<string, unknown>
}
