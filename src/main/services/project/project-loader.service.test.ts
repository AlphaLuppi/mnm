import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadProject } from './project-loader.service'

// Mock fs
vi.mock('node:fs', () => ({
  promises: {
    stat: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rename: vi.fn()
  }
}))

// Mock bmad-detector
vi.mock('./bmad-detector', () => ({
  detectBmadStructure: vi.fn()
}))

// Mock logger
vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

import { promises as fs } from 'node:fs'
import { detectBmadStructure } from './bmad-detector'

const mockStat = vi.mocked(fs.stat)
const mockAccess = vi.mocked(fs.access)
const mockMkdir = vi.mocked(fs.mkdir)
const mockReadFile = vi.mocked(fs.readFile)
const mockWriteFile = vi.mocked(fs.writeFile)
const mockRename = vi.mocked(fs.rename)
const mockDetectBmad = vi.mocked(detectBmadStructure)

const BMAD_RESULT = {
  detected: true,
  hasBmadDir: true,
  hasBmadOutputDir: true,
  workflowFiles: [],
  agentFiles: [],
  outputArtifacts: []
}

describe('loadProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupValidProject(name = 'test-project') {
    mockStat.mockResolvedValue({ isDirectory: () => true } as never)
    mockAccess.mockResolvedValue(undefined)
    mockDetectBmad.mockResolvedValue(BMAD_RESULT)
    mockMkdir.mockResolvedValue(undefined)
    mockReadFile.mockImplementation(async (p) => {
      const path = p.toString()
      if (path.endsWith('package.json')) {
        return JSON.stringify({ name })
      }
      throw new Error('not found')
    })
    mockWriteFile.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)
  }

  it('should load a valid Git + BMAD project', async () => {
    setupValidProject('my-project')

    const result = await loadProject('/test/my-project')

    expect(result.name).toBe('my-project')
    expect(result.path).toBe('/test/my-project')
    expect(result.bmadStructure.detected).toBe(true)
    expect(result.settings.version).toBe(1)
  })

  it('should throw NOT_GIT_REPO for non-Git directory', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as never)
    mockAccess.mockRejectedValue(new Error('ENOENT'))

    await expect(loadProject('/test/no-git')).rejects.toMatchObject({
      code: 'NOT_GIT_REPO'
    })
  })

  it('should throw INVALID_DIRECTORY for non-existent path', async () => {
    mockStat.mockRejectedValue(new Error('ENOENT'))

    await expect(loadProject('/nonexistent')).rejects.toMatchObject({
      code: 'INVALID_DIRECTORY'
    })
  })

  it('should throw INVALID_DIRECTORY for non-directory path', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => false } as never)

    await expect(loadProject('/test/file.txt')).rejects.toMatchObject({
      code: 'INVALID_DIRECTORY'
    })
  })

  it('should create .mnm/ directory with defaults', async () => {
    setupValidProject()

    await loadProject('/test/project')

    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('.mnm'),
      { recursive: true }
    )
  })

  it('should merge existing settings with defaults', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as never)
    mockAccess.mockResolvedValue(undefined)
    mockDetectBmad.mockResolvedValue(BMAD_RESULT)
    mockMkdir.mockResolvedValue(undefined)
    mockReadFile.mockImplementation(async (p) => {
      const path = p.toString()
      if (path.endsWith('settings.json')) {
        return JSON.stringify({ version: 1, driftThreshold: 75 })
      }
      if (path.endsWith('package.json')) {
        return JSON.stringify({ name: 'test' })
      }
      throw new Error('not found')
    })
    mockWriteFile.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)

    const result = await loadProject('/test/project')

    expect(result.settings.driftThreshold).toBe(75)
    expect(result.settings.recentProjects).toEqual([])
  })

  it('should use directory basename when package.json has no name', async () => {
    mockStat.mockResolvedValue({ isDirectory: () => true } as never)
    mockAccess.mockResolvedValue(undefined)
    mockDetectBmad.mockResolvedValue(BMAD_RESULT)
    mockMkdir.mockResolvedValue(undefined)
    mockReadFile.mockRejectedValue(new Error('not found'))
    mockWriteFile.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)

    const result = await loadProject('/test/my-dir')

    expect(result.name).toBe('my-dir')
  })
})
