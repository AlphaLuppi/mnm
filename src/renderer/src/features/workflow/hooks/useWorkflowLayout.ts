import dagre from 'dagre'
import type { WorkflowGraph, WorkflowNodeStatus } from '@shared/types/workflow.types'

export type LayoutNode = {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    role?: string
    instructions?: string
    conditions?: string
    sourceFile: string
    sourceLine?: number
    executionStatus?: WorkflowNodeStatus
    executionError?: string
  }
}

export type LayoutEdge = {
  id: string
  source: string
  target: string
  type: string
  label?: string
  animated: boolean
}

const NODE_WIDTH = 240
const NODE_HEIGHT = 80
const CHECK_NODE_SIZE = 100

export function layoutWorkflowGraph(
  graph: WorkflowGraph,
  nodeStatuses?: Record<string, WorkflowNodeStatus>
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 80,
    marginx: 20,
    marginy: 20
  })

  for (const node of graph.nodes) {
    const isCheck = node.type === 'check'
    g.setNode(node.id, {
      width: isCheck ? CHECK_NODE_SIZE : NODE_WIDTH,
      height: isCheck ? CHECK_NODE_SIZE : NODE_HEIGHT
    })
  }

  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const nodes: LayoutNode[] = graph.nodes.map((wfNode) => {
    const pos = g.node(wfNode.id)
    return {
      id: wfNode.id,
      type: wfNode.type,
      position: {
        x: pos.x - pos.width / 2,
        y: pos.y - pos.height / 2
      },
      data: {
        label: wfNode.label,
        role: wfNode.role,
        instructions: wfNode.instructions,
        conditions: wfNode.conditions,
        sourceFile: wfNode.sourceFile,
        sourceLine: wfNode.sourceLine,
        executionStatus: nodeStatuses?.[wfNode.id]
      }
    }
  })

  const edges: LayoutEdge[] = graph.edges.map((wfEdge) => ({
    id: wfEdge.id,
    source: wfEdge.source,
    target: wfEdge.target,
    type: wfEdge.type === 'conditional' ? 'conditional' : 'default',
    label: wfEdge.label,
    animated: (nodeStatuses?.[wfEdge.target] ?? null) === 'active'
  }))

  return { nodes, edges }
}
