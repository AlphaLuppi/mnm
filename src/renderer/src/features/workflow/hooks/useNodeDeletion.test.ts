import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkflowStore } from '../workflow.store'
import type { WorkflowGraph } from '@shared/types/workflow.types'

const mockGraph: WorkflowGraph = {
  id: 'wf-1',
  name: 'Test',
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

describe('useNodeDeletion (store actions)', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflows: { status: 'success', data: [mockGraph] },
      selectedWorkflowId: 'wf-1',
      selectedNodeId: null,
      isEditMode: true,
      unsavedChanges: false
    })
  })

  it('removeNode reconnects simple chain', () => {
    useWorkflowStore.getState().removeNode('b')

    const state = useWorkflowStore.getState()
    if (state.workflows.status !== 'success') throw new Error()
    const graph = state.workflows.data[0]

    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].source).toBe('a')
    expect(graph.edges[0].target).toBe('c')
  })

  it('removeNode clears selectedNodeId when deleted node was selected', () => {
    useWorkflowStore.setState({ selectedNodeId: 'b' })
    useWorkflowStore.getState().removeNode('b')
    expect(useWorkflowStore.getState().selectedNodeId).toBeNull()
  })

  it('removeNode does not clear selectedNodeId for other nodes', () => {
    useWorkflowStore.setState({ selectedNodeId: 'a' })
    useWorkflowStore.getState().removeNode('b')
    expect(useWorkflowStore.getState().selectedNodeId).toBe('a')
  })

  it('removeNode marks unsaved changes', () => {
    useWorkflowStore.getState().removeNode('b')
    expect(useWorkflowStore.getState().unsavedChanges).toBe(true)
  })
})
