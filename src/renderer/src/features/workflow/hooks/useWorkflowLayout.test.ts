import { describe, it, expect } from 'vitest'
import { layoutWorkflowGraph } from './useWorkflowLayout'
import type { WorkflowGraph } from '@shared/types/workflow.types'

describe('layoutWorkflowGraph', () => {
  it('lays out a linear graph top-to-bottom', () => {
    const graph: WorkflowGraph = {
      id: 'wf-1',
      name: 'Linear',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [
        { id: 'a', label: 'A', type: 'step', sourceFile: 'test.yaml' },
        { id: 'b', label: 'B', type: 'step', sourceFile: 'test.yaml' },
        { id: 'c', label: 'C', type: 'step', sourceFile: 'test.yaml' }
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', type: 'sequential' },
        { id: 'e2', source: 'b', target: 'c', type: 'sequential' }
      ]
    }

    const { nodes, edges } = layoutWorkflowGraph(graph)
    expect(nodes).toHaveLength(3)
    expect(edges).toHaveLength(2)

    // Top-to-bottom: A.y < B.y < C.y
    expect(nodes[0].position.y).toBeLessThan(nodes[1].position.y)
    expect(nodes[1].position.y).toBeLessThan(nodes[2].position.y)
  })

  it('handles a single node graph', () => {
    const graph: WorkflowGraph = {
      id: 'wf-2',
      name: 'Single',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [
        { id: 'only', label: 'Only Node', type: 'step', sourceFile: 'test.yaml' }
      ],
      edges: []
    }

    const { nodes } = layoutWorkflowGraph(graph)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('only')
    expect(nodes[0].position.x).toBeDefined()
    expect(nodes[0].position.y).toBeDefined()
  })

  it('handles branching graph', () => {
    const graph: WorkflowGraph = {
      id: 'wf-3',
      name: 'Branching',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [
        { id: 'start', label: 'Start', type: 'step', sourceFile: 'test.yaml' },
        { id: 'left', label: 'Left', type: 'action', sourceFile: 'test.yaml' },
        { id: 'right', label: 'Right', type: 'action', sourceFile: 'test.yaml' },
        { id: 'end', label: 'End', type: 'step', sourceFile: 'test.yaml' }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'left', type: 'conditional' },
        { id: 'e2', source: 'start', target: 'right', type: 'conditional' },
        { id: 'e3', source: 'left', target: 'end', type: 'sequential' },
        { id: 'e4', source: 'right', target: 'end', type: 'sequential' }
      ]
    }

    const { nodes, edges } = layoutWorkflowGraph(graph)
    expect(nodes).toHaveLength(4)
    expect(edges).toHaveLength(4)

    // Start at top, left and right at same level, end at bottom
    const startNode = nodes.find((n) => n.id === 'start')!
    const leftNode = nodes.find((n) => n.id === 'left')!
    const rightNode = nodes.find((n) => n.id === 'right')!
    const endNode = nodes.find((n) => n.id === 'end')!

    expect(startNode.position.y).toBeLessThan(leftNode.position.y)
    expect(leftNode.position.y).toBeLessThan(endNode.position.y)
    // Left and right at approximately the same y
    expect(Math.abs(leftNode.position.y - rightNode.position.y)).toBeLessThan(10)
  })

  it('preserves node data in layout output', () => {
    const graph: WorkflowGraph = {
      id: 'wf-4',
      name: 'Data Test',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [
        {
          id: 'n1',
          label: 'Step 1',
          type: 'step',
          role: 'developer',
          instructions: 'Do something',
          sourceFile: 'test.yaml',
          sourceLine: 42
        }
      ],
      edges: []
    }

    const { nodes } = layoutWorkflowGraph(graph)
    expect(nodes[0].data.label).toBe('Step 1')
    expect(nodes[0].data.role).toBe('developer')
    expect(nodes[0].data.instructions).toBe('Do something')
    expect(nodes[0].data.sourceFile).toBe('test.yaml')
    expect(nodes[0].data.sourceLine).toBe(42)
  })

  it('maps edge types correctly', () => {
    const graph: WorkflowGraph = {
      id: 'wf-5',
      name: 'Edge Types',
      sourceFile: 'test.yaml',
      sourceFormat: 'yaml',
      nodes: [
        { id: 'a', label: 'A', type: 'step', sourceFile: 'test.yaml' },
        { id: 'b', label: 'B', type: 'step', sourceFile: 'test.yaml' },
        { id: 'c', label: 'C', type: 'step', sourceFile: 'test.yaml' }
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b', type: 'sequential' },
        { id: 'e2', source: 'a', target: 'c', type: 'conditional', label: 'if true' }
      ]
    }

    const { edges } = layoutWorkflowGraph(graph)
    expect(edges[0].type).toBe('default')
    expect(edges[1].type).toBe('conditional')
    expect(edges[1].label).toBe('if true')
  })
})
