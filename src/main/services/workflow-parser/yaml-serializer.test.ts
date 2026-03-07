import { describe, it, expect } from 'vitest'
import { serializeToYaml } from './yaml-serializer'
import { parseYamlWorkflow } from './yaml-parser'
import type { WorkflowGraph } from '@shared/types/workflow.types'

const linearGraph: WorkflowGraph = {
  id: 'wf-1',
  name: 'Linear Workflow',
  sourceFile: 'test.yaml',
  sourceFormat: 'yaml',
  nodes: [
    { id: 'step-0', label: 'Step A', type: 'step', sourceFile: 'test.yaml' },
    { id: 'step-1', label: 'Step B', type: 'step', role: 'developer', sourceFile: 'test.yaml' },
    { id: 'step-2', label: 'Step C', type: 'step', instructions: 'Do something', sourceFile: 'test.yaml' }
  ],
  edges: [
    { id: 'e1', source: 'step-0', target: 'step-1', type: 'sequential' },
    { id: 'e2', source: 'step-1', target: 'step-2', type: 'sequential' }
  ]
}

const branchingGraph: WorkflowGraph = {
  id: 'wf-2',
  name: 'Branching Workflow',
  sourceFile: 'test.yaml',
  sourceFormat: 'yaml',
  nodes: [
    { id: 'start', label: 'Start', type: 'step', sourceFile: 'test.yaml' },
    { id: 'left', label: 'Left Branch', type: 'action', sourceFile: 'test.yaml' },
    { id: 'right', label: 'Right Branch', type: 'action', sourceFile: 'test.yaml' }
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'left', type: 'conditional', label: 'if true' },
    { id: 'e2', source: 'start', target: 'right', type: 'conditional', label: 'if false' }
  ]
}

describe('serializeToYaml', () => {
  it('serializes linear graph to valid YAML', () => {
    const output = serializeToYaml(linearGraph)
    expect(output).toContain('name: Linear Workflow')
    expect(output).toContain('Step A')
    expect(output).toContain('Step B')
    expect(output).toContain('Step C')
    expect(output).toContain('role: developer')
    expect(output).toContain('instructions: Do something')
  })

  it('serializes branching graph with branches', () => {
    const output = serializeToYaml(branchingGraph)
    expect(output).toContain('branches')
    expect(output).toContain('if true')
    expect(output).toContain('if false')
  })

  it('serializes single next step correctly', () => {
    const output = serializeToYaml(linearGraph)
    expect(output).toContain('next: step-1')
  })

  it('output is valid YAML (round-trip parsable)', () => {
    const output = serializeToYaml(linearGraph)
    const parsed = parseYamlWorkflow('test.yaml', output)
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.nodes.length).toBeGreaterThan(0)
    expect(parsed.metadata.name).toBe('Linear Workflow')
  })

  it('preserves metadata', () => {
    const graphWithMeta: WorkflowGraph = {
      ...linearGraph,
      metadata: { description: 'A test workflow', version: '1.0' }
    }
    const output = serializeToYaml(graphWithMeta)
    expect(output).toContain('description: A test workflow')
  })
})
