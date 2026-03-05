import { useEffect, useCallback, useRef, useState } from 'react'
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream'
import type { ProjectHierarchy } from '@shared/types/story.types'
import type { AsyncState } from '@shared/types/async-state.types'

export type StoryProgressItem = {
  id: string
  number: string
  title: string
  epicId: string
  epicTitle: string
  tasksTotal: number
  tasksCompleted: number
  ratio: number
}

export function useStoriesProgress(): AsyncState<StoryProgressItem[]> {
  const [state, setState] = useState<AsyncState<StoryProgressItem[]>>({ status: 'loading' })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchStories = useCallback(async () => {
    try {
      setState({ status: 'loading' })
      const hierarchy: ProjectHierarchy = await window.electronAPI.invoke('stories:list', undefined)
      const items = flattenHierarchy(hierarchy)
      setState({ status: 'success', data: items })
    } catch {
      setState({
        status: 'error',
        error: {
          code: 'STORIES_FETCH_FAILED',
          message: 'Impossible de charger les stories',
          source: 'dashboard'
        }
      })
    }
  }, [])

  useEffect(() => {
    fetchStories()
  }, [fetchStories])

  useIpcStream(
    'stream:file-change',
    useCallback(
      (data) => {
        if (data.path.includes('_bmad-output') && data.path.endsWith('.md')) {
          if (debounceRef.current) {
            clearTimeout(debounceRef.current)
          }
          debounceRef.current = setTimeout(() => {
            fetchStories()
          }, 300)
        }
      },
      [fetchStories]
    )
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return state
}

function flattenHierarchy(hierarchy: ProjectHierarchy): StoryProgressItem[] {
  const items: StoryProgressItem[] = []
  for (const epic of hierarchy.epics) {
    for (const story of epic.stories) {
      const tasksTotal = story.tasks.length
      const tasksCompleted = story.tasks.filter((t) => t.completed).length
      items.push({
        id: story.id,
        number: story.number,
        title: story.title,
        epicId: epic.id,
        epicTitle: epic.title,
        tasksTotal,
        tasksCompleted,
        ratio: tasksTotal > 0 ? tasksCompleted / tasksTotal : 0
      })
    }
  }
  return items
}
