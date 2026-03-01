import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectBmadStructure } from './bmad-detector'

// Mock fs
vi.mock('node:fs', () => ({
  promises: {
    stat: vi.fn(),
    readdir: vi.fn()
  }
}))

import { promises as fs } from 'node:fs'

const mockStat = vi.mocked(fs.stat)
const mockReaddir = vi.mocked(fs.readdir)

describe('detectBmadStructure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should detect BMAD when _bmad/ exists', async () => {
    mockStat.mockImplementation(async (p) => {
      const path = p.toString()
      if (path.endsWith('_bmad') || path.endsWith('_bmad-output')) {
        return { isDirectory: () => true } as never
      }
      throw new Error('not found')
    })

    mockReaddir.mockResolvedValue([
      { name: 'workflow.yaml', isFile: () => true, isDirectory: () => false, parentPath: '/project/_bmad' },
      { name: 'agents', isFile: () => false, isDirectory: () => true, parentPath: '/project/_bmad' }
    ] as never)

    const result = await detectBmadStructure('/project')

    expect(result.detected).toBe(true)
    expect(result.hasBmadDir).toBe(true)
    expect(result.hasBmadOutputDir).toBe(true)
  })

  it('should return detected=false when _bmad/ does not exist', async () => {
    mockStat.mockRejectedValue(new Error('not found'))

    const result = await detectBmadStructure('/project')

    expect(result.detected).toBe(false)
    expect(result.hasBmadDir).toBe(false)
    expect(result.hasBmadOutputDir).toBe(false)
    expect(result.workflowFiles).toEqual([])
    expect(result.agentFiles).toEqual([])
    expect(result.outputArtifacts).toEqual([])
  })

  it('should handle _bmad/ existing but _bmad-output/ missing', async () => {
    mockStat.mockImplementation(async (p) => {
      const path = p.toString()
      if (path.endsWith('_bmad')) {
        return { isDirectory: () => true } as never
      }
      throw new Error('not found')
    })

    mockReaddir.mockResolvedValue([])

    const result = await detectBmadStructure('/project')

    expect(result.detected).toBe(true)
    expect(result.hasBmadDir).toBe(true)
    expect(result.hasBmadOutputDir).toBe(false)
  })

  it('should handle readdir permission errors gracefully', async () => {
    mockStat.mockImplementation(async (p) => {
      const path = p.toString()
      if (path.endsWith('_bmad')) {
        return { isDirectory: () => true } as never
      }
      throw new Error('not found')
    })

    mockReaddir.mockRejectedValue(new Error('EACCES'))

    const result = await detectBmadStructure('/project')

    expect(result.detected).toBe(true)
    expect(result.workflowFiles).toEqual([])
  })
})
