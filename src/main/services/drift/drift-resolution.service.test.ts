import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DriftResolutionService } from './drift-resolution.service'

describe('DriftResolutionService', () => {
  let mockHistory: { addResolution: ReturnType<typeof vi.fn> }
  let mockStream: { send: ReturnType<typeof vi.fn> }
  let service: DriftResolutionService

  beforeEach(() => {
    vi.clearAllMocks()
    mockHistory = { addResolution: vi.fn().mockResolvedValue(undefined) }
    mockStream = { send: vi.fn() }
    service = new DriftResolutionService(mockHistory as never, mockStream as never)
  })

  it('resolves drift with ignore action', async () => {
    await service.resolveDrift('d1', 'ignore')

    expect(mockHistory.addResolution).toHaveBeenCalledWith(
      expect.objectContaining({ driftId: 'd1', action: 'ignore', resolvedBy: 'user' })
    )
    expect(mockStream.send).toHaveBeenCalledWith('stream:drift-resolved', {
      driftId: 'd1',
      action: 'ignore'
    })
  })

  it('resolves drift with fix-source action', async () => {
    await service.resolveDrift('d1', 'fix-source')

    expect(mockHistory.addResolution).toHaveBeenCalledWith(
      expect.objectContaining({ driftId: 'd1', action: 'fix-source' })
    )
    expect(mockStream.send).toHaveBeenCalledWith('stream:drift-resolved', {
      driftId: 'd1',
      action: 'fix-source'
    })
  })

  it('resolves drift with fix-derived action', async () => {
    await service.resolveDrift('d1', 'fix-derived')

    expect(mockHistory.addResolution).toHaveBeenCalledWith(
      expect.objectContaining({ driftId: 'd1', action: 'fix-derived' })
    )
  })
})
