import type { WorkflowGraph } from '@shared/types/workflow.types'
import { serializeToYaml } from './yaml-serializer'
import { serializeToMarkdown } from './markdown-serializer'
import { writeFileAtomic } from './file-writer'
import { logger } from '@main/utils/logger'

export function validateGraphForSave(graph: WorkflowGraph): string[] {
  const errors: string[] = []

  for (const node of graph.nodes) {
    if (!node.label.trim()) {
      errors.push(`Le noeud "${node.id}" a un titre vide`)
    }
  }

  // Check for orphan nodes (no edges at all, in a graph with edges)
  if (graph.edges.length > 0) {
    const connectedNodes = new Set<string>()
    for (const edge of graph.edges) {
      connectedNodes.add(edge.source)
      connectedNodes.add(edge.target)
    }
    for (const node of graph.nodes) {
      if (!connectedNodes.has(node.id) && graph.nodes.length > 1) {
        errors.push(`Le noeud "${node.label}" n'est connecte a aucun autre noeud`)
      }
    }
  }

  return errors
}

export async function saveWorkflow(graph: WorkflowGraph): Promise<void> {
  const validationErrors = validateGraphForSave(graph)
  if (validationErrors.length > 0) {
    throw {
      code: 'WORKFLOW_VALIDATION_ERROR',
      message: validationErrors.join('; '),
      source: 'workflow-save'
    }
  }

  let content: string
  switch (graph.sourceFormat) {
    case 'yaml':
      content = serializeToYaml(graph)
      break
    case 'markdown':
      content = serializeToMarkdown(graph)
      break
    default:
      throw {
        code: 'UNSUPPORTED_FORMAT',
        message: `Format non supporte: ${graph.sourceFormat}`,
        source: 'workflow-save'
      }
  }

  await writeFileAtomic(graph.sourceFile, content)
  logger.info('workflow-parser', 'Workflow saved', { file: graph.sourceFile })
}
