import type { AgentStatus } from './ipc-channels'

// Main process events (EventEmitter)
export type MainEvents = {
  'agent:output': { agentId: string; data: string; timestamp: number }
  'agent:status': { agentId: string; status: AgentStatus }
  'agent:chat-entry': {
    agentId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    checkpoint?: string
    timestamp: number
  }
  'file:changed': { path: string; type: 'create' | 'modify' | 'delete' }
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
