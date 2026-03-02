export type FileChangeEvent = {
  path: string
  type: 'create' | 'modify' | 'delete'
  timestamp: number
  agentId?: string
}

export type WatcherOptions = {
  ignoredPatterns?: string[]
  stabilityThreshold?: number
}

export type WatcherStatus = 'idle' | 'watching' | 'error'
