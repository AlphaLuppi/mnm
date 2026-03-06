import { readFile } from 'node:fs/promises'
import type { WorkflowGraph } from '@shared/types/workflow.types'
import type { WorkflowParseResult } from './workflow-parser.types'
import { parseYamlWorkflow } from './yaml-parser'
import { parseMarkdownWorkflow } from './markdown-parser'
import { buildWorkflowGraph } from './workflow-graph-builder'
import { scanWorkflowFiles, detectFormat } from './workflow-scanner'
import { logger } from '@main/utils/logger'

export async function parseWorkflow(filePath: string): Promise<WorkflowGraph> {
  const format = detectFormat(filePath)
  if (!format) {
    throw {
      code: 'WORKFLOW_PARSE_ERROR',
      message: `Unsupported file format: ${filePath}`,
      source: 'workflow-parser'
    }
  }

  const content = await readFile(filePath, 'utf-8')
  let parseResult: WorkflowParseResult

  switch (format) {
    case 'yaml':
      parseResult = parseYamlWorkflow(filePath, content)
      break
    case 'markdown':
      parseResult = parseMarkdownWorkflow(filePath, content)
      break
  }

  if (parseResult.errors.length > 0) {
    logger.warn('workflow-parser', `Parse errors in ${filePath}`, { errors: parseResult.errors })
  }

  return buildWorkflowGraph(filePath, parseResult)
}

export async function parseAllWorkflows(projectPath: string): Promise<WorkflowGraph[]> {
  const files = await scanWorkflowFiles(projectPath)
  const graphs: WorkflowGraph[] = []

  for (const filePath of files) {
    try {
      const graph = await parseWorkflow(filePath)
      graphs.push(graph)
    } catch (err) {
      logger.warn('workflow-parser', `Failed to parse ${filePath}`, { error: err })
    }
  }

  return graphs
}
