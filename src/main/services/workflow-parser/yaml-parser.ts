import jsYaml from 'js-yaml'
import type { WorkflowParseResult, WorkflowRawStep, WorkflowRawEdge, WorkflowParseError } from './workflow-parser.types'

export function parseYamlWorkflow(filePath: string, content: string): WorkflowParseResult {
  const errors: WorkflowParseError[] = []

  let doc: unknown
  try {
    doc = jsYaml.load(content, { filename: filePath })
  } catch (err) {
    if (err instanceof jsYaml.YAMLException) {
      return {
        nodes: [],
        edges: [],
        metadata: { sourceFormat: 'yaml' },
        errors: [{
          file: filePath,
          line: err.mark?.line,
          column: err.mark?.column,
          message: err.message
        }]
      }
    }
    throw err
  }

  if (!doc || typeof doc !== 'object') {
    return {
      nodes: [],
      edges: [],
      metadata: { sourceFormat: 'yaml' },
      errors: [{ file: filePath, message: 'YAML document is empty or not an object' }]
    }
  }

  const docObj = doc as Record<string, unknown>
  const name = typeof docObj.name === 'string' ? docObj.name : undefined
  const description = typeof docObj.description === 'string' ? docObj.description : undefined

  const nodes: WorkflowRawStep[] = []
  const edges: WorkflowRawEdge[] = []

  // Parse steps array if present
  if (Array.isArray(docObj.steps)) {
    parseStepsArray(docObj.steps, filePath, nodes, edges, errors)
  }

  // Parse variables as informational nodes
  if (docObj.variables && typeof docObj.variables === 'object') {
    const varsObj = docObj.variables as Record<string, unknown>
    const varEntries = Object.entries(varsObj)
    if (varEntries.length > 0) {
      const varNodeId = 'variables'
      nodes.push({
        id: varNodeId,
        label: 'Variables',
        type: 'check',
        instructions: varEntries.map(([k, v]) => `${k}: ${String(v)}`).join('\n')
      })
    }
  }

  // Parse required_tools as an action node
  if (Array.isArray(docObj.required_tools)) {
    nodes.push({
      id: 'required-tools',
      label: 'Required Tools',
      type: 'action',
      instructions: (docObj.required_tools as unknown[]).map(String).join(', ')
    })
  }

  // If no explicit steps but has a name, create a single-node workflow
  if (nodes.length === 0 && name) {
    nodes.push({
      id: 'main',
      label: name,
      type: 'step',
      role: typeof docObj.author === 'string' ? docObj.author : undefined,
      instructions: description
    })
  }

  // Create sequential edges between nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    const sourceId = nodes[i].id ?? `step-${i}`
    const targetId = nodes[i + 1].id ?? `step-${i + 1}`
    edges.push({
      source: sourceId,
      target: targetId,
      type: 'sequential'
    })
  }

  return {
    nodes,
    edges,
    metadata: { sourceFormat: 'yaml', name, description },
    errors
  }
}

function parseStepsArray(
  steps: unknown[],
  filePath: string,
  nodes: WorkflowRawStep[],
  edges: WorkflowRawEdge[],
  errors: WorkflowParseError[]
): void {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (!step || typeof step !== 'object') {
      errors.push({ file: filePath, message: `Step ${i} is not an object` })
      continue
    }

    const stepObj = step as Record<string, unknown>
    const id = typeof stepObj.id === 'string' ? stepObj.id : `step-${i}`
    const label = typeof stepObj.name === 'string'
      ? stepObj.name
      : typeof stepObj.label === 'string'
        ? stepObj.label
        : `Step ${i + 1}`

    nodes.push({
      id,
      label,
      type: typeof stepObj.type === 'string' ? (stepObj.type as WorkflowRawStep['type']) : 'step',
      role: typeof stepObj.role === 'string' ? stepObj.role : undefined,
      instructions: typeof stepObj.instructions === 'string' ? stepObj.instructions : undefined,
      conditions: typeof stepObj.conditions === 'string' ? stepObj.conditions : undefined
    })

    // Handle explicit next references
    if (typeof stepObj.next === 'string') {
      edges.push({ source: id, target: stepObj.next, type: 'sequential' })
    } else if (Array.isArray(stepObj.next)) {
      for (const target of stepObj.next) {
        if (typeof target === 'string') {
          edges.push({ source: id, target, type: 'conditional' })
        }
      }
    }
  }
}
