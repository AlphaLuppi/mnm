import { create } from 'zustand'
import type { ProjectHierarchy } from '@shared/types/story.types'
import type { AsyncState } from '@shared/types/async-state.types'
import type { NavigationLevel, BreadcrumbSegment } from '@shared/types/navigation.types'

type HierarchyStoreState = {
  hierarchy: AsyncState<ProjectHierarchy>
  selectedEpicId: string | null
  selectedStoryId: string | null
  selectedTaskId: string | null
  expandedNodes: Set<string>

  loadHierarchy: () => Promise<void>
  selectEpic: (id: string) => void
  selectStory: (epicId: string, storyId: string) => void
  selectTask: (id: string) => void
  navigateUp: () => void
  navigateTo: (level: NavigationLevel, id: string) => void
  toggleExpanded: (nodeId: string) => void
  currentLevel: () => NavigationLevel
  breadcrumb: () => BreadcrumbSegment[]
}

export const useHierarchyStore = create<HierarchyStoreState>((set, get) => ({
  hierarchy: { status: 'idle' },
  selectedEpicId: null,
  selectedStoryId: null,
  selectedTaskId: null,
  expandedNodes: new Set<string>(),

  loadHierarchy: async () => {
    set({ hierarchy: { status: 'loading' } })
    try {
      const data = await window.electronAPI.invoke('stories:list', undefined as never)
      set({ hierarchy: { status: 'success', data: data as ProjectHierarchy } })
    } catch {
      set({
        hierarchy: {
          status: 'error',
          error: {
            code: 'HIERARCHY_LOAD_FAILED',
            message: 'Impossible de charger la hierarchie du projet',
            source: 'hierarchy-store'
          }
        }
      })
    }
  },

  selectEpic: (id) =>
    set((state) => ({
      selectedEpicId: id,
      selectedStoryId: null,
      selectedTaskId: null,
      expandedNodes: new Set([...state.expandedNodes, id])
    })),

  selectStory: (epicId, storyId) =>
    set((state) => ({
      selectedEpicId: epicId,
      selectedStoryId: storyId,
      selectedTaskId: null,
      expandedNodes: new Set([...state.expandedNodes, epicId, storyId])
    })),

  selectTask: (id) => set({ selectedTaskId: id }),

  navigateUp: () => {
    const state = get()
    if (state.selectedTaskId) {
      set({ selectedTaskId: null })
    } else if (state.selectedStoryId) {
      set({ selectedStoryId: null, selectedTaskId: null })
    } else if (state.selectedEpicId) {
      set({ selectedEpicId: null, selectedStoryId: null, selectedTaskId: null })
    }
  },

  navigateTo: (level, id) => {
    const state = get()
    if (state.hierarchy.status !== 'success') return

    switch (level) {
      case 'project':
        set({ selectedEpicId: null, selectedStoryId: null, selectedTaskId: null })
        break
      case 'epic':
        state.selectEpic(id)
        break
      case 'story': {
        const epic = state.hierarchy.data.epics.find((e) =>
          e.stories.some((s) => s.id === id)
        )
        if (epic) state.selectStory(epic.id, id)
        break
      }
      case 'task':
        state.selectTask(id)
        break
    }
  },

  toggleExpanded: (nodeId) =>
    set((state) => {
      const next = new Set(state.expandedNodes)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return { expandedNodes: next }
    }),

  currentLevel: () => {
    const state = get()
    if (state.selectedTaskId) return 'task'
    if (state.selectedStoryId) return 'story'
    if (state.selectedEpicId) return 'epic'
    return 'project'
  },

  breadcrumb: () => {
    const state = get()
    const segments: BreadcrumbSegment[] = []
    if (state.hierarchy.status !== 'success') return segments

    const data = state.hierarchy.data
    segments.push({ id: 'project', label: data.projectName, level: 'project' })

    if (state.selectedEpicId) {
      const epic = data.epics.find((e) => e.id === state.selectedEpicId)
      if (epic) segments.push({ id: epic.id, label: `Epic ${epic.number}`, level: 'epic' })
    }

    if (state.selectedStoryId && state.selectedEpicId) {
      const epic = data.epics.find((e) => e.id === state.selectedEpicId)
      const story = epic?.stories.find((s) => s.id === state.selectedStoryId)
      if (story) segments.push({ id: story.id, label: `Story ${story.number}`, level: 'story' })
    }

    if (state.selectedTaskId && state.selectedStoryId) {
      const epic = data.epics.find((e) => e.id === state.selectedEpicId)
      const story = epic?.stories.find((s) => s.id === state.selectedStoryId)
      const task = story?.tasks.find((t) => t.id === state.selectedTaskId)
      if (task) segments.push({ id: task.id, label: task.title, level: 'task' })
    }

    return segments
  }
}))
