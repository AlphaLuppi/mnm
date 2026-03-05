import { useCallback } from 'react'
import { useHierarchyStore } from '@renderer/stores/hierarchy.store'

export function useCockpitNavigation() {
  const navigateToAgent = useHierarchyStore((s) => s.navigateToAgent)
  const navigateToDrift = useHierarchyStore((s) => s.navigateToDrift)
  const navigateTo = useHierarchyStore((s) => s.navigateTo)
  const clearDetailView = useHierarchyStore((s) => s.clearDetailView)

  const goToAgent = useCallback(
    (agentId: string) => navigateToAgent(agentId),
    [navigateToAgent]
  )

  const goToDrift = useCallback(
    (driftId: string) => navigateToDrift(driftId),
    [navigateToDrift]
  )

  const goToStory = useCallback(
    (storyId: string) => navigateTo('story', storyId),
    [navigateTo]
  )

  const goToProject = useCallback(() => {
    clearDetailView()
    navigateTo('project', '')
  }, [clearDetailView, navigateTo])

  return { goToAgent, goToDrift, goToStory, goToProject }
}
