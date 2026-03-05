import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ManualDriftCheckService } from './manual-drift-check.service'
import type { DriftReport, DriftSeverity } from '@shared/types/drift.types'

function createMockReport(id: string, driftCount = 0): DriftReport {
  return {
    id,
    documentA: '/a.md',
    documentB: '/b.md',
    timestamp: Date.now(),
    drifts: Array.from({ length: driftCount }, (_, i) => ({
      id: `drift-${i}`,
      parentConcept: { id: `p${i}`, name: 'S', description: '', sourceSection: 'S', sourceLineRange: [0, 0] as [number, number] },
      childConcept: null,
      type: 'contradiction' as const,
      description: 'Mismatch',
      confidence: 80,
      severity: 'warning' as DriftSeverity
    })),
    overallConfidence: driftCount > 0 ? 80 : 100,
    pipelineLatencyMs: 10,
    llmLatencyMs: 100
  }
}

describe('ManualDriftCheckService', () => {
  let mockEngine: { analyzePair: ReturnType<typeof vi.fn> }
  let mockStream: { send: ReturnType<typeof vi.fn> }
  let service: ManualDriftCheckService

  beforeEach(() => {
    vi.clearAllMocks()
    mockEngine = { analyzePair: vi.fn() }
    mockStream = { send: vi.fn() }
    service = new ManualDriftCheckService(mockEngine as never, mockStream as never)
  })

  it('analyzes multiple pairs sequentially with progress', async () => {
    mockEngine.analyzePair
      .mockResolvedValueOnce(createMockReport('r1'))
      .mockResolvedValueOnce(createMockReport('r2'))

    const pairs = [
      { docA: '/a.md', docB: '/b.md' },
      { docA: '/c.md', docB: '/d.md' }
    ]

    const reports = await service.runManualCheck(pairs)

    expect(reports).toHaveLength(2)
    expect(mockEngine.analyzePair).toHaveBeenCalledTimes(2)

    // Progress: 0/2, 1/2, 2/2 (final)
    const progressCalls = mockStream.send.mock.calls.filter(
      (c: unknown[]) => c[0] === 'stream:drift-progress'
    )
    expect(progressCalls).toHaveLength(3)
    expect(progressCalls[0][1]).toEqual({ completed: 0, total: 2, currentPair: ['/a.md', '/b.md'] })
    expect(progressCalls[1][1]).toEqual({ completed: 1, total: 2, currentPair: ['/c.md', '/d.md'] })
    expect(progressCalls[2][1]).toEqual({ completed: 2, total: 2, currentPair: ['', ''] })
  })

  it('emits drift alert when drifts found', async () => {
    mockEngine.analyzePair.mockResolvedValue(createMockReport('r1', 2))

    await service.runManualCheck([{ docA: '/a.md', docB: '/b.md' }])

    const alertCalls = mockStream.send.mock.calls.filter(
      (c: unknown[]) => c[0] === 'stream:drift-alert'
    )
    expect(alertCalls).toHaveLength(1)
    expect(alertCalls[0][1]).toMatchObject({ id: 'r1', severity: 'warning' })
  })

  it('does not emit alert when no drifts', async () => {
    mockEngine.analyzePair.mockResolvedValue(createMockReport('r1', 0))

    await service.runManualCheck([{ docA: '/a.md', docB: '/b.md' }])

    const alertCalls = mockStream.send.mock.calls.filter(
      (c: unknown[]) => c[0] === 'stream:drift-alert'
    )
    expect(alertCalls).toHaveLength(0)
  })

  it('continues with remaining pairs when one fails', async () => {
    mockEngine.analyzePair
      .mockRejectedValueOnce(new Error('LLM error'))
      .mockResolvedValueOnce(createMockReport('r2'))

    const reports = await service.runManualCheck([
      { docA: '/a.md', docB: '/b.md' },
      { docA: '/c.md', docB: '/d.md' }
    ])

    expect(reports).toHaveLength(1)
    expect(reports[0].id).toBe('r2')
    expect(mockEngine.analyzePair).toHaveBeenCalledTimes(2)
  })
})
