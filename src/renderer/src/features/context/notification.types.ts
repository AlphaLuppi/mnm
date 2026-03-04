export type FileChangeNotification = {
  agentId: string
  agentName: string
  filePath: string
  fileName: string
  changeType: 'create' | 'modify' | 'delete'
  affectedAgentIds: string[]
  timestamp: number
}

export type NotificationLevel = 'all' | 'important' | 'none'
