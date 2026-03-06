import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkflowStore } from './workflow.store'
import type { WorkflowGraph } from '@shared/types/workflow.types'

const mockGraph: WorkflowGraph = {
  id: 'wf-1',
  name: 'Test Workflow',
  sourceFile: 'test.yaml',
  sourceFormat: 'yaml',
  nodes: [{ id: 'n1', label: 'Step 1', type: 'step', sourceFile: 'test.yaml' }],
  edges: []
}

describe('useWorkflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflows: { status: 'idle' },
      selectedWorkflowId: null,
      selectedNodeId: null
    })
  })

  it('has correct initial state', () => {
    const state = useWorkflowStore.getState()
    expect(state.workflows.status).toBe('idle')
    expect(state.selectedWorkflowId).toBeNull()
    expect(state.selectedNodeId).toBeNull()
  })

  it('selectWorkflow updates selected ID and clears node', () => {
    useWorkflowStore.setState({ selectedNodeId: 'some-node' })
    useWorkflowStore.getState().selectWorkflow('wf-1')
    expect(useWorkflowStore.getState().selectedWorkflowId).toBe('wf-1')
    expect(useWorkflowStore.getState().selectedNodeId).toBeNull()
  })

  it('selectNode updates selected node ID', () => {
    useWorkflowStore.getState().selectNode('n1')
    expect(useWorkflowStore.getState().selectedNodeId).toBe('n1')

    useWorkflowStore.getState().selectNode(null)
    expect(useWorkflowStore.getState().selectedNodeId).toBeNull()
  })

  it('sets success state with data', () => {
    useWorkflowStore.setState({
      workflows: { status: 'success', data: [mockGraph] },
      selectedWorkflowId: mockGraph.id
    })

    const state = useWorkflowStore.getState()
    expect(state.workflows.status).toBe('success')
    if (state.workflows.status === 'success') {
      expect(state.workflows.data).toHaveLength(1)
      expect(state.workflows.data[0].name).toBe('Test Workflow')
    }
    expect(state.selectedWorkflowId).toBe('wf-1')
  })
})
