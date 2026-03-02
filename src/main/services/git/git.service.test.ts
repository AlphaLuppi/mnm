import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGitInstance = {
  log: vi.fn(),
  status: vi.fn(),
  show: vi.fn(),
  diff: vi.fn()
}

vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGitInstance)
}))

import { GitService } from './git.service'

describe('GitService', () => {
  let service: GitService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new GitService('/test/project')
  })

  describe('getLog', () => {
    it('returns formatted log entries', async () => {
      mockGitInstance.log.mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            date: '2024-01-15',
            message: 'feat: add feature',
            author_name: 'Dev'
          },
          {
            hash: 'def456',
            date: '2024-01-14',
            message: 'fix: bug fix',
            author_name: 'Dev'
          }
        ]
      })

      const result = await service.getLog(10)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        hash: 'abc123',
        date: '2024-01-15',
        message: 'feat: add feature',
        author: 'Dev',
        files: []
      })
      expect(mockGitInstance.log).toHaveBeenCalledWith({ maxCount: 10 })
    })

    it('uses default count of 50', async () => {
      mockGitInstance.log.mockResolvedValue({ all: [] })

      await service.getLog()

      expect(mockGitInstance.log).toHaveBeenCalledWith({ maxCount: 50 })
    })
  })

  describe('getStatus', () => {
    it('returns formatted status', async () => {
      mockGitInstance.status.mockResolvedValue({
        current: 'main',
        tracking: 'origin/main',
        files: [
          { path: 'src/a.ts', working_dir: 'M', index: ' ' },
          { path: 'src/b.ts', working_dir: '?', index: '?' },
          { path: 'src/c.ts', working_dir: 'D', index: ' ' }
        ],
        ahead: 2,
        behind: 0
      })

      const result = await service.getStatus()

      expect(result.current).toBe('main')
      expect(result.tracking).toBe('origin/main')
      expect(result.ahead).toBe(2)
      expect(result.behind).toBe(0)
      expect(result.files).toEqual([
        { path: 'src/a.ts', status: 'modified' },
        { path: 'src/b.ts', status: 'untracked' },
        { path: 'src/c.ts', status: 'deleted' }
      ])
    })

    it('maps added files correctly', async () => {
      mockGitInstance.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        files: [{ path: 'new.ts', working_dir: ' ', index: 'A' }],
        ahead: 0,
        behind: 0
      })

      const result = await service.getStatus()
      expect(result.files[0].status).toBe('added')
    })

    it('maps renamed files correctly', async () => {
      mockGitInstance.status.mockResolvedValue({
        current: 'main',
        tracking: null,
        files: [{ path: 'renamed.ts', working_dir: ' ', index: 'R' }],
        ahead: 0,
        behind: 0
      })

      const result = await service.getStatus()
      expect(result.files[0].status).toBe('renamed')
    })
  })

  describe('getFileHistory', () => {
    it('returns log filtered by file', async () => {
      mockGitInstance.log.mockResolvedValue({
        all: [
          {
            hash: 'abc123',
            date: '2024-01-15',
            message: 'update file',
            author_name: 'Dev'
          }
        ]
      })

      const result = await service.getFileHistory('src/main.ts', 5)

      expect(result).toHaveLength(1)
      expect(result[0].files).toEqual(['src/main.ts'])
      expect(mockGitInstance.log).toHaveBeenCalledWith({
        maxCount: 5,
        file: 'src/main.ts'
      })
    })
  })

  describe('showFile', () => {
    it('calls git show with correct ref', async () => {
      mockGitInstance.show.mockResolvedValue('file content here')

      const result = await service.showFile('src/main.ts', 'abc123')

      expect(result).toBe('file content here')
      expect(mockGitInstance.show).toHaveBeenCalledWith(['abc123:src/main.ts'])
    })
  })

  describe('getDiff', () => {
    it('calls git diff with two commits', async () => {
      mockGitInstance.diff.mockResolvedValue('diff output')

      const result = await service.getDiff('abc123', 'def456')

      expect(result).toBe('diff output')
      expect(mockGitInstance.diff).toHaveBeenCalledWith(['abc123', 'def456'])
    })
  })
})
