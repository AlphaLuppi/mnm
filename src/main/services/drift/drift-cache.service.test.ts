import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DriftCacheService } from './drift-cache.service'
import type { DriftReport } from '@shared/types/drift.types'

vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn()
  }
}))

import { promises as fs } from 'node:fs'

const mockFs = vi.mocked(fs)

describe('DriftCacheService', () => {
  let service: DriftCacheService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DriftCacheService('/test/.mnm/drift-cache')
  })

  describe('computeHash', () => {
    it('returns consistent hash for same content', () => {
      const hash1 = service.computeHash('hello')
      const hash2 = service.computeHash('hello')
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(16)
    })

    it('returns different hashes for different content', () => {
      const hash1 = service.computeHash('hello')
      const hash2 = service.computeHash('world')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('getCachedResult', () => {
    it('returns cached entry when file exists', async () => {
      const entry = { pairHash: 'abc', report: { id: 'r1' }, cachedAt: 1000 }
      mockFs.readFile.mockResolvedValue(JSON.stringify(entry))

      const result = await service.getCachedResult('abc')
      expect(result).toEqual(entry)
    })

    it('returns null when file does not exist', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'))

      const result = await service.getCachedResult('missing')
      expect(result).toBeNull()
    })
  })

  describe('cacheResult', () => {
    it('writes to temp file then renames (atomic write)', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue()
      mockFs.rename.mockResolvedValue()

      const report: DriftReport = {
        id: 'r1',
        documentA: 'a.md',
        documentB: 'b.md',
        timestamp: 1000,
        drifts: [],
        overallConfidence: 0,
        pipelineLatencyMs: 10,
        llmLatencyMs: 100
      }

      await service.cacheResult('abc', report)

      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/.mnm/drift-cache', { recursive: true })
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.any(String),
        'utf-8'
      )
      expect(mockFs.rename).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        expect.stringContaining('results-abc.json')
      )
    })
  })

  describe('getCachedConcepts / cacheConcepts', () => {
    it('returns null for missing concepts', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'))
      const result = await service.getCachedConcepts('hash1')
      expect(result).toBeNull()
    })

    it('caches concepts with atomic write', async () => {
      mockFs.mkdir.mockResolvedValue(undefined)
      mockFs.writeFile.mockResolvedValue()
      mockFs.rename.mockResolvedValue()

      await service.cacheConcepts('hash1', [
        { id: 'c1', name: 'Auth', description: 'JWT', sourceSection: 'Security', sourceLineRange: [1, 5] }
      ])

      expect(mockFs.writeFile).toHaveBeenCalled()
      expect(mockFs.rename).toHaveBeenCalled()
    })
  })
})
