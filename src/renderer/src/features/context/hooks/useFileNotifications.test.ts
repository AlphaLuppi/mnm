import { describe, it, expect, beforeEach } from 'vitest'
import { useContextStore } from '../context.store'
import type { ContextFile } from '../context.types'

function makeFile(overrides: Partial<ContextFile> = {}): ContextFile {
  return {
    path: '/project/src/main.ts',
    name: 'main.ts',
    extension: 'ts',
    relativePath: 'src/main.ts',
    agentIds: ['agent-1'],
    isModified: false,
    lastModified: 0,
    ...overrides
  }
}

describe('useFileNotifications (store logic)', () => {
  beforeEach(() => {
    useContextStore.setState({
      files: new Map(),
      selectedStoryFilter: null,
      pendingNotificationCount: 0
    })
  })

  describe('incrementNotificationCount', () => {
    it('increments the count', () => {
      useContextStore.getState().incrementNotificationCount()
      expect(useContextStore.getState().pendingNotificationCount).toBe(1)

      useContextStore.getState().incrementNotificationCount()
      expect(useContextStore.getState().pendingNotificationCount).toBe(2)
    })
  })

  describe('resetNotificationCount', () => {
    it('resets count to 0', () => {
      useContextStore.getState().incrementNotificationCount()
      useContextStore.getState().incrementNotificationCount()
      useContextStore.getState().resetNotificationCount()
      expect(useContextStore.getState().pendingNotificationCount).toBe(0)
    })
  })

  describe('markFileModified with notification flow', () => {
    it('marks file modified and increments notification count', () => {
      const file = makeFile()
      useContextStore.getState().addFile(file)

      useContextStore.getState().markFileModified(file.path, 'agent-1')
      useContextStore.getState().incrementNotificationCount()

      const updated = useContextStore.getState().files.get(file.path)
      expect(updated?.isModified).toBe(true)
      expect(updated?.lastModifiedBy).toBe('agent-1')
      expect(useContextStore.getState().pendingNotificationCount).toBe(1)
    })

    it('does not mark untracked files', () => {
      useContextStore.getState().markFileModified('/unknown.ts', 'agent-1')
      expect(useContextStore.getState().files.size).toBe(0)
    })
  })

  describe('shared file detection', () => {
    it('identifies affected agents when file is shared', () => {
      const file = makeFile({ agentIds: ['agent-1', 'agent-2'] })
      useContextStore.getState().addFile(file)

      const agents = useContextStore.getState().getAgentsForFile(file.path)
      const affectedAgents = agents.filter((id) => id !== 'agent-1')
      expect(affectedAgents).toEqual(['agent-2'])
    })

    it('returns no affected agents for single-agent file', () => {
      const file = makeFile({ agentIds: ['agent-1'] })
      useContextStore.getState().addFile(file)

      const agents = useContextStore.getState().getAgentsForFile(file.path)
      const affectedAgents = agents.filter((id) => id !== 'agent-1')
      expect(affectedAgents).toEqual([])
    })
  })
})
