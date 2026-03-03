import { describe, it, expect, beforeEach } from 'vitest'
import { useContextStore } from './context.store'
import type { ContextFile } from './context.types'

function makeFile(overrides: Partial<ContextFile> = {}): ContextFile {
  return {
    path: '/project/src/main.ts',
    name: 'main.ts',
    extension: 'ts',
    relativePath: 'src/main.ts',
    agentIds: [],
    isModified: false,
    lastModified: 0,
    ...overrides
  }
}

describe('context.store', () => {
  beforeEach(() => {
    useContextStore.setState({ files: new Map(), selectedStoryFilter: null })
  })

  describe('addFile / removeFile', () => {
    it('adds a file to the store', () => {
      const file = makeFile()
      useContextStore.getState().addFile(file)

      expect(useContextStore.getState().files.size).toBe(1)
      expect(useContextStore.getState().files.get(file.path)).toEqual(file)
    })

    it('removes a file from the store', () => {
      const file = makeFile()
      useContextStore.getState().addFile(file)
      useContextStore.getState().removeFile(file.path)

      expect(useContextStore.getState().files.size).toBe(0)
    })
  })

  describe('updateFileStatus', () => {
    it('updates partial fields on an existing file', () => {
      const file = makeFile()
      useContextStore.getState().addFile(file)
      useContextStore.getState().updateFileStatus(file.path, { isModified: true })

      const updated = useContextStore.getState().files.get(file.path)
      expect(updated?.isModified).toBe(true)
      expect(updated?.name).toBe('main.ts')
    })

    it('does nothing for a non-existent file', () => {
      useContextStore.getState().updateFileStatus('/nope', { isModified: true })
      expect(useContextStore.getState().files.size).toBe(0)
    })
  })

  describe('setAgentFiles', () => {
    it('adds agent to files in the list', () => {
      const f1 = makeFile({ path: '/a.ts', name: 'a.ts' })
      const f2 = makeFile({ path: '/b.ts', name: 'b.ts' })
      useContextStore.getState().addFile(f1)
      useContextStore.getState().addFile(f2)

      useContextStore.getState().setAgentFiles('agent-1', ['/a.ts', '/b.ts'])

      expect(useContextStore.getState().files.get('/a.ts')?.agentIds).toEqual(['agent-1'])
      expect(useContextStore.getState().files.get('/b.ts')?.agentIds).toEqual(['agent-1'])
    })

    it('removes agent from files not in the new list', () => {
      const f1 = makeFile({ path: '/a.ts', name: 'a.ts', agentIds: ['agent-1'] })
      const f2 = makeFile({ path: '/b.ts', name: 'b.ts', agentIds: ['agent-1'] })
      useContextStore.getState().addFile(f1)
      useContextStore.getState().addFile(f2)

      useContextStore.getState().setAgentFiles('agent-1', ['/a.ts'])

      expect(useContextStore.getState().files.get('/a.ts')?.agentIds).toEqual(['agent-1'])
      expect(useContextStore.getState().files.get('/b.ts')?.agentIds).toEqual([])
    })
  })

  describe('removeAgentFromFiles', () => {
    it('removes agent from all files', () => {
      const f1 = makeFile({ path: '/a.ts', name: 'a.ts', agentIds: ['agent-1', 'agent-2'] })
      const f2 = makeFile({ path: '/b.ts', name: 'b.ts', agentIds: ['agent-1'] })
      useContextStore.getState().addFile(f1)
      useContextStore.getState().addFile(f2)

      useContextStore.getState().removeAgentFromFiles('agent-1')

      expect(useContextStore.getState().files.get('/a.ts')?.agentIds).toEqual(['agent-2'])
      expect(useContextStore.getState().files.get('/b.ts')?.agentIds).toEqual([])
    })
  })

  describe('markFileModified', () => {
    it('marks a tracked file as modified with agentId', () => {
      const file = makeFile()
      useContextStore.getState().addFile(file)
      useContextStore.getState().markFileModified(file.path, 'agent-1')

      const updated = useContextStore.getState().files.get(file.path)
      expect(updated?.isModified).toBe(true)
      expect(updated?.lastModifiedBy).toBe('agent-1')
      expect(updated?.lastModified).toBeGreaterThan(0)
    })

    it('does nothing for untracked files', () => {
      useContextStore.getState().markFileModified('/unknown.ts', 'agent-1')
      expect(useContextStore.getState().files.size).toBe(0)
    })
  })

  describe('setStoryFilter / getFilesForCurrentView', () => {
    it('returns all files when no filter is set', () => {
      useContextStore.getState().addFile(makeFile({ path: '/a.ts', storyId: 'story-1' }))
      useContextStore.getState().addFile(makeFile({ path: '/b.ts', storyId: 'story-2' }))

      const result = useContextStore.getState().getFilesForCurrentView()
      expect(result).toHaveLength(2)
    })

    it('filters by story when filter is set', () => {
      useContextStore.getState().addFile(makeFile({ path: '/a.ts', storyId: 'story-1' }))
      useContextStore.getState().addFile(makeFile({ path: '/b.ts', storyId: 'story-2' }))
      useContextStore.getState().setStoryFilter('story-1')

      const result = useContextStore.getState().getFilesForCurrentView()
      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('/a.ts')
    })

    it('clears filter when null is passed', () => {
      useContextStore.getState().addFile(makeFile({ path: '/a.ts', storyId: 'story-1' }))
      useContextStore.getState().setStoryFilter('story-1')
      useContextStore.getState().setStoryFilter(null)

      const result = useContextStore.getState().getFilesForCurrentView()
      expect(result).toHaveLength(1)
    })
  })

  describe('getAgentsForFile', () => {
    it('returns agent IDs for a tracked file', () => {
      useContextStore.getState().addFile(makeFile({ agentIds: ['a1', 'a2'] }))
      expect(useContextStore.getState().getAgentsForFile('/project/src/main.ts')).toEqual(['a1', 'a2'])
    })

    it('returns empty array for unknown file', () => {
      expect(useContextStore.getState().getAgentsForFile('/nope')).toEqual([])
    })
  })
})
