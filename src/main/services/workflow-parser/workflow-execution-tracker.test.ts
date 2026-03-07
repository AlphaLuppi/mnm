import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { WorkflowExecutionTracker } from './workflow-execution-tracker'
import type { WorkflowGraph } from '@shared/types/workflow.types'

const mockGraph: WorkflowGraph = {
  id: 'wf-1',
  name: 'Test',
  sourceFile: 'test.yaml',
  sourceFormat: 'yaml',
  nodes: [
    { id: 'a', label: 'Step A', type: 'step', sourceFile: 'test.yaml' },
    { id: 'b', label: 'Step B', type: 'step', sourceFile: 'test.yaml' },
    { id: 'c', label: 'Step C', type: 'step', sourceFile: 'test.yaml' }
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', type: 'sequential' },
    { id: 'e2', source: 'b', target: 'c', type: 'sequential' }
  ],
  entryNodeId: 'a'
}

describe('WorkflowExecutionTracker', () => {
  let eventBus: EventEmitter
  let tracker: WorkflowExecutionTracker

  beforeEach(() => {
    eventBus = new EventEmitter()
    tracker = new WorkflowExecutionTracker(eventBus)
  })

  it('startTracking initializes all nodes to pending with entry node active', () => {
    const statusHandler = vi.fn()
    eventBus.on('workflow:node-status', statusHandler)

    tracker.startTracking('wf-1', mockGraph)

    const state = tracker.getExecutionState('wf-1')!
    expect(state.get('a')).toBe('active')
    expect(state.get('b')).toBe('pending')
    expect(state.get('c')).toBe('pending')
    expect(statusHandler).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'wf-1', nodeId: 'a', status: 'active' })
    )
  })

  it('updateNodeStatus changes node status and emits event', () => {
    const statusHandler = vi.fn()
    eventBus.on('workflow:node-status', statusHandler)

    tracker.startTracking('wf-1', mockGraph)
    tracker.updateNodeStatus('wf-1', 'a', 'done')

    const state = tracker.getExecutionState('wf-1')!
    expect(state.get('a')).toBe('done')
  })

  it('detects workflow completion when all nodes are done', () => {
    const completionHandler = vi.fn()
    eventBus.on('workflow:completed', completionHandler)

    tracker.startTracking('wf-1', mockGraph)
    tracker.updateNodeStatus('wf-1', 'a', 'done')
    tracker.updateNodeStatus('wf-1', 'b', 'done')
    tracker.updateNodeStatus('wf-1', 'c', 'done')

    expect(completionHandler).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: 'wf-1' })
    )
  })

  it('stopTracking removes execution state', () => {
    tracker.startTracking('wf-1', mockGraph)
    tracker.stopTracking('wf-1')
    expect(tracker.getExecutionState('wf-1')).toBeNull()
  })

  it('correlates agent output to node labels', () => {
    const statusHandler = vi.fn()
    eventBus.on('workflow:node-status', statusHandler)

    tracker.startTracking('wf-1', mockGraph)
    statusHandler.mockClear()

    // Emit agent output that includes a step label
    eventBus.emit('agent:output', { agentId: 'agent-1', data: 'Working on step b...' })

    const state = tracker.getExecutionState('wf-1')!
    expect(state.get('b')).toBe('active')
  })

  it('dispose cleans up', () => {
    tracker.startTracking('wf-1', mockGraph)
    tracker.dispose()
    expect(tracker.getExecutionState('wf-1')).toBeNull()
  })
})
