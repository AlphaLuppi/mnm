export const AgentStatus = {
  LAUNCHING: 'LAUNCHING',
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  CRASHED: 'CRASHED'
} as const

export type AgentStatus = (typeof AgentStatus)[keyof typeof AgentStatus]

export type AgentInfo = {
  id: string
  task: string
  status: AgentStatus
  contextFiles: string[]
  startedAt: number
  stoppedAt?: number
  lastOutputAt?: number
  lastError?: string
  progress?: {
    completed: number
    total: number
  }
}

export type BlockingContext = {
  lastMessage: string
  timestamp: number
  stderrSnippet?: string
  checkpointId?: string
  reason: 'timeout' | 'error-pattern' | 'stderr-error'
}

export type AgentLaunchParams = {
  task: string
  context: string[]
  workingDirectory?: string
}
