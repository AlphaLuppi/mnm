import { describe, it, expect, beforeEach } from 'vitest'
import { useHierarchyStore } from '@renderer/stores/hierarchy.store'

describe('cockpit navigation', () => {
  beforeEach(() => {
    useHierarchyStore.setState({
      selectedEpicId: null,
      selectedStoryId: null,
      selectedTaskId: null,
      detailView: null
    })
  })

  it('navigateToAgent sets detail view with agent type', () => {
    useHierarchyStore.getState().navigateToAgent('agent-123')
    expect(useHierarchyStore.getState().detailView).toEqual({ type: 'agent', id: 'agent-123' })
  })

  it('navigateToDrift sets detail view with drift type', () => {
    useHierarchyStore.getState().navigateToDrift('drift-456')
    expect(useHierarchyStore.getState().detailView).toEqual({ type: 'drift', id: 'drift-456' })
  })

  it('clearDetailView clears the detail view', () => {
    useHierarchyStore.getState().navigateToAgent('agent-123')
    useHierarchyStore.getState().clearDetailView()
    expect(useHierarchyStore.getState().detailView).toBeNull()
  })

  it('navigateUp clears detail view if set', () => {
    useHierarchyStore.getState().navigateToAgent('agent-123')
    useHierarchyStore.getState().navigateUp()
    expect(useHierarchyStore.getState().detailView).toBeNull()
  })

  it('navigateUp works normally when no detail view', () => {
    useHierarchyStore.setState({ selectedEpicId: 'epic-1', selectedStoryId: 'story-1.1' })
    useHierarchyStore.getState().navigateUp()
    expect(useHierarchyStore.getState().selectedStoryId).toBeNull()
    expect(useHierarchyStore.getState().selectedEpicId).toBe('epic-1')
  })

  it('navigateTo story finds epic and selects story', () => {
    useHierarchyStore.setState({
      hierarchy: {
        status: 'success',
        data: {
          projectName: 'test',
          epics: [
            {
              id: 'epic-1',
              number: 1,
              title: 'Foundation',
              description: '',
              stories: [
                { id: 'story-1.1', epicId: 'epic-1', number: '1.1', title: 'Scaffold', tasks: [] }
              ]
            }
          ]
        }
      }
    })

    useHierarchyStore.getState().navigateTo('story', 'story-1.1')
    expect(useHierarchyStore.getState().selectedStoryId).toBe('story-1.1')
    expect(useHierarchyStore.getState().selectedEpicId).toBe('epic-1')
  })
})
