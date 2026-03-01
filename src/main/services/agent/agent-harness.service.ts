import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { AgentStatus } from '@shared/types/agent.types'
import type { AgentInfo, AgentLaunchParams } from '@shared/types/agent.types'
import type { ChatEntry } from '@shared/types/chat.types'
import { StdoutParser } from './stdout-parser'
import { ChatSegmenter } from './chat-segmenter'
import type { AgentProcess } from './agent.types'

const STOP_GRACE_PERIOD_MS = 5000

export type AgentHarnessConfig = {
  projectPath: string
  onStatusChange: (agentId: string, status: AgentStatus, lastError?: string) => void
  onOutput: (agentId: string, data: string) => void
  onChatEntry: (entry: ChatEntry) => void
}

export class AgentHarnessService {
  private agents = new Map<string, AgentProcess>()
  private projectPath: string
  private onStatusChange: AgentHarnessConfig['onStatusChange']
  private onOutput: AgentHarnessConfig['onOutput']
  private onChatEntry: AgentHarnessConfig['onChatEntry']

  constructor(config: AgentHarnessConfig) {
    this.projectPath = config.projectPath
    this.onStatusChange = config.onStatusChange
    this.onOutput = config.onOutput
    this.onChatEntry = config.onChatEntry
  }

  launchAgent(params: AgentLaunchParams): string {
    const agentId = randomUUID()
    const { task, context, workingDirectory } = params

    const info: AgentInfo = {
      id: agentId,
      task,
      status: AgentStatus.LAUNCHING,
      contextFiles: context,
      startedAt: Date.now()
    }

    const args = this.buildCliArgs(task, context)

    const child = spawn('claude', args, {
      cwd: workingDirectory ?? this.projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    })

    const parser = new StdoutParser()
    const segmenter = new ChatSegmenter(agentId)

    const agentProcess: AgentProcess = {
      info,
      process: child,
      parser,
      segmenter,
      stderrBuffer: ''
    }

    this.agents.set(agentId, agentProcess)

    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      info.lastOutputAt = Date.now()
      this.onOutput(agentId, text)
      parser.feed(text)
    })

    child.stderr?.on('data', (data: Buffer) => {
      agentProcess.stderrBuffer += data.toString()
    })

    parser.on('event', (event) => {
      const entry = segmenter.process(event)
      if (entry) {
        this.onChatEntry(entry)
      }
    })

    child.on('spawn', () => {
      info.status = AgentStatus.ACTIVE
      this.onStatusChange(agentId, AgentStatus.ACTIVE)
    })

    child.on('close', (code) => {
      parser.flush()
      info.stoppedAt = Date.now()

      if (info.status === AgentStatus.STOPPING) {
        info.status = AgentStatus.STOPPED
        this.onStatusChange(agentId, AgentStatus.STOPPED)
      } else if (code === 0 || code === null) {
        info.status = AgentStatus.STOPPED
        this.onStatusChange(agentId, AgentStatus.STOPPED)
      } else {
        info.status = AgentStatus.CRASHED
        info.lastError = agentProcess.stderrBuffer.slice(-2000)
        this.onStatusChange(agentId, AgentStatus.CRASHED, info.lastError)
      }

      this.persistSession(agentProcess).catch(() => {
        // Silently fail persistence
      })
    })

    child.on('error', (err) => {
      info.status = AgentStatus.CRASHED
      info.stoppedAt = Date.now()
      info.lastError = err.message
      this.onStatusChange(agentId, AgentStatus.CRASHED, err.message)
    })

    this.onStatusChange(agentId, AgentStatus.LAUNCHING)

    return agentId
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    if (agent.info.status === AgentStatus.STOPPED || agent.info.status === AgentStatus.CRASHED) {
      return
    }

    agent.info.status = AgentStatus.STOPPING
    this.onStatusChange(agentId, AgentStatus.STOPPING)

    const child = agent.process

    child.kill('SIGTERM')

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL')
        }
        resolve()
      }, STOP_GRACE_PERIOD_MS)

      child.on('close', () => {
        clearTimeout(timeout)
        resolve()
      })
    })
  }

  listAgents(): AgentInfo[] {
    return Array.from(this.agents.values()).map((a) => ({ ...a.info }))
  }

  getAgentChat(agentId: string, fromCheckpoint?: string): ChatEntry[] {
    const agent = this.agents.get(agentId)
    if (!agent) return []
    return agent.segmenter.getEntries(fromCheckpoint)
  }

  getAgent(agentId: string): AgentInfo | undefined {
    const agent = this.agents.get(agentId)
    return agent ? { ...agent.info } : undefined
  }

  updateProjectPath(projectPath: string): void {
    this.projectPath = projectPath
  }

  private buildCliArgs(task: string, context: string[]): string[] {
    const args: string[] = ['--print', '--output-format', 'json']

    for (const file of context) {
      args.push('--allowedTools', `Read(${file})`)
    }

    args.push(task)

    return args
  }

  private async persistSession(agent: AgentProcess): Promise<void> {
    const historyDir = join(this.projectPath, '.mnm', 'agent-history')
    await mkdir(historyDir, { recursive: true })

    const session = {
      id: agent.info.id,
      task: agent.info.task,
      status: agent.info.status,
      startedAt: agent.info.startedAt,
      stoppedAt: agent.info.stoppedAt,
      chatEntries: agent.segmenter.getEntries(),
      lastError: agent.info.lastError
    }

    const filename = `session-${agent.info.startedAt}.json`
    const tempPath = join(historyDir, `.${filename}.tmp`)
    const finalPath = join(historyDir, filename)

    await writeFile(tempPath, JSON.stringify(session, null, 2), 'utf-8')
    await rename(tempPath, finalPath)
  }

  async shutdown(): Promise<void> {
    const stopPromises = Array.from(this.agents.keys()).map((id) =>
      this.stopAgent(id).catch(() => {
        const agent = this.agents.get(id)
        if (agent && !agent.process.killed) {
          agent.process.kill('SIGKILL')
        }
      })
    )
    await Promise.all(stopPromises)
  }
}
