import { create } from 'zustand'
import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from '@shared/types/workflow.types'
import type { AsyncState } from '@shared/types/async-state.types'

type WorkflowState = {
  workflows: AsyncState<WorkflowGraph[]>
  selectedWorkflowId: string | null
  selectedNodeId: string | null
  isEditMode: boolean
  unsavedChanges: boolean
  saveState: AsyncState<void>

  loadWorkflows: () => Promise<void>
  selectWorkflow: (id: string) => void
  selectNode: (id: string | null) => void
  toggleEditMode: () => void
  saveWorkflow: () => Promise<void>

  updateNode: (nodeId: string, updates: Partial<WorkflowNode>) => void
  addNode: (node: WorkflowNode, splitEdgeId: string) => void
  removeNode: (nodeId: string) => void

  addEdge: (edge: WorkflowEdge) => void
  removeEdge: (edgeId: string) => void
  reconnectEdge: (edgeId: string, newSource: string, newTarget: string) => void
}

function getSelectedGraph(state: WorkflowState): WorkflowGraph | null {
  if (state.workflows.status !== 'success') return null
  return state.workflows.data.find((w) => w.id === state.selectedWorkflowId) ?? null
}

function updateGraphInState(
  state: WorkflowState,
  updatedGraph: WorkflowGraph
): Partial<WorkflowState> {
  if (state.workflows.status !== 'success') return {}
  return {
    workflows: {
      status: 'success' as const,
      data: state.workflows.data.map((w) => (w.id === updatedGraph.id ? updatedGraph : w))
    },
    unsavedChanges: true
  }
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: { status: 'idle' },
  selectedWorkflowId: null,
  selectedNodeId: null,
  isEditMode: false,
  unsavedChanges: false,
  saveState: { status: 'idle' },

  loadWorkflows: async () => {
    set({ workflows: { status: 'loading' } })
    try {
      const graphs = await window.electronAPI.invoke('workflow:list', undefined)
      set({
        workflows: { status: 'success', data: graphs },
        selectedWorkflowId: graphs.length > 0 ? graphs[0].id : null
      })
    } catch {
      set({
        workflows: {
          status: 'error',
          error: {
            code: 'WORKFLOW_LOAD_FAILED',
            message: 'Impossible de charger les workflows',
            source: 'workflow-store'
          }
        }
      })
    }
  },

  selectWorkflow: (id) => set({ selectedWorkflowId: id, selectedNodeId: null }),
  selectNode: (id) => set({ selectedNodeId: id }),
  toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),

  saveWorkflow: async () => {
    const state = get()
    const graph = getSelectedGraph(state)
    if (!graph) return

    set({ saveState: { status: 'loading' } })
    try {
      await window.electronAPI.invoke('workflow:save', {
        workflowId: graph.id,
        graph
      })
      set({
        saveState: { status: 'success', data: undefined },
        unsavedChanges: false
      })
    } catch {
      set({
        saveState: {
          status: 'error',
          error: {
            code: 'WORKFLOW_SAVE_FAILED',
            message: 'Impossible de sauvegarder le workflow',
            source: 'workflow-store'
          }
        }
      })
    }
  },

  updateNode: (nodeId, updates) => {
    const state = get()
    const graph = getSelectedGraph(state)
    if (!graph) return

    const updatedGraph = {
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates, id: nodeId } : n))
    }
    set(updateGraphInState(state, updatedGraph))
  },

  addNode: (newNode, splitEdgeId) => {
    const state = get()
    const graph = getSelectedGraph(state)
    if (!graph) return

    const edgeToSplit = graph.edges.find((e) => e.id === splitEdgeId)
    if (!edgeToSplit) return

    const newEdges = graph.edges
      .filter((e) => e.id !== splitEdgeId)
      .concat([
        {
          id: `edge-${edgeToSplit.source}-${newNode.id}`,
          source: edgeToSplit.source,
          target: newNode.id,
          type: 'sequential' as const
        },
        {
          id: `edge-${newNode.id}-${edgeToSplit.target}`,
          source: newNode.id,
          target: edgeToSplit.target,
          type: 'sequential' as const
        }
      ])

    const updatedGraph = {
      ...graph,
      nodes: [...graph.nodes, newNode],
      edges: newEdges
    }
    set({
      ...updateGraphInState(state, updatedGraph),
      selectedNodeId: newNode.id
    })
  },

  removeNode: (nodeId) => {
    const state = get()
    const graph = getSelectedGraph(state)
    if (!graph) return

    const incomingEdges = graph.edges.filter((e) => e.target === nodeId)
    const outgoingEdges = graph.edges.filter((e) => e.source === nodeId)

    let newEdges = graph.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)

    // Simple chain: one incoming + one outgoing → reconnect
    if (incomingEdges.length === 1 && outgoingEdges.length === 1) {
      newEdges = [
        ...newEdges,
        {
          id: `edge-${incomingEdges[0].source}-${outgoingEdges[0].target}`,
          source: incomingEdges[0].source,
          target: outgoingEdges[0].target,
          type: 'sequential' as const
        }
      ]
    }

    const updatedGraph = {
      ...graph,
      nodes: graph.nodes.filter((n) => n.id !== nodeId),
      edges: newEdges
    }
    set({
      ...updateGraphInState(state, updatedGraph),
      selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
    })
  },

  addEdge: (edge) => {
    const state = get()
    const graph = getSelectedGraph(state)
    if (!graph) return

    // No self-loops
    if (edge.source === edge.target) return
    // No duplicates
    if (graph.edges.some((e) => e.source === edge.source && e.target === edge.target)) return

    const updatedGraph = {
      ...graph,
      edges: [...graph.edges, edge]
    }
    set(updateGraphInState(state, updatedGraph))
  },

  removeEdge: (edgeId) => {
    const state = get()
    const graph = getSelectedGraph(state)
    if (!graph) return

    const updatedGraph = {
      ...graph,
      edges: graph.edges.filter((e) => e.id !== edgeId)
    }
    set(updateGraphInState(state, updatedGraph))
  },

  reconnectEdge: (edgeId, newSource, newTarget) => {
    const state = get()
    const graph = getSelectedGraph(state)
    if (!graph) return

    // No self-loops
    if (newSource === newTarget) return
    // No duplicates (excluding the edge being reconnected)
    if (
      graph.edges.some(
        (e) => e.id !== edgeId && e.source === newSource && e.target === newTarget
      )
    )
      return

    const updatedGraph = {
      ...graph,
      edges: graph.edges.map((e) =>
        e.id === edgeId ? { ...e, source: newSource, target: newTarget } : e
      )
    }
    set(updateGraphInState(state, updatedGraph))
  }
}))
