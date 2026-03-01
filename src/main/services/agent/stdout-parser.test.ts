import { describe, it, expect } from 'vitest'
import { StdoutParser } from './stdout-parser'
import type { StdoutEvent } from './stdout-parser'

function collectEvents(parser: StdoutParser): StdoutEvent[] {
  const events: StdoutEvent[] = []
  parser.on('event', (e: StdoutEvent) => events.push(e))
  return events
}

describe('StdoutParser', () => {
  it('parses JSON assistant message', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"assistant","content":"Hello world"}\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', role: 'assistant', content: 'Hello world' })
  })

  it('parses JSON user message', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"user","content":"Do something"}\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', role: 'user', content: 'Do something' })
  })

  it('parses JSON system message', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"system","content":"System info"}\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', role: 'system', content: 'System info' })
  })

  it('parses tool_use message', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"tool_use","name":"Read","input":{"file":"test.ts"}}\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      type: 'tool-call',
      tool: 'Read',
      args: '{"file":"test.ts"}'
    })
  })

  it('parses tool_result and detects checkpoint for Write tool', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"tool_result","name":"Write","content":"File written"}\n')

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'tool-result', tool: 'Write', result: 'File written' })
    expect(events[1]).toEqual({ type: 'checkpoint', label: 'File modified via Write' })
  })

  it('detects checkpoint for Edit tool', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"tool_result","name":"Edit","content":"done"}\n')

    expect(events).toHaveLength(2)
    expect(events[1]).toEqual({ type: 'checkpoint', label: 'File modified via Edit' })
  })

  it('does not emit checkpoint for non-write tools', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"tool_result","name":"Read","content":"file content"}\n')

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('tool-result')
  })

  it('falls back to plain text for non-JSON lines', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('Just some plain text output\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', role: 'assistant', content: 'Just some plain text output' })
  })

  it('handles partial line buffering', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"assi')
    expect(events).toHaveLength(0)

    parser.feed('stant","content":"Hello"}\n')
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', role: 'assistant', content: 'Hello' })
  })

  it('handles multiple lines in one chunk', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed(
      '{"type":"assistant","content":"Line 1"}\n{"type":"assistant","content":"Line 2"}\n'
    )

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'text', role: 'assistant', content: 'Line 1' })
    expect(events[1]).toEqual({ type: 'text', role: 'assistant', content: 'Line 2' })
  })

  it('flush emits remaining buffer content', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('trailing content')
    expect(events).toHaveLength(0)

    parser.flush()
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', role: 'assistant', content: 'trailing content' })
  })

  it('skips empty lines', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('\n\n{"type":"assistant","content":"After blank"}\n\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'text', role: 'assistant', content: 'After blank' })
  })

  it('handles unknown JSON type as system message', () => {
    const parser = new StdoutParser()
    const events = collectEvents(parser)

    parser.feed('{"type":"unknown_type","data":"something"}\n')

    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('text')
    if (events[0].type === 'text') {
      expect(events[0].role).toBe('system')
    }
  })
})
