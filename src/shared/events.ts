import type { AgentStatus, BlockingContext } from './types/agent.types'
import type { ChatEntry } from './types/chat.types'

// Main process events (EventEmitter)
export type MainEvents = {
  'agent:output': { agentId: string; data: string; timestamp: number }
  'agent:status': {
    agentId: string
    status: AgentStatus
    lastError?: string
    progress?: { completed: number; total: number }
    blockingContext?: BlockingContext
  }
  'agent:chat-entry': ChatEntry
  'file:changed': { path: string; type: 'create' | 'modify' | 'delete'; agentId?: string }
  'drift:detected': {
    id: string
    severity: 'critical' | 'warning' | 'info'
    documents: [string, string]
  }
  'git:commit': { hash: string; message: string }
  'workflow:node-status': {
    workflowId: string
    nodeId: string
    status: 'pending' | 'active' | 'done' | 'error'
  }
  'test:result': {
    testId: string
    specId: string
    status: 'pass' | 'fail' | 'pending'
    duration: number
  }
}

// Renderer events (mitt)
export type RendererEvents = {
  'nav:select': { level: 'project' | 'epic' | 'story' | 'task'; id: string }
  'panel:resize': { panel: 'context' | 'agents' | 'tests'; width: number }
  'agent:launch': { task: string; context: string[] }
}
