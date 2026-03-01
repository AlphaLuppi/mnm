import { randomUUID } from 'node:crypto'
import type { ChatEntry } from '@shared/types/chat.types'
import type { StdoutEvent } from './stdout-parser'

export class ChatSegmenter {
  private entries: ChatEntry[] = []
  private agentId: string

  constructor(agentId: string) {
    this.agentId = agentId
  }

  process(event: StdoutEvent): ChatEntry | null {
    switch (event.type) {
      case 'text': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: event.role,
          content: event.content,
          timestamp: Date.now()
        }
        this.entries.push(entry)
        return entry
      }
      case 'tool-call': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: 'assistant',
          content: `[Tool Call: ${event.tool}]\n${event.args}`,
          timestamp: Date.now()
        }
        this.entries.push(entry)
        return entry
      }
      case 'tool-result': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: 'system',
          content: `[Tool Result: ${event.tool}]\n${event.result}`,
          timestamp: Date.now()
        }
        this.entries.push(entry)
        return entry
      }
      case 'checkpoint': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: 'system',
          content: event.label,
          checkpoint: `cp-${randomUUID().slice(0, 8)}`,
          timestamp: Date.now()
        }
        this.entries.push(entry)
        return entry
      }
      case 'error': {
        const entry: ChatEntry = {
          id: randomUUID(),
          agentId: this.agentId,
          role: 'system',
          content: `[Error] ${event.message}`,
          timestamp: Date.now()
        }
        this.entries.push(entry)
        return entry
      }
      default:
        return null
    }
  }

  getEntries(fromCheckpoint?: string): ChatEntry[] {
    if (!fromCheckpoint) return [...this.entries]

    const idx = this.entries.findIndex((e) => e.checkpoint === fromCheckpoint)
    if (idx === -1) return [...this.entries]
    return this.entries.slice(idx)
  }

  get size(): number {
    return this.entries.length
  }
}
