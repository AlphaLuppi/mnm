// IPC Channel type maps — shared between main, preload, and renderer.
// Only type declarations here. Handlers implemented by individual stories.

// Re-export project types used in IPC channels
import type { ProjectOpenResult } from './types/project.types'
import type { ProjectHierarchy } from './types/story.types'
import type { AgentStatus, AgentInfo, AgentLaunchParams, BlockingContext } from './types/agent.types'
import type { ChatEntry } from './types/chat.types'
import type { DriftReport as DriftReportFull } from './types/drift.types'
export type { ProjectInfo, BmadStructure, ProjectOpenResult } from './types/project.types'
export type { ProjectHierarchy } from './types/story.types'
export type { AgentStatus, AgentInfo, AgentLaunchParams, BlockingContext } from './types/agent.types'
export type { ChatEntry, ChatRole } from './types/chat.types'

export type GitFileStatus = {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

export type GitStatus = {
  current: string | null
  tracking: string | null
  files: GitFileStatus[]
  ahead: number
  behind: number
}

export type DriftReport = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  summary: string
  confidence: number
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

export type ProjectFileInfo = {
  path: string
  name: string
  relativePath: string
  extension: string
}

// Request-Response (renderer → main → response)
export type IpcInvokeChannels = {
  'project:open': { args: { path: string }; result: ProjectOpenResult }
  'git:status': { args: void; result: GitStatus }
  'git:log': { args: { count: number }; result: unknown }
  'git:show-file': { args: { path: string; commitHash: string }; result: string }
  'agent:launch': { args: AgentLaunchParams; result: { agentId: string } }
  'agent:stop': { args: { agentId: string }; result: void }
  'agent:list': { args: void; result: AgentInfo[] }
  'agent:get-chat': {
    args: { agentId: string; fromCheckpoint?: string }
    result: ChatEntry[]
  }
  'drift:check': { args: { docA: string; docB: string }; result: DriftReportFull }
  'drift:resolve': {
    args: { driftId: string; action: 'fix-source' | 'fix-derived' | 'ignore'; content?: string }
    result: void
  }
  'stories:list': { args: void; result: ProjectHierarchy }
  'workflow:save': { args: { workflowId: string; graph: WorkflowGraph }; result: void }
  'test:run': {
    args: { specId?: string; scope: 'unit' | 'integration' | 'e2e' }
    result: { runId: string }
  }
  'test:list': { args: { specId?: string }; result: TestInfo[] }
  'context:add-to-agent': { args: { agentId: string; filePath: string }; result: void }
  'context:remove-from-agent': { args: { agentId: string; filePath: string }; result: void }
  'context:list-project-files': { args: void; result: ProjectFileInfo[] }
  'git:file-history': { args: { filePath: string; count: number }; result: unknown }
  'git:file-diff': { args: { commitA: string; commitB: string }; result: string }
  'drift:check-multiple': {
    args: { pairs: Array<{ docA: string; docB: string }> }
    result: { reports: DriftReportFull[] }
  }
  'drift:list-pairs': { args: void; result: Array<{ parent: string; child: string; relationship: string }> }
  'settings:update': { args: { key: string; value: unknown }; result: void }
  'settings:get': { args: { key: string }; result: unknown }
}

// Streaming (main → renderer, push)
export type IpcStreamChannels = {
  'stream:agent-output': { agentId: string; data: string; timestamp: number }
  'stream:agent-status': {
    agentId: string
    status: AgentStatus
    lastError?: string
    progress?: { completed: number; total: number }
    blockingContext?: BlockingContext
  }
  'stream:agent-chat': ChatEntry
  'stream:file-change': {
    path: string
    type: 'create' | 'modify' | 'delete'
    agentId?: string
  }
  'stream:drift-alert': {
    id: string
    severity: string
    summary: string
    documents: [string, string]
    confidence: number
  }
  'stream:drift-status': { status: 'idle' | 'analyzing'; pairCount: number }
  'stream:drift-progress': {
    completed: number
    total: number
    currentPair: [string, string]
  }
  'stream:settings-changed': { key: string; value: unknown }
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
