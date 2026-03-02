export type TimelineEventCategory =
  | 'checkpoint'
  | 'file-write'
  | 'tool-call'
  | 'error'
  | 'status-change'
  | 'progress'

export type TimelineEvent = {
  id: string
  agentId: string
  category: TimelineEventCategory
  label: string
  description?: string
  timestamp: number
  checkpointId?: string
  metadata?: Record<string, unknown>
}
