import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkflowStore } from '../workflow.store'
import { validateConnection } from './useEdgeManagement'
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
  edges: [{ id: 'e1', source: 'a', target: 'b', type: 'sequential' }]
}

describe('useEdgeManagement', () => {
  beforeEach(() => {
    useWorkflowStore.setState({
      workflows: { status: 'success', data: [mockGraph] },
      selectedWorkflowId: 'wf-1',
      selectedNodeId: null,
      isEditMode: true,
      unsavedChanges: false
    })
  })

  describe('validateConnection', () => {
    it('accepts valid connection', () => {
      expect(validateConnection('a', 'b')).toBe(true)
    })

    it('rejects self-loops', () => {
      expect(validateConnection('a', 'a')).toBe(false)
    })

    it('rejects empty source or target', () => {
      expect(validateConnection('', 'b')).toBe(false)
      expect(validateConnection('a', '')).toBe(false)
    })
  })

  describe('store addEdge', () => {
    it('creates new edge', () => {
      useWorkflowStore.getState().addEdge({
        id: 'e-new',
        source: 'b',
        target: 'c',
        type: 'sequential'
      })

      const state = useWorkflowStore.getState()
      if (state.workflows.status !== 'success') throw new Error()
      expect(state.workflows.data[0].edges).toHaveLength(2)
    })

    it('rejects duplicate edges', () => {
      useWorkflowStore.getState().addEdge({
        id: 'e-dup',
        source: 'a',
        target: 'b',
        type: 'sequential'
      })

      const state = useWorkflowStore.getState()
      if (state.workflows.status !== 'success') throw new Error()
      expect(state.workflows.data[0].edges).toHaveLength(1)
    })
  })

  describe('store reconnectEdge', () => {
    it('updates edge endpoints', () => {
      useWorkflowStore.getState().reconnectEdge('e1', 'a', 'c')

      const state = useWorkflowStore.getState()
      if (state.workflows.status !== 'success') throw new Error()
      const edge = state.workflows.data[0].edges.find((e) => e.id === 'e1')!
      expect(edge.target).toBe('c')
    })

    it('rejects self-loop reconnection', () => {
      useWorkflowStore.getState().reconnectEdge('e1', 'a', 'a')

      const state = useWorkflowStore.getState()
      if (state.workflows.status !== 'success') throw new Error()
      const edge = state.workflows.data[0].edges.find((e) => e.id === 'e1')!
      expect(edge.target).toBe('b') // unchanged
    })
  })
})
