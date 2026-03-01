import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'
import { AgentHarnessService } from './agent-harness.service'
import { AgentStatus } from '@shared/types/agent.types'
import type { ChatEntry } from '@shared/types/chat.types'

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}))

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined)
}))

function createMockProcess() {
  const proc = new EventEmitter() as ReturnType<typeof import('node:child_process').spawn>
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()
  Object.defineProperty(proc, 'stdout', { value: stdout, writable: false })
  Object.defineProperty(proc, 'stderr', { value: stderr, writable: false })
  Object.defineProperty(proc, 'killed', { value: false, writable: true })
  Object.defineProperty(proc, 'pid', { value: 12345, writable: false })
  proc.kill = vi.fn(() => {
    ;(proc as unknown as { killed: boolean }).killed = true
    return true
  })
  return proc
}

describe('AgentHarnessService', () => {
  let harness: AgentHarnessService
  let statusChanges: Array<{ agentId: string; status: AgentStatus; lastError?: string }>
  let outputs: Array<{ agentId: string; data: string }>
  let chatEntries: ChatEntry[]
  let mockSpawn: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    statusChanges = []
    outputs = []
    chatEntries = []

    const { spawn } = await import('node:child_process')
    mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>

    harness = new AgentHarnessService({
      projectPath: '/tmp/test-project',
      onStatusChange: (agentId, status, lastError) => {
        statusChanges.push({ agentId, status, lastError })
      },
      onOutput: (agentId, data) => {
        outputs.push({ agentId, data })
      },
      onChatEntry: (entry) => {
        chatEntries.push(entry)
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('launchAgent returns agentId and emits LAUNCHING status', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const agentId = harness.launchAgent({
      task: 'Fix the bug',
      context: ['src/main.ts']
    })

    expect(agentId).toBeTruthy()
    expect(statusChanges).toHaveLength(1)
    expect(statusChanges[0].status).toBe(AgentStatus.LAUNCHING)
  })

  it('transitions to ACTIVE on spawn event', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')

    expect(statusChanges).toHaveLength(2)
    expect(statusChanges[1].status).toBe(AgentStatus.ACTIVE)
  })

  it('captures stdout output and pipes through parser', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')

    mockProc.stdout!.emit('data', Buffer.from('{"type":"assistant","content":"Hello"}\n'))

    expect(outputs).toHaveLength(1)
    expect(chatEntries).toHaveLength(1)
    expect(chatEntries[0].content).toBe('Hello')
    expect(chatEntries[0].role).toBe('assistant')
  })

  it('captures stderr into buffer', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')

    mockProc.stderr!.emit('data', Buffer.from('Error: something went wrong'))
    mockProc.emit('close', 1)

    const crashed = statusChanges.find((s) => s.status === AgentStatus.CRASHED)
    expect(crashed).toBeTruthy()
    expect(crashed!.lastError).toContain('Error: something went wrong')
  })

  it('sets STOPPED on natural exit (code 0)', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')
    mockProc.emit('close', 0)

    const stopped = statusChanges.find((s) => s.status === AgentStatus.STOPPED)
    expect(stopped).toBeTruthy()
  })

  it('sets STOPPED on null exit code', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')
    mockProc.emit('close', null)

    const stopped = statusChanges.find((s) => s.status === AgentStatus.STOPPED)
    expect(stopped).toBeTruthy()
  })

  it('sets CRASHED on non-zero exit code', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')
    mockProc.emit('close', 1)

    const crashed = statusChanges.find((s) => s.status === AgentStatus.CRASHED)
    expect(crashed).toBeTruthy()
  })

  it('sets CRASHED on process error event', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('error', new Error('spawn ENOENT'))

    const crashed = statusChanges.find((s) => s.status === AgentStatus.CRASHED)
    expect(crashed).toBeTruthy()
    expect(crashed!.lastError).toBe('spawn ENOENT')
  })

  it('stopAgent sends SIGTERM', async () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const agentId = harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')

    const stopPromise = harness.stopAgent(agentId)

    expect(statusChanges.at(-1)!.status).toBe(AgentStatus.STOPPING)
    expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM')

    // Simulate the process closing after SIGTERM
    mockProc.emit('close', 0)
    await stopPromise

    const stopped = statusChanges.find((s) => s.status === AgentStatus.STOPPED)
    expect(stopped).toBeTruthy()
  })

  it('stopAgent is no-op for already stopped agent', async () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const agentId = harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')
    mockProc.emit('close', 0)

    const countBefore = statusChanges.length
    await harness.stopAgent(agentId)

    // No new status changes
    expect(statusChanges.length).toBe(countBefore)
  })

  it('stopAgent throws for unknown agent', async () => {
    await expect(harness.stopAgent('nonexistent')).rejects.toThrow('Agent nonexistent not found')
  })

  it('listAgents returns all tracked agents', () => {
    const mockProc1 = createMockProcess()
    const mockProc2 = createMockProcess()
    mockSpawn.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2)

    harness.launchAgent({ task: 'Task 1', context: [] })
    harness.launchAgent({ task: 'Task 2', context: [] })

    const agents = harness.listAgents()
    expect(agents).toHaveLength(2)
    expect(agents[0].task).toBe('Task 1')
    expect(agents[1].task).toBe('Task 2')
  })

  it('getAgentChat returns entries for a specific agent', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const agentId = harness.launchAgent({ task: 'Test', context: [] })
    mockProc.emit('spawn')

    mockProc.stdout!.emit('data', Buffer.from('{"type":"assistant","content":"Hi"}\n'))

    const chat = harness.getAgentChat(agentId)
    expect(chat).toHaveLength(1)
    expect(chat[0].content).toBe('Hi')
  })

  it('getAgentChat returns empty for unknown agent', () => {
    expect(harness.getAgentChat('nonexistent')).toEqual([])
  })

  it('getAgent returns agent info', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    const agentId = harness.launchAgent({ task: 'Test task', context: ['a.ts'] })

    const info = harness.getAgent(agentId)
    expect(info).toBeTruthy()
    expect(info!.task).toBe('Test task')
    expect(info!.contextFiles).toEqual(['a.ts'])
  })

  it('getAgent returns undefined for unknown agent', () => {
    expect(harness.getAgent('nonexistent')).toBeUndefined()
  })

  it('spawns claude with correct args', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({ task: 'Do something', context: ['file1.ts', 'file2.ts'] })

    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      [
        '--print',
        '--output-format',
        'json',
        '--allowedTools',
        'Read(file1.ts)',
        '--allowedTools',
        'Read(file2.ts)',
        'Do something'
      ],
      expect.objectContaining({
        cwd: '/tmp/test-project',
        stdio: ['pipe', 'pipe', 'pipe']
      })
    )
  })

  it('uses workingDirectory override when provided', () => {
    const mockProc = createMockProcess()
    mockSpawn.mockReturnValue(mockProc)

    harness.launchAgent({
      task: 'Test',
      context: [],
      workingDirectory: '/custom/path'
    })

    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      expect.any(Array),
      expect.objectContaining({ cwd: '/custom/path' })
    )
  })

  it('multiple agents tracked independently', () => {
    const mockProc1 = createMockProcess()
    const mockProc2 = createMockProcess()
    mockSpawn.mockReturnValueOnce(mockProc1).mockReturnValueOnce(mockProc2)

    const id1 = harness.launchAgent({ task: 'Task 1', context: [] })
    const id2 = harness.launchAgent({ task: 'Task 2', context: [] })

    mockProc1.emit('spawn')
    mockProc1.emit('close', 1) // crash agent 1

    mockProc2.emit('spawn')

    const agent1 = harness.getAgent(id1)
    const agent2 = harness.getAgent(id2)

    expect(agent1!.status).toBe(AgentStatus.CRASHED)
    expect(agent2!.status).toBe(AgentStatus.ACTIVE)
  })
})
