import type { WorkflowGraph } from '@shared/types/workflow.types'

export function serializeToMarkdown(graph: WorkflowGraph): string {
  const lines: string[] = []

  // Add frontmatter
  lines.push('---')
  lines.push(`name: ${graph.name}`)
  if (graph.metadata?.description) {
    lines.push(`description: ${String(graph.metadata.description)}`)
  }
  lines.push('---')
  lines.push('')
  lines.push(`# ${graph.name}`)
  lines.push('')

  // Build adjacency for ordering: follow edge order from entry
  const visited = new Set<string>()
  const ordered: string[] = []
  const adjacency = new Map<string, string[]>()

  for (const edge of graph.edges) {
    const targets = adjacency.get(edge.source) ?? []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  }

  // Find entry nodes (no incoming edges)
  const hasIncoming = new Set(graph.edges.map((e) => e.target))
  const entryNodes = graph.nodes.filter((n) => !hasIncoming.has(n.id))
  const startNodes = entryNodes.length > 0 ? entryNodes : graph.nodes.slice(0, 1)

  // BFS to order nodes
  const queue = startNodes.map((n) => n.id)
  for (const id of queue) {
    if (visited.has(id)) continue
    visited.add(id)
    ordered.push(id)
    const targets = adjacency.get(id) ?? []
    for (const t of targets) {
      if (!visited.has(t)) queue.push(t)
    }
  }

  // Add any remaining nodes not reached
  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node.id)
    }
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

  for (const nodeId of ordered) {
    const node = nodeMap.get(nodeId)
    if (!node) continue

    if (node.type === 'action') {
      lines.push(`### ${node.label}`)
    } else if (node.type === 'check') {
      lines.push(`### ${node.label}`)
    } else {
      lines.push(`## ${node.label}`)
    }

    lines.push('')

    if (node.role) {
      lines.push(`**Role:** ${node.role}`)
      lines.push('')
    }

    if (node.instructions) {
      lines.push(node.instructions)
      lines.push('')
    }

    if (node.conditions) {
      lines.push(`**Conditions:** ${node.conditions}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}
