import { describe, it, expect } from 'vitest'
import { buildWorkflowGraph } from './workflow-graph-builder'
import type { WorkflowParseResult } from './workflow-parser.types'

describe('buildWorkflowGraph', () => {
  it('builds a graph from parse result', () => {
    const parseResult: WorkflowParseResult = {
      nodes: [
        { id: 'a', label: 'Step A', type: 'step' },
        { id: 'b', label: 'Step B', type: 'step' },
        { id: 'c', label: 'Step C', type: 'step' }
      ],
      edges: [
        { source: 'a', target: 'b', type: 'sequential' },
        { source: 'b', target: 'c', type: 'sequential' }
      ],
      metadata: { sourceFormat: 'yaml', name: 'Test Workflow' },
      errors: []
    }

    const graph = buildWorkflowGraph('/test/workflow.yaml', parseResult)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges).toHaveLength(2)
    expect(graph.name).toBe('Test Workflow')
    expect(graph.sourceFormat).toBe('yaml')
  })

  it('generates ids for nodes without ids', () => {
    const parseResult: WorkflowParseResult = {
      nodes: [
        { label: 'Step 1', type: 'step' },
        { label: 'Step 2', type: 'action' }
      ],
      edges: [],
      metadata: { sourceFormat: 'markdown' },
      errors: []
    }

    const graph = buildWorkflowGraph('/test/workflow.md', parseResult)
    expect(graph.nodes[0].id).toBe('node-0')
    expect(graph.nodes[1].id).toBe('node-1')
  })

  it('computes entry and exit nodes', () => {
    const parseResult: WorkflowParseResult = {
      nodes: [
        { id: 'start', label: 'Start', type: 'step' },
        { id: 'middle', label: 'Middle', type: 'step' },
        { id: 'end', label: 'End', type: 'step' }
      ],
      edges: [
        { source: 'start', target: 'middle', type: 'sequential' },
        { source: 'middle', target: 'end', type: 'sequential' }
      ],
      metadata: { sourceFormat: 'yaml' },
      errors: []
    }

    const graph = buildWorkflowGraph('/test/w.yaml', parseResult)
    expect(graph.entryNodeId).toBe('start')
    expect(graph.exitNodeIds).toEqual(['end'])
  })

  it('skips edges with invalid node references', () => {
    const parseResult: WorkflowParseResult = {
      nodes: [
        { id: 'a', label: 'A', type: 'step' }
      ],
      edges: [
        { source: 'a', target: 'nonexistent', type: 'sequential' }
      ],
      metadata: { sourceFormat: 'yaml' },
      errors: []
    }

    const graph = buildWorkflowGraph('/test/w.yaml', parseResult)
    expect(graph.edges).toHaveLength(0)
  })

  it('sets sourceFile on all nodes', () => {
    const parseResult: WorkflowParseResult = {
      nodes: [
        { id: 'a', label: 'A', type: 'step', sourceLine: 10 }
      ],
      edges: [],
      metadata: { sourceFormat: 'yaml' },
      errors: []
    }

    const graph = buildWorkflowGraph('/test/workflow.yaml', parseResult)
    expect(graph.nodes[0].sourceFile).toBe('/test/workflow.yaml')
    expect(graph.nodes[0].sourceLine).toBe(10)
  })

  it('uses filePath as name when no name in metadata', () => {
    const parseResult: WorkflowParseResult = {
      nodes: [],
      edges: [],
      metadata: { sourceFormat: 'markdown' },
      errors: []
    }

    const graph = buildWorkflowGraph('/test/workflow.md', parseResult)
    expect(graph.name).toBe('/test/workflow.md')
  })
})
