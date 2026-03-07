import jsYaml from 'js-yaml'
import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from '@shared/types/workflow.types'

export function serializeToYaml(graph: WorkflowGraph): string {
  const doc: Record<string, unknown> = {
    name: graph.name,
    ...(graph.metadata ?? {}),
    steps: graph.nodes.map((node) => serializeNode(node, graph.edges))
  }

  return jsYaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    sortKeys: false,
    noRefs: true,
    quotingType: '"'
  })
}

function serializeNode(
  node: WorkflowNode,
  edges: WorkflowEdge[]
): Record<string, unknown> {
  const outgoing = edges.filter((e) => e.source === node.id)
  const step: Record<string, unknown> = {
    id: node.id,
    name: node.label,
    type: node.type
  }

  if (node.role) step.role = node.role
  if (node.instructions) step.instructions = node.instructions
  if (node.conditions) step.conditions = node.conditions

  if (outgoing.length === 1 && outgoing[0].type === 'sequential') {
    step.next = outgoing[0].target
  }

  if (outgoing.length > 1) {
    step.branches = outgoing.map((e) => ({
      target: e.target,
      ...(e.label ? { condition: e.label } : {})
    }))
  }

  return step
}
