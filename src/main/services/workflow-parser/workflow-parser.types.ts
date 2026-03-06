import type { WorkflowNodeType, WorkflowEdgeType, WorkflowSourceFormat } from '@shared/types/workflow.types'

export type WorkflowRawStep = {
  id?: string
  label: string
  type: WorkflowNodeType
  role?: string
  instructions?: string
  conditions?: string
  next?: string | string[]
  sourceLine?: number
}

export type WorkflowRawEdge = {
  source: string
  target: string
  type: WorkflowEdgeType
  label?: string
}

export type WorkflowParseError = {
  file: string
  line?: number
  column?: number
  message: string
}

export type WorkflowMetadata = {
  name?: string
  description?: string
  sourceFormat: WorkflowSourceFormat
  [key: string]: unknown
}

export type WorkflowParseResult = {
  nodes: WorkflowRawStep[]
  edges: WorkflowRawEdge[]
  metadata: WorkflowMetadata
  errors: WorkflowParseError[]
}
