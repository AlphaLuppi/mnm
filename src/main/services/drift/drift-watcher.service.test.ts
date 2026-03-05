import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DriftWatcherService } from './drift-watcher.service'
import type { DriftReport, DriftResult, DriftSeverity } from '@shared/types/drift.types'

function createMockReport(drifts: Partial<DriftResult>[] = [], overallConfidence = 80): DriftReport {
  return {
    id: 'report-1',
    documentA: '/project/prd.md',
    documentB: '/project/arch.md',
    timestamp: Date.now(),
    drifts: drifts.map((d, i) => ({
      id: `drift-${i}`,
      parentConcept: { id: `p${i}`, name: 'Section', description: '', sourceSection: 'Section', sourceLineRange: [0, 0] as [number, number] },
      childConcept: null,
      type: 'contradiction' as const,
      description: 'Mismatch',
      confidence: 80,
      severity: 'warning' as DriftSeverity,
      ...d
    })),
    overallConfidence,
    pipelineLatencyMs: 10,
    llmLatencyMs: 100
  }
}

describe('DriftWatcherService', () => {
  let mockEngine: { analyzePair: ReturnType<typeof vi.fn> }
  let mockRegistry: { getPairsForFile: ReturnType<typeof vi.fn>; getAllPairs: ReturnType<typeof vi.fn> }
  let mockBus: { on: ReturnType<typeof vi.fn>; emit: ReturnType<typeof vi.fn> }
  let mockStream: { send: ReturnType<typeof vi.fn> }
  let watcher: DriftWatcherService

  const mockPair = { parent: '/project/prd.md', child: '/project/arch.md', relationship: 'prd-architecture' as const }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    mockEngine = { analyzePair: vi.fn().mockResolvedValue(createMockReport()) }
    mockRegistry = {
      getPairsForFile: vi.fn().mockReturnValue([]),
      getAllPairs: vi.fn().mockReturnValue([])
    }
    mockBus = { on: vi.fn(), emit: vi.fn() }
    mockStream = { send: vi.fn() }

    watcher = new DriftWatcherService(
      mockEngine as never,
      mockRegistry as never,
      mockBus as never,
      mockStream as never,
      { confidenceThreshold: 50, debounceMs: 500 }
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    watcher.stop()
  })

  function triggerFileChanged(path: string, type = 'modify'): void {
    const handler = mockBus.on.mock.calls[0][1]
    handler({ path, type })
  }

  it('registers file:changed listener on start', () => {
    watcher.start()
    expect(mockBus.on).toHaveBeenCalledWith('file:changed', expect.any(Function))
  })

  it('does nothing when changed file has no matching pairs', () => {
    watcher.start()
    triggerFileChanged('/project/unknown.txt')

    vi.advanceTimersByTime(600)

    expect(mockEngine.analyzePair).not.toHaveBeenCalled()
  })

  it('triggers analysis when a monitored file changes', async () => {
    mockRegistry.getPairsForFile.mockReturnValue([mockPair])
    mockEngine.analyzePair.mockResolvedValue(createMockReport([{ confidence: 80 }]))

    watcher.start()
    triggerFileChanged('/project/prd.md')

    vi.advanceTimersByTime(600)
    await vi.runAllTimersAsync()

    expect(mockEngine.analyzePair).toHaveBeenCalledWith('/project/prd.md', '/project/arch.md')
  })

  it('debounces rapid file changes to single analysis', async () => {
    mockRegistry.getPairsForFile.mockReturnValue([mockPair])
    mockEngine.analyzePair.mockResolvedValue(createMockReport())

    watcher.start()
    triggerFileChanged('/project/prd.md')
    vi.advanceTimersByTime(200)
    triggerFileChanged('/project/prd.md')
    vi.advanceTimersByTime(200)
    triggerFileChanged('/project/prd.md')

    vi.advanceTimersByTime(600)
    await vi.runAllTimersAsync()

    expect(mockEngine.analyzePair).toHaveBeenCalledTimes(1)
  })

  it('emits drift alert when confidence is above threshold', async () => {
    mockRegistry.getPairsForFile.mockReturnValue([mockPair])
    mockEngine.analyzePair.mockResolvedValue(createMockReport([{ confidence: 80, severity: 'warning' }]))

    watcher.start()
    triggerFileChanged('/project/prd.md')

    vi.advanceTimersByTime(600)
    await vi.runAllTimersAsync()

    expect(mockBus.emit).toHaveBeenCalledWith('drift:detected', expect.objectContaining({
      id: 'report-1',
      severity: 'warning'
    }))

    expect(mockStream.send).toHaveBeenCalledWith('stream:drift-alert', expect.objectContaining({
      id: 'report-1',
      severity: 'warning'
    }))
  })

  it('does not emit alert when confidence is below threshold', async () => {
    mockRegistry.getPairsForFile.mockReturnValue([mockPair])
    mockEngine.analyzePair.mockResolvedValue(createMockReport([{ confidence: 30 }]))

    watcher.start()
    triggerFileChanged('/project/prd.md')

    vi.advanceTimersByTime(600)
    await vi.runAllTimersAsync()

    expect(mockBus.emit).not.toHaveBeenCalledWith('drift:detected', expect.anything())
    expect(mockStream.send).not.toHaveBeenCalledWith('stream:drift-alert', expect.anything())
  })

  it('emits status transitions: analyzing -> idle', async () => {
    mockRegistry.getPairsForFile.mockReturnValue([mockPair])
    mockEngine.analyzePair.mockResolvedValue(createMockReport())

    watcher.start()
    triggerFileChanged('/project/prd.md')

    vi.advanceTimersByTime(600)
    await vi.runAllTimersAsync()

    const statusCalls = mockStream.send.mock.calls.filter(
      (c: unknown[]) => c[0] === 'stream:drift-status'
    )
    expect(statusCalls).toHaveLength(2)
    expect(statusCalls[0][1]).toEqual({ status: 'analyzing', pairCount: 1 })
    expect(statusCalls[1][1]).toEqual({ status: 'idle', pairCount: 0 })
  })

  it('logs error and continues when analysis fails', async () => {
    mockRegistry.getPairsForFile.mockReturnValue([mockPair])
    mockEngine.analyzePair.mockRejectedValue(new Error('LLM error'))

    watcher.start()
    triggerFileChanged('/project/prd.md')

    vi.advanceTimersByTime(600)
    await vi.runAllTimersAsync()

    // Should still emit idle status after error
    const statusCalls = mockStream.send.mock.calls.filter(
      (c: unknown[]) => c[0] === 'stream:drift-status'
    )
    expect(statusCalls[statusCalls.length - 1][1]).toEqual({ status: 'idle', pairCount: 0 })
  })

  it('computes max severity as critical when any drift is critical', async () => {
    mockRegistry.getPairsForFile.mockReturnValue([mockPair])
    mockEngine.analyzePair.mockResolvedValue(createMockReport([
      { confidence: 80, severity: 'warning' },
      { confidence: 90, severity: 'critical' }
    ]))

    watcher.start()
    triggerFileChanged('/project/prd.md')

    vi.advanceTimersByTime(600)
    await vi.runAllTimersAsync()

    expect(mockStream.send).toHaveBeenCalledWith('stream:drift-alert', expect.objectContaining({
      severity: 'critical'
    }))
  })
})
