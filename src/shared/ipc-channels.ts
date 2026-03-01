// IPC Channel type maps — shared between main, preload, and renderer.
// Only type declarations here. Handlers implemented by individual stories.

// Re-export project types used in IPC channels
import type { ProjectOpenResult } from './types/project.types'
export type { ProjectInfo, BmadStructure, ProjectOpenResult } from './types/project.types'

export type GitStatus = {
  branch: string
  modified: string[]
  staged: string[]
}

export type AgentStatus = 'launching' | 'active' | 'blocked' | 'stopping' | 'stopped' | 'crashed'

export type DriftReport = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  summary: string
  confidence: number
}

export type ChatEntry = {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  checkpoint?: string
}

export type StoryProgress = {
  key: string
  title: string
  status: string
  tasksTotal: number
  tasksDone: number
}

export type WorkflowGraph = {
  nodes: unknown[]
  edges: unknown[]
}

export type TestInfo = {
  id: string
  name: string
  specId: string
  status: 'pass' | 'fail' | 'pending'
}

// Request-Response (renderer → main → response)
export type IpcInvokeChannels = {
  'project:open': { args: { path: string }; result: ProjectOpenResult }
  'git:status': { args: void; result: GitStatus }
  'git:log': { args: { count: number }; result: unknown }
  'git:show-file': { args: { path: string; commitHash: string }; result: string }
  'agent:launch': { args: { task: string; context: string[] }; result: { agentId: string } }
  'agent:stop': { args: { agentId: string }; result: void }
  'agent:get-chat': {
    args: { agentId: string; fromCheckpoint?: string }
    result: ChatEntry[]
  }
  'drift:check': { args: { docA: string; docB: string }; result: DriftReport }
  'drift:resolve': {
    args: { driftId: string; action: 'fix-source' | 'fix-derived' | 'ignore'; content?: string }
    result: void
  }
  'stories:list': { args: void; result: StoryProgress[] }
  'workflow:save': { args: { workflowId: string; graph: WorkflowGraph }; result: void }
  'test:run': {
    args: { specId?: string; scope: 'unit' | 'integration' | 'e2e' }
    result: { runId: string }
  }
  'test:list': { args: { specId?: string }; result: TestInfo[] }
}

// Streaming (main → renderer, push)
export type IpcStreamChannels = {
  'stream:agent-output': { agentId: string; data: string; timestamp: number }
  'stream:agent-chat': {
    agentId: string
    role: 'user' | 'assistant' | 'system'
    content: string
    checkpoint?: string
    timestamp: number
  }
  'stream:file-change': {
    path: string
    type: 'create' | 'modify' | 'delete'
    agentId?: string
  }
  'stream:drift-alert': { id: string; severity: string; summary: string }
  'stream:agent-status': { agentId: string; status: AgentStatus }
  'stream:workflow-node': {
    workflowId: string
    nodeId: string
    status: 'pending' | 'active' | 'done' | 'error'
  }
  'stream:test-result': {
    testId: string
    specId: string
    status: 'pass' | 'fail' | 'pending'
    duration: number
    output?: string
  }
}
