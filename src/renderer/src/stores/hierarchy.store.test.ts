import { describe, it, expect, beforeEach } from 'vitest'
import { useHierarchyStore } from './hierarchy.store'
import type { ProjectHierarchy } from '@shared/types/story.types'

const MOCK_HIERARCHY: ProjectHierarchy = {
  projectName: 'mnm',
  epics: [
    {
      id: 'epic-1',
      number: 1,
      title: 'Foundation',
      description: '',
      stories: [
        {
          id: 'story-1.1',
          epicId: 'epic-1',
          number: '1.1',
          title: 'Scaffold',
          tasks: [
            { id: 'task-1.1.1', storyId: 'story-1.1', title: 'Init project', completed: true },
            { id: 'task-1.1.2', storyId: 'story-1.1', title: 'Setup IPC', completed: false }
          ]
        },
        {
          id: 'story-1.2',
          epicId: 'epic-1',
          number: '1.2',
          title: 'Layout',
          tasks: []
        }
      ]
    },
    {
      id: 'epic-2',
      number: 2,
      title: 'Agents',
      description: '',
      stories: []
    }
  ]
}

describe('useHierarchyStore', () => {
  beforeEach(() => {
    useHierarchyStore.setState({
      hierarchy: { status: 'success', data: MOCK_HIERARCHY },
      selectedEpicId: null,
      selectedStoryId: null,
      selectedTaskId: null,
      expandedNodes: new Set()
    })
  })

  it('should default to project level', () => {
    expect(useHierarchyStore.getState().currentLevel()).toBe('project')
  })

  it('should select an epic and update level', () => {
    useHierarchyStore.getState().selectEpic('epic-1')
    const state = useHierarchyStore.getState()

    expect(state.selectedEpicId).toBe('epic-1')
    expect(state.selectedStoryId).toBeNull()
    expect(state.currentLevel()).toBe('epic')
    expect(state.expandedNodes.has('epic-1')).toBe(true)
  })

  it('should select a story with its epic', () => {
    useHierarchyStore.getState().selectStory('epic-1', 'story-1.1')
    const state = useHierarchyStore.getState()

    expect(state.selectedEpicId).toBe('epic-1')
    expect(state.selectedStoryId).toBe('story-1.1')
    expect(state.currentLevel()).toBe('story')
  })

  it('should navigate up from story to epic', () => {
    useHierarchyStore.getState().selectStory('epic-1', 'story-1.1')
    useHierarchyStore.getState().navigateUp()

    expect(useHierarchyStore.getState().selectedStoryId).toBeNull()
    expect(useHierarchyStore.getState().selectedEpicId).toBe('epic-1')
    expect(useHierarchyStore.getState().currentLevel()).toBe('epic')
  })

  it('should navigate up from epic to project', () => {
    useHierarchyStore.getState().selectEpic('epic-1')
    useHierarchyStore.getState().navigateUp()

    expect(useHierarchyStore.getState().selectedEpicId).toBeNull()
    expect(useHierarchyStore.getState().currentLevel()).toBe('project')
  })

  it('should build breadcrumb for story level', () => {
    useHierarchyStore.getState().selectStory('epic-1', 'story-1.1')
    const crumbs = useHierarchyStore.getState().breadcrumb()

    expect(crumbs).toHaveLength(3)
    expect(crumbs[0]).toEqual({ id: 'project', label: 'mnm', level: 'project' })
    expect(crumbs[1]).toEqual({ id: 'epic-1', label: 'Epic 1', level: 'epic' })
    expect(crumbs[2]).toEqual({ id: 'story-1.1', label: 'Story 1.1', level: 'story' })
  })

  it('should toggle expanded nodes', () => {
    useHierarchyStore.getState().toggleExpanded('epic-1')
    expect(useHierarchyStore.getState().expandedNodes.has('epic-1')).toBe(true)

    useHierarchyStore.getState().toggleExpanded('epic-1')
    expect(useHierarchyStore.getState().expandedNodes.has('epic-1')).toBe(false)
  })

  it('should navigateTo story by finding its epic', () => {
    useHierarchyStore.getState().navigateTo('story', 'story-1.2')
    const state = useHierarchyStore.getState()

    expect(state.selectedEpicId).toBe('epic-1')
    expect(state.selectedStoryId).toBe('story-1.2')
  })
})
