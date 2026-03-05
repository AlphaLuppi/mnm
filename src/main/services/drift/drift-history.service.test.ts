import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn(),
    mkdir: vi.fn()
  }
}))

import { promises as fs } from 'node:fs'
import { DriftHistoryService } from './drift-history.service'
import type { ResolutionEntry } from './drift-history.service'

const mockFs = vi.mocked(fs)

describe('DriftHistoryService', () => {
  let service: DriftHistoryService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new DriftHistoryService('/test/.mnm/drift-cache')
  })

  it('returns empty array when no history file exists', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'))
    const history = await service.getHistory()
    expect(history).toEqual([])
  })

  it('returns parsed history when file exists', async () => {
    const entries: ResolutionEntry[] = [
      { driftId: 'd1', action: 'ignore', resolvedAt: 1000, resolvedBy: 'user' }
    ]
    mockFs.readFile.mockResolvedValue(JSON.stringify(entries))
    const history = await service.getHistory()
    expect(history).toHaveLength(1)
    expect(history[0].driftId).toBe('d1')
  })

  it('appends resolution with atomic write', async () => {
    mockFs.readFile.mockRejectedValue(new Error('ENOENT'))
    mockFs.mkdir.mockResolvedValue(undefined)
    mockFs.writeFile.mockResolvedValue()
    mockFs.rename.mockResolvedValue()

    await service.addResolution({
      driftId: 'd1',
      action: 'ignore',
      resolvedAt: 1000,
      resolvedBy: 'user'
    })

    expect(mockFs.mkdir).toHaveBeenCalled()
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('.tmp'),
      expect.any(String),
      'utf-8'
    )
    expect(mockFs.rename).toHaveBeenCalled()
  })

  it('detects ignored drift', async () => {
    const entries: ResolutionEntry[] = [
      {
        driftId: 'd1',
        documentA: '/a.md',
        documentB: '/b.md',
        driftHash: 'hash1',
        action: 'ignore',
        resolvedAt: 1000,
        resolvedBy: 'user'
      }
    ]
    mockFs.readFile.mockResolvedValue(JSON.stringify(entries))

    expect(await service.isIgnored('/a.md', '/b.md', 'hash1')).toBe(true)
    expect(await service.isIgnored('/a.md', '/b.md', 'hash2')).toBe(false)
    expect(await service.isIgnored('/x.md', '/y.md', 'hash1')).toBe(false)
  })
})
