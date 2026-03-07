import { describe, it, expect } from 'vitest'
import { validateGraphForSave } from './workflow-save.service'
import type { WorkflowGraph } from '@shared/types/workflow.types'

describe('validateGraphForSave', () => {
  it('returns no errors for valid graph', () => {
    const graph: WorkflowGraph = {
      id: 'wf-1',
      name: 'Valid',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [
        { id: 'a', label: 'Step A', type: 'step', sourceFile: 'test.yaml' },
        { id: 'b', label: 'Step B', type: 'step', sourceFile: 'test.yaml' }
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', type: 'sequential' }]
    }
    expect(validateGraphForSave(graph)).toHaveLength(0)
  })

  it('reports empty labels', () => {
    const graph: WorkflowGraph = {
      id: 'wf-1',
      name: 'Invalid',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [
        { id: 'a', label: '', type: 'step', sourceFile: 'test.yaml' },
        { id: 'b', label: '  ', type: 'step', sourceFile: 'test.yaml' }
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', type: 'sequential' }]
    }
    const errors = validateGraphForSave(graph)
    expect(errors.length).toBe(2)
  })

  it('reports orphan nodes in a graph with edges', () => {
    const graph: WorkflowGraph = {
      id: 'wf-1',
      name: 'Orphan',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [
        { id: 'a', label: 'Step A', type: 'step', sourceFile: 'test.yaml' },
        { id: 'b', label: 'Step B', type: 'step', sourceFile: 'test.yaml' },
        { id: 'c', label: 'Orphan', type: 'step', sourceFile: 'test.yaml' }
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b', type: 'sequential' }]
    }
    const errors = validateGraphForSave(graph)
    expect(errors.length).toBe(1)
    expect(errors[0]).toContain('Orphan')
  })

  it('allows single node with no edges', () => {
    const graph: WorkflowGraph = {
      id: 'wf-1',
      name: 'Single',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [{ id: 'a', label: 'Only', type: 'step', sourceFile: 'test.yaml' }],
      edges: []
    }
    expect(validateGraphForSave(graph)).toHaveLength(0)
  })
})
