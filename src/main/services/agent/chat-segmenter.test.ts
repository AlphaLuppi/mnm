import { describe, it, expect } from 'vitest'
import { ChatSegmenter } from './chat-segmenter'
import type { StdoutEvent } from './stdout-parser'

describe('ChatSegmenter', () => {
  it('converts text event to ChatEntry with correct role', () => {
    const seg = new ChatSegmenter('agent-1')
    const event: StdoutEvent = { type: 'text', role: 'assistant', content: 'Hello' }

    const entry = seg.process(event)

    expect(entry).not.toBeNull()
    expect(entry!.agentId).toBe('agent-1')
    expect(entry!.role).toBe('assistant')
    expect(entry!.content).toBe('Hello')
    expect(entry!.id).toBeTruthy()
    expect(entry!.timestamp).toBeGreaterThan(0)
  })

  it('converts tool-call event to assistant entry', () => {
    const seg = new ChatSegmenter('agent-1')
    const event: StdoutEvent = { type: 'tool-call', tool: 'Read', args: '{"file":"x.ts"}' }

    const entry = seg.process(event)

    expect(entry).not.toBeNull()
    expect(entry!.role).toBe('assistant')
    expect(entry!.content).toContain('[Tool Call: Read]')
    expect(entry!.content).toContain('{"file":"x.ts"}')
  })

  it('converts tool-result event to system entry', () => {
    const seg = new ChatSegmenter('agent-1')
    const event: StdoutEvent = { type: 'tool-result', tool: 'Read', result: 'file content here' }

    const entry = seg.process(event)

    expect(entry).not.toBeNull()
    expect(entry!.role).toBe('system')
    expect(entry!.content).toContain('[Tool Result: Read]')
  })

  it('converts checkpoint event with checkpoint ID', () => {
    const seg = new ChatSegmenter('agent-1')
    const event: StdoutEvent = { type: 'checkpoint', label: 'File modified via Write' }

    const entry = seg.process(event)

    expect(entry).not.toBeNull()
    expect(entry!.checkpoint).toBeTruthy()
    expect(entry!.checkpoint).toMatch(/^cp-/)
    expect(entry!.content).toBe('File modified via Write')
  })

  it('converts error event to system entry', () => {
    const seg = new ChatSegmenter('agent-1')
    const event: StdoutEvent = { type: 'error', message: 'Something broke' }

    const entry = seg.process(event)

    expect(entry).not.toBeNull()
    expect(entry!.role).toBe('system')
    expect(entry!.content).toBe('[Error] Something broke')
  })

  it('getEntries returns all entries', () => {
    const seg = new ChatSegmenter('agent-1')
    seg.process({ type: 'text', role: 'assistant', content: 'First' })
    seg.process({ type: 'text', role: 'assistant', content: 'Second' })
    seg.process({ type: 'text', role: 'user', content: 'Third' })

    const entries = seg.getEntries()
    expect(entries).toHaveLength(3)
    expect(entries[0].content).toBe('First')
    expect(entries[2].content).toBe('Third')
  })

  it('getEntries(fromCheckpoint) filters from checkpoint', () => {
    const seg = new ChatSegmenter('agent-1')
    seg.process({ type: 'text', role: 'assistant', content: 'Before' })
    const cpEntry = seg.process({ type: 'checkpoint', label: 'Checkpoint' })
    seg.process({ type: 'text', role: 'assistant', content: 'After' })

    const entries = seg.getEntries(cpEntry!.checkpoint)
    expect(entries).toHaveLength(2)
    expect(entries[0].checkpoint).toBe(cpEntry!.checkpoint)
    expect(entries[1].content).toBe('After')
  })

  it('getEntries with unknown checkpoint returns all entries', () => {
    const seg = new ChatSegmenter('agent-1')
    seg.process({ type: 'text', role: 'assistant', content: 'Hello' })

    const entries = seg.getEntries('cp-nonexistent')
    expect(entries).toHaveLength(1)
  })

  it('generates unique IDs for each entry', () => {
    const seg = new ChatSegmenter('agent-1')
    const e1 = seg.process({ type: 'text', role: 'assistant', content: 'A' })
    const e2 = seg.process({ type: 'text', role: 'assistant', content: 'B' })

    expect(e1!.id).not.toBe(e2!.id)
  })

  it('tracks size correctly', () => {
    const seg = new ChatSegmenter('agent-1')
    expect(seg.size).toBe(0)

    seg.process({ type: 'text', role: 'assistant', content: 'A' })
    expect(seg.size).toBe(1)

    seg.process({ type: 'tool-call', tool: 'Read', args: '{}' })
    expect(seg.size).toBe(2)
  })

  it('returns copy of entries (not reference)', () => {
    const seg = new ChatSegmenter('agent-1')
    seg.process({ type: 'text', role: 'assistant', content: 'Hello' })

    const entries1 = seg.getEntries()
    const entries2 = seg.getEntries()
    expect(entries1).not.toBe(entries2)
    expect(entries1).toEqual(entries2)
  })
})
