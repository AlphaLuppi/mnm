import { useEffect } from 'react'
import { useTimelineStore } from '../timeline.store'
import type { TimelineEvent } from '@shared/types/timeline.types'

export function useTimelineStream(): void {
  const addEvent = useTimelineStore((state) => state.addEvent)

  useEffect(() => {
    const cleanupChat = window.electronAPI.on('stream:agent-chat', (entry) => {
      if (entry.checkpoint) {
        const timelineEvent: TimelineEvent = {
          id: `tl-${entry.id}`,
          agentId: entry.agentId,
          category: 'checkpoint',
          label: entry.content.slice(0, 60),
          description: entry.content,
          timestamp: entry.timestamp,
          checkpointId: entry.checkpoint
        }
        addEvent(timelineEvent)
      }
    })

    const cleanupStatus = window.electronAPI.on('stream:agent-status', (data) => {
      const timelineEvent: TimelineEvent = {
        id: `tl-status-${data.agentId}-${Date.now()}`,
        agentId: data.agentId,
        category: 'status-change',
        label: `Status: ${data.status}`,
        description: data.lastError ?? `Agent status changed to ${data.status}`,
        timestamp: Date.now()
      }
      addEvent(timelineEvent)
    })

    return () => {
      cleanupChat()
      cleanupStatus()
    }
  }, [addEvent])
}
