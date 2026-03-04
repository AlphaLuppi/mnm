import { useCallback, useRef } from 'react'
import { useIpcStream } from '@renderer/shared/hooks/useIpcStream'
import { useContextStore } from '../context.store'
import { showFileChangeToast } from '../components/FileChangeToast'
import type { FileChangeNotification, NotificationLevel } from '../notification.types'

const DEDUP_WINDOW_MS = 500

export function useFileNotifications(
  notificationLevel: NotificationLevel = 'all'
): void {
  const markFileModified = useContextStore((s) => s.markFileModified)
  const incrementNotificationCount = useContextStore((s) => s.incrementNotificationCount)

  const recentNotifications = useRef<Map<string, number>>(new Map())

  const handleFileChange = useCallback(
    (data: { path: string; type: 'create' | 'modify' | 'delete'; agentId?: string }) => {
      // Only notify for agent-initiated changes on tracked context files
      if (!data.agentId) return

      const contextFile = useContextStore.getState().files.get(data.path)
      if (!contextFile) return

      // Deduplication: skip if same file notified within window
      const now = Date.now()
      const lastNotified = recentNotifications.current.get(data.path)
      if (lastNotified && now - lastNotified < DEDUP_WINDOW_MS) return
      recentNotifications.current.set(data.path, now)

      // Update store
      markFileModified(data.path, data.agentId)
      incrementNotificationCount()

      // Build notification
      const affectedAgentIds = contextFile.agentIds.filter(
        (id) => id !== data.agentId
      )
      const notification: FileChangeNotification = {
        agentId: data.agentId,
        agentName: data.agentId,
        filePath: data.path,
        fileName: contextFile.name,
        changeType: data.type,
        affectedAgentIds,
        timestamp: now
      }

      // Apply notification level filter
      if (notificationLevel === 'none') return
      if (
        notificationLevel === 'important' &&
        affectedAgentIds.length === 0 &&
        data.type !== 'delete'
      ) {
        return
      }

      showFileChangeToast(notification)
    },
    [markFileModified, incrementNotificationCount, notificationLevel]
  )

  useIpcStream('stream:file-change', handleFileChange)
}
