import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from '@shared/types/workflow.types'
import type { WorkflowParseResult } from './workflow-parser.types'

export function buildWorkflowGraph(
  filePath: string,
  parseResult: WorkflowParseResult
): WorkflowGraph {
  const nodeMap = new Map<string, WorkflowNode>()
  const edges: WorkflowEdge[] = []

  const nodes = parseResult.nodes.map((raw, index) => {
    const id = raw.id ?? `node-${index}`
    const node: WorkflowNode = {
      id,
      label: raw.label,
      type: raw.type,
      role: raw.role,
      instructions: raw.instructions,
      conditions: raw.conditions,
      sourceFile: filePath,
      sourceLine: raw.sourceLine
    }
    nodeMap.set(id, node)
    return node
  })

  for (const rawEdge of parseResult.edges) {
    const sourceId = rawEdge.source
    const targetId = rawEdge.target
    if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
      continue
    }
    edges.push({
      id: `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: rawEdge.type,
      label: rawEdge.label
    })
  }

  const targetSet = new Set(edges.map((e) => e.target))
  const sourceSet = new Set(edges.map((e) => e.source))
  const entryNodeId = nodes.find((n) => !targetSet.has(n.id))?.id
  const exitNodeIds = nodes.filter((n) => !sourceSet.has(n.id)).map((n) => n.id)

  return {
    id: `workflow-${filePath}`,
    name: parseResult.metadata.name ?? filePath,
    sourceFile: filePath,
    sourceFormat: parseResult.metadata.sourceFormat,
    nodes,
    edges,
    entryNodeId,
    exitNodeIds,
    metadata: parseResult.metadata
  }
}
