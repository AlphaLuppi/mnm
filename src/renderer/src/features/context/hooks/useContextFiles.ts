import { useCallback, useEffect } from 'react'
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream'
import { useContextStore } from '../context.store'
import { useHierarchyStore } from '@renderer/stores/hierarchy.store'

export function useContextFiles(): void {
  const markFileModified = useContextStore((s) => s.markFileModified)
  const setStoryFilter = useContextStore((s) => s.setStoryFilter)
  const selectedStoryId = useHierarchyStore((s) => s.selectedStoryId)

  // Sync story filter with hierarchy store
  useEffect(() => {
    setStoryFilter(selectedStoryId)
  }, [selectedStoryId, setStoryFilter])

  // Handle file change events from file watcher
  const handleFileChange = useCallback(
    (data: { path: string; type: 'create' | 'modify' | 'delete'; agentId?: string }) => {
      if (data.type === 'modify') {
        markFileModified(data.path, data.agentId)
      }
    },
    [markFileModified]
  )

  useIpcStream('stream:file-change', handleFileChange)
}
