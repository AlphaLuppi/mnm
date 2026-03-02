import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BlockingDetector } from './blocking-detector'

describe('BlockingDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls onBlocked after timeout with reason timeout', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked, { timeoutMs: 5000 })

    vi.advanceTimersByTime(5001)

    expect(onBlocked).toHaveBeenCalledOnce()
    expect(onBlocked.mock.calls[0][0].reason).toBe('timeout')

    detector.destroy()
  })

  it('resets timer on output received', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked, { timeoutMs: 5000 })

    vi.advanceTimersByTime(4000)
    detector.onOutput('some output')
    vi.advanceTimersByTime(4000)

    expect(onBlocked).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2000)
    expect(onBlocked).toHaveBeenCalledOnce()

    detector.destroy()
  })

  it('detects error patterns in stdout', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked)

    detector.onOutput('Error: rate limit exceeded')

    expect(onBlocked).toHaveBeenCalledOnce()
    expect(onBlocked.mock.calls[0][0].reason).toBe('error-pattern')
    expect(onBlocked.mock.calls[0][0].lastMessage).toContain('rate limit')

    detector.destroy()
  })

  it('detects permission denied in stdout', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked)

    detector.onOutput('Permission denied for this operation')

    expect(onBlocked).toHaveBeenCalledOnce()
    expect(onBlocked.mock.calls[0][0].reason).toBe('error-pattern')

    detector.destroy()
  })

  it('detects error patterns in stderr', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked)

    detector.onStderr('fatal: cannot connect to server')

    expect(onBlocked).toHaveBeenCalledOnce()
    expect(onBlocked.mock.calls[0][0].reason).toBe('stderr-error')
    expect(onBlocked.mock.calls[0][0].stderrSnippet).toContain('fatal')

    detector.destroy()
  })

  it('does not double-trigger blocking', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked)

    detector.onOutput('rate limit hit')
    detector.onOutput('rate limit again')

    expect(onBlocked).toHaveBeenCalledOnce()

    detector.destroy()
  })

  it('includes last checkpoint ID in blocking context', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked)

    detector.setCheckpoint('cp-abc123')
    detector.onOutput('rate limit error')

    expect(onBlocked.mock.calls[0][0].checkpointId).toBe('cp-abc123')

    detector.destroy()
  })

  it('uses configurable timeout value', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked, { timeoutMs: 2000 })

    vi.advanceTimersByTime(2001)

    expect(onBlocked).toHaveBeenCalledOnce()

    detector.destroy()
  })

  it('destroy stops the timer', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked, { timeoutMs: 5000 })

    detector.destroy()
    vi.advanceTimersByTime(10000)

    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('resets blocked state on new output after being blocked', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked, { timeoutMs: 5000 })

    vi.advanceTimersByTime(5001)
    expect(onBlocked).toHaveBeenCalledOnce()

    // New output resets blocked state
    detector.onOutput('agent is working again')

    // Now trigger another block
    vi.advanceTimersByTime(5001)
    expect(onBlocked).toHaveBeenCalledTimes(2)

    detector.destroy()
  })

  it('includes stderr snippet in timeout context', () => {
    const onBlocked = vi.fn()
    const detector = new BlockingDetector(onBlocked, {
      timeoutMs: 3000,
      stderrPatterns: [] // disable stderr detection to test timeout only
    })

    detector.onStderr('some warning message')
    vi.advanceTimersByTime(3001)

    expect(onBlocked.mock.calls[0][0].stderrSnippet).toContain('some warning message')

    detector.destroy()
  })
})
