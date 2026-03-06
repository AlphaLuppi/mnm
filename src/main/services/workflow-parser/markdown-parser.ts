import type { WorkflowParseResult, WorkflowRawStep, WorkflowRawEdge } from './workflow-parser.types'

export function parseMarkdownWorkflow(_filePath: string, content: string): WorkflowParseResult {
  const nodes: WorkflowRawStep[] = []
  const edges: WorkflowRawEdge[] = []

  // Extract frontmatter if present
  let name: string | undefined
  let description: string | undefined
  let body = content

  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (frontmatterMatch) {
    const fm = frontmatterMatch[1]
    const nameMatch = fm.match(/^name:\s*(.+)$/m)
    const descMatch = fm.match(/^description:\s*(.+)$/m)
    name = nameMatch?.[1].trim()
    description = descMatch?.[1].trim()
    body = content.slice(frontmatterMatch[0].length)
  }

  // Extract title from first H1 if no frontmatter name
  if (!name) {
    const h1Match = body.match(/^#\s+(.+)$/m)
    if (h1Match) {
      name = h1Match[1].trim()
    }
  }

  const lines = body.split('\n')
  let currentNodeId: string | undefined
  let nodeIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match H2 sections as major workflow phases
    const h2Match = line.match(/^##\s+(.+)$/)
    if (h2Match) {
      const id = `section-${nodeIndex}`
      nodes.push({
        id,
        label: h2Match[1].trim(),
        type: 'step',
        sourceLine: i + 1
      })

      if (currentNodeId) {
        edges.push({ source: currentNodeId, target: id, type: 'sequential' })
      }
      currentNodeId = id
      nodeIndex++
      continue
    }

    // Match H3 sections as sub-steps
    const h3Match = line.match(/^###\s+(.+)$/)
    if (h3Match) {
      const id = `step-${nodeIndex}`
      const label = h3Match[1].trim()

      // Detect if this is a conditional/check step
      const isConditional = /^(if|when|check|condition|decision)/i.test(label)

      nodes.push({
        id,
        label,
        type: isConditional ? 'check' : 'step',
        sourceLine: i + 1
      })

      if (currentNodeId) {
        edges.push({ source: currentNodeId, target: id, type: 'sequential' })
      }
      currentNodeId = id
      nodeIndex++
      continue
    }

    // Match numbered lists as sequential steps within a section
    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.+)$/)
    if (numberedMatch && currentNodeId) {
      const id = `list-${nodeIndex}`
      nodes.push({
        id,
        label: numberedMatch[2].trim(),
        type: 'action',
        sourceLine: i + 1
      })

      edges.push({ source: currentNodeId, target: id, type: 'sequential' })
      currentNodeId = id
      nodeIndex++
    }
  }

  if (nodes.length === 0 && name) {
    nodes.push({
      id: 'main',
      label: name,
      type: 'step',
      instructions: description
    })
  }

  return {
    nodes,
    edges,
    metadata: { sourceFormat: 'markdown', name, description },
    errors: []
  }
}
