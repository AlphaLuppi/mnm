import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkflowStore } from './workflow.store'
import type { WorkflowGraph } from '@shared/types/workflow.types'

const mockGraph: WorkflowGraph = {
  id: 'wf-1',
  name: 'Test Workflow',
  sourceFile: 'test.yaml',
  sourceFormat: 'yaml',
  nodes: [
    { id: 'n1', label: 'Step 1', type: 'step', sourceFile: 'test.yaml' },
    { id: 'n2', label: 'Step 2', type: 'step', sourceFile: 'test.yaml' },
    { id: 'n3', label: 'Step 3', type: 'step', sourceFile: 'test.yaml' }
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', type: 'sequential' },
    { id: 'e2', source: 'n2', target: 'n3', type: 'sequential' }
  ]
}

function setupWithGraph() {
  useWorkflowStore.setState({
    workflows: { status: 'success', data: [mockGraph] },
    selectedWorkflowId: 'wf-1',
    selectedNodeId: null,
    isEditMode: true,
    unsavedChanges: false
  })
}

function getGraph(): WorkflowGraph {
  const state = useWorkflowStore.getState()
  if (state.workflows.status !== 'success') throw new Error('No graph')
  return state.workflows.data[0]
}

describe('useWorkflowStore', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflows: { status: 'idle' },
      selectedWorkflowId: null,
      selectedNodeId: null,
      isEditMode: false,
      unsavedChanges: false
    })
  })

  it('has correct initial state', () => {
    const state = useWorkflowStore.getState()
    expect(state.workflows.status).toBe('idle')
    expect(state.selectedWorkflowId).toBeNull()
    expect(state.selectedNodeId).toBeNull()
    expect(state.isEditMode).toBe(false)
    expect(state.unsavedChanges).toBe(false)
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

  it('toggleEditMode toggles edit mode', () => {
    expect(useWorkflowStore.getState().isEditMode).toBe(false)
    useWorkflowStore.getState().toggleEditMode()
    expect(useWorkflowStore.getState().isEditMode).toBe(true)
    useWorkflowStore.getState().toggleEditMode()
    expect(useWorkflowStore.getState().isEditMode).toBe(false)
  })

  describe('updateNode', () => {
    it('updates node fields', () => {
      setupWithGraph()
      useWorkflowStore.getState().updateNode('n1', { label: 'Updated Step', role: 'architect' })

      const graph = getGraph()
      const node = graph.nodes.find((n) => n.id === 'n1')!
      expect(node.label).toBe('Updated Step')
      expect(node.role).toBe('architect')
      expect(useWorkflowStore.getState().unsavedChanges).toBe(true)
    })

    it('preserves node id even if updates contain different id', () => {
      setupWithGraph()
      useWorkflowStore.getState().updateNode('n1', { id: 'hacked', label: 'Test' } as never)

      const graph = getGraph()
      expect(graph.nodes.find((n) => n.id === 'n1')).toBeDefined()
      expect(graph.nodes.find((n) => n.id === 'hacked')).toBeUndefined()
    })
  })

  describe('addNode', () => {
    it('splits edge and inserts node', () => {
      setupWithGraph()
      useWorkflowStore.getState().addNode(
        { id: 'new-1', label: 'New', type: 'action', sourceFile: 'editor' },
        'e1'
      )

      const graph = getGraph()
      expect(graph.nodes).toHaveLength(4)
      expect(graph.nodes.find((n) => n.id === 'new-1')).toBeDefined()

      // Old edge removed, two new edges created
      expect(graph.edges.find((e) => e.id === 'e1')).toBeUndefined()
      expect(graph.edges.find((e) => e.source === 'n1' && e.target === 'new-1')).toBeDefined()
      expect(graph.edges.find((e) => e.source === 'new-1' && e.target === 'n2')).toBeDefined()
      expect(graph.edges).toHaveLength(3) // e2 + 2 new
    })

    it('auto-selects the new node', () => {
      setupWithGraph()
      useWorkflowStore.getState().addNode(
        { id: 'new-2', label: 'New', type: 'step', sourceFile: 'editor' },
        'e1'
      )
      expect(useWorkflowStore.getState().selectedNodeId).toBe('new-2')
    })

    it('does nothing if edge not found', () => {
      setupWithGraph()
      useWorkflowStore.getState().addNode(
        { id: 'new-3', label: 'New', type: 'step', sourceFile: 'editor' },
        'nonexistent'
      )
      expect(getGraph().nodes).toHaveLength(3)
    })
  })

  describe('removeNode', () => {
    it('reconnects edges for simple chain (1 in, 1 out)', () => {
      setupWithGraph()
      useWorkflowStore.getState().removeNode('n2')

      const graph = getGraph()
      expect(graph.nodes).toHaveLength(2)
      expect(graph.nodes.find((n) => n.id === 'n2')).toBeUndefined()

      // n1 → n3 reconnected
      const reconnected = graph.edges.find((e) => e.source === 'n1' && e.target === 'n3')
      expect(reconnected).toBeDefined()
      expect(graph.edges).toHaveLength(1)
    })

    it('removes all edges for multi-connection nodes', () => {
      useWorkflowStore.setState({
        workflows: {
          status: 'success',
          data: [
            {
              ...mockGraph,
              nodes: [
                { id: 'a', label: 'A', type: 'step', sourceFile: 'test.yaml' },
                { id: 'b', label: 'B', type: 'step', sourceFile: 'test.yaml' },
                { id: 'c', label: 'C', type: 'step', sourceFile: 'test.yaml' },
                { id: 'd', label: 'D', type: 'step', sourceFile: 'test.yaml' }
              ],
              edges: [
                { id: 'e1', source: 'a', target: 'b', type: 'sequential' },
                { id: 'e2', source: 'c', target: 'b', type: 'sequential' },
                { id: 'e3', source: 'b', target: 'd', type: 'sequential' }
              ]
            }
          ]
        },
        selectedWorkflowId: 'wf-1',
        isEditMode: true,
        unsavedChanges: false
      })

      // b has 2 incoming + 1 outgoing → no reconnection, just remove all edges to/from b
      useWorkflowStore.getState().removeNode('b')
      const graph = getGraph()
      expect(graph.nodes).toHaveLength(3)
      expect(graph.edges).toHaveLength(0)
    })

    it('clears selectedNodeId if deleted node was selected', () => {
      setupWithGraph()
      useWorkflowStore.setState({ selectedNodeId: 'n2' })
      useWorkflowStore.getState().removeNode('n2')
      expect(useWorkflowStore.getState().selectedNodeId).toBeNull()
    })
  })

  describe('addEdge', () => {
    it('adds a new edge', () => {
      setupWithGraph()
      useWorkflowStore.getState().addEdge({
        id: 'e-new',
        source: 'n1',
        target: 'n3',
        type: 'conditional'
      })

      const graph = getGraph()
      expect(graph.edges).toHaveLength(3)
      expect(graph.edges.find((e) => e.id === 'e-new')).toBeDefined()
    })

    it('rejects self-loops', () => {
      setupWithGraph()
      useWorkflowStore.getState().addEdge({
        id: 'e-self',
        source: 'n1',
        target: 'n1',
        type: 'sequential'
      })
      expect(getGraph().edges).toHaveLength(2)
    })

    it('rejects duplicate edges', () => {
      setupWithGraph()
      useWorkflowStore.getState().addEdge({
        id: 'e-dup',
        source: 'n1',
        target: 'n2',
        type: 'sequential'
      })
      expect(getGraph().edges).toHaveLength(2)
    })
  })

  describe('removeEdge', () => {
    it('removes an edge', () => {
      setupWithGraph()
      useWorkflowStore.getState().removeEdge('e1')
      expect(getGraph().edges).toHaveLength(1)
      expect(getGraph().edges.find((e) => e.id === 'e1')).toBeUndefined()
    })
  })

  describe('reconnectEdge', () => {
    it('updates edge source and target', () => {
      setupWithGraph()
      useWorkflowStore.getState().reconnectEdge('e1', 'n1', 'n3')

      const edge = getGraph().edges.find((e) => e.id === 'e1')!
      expect(edge.source).toBe('n1')
      expect(edge.target).toBe('n3')
    })

    it('rejects self-loops on reconnect', () => {
      setupWithGraph()
      useWorkflowStore.getState().reconnectEdge('e1', 'n1', 'n1')

      const edge = getGraph().edges.find((e) => e.id === 'e1')!
      expect(edge.target).toBe('n2') // unchanged
    })

    it('rejects duplicates on reconnect', () => {
      setupWithGraph()
      // e1: n1→n2, e2: n2→n3. Try reconnecting e1 to n2→n3 (duplicate of e2)
      useWorkflowStore.getState().reconnectEdge('e1', 'n2', 'n3')

      const edge = getGraph().edges.find((e) => e.id === 'e1')!
      expect(edge.source).toBe('n1') // unchanged
    })
  })

  describe('execution state', () => {
    it('startExecution initializes all nodes to pending', () => {
      setupWithGraph()
      useWorkflowStore.getState().startExecution('wf-1')

      const state = useWorkflowStore.getState()
      expect(state.executionState).not.toBeNull()
      expect(state.executionState!.nodeStatuses.n1).toBe('pending')
      expect(state.executionState!.nodeStatuses.n2).toBe('pending')
      expect(state.executionState!.nodeStatuses.n3).toBe('pending')
    })

    it('startExecution disables edit mode', () => {
      setupWithGraph()
      useWorkflowStore.setState({ isEditMode: true })
      useWorkflowStore.getState().startExecution('wf-1')
      expect(useWorkflowStore.getState().isEditMode).toBe(false)
    })

    it('updateNodeStatus updates the correct node', () => {
      setupWithGraph()
      useWorkflowStore.getState().startExecution('wf-1')
      useWorkflowStore.getState().updateNodeStatus('n1', 'active')

      const state = useWorkflowStore.getState()
      expect(state.executionState!.nodeStatuses.n1).toBe('active')
    })

    it('updateNodeStatus sets completedAt when all done', () => {
      setupWithGraph()
      useWorkflowStore.getState().startExecution('wf-1')
      useWorkflowStore.getState().updateNodeStatus('n1', 'done')
      useWorkflowStore.getState().updateNodeStatus('n2', 'done')
      useWorkflowStore.getState().updateNodeStatus('n3', 'done')

      const state = useWorkflowStore.getState()
      expect(state.executionState!.completedAt).toBeDefined()
    })

    it('clearExecution resets execution state', () => {
      setupWithGraph()
      useWorkflowStore.getState().startExecution('wf-1')
      useWorkflowStore.getState().clearExecution()
      expect(useWorkflowStore.getState().executionState).toBeNull()
    })
  })
})
