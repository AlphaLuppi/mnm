import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkflowStore } from '../workflow.store'
import { generateNodeId } from './useNodeInsertion'
import type { WorkflowGraph } from '@shared/types/workflow.types'

const mockGraph: WorkflowGraph = {
  id: 'wf-1',
  name: 'Test',
  sourceFile: 'test.yaml',
  sourceFormat: 'yaml',
  nodes: [
    { id: 'a', label: 'A', type: 'step', sourceFile: 'test.yaml' },
    { id: 'b', label: 'B', type: 'step', sourceFile: 'test.yaml' }
  ],
  edges: [{ id: 'e1', source: 'a', target: 'b', type: 'sequential' }]
}

describe('useNodeInsertion', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflows: { status: 'success', data: [mockGraph] },
      selectedWorkflowId: 'wf-1',
      selectedNodeId: null,
      isEditMode: true,
      unsavedChanges: false
    })
  })

  it('generateNodeId returns unique ids', () => {
    const id1 = generateNodeId()
    const id2 = generateNodeId()
    expect(id1).toMatch(/^node-\d+-\d+$/)
    expect(id1).not.toBe(id2)
  })

  it('addNode via store inserts node and splits edge', () => {
    useWorkflowStore.getState().addNode(
      { id: 'new-node', label: 'New', type: 'action', sourceFile: 'editor' },
      'e1'
    )

    const state = useWorkflowStore.getState()
    if (state.workflows.status !== 'success') throw new Error()
    const graph = state.workflows.data[0]

    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges).toHaveLength(2)
    expect(graph.edges.find((e) => e.source === 'a' && e.target === 'new-node')).toBeDefined()
    expect(graph.edges.find((e) => e.source === 'new-node' && e.target === 'b')).toBeDefined()
  })

  it('auto-selects inserted node', () => {
    useWorkflowStore.getState().addNode(
      { id: 'inserted', label: 'Inserted', type: 'step', sourceFile: 'editor' },
      'e1'
    )
    expect(useWorkflowStore.getState().selectedNodeId).toBe('inserted')
  })
})
