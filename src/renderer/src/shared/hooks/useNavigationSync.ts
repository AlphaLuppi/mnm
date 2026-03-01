import { useHierarchyStore } from '@renderer/stores/hierarchy.store'
import type { NavigationLevel } from '@shared/types/navigation.types'

export type PaneSyncData = {
  level: NavigationLevel
  label: string
  epicId: string | null
  storyId: string | null
  taskId: string | null
}

export function useNavigationSync(): PaneSyncData {
  const level = useHierarchyStore((s) => s.currentLevel())
  const breadcrumb = useHierarchyStore((s) => s.breadcrumb())
  const epicId = useHierarchyStore((s) => s.selectedEpicId)
  const storyId = useHierarchyStore((s) => s.selectedStoryId)
  const taskId = useHierarchyStore((s) => s.selectedTaskId)

  return {
    level,
    label: breadcrumb.map((seg) => seg.label).join(' > ') || 'Projet',
    epicId,
    storyId,
    taskId
  }
}
