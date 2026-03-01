import { EventEmitter } from 'node:events'
import type { ChatRole } from '@shared/types/chat.types'

export type StdoutEvent =
  | { type: 'text'; role: ChatRole; content: string }
  | { type: 'tool-call'; tool: string; args: string }
  | { type: 'tool-result'; tool: string; result: string }
  | { type: 'checkpoint'; label: string }
  | { type: 'error'; message: string }

export class StdoutParser extends EventEmitter {
  private buffer = ''

  feed(chunk: string): void {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.trim() === '') continue
      this.parseLine(line.trim())
    }
  }

  flush(): void {
    if (this.buffer.trim()) {
      this.parseLine(this.buffer.trim())
      this.buffer = ''
    }
  }

  private parseLine(line: string): void {
    try {
      const parsed: unknown = JSON.parse(line)
      if (typeof parsed === 'object' && parsed !== null) {
        this.handleJsonMessage(parsed as Record<string, unknown>)
        return
      }
    } catch {
      // Not JSON — treat as plain text
    }

    this.emit('event', { type: 'text', role: 'assistant', content: line } satisfies StdoutEvent)
  }

  private handleJsonMessage(msg: Record<string, unknown>): void {
    const msgType = msg['type'] as string | undefined

    switch (msgType) {
      case 'assistant':
        this.emit('event', {
          type: 'text',
          role: 'assistant',
          content: String(msg['content'] ?? '')
        } satisfies StdoutEvent)
        break
      case 'user':
        this.emit('event', {
          type: 'text',
          role: 'user',
          content: String(msg['content'] ?? '')
        } satisfies StdoutEvent)
        break
      case 'system':
        this.emit('event', {
          type: 'text',
          role: 'system',
          content: String(msg['content'] ?? '')
        } satisfies StdoutEvent)
        break
      case 'tool_use':
        this.emit('event', {
          type: 'tool-call',
          tool: String(msg['name'] ?? 'unknown'),
          args: JSON.stringify(msg['input'] ?? {})
        } satisfies StdoutEvent)
        break
      case 'tool_result':
        this.emit('event', {
          type: 'tool-result',
          tool: String(msg['name'] ?? 'unknown'),
          result: String(msg['content'] ?? '')
        } satisfies StdoutEvent)
        this.detectCheckpoint(msg)
        break
      default:
        this.emit('event', {
          type: 'text',
          role: 'system',
          content: JSON.stringify(msg)
        } satisfies StdoutEvent)
    }
  }

  private detectCheckpoint(msg: Record<string, unknown>): void {
    const tool = String(msg['name'] ?? '')
    if (['Write', 'Edit', 'NotebookEdit'].includes(tool)) {
      this.emit('event', {
        type: 'checkpoint',
        label: `File modified via ${tool}`
      } satisfies StdoutEvent)
    }
  }
}
