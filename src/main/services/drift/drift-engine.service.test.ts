import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn()
  }
}))

import { promises as fs } from 'node:fs'
import { DriftEngineService } from './drift-engine.service'
import { DriftCacheService } from './drift-cache.service'
import type { LLMService } from '@main/services/llm/llm.service'
import type { DriftReport } from '@shared/types/drift.types'

const mockFs = vi.mocked(fs)

function createMockLLM(): LLMService {
  return {
    compareDocuments: vi.fn().mockResolvedValue({
      id: 'report-1',
      documentA: '',
      documentB: '',
      timestamp: 0,
      drifts: [
        {
          id: 'drift-0',
          parentConcept: { id: 'p0', name: 'Overview', description: '', sourceSection: 'Overview', sourceLineRange: [0, 0] },
          childConcept: null,
          type: 'missing',
          description: 'Missing section',
          confidence: 80,
          severity: 'warning'
        }
      ],
      overallConfidence: 80,
      pipelineLatencyMs: 0,
      llmLatencyMs: 0
    } satisfies DriftReport),
    extractConcepts: vi.fn().mockResolvedValue([])
  }
}

function createMockCache() {
  return {
    computeHash: vi.fn().mockReturnValue('hash123'),
    getCachedResult: vi.fn().mockResolvedValue(null),
    cacheResult: vi.fn().mockResolvedValue(undefined),
    getCachedConcepts: vi.fn().mockResolvedValue(null),
    cacheConcepts: vi.fn().mockResolvedValue(undefined)
  }
}

describe('DriftEngineService', () => {
  let llm: ReturnType<typeof createMockLLM>
  let cache: ReturnType<typeof createMockCache>
  let engine: DriftEngineService

  beforeEach(() => {
    vi.clearAllMocks()
    llm = createMockLLM()
    cache = createMockCache()
    engine = new DriftEngineService(llm, cache as unknown as DriftCacheService)
  })

  it('reads both files and sends to LLM', async () => {
    mockFs.readFile
      .mockResolvedValueOnce('# Parent Doc' as never)
      .mockResolvedValueOnce('# Child Doc' as never)

    const report = await engine.analyzePair('/a.md', '/b.md')

    expect(mockFs.readFile).toHaveBeenCalledTimes(2)
    expect(llm.compareDocuments).toHaveBeenCalledTimes(1)
    expect(report.drifts).toHaveLength(1)
    expect(report.documentA).toBe('/a.md')
    expect(report.documentB).toBe('/b.md')
    expect(report.pipelineLatencyMs).toBeGreaterThanOrEqual(0)
  })

  it('returns cached result when available', async () => {
    const cachedReport: DriftReport = {
      id: 'cached-1',
      documentA: '/a.md',
      documentB: '/b.md',
      timestamp: 1000,
      drifts: [],
      overallConfidence: 100,
      pipelineLatencyMs: 5,
      llmLatencyMs: 200
    }
    cache.getCachedResult.mockResolvedValue({ pairHash: 'hash123', report: cachedReport, cachedAt: 1000, documentAHash: 'h1', documentBHash: 'h2' })
    mockFs.readFile.mockResolvedValue('# Doc' as never)

    const report = await engine.analyzePair('/a.md', '/b.md')

    expect(report.id).toBe('cached-1')
    expect(llm.compareDocuments).not.toHaveBeenCalled()
  })

  it('caches result after LLM call', async () => {
    mockFs.readFile.mockResolvedValue('# Doc' as never)

    await engine.analyzePair('/a.md', '/b.md')

    expect(cache.cacheResult).toHaveBeenCalledWith('hash123', expect.objectContaining({ documentA: '/a.md' }))
  })

  it('measures pipeline and LLM latency', async () => {
    mockFs.readFile.mockResolvedValue('# Doc' as never)

    const report = await engine.analyzePair('/a.md', '/b.md')

    expect(report.pipelineLatencyMs).toBeGreaterThanOrEqual(0)
    expect(report.llmLatencyMs).toBeGreaterThanOrEqual(0)
  })
})
