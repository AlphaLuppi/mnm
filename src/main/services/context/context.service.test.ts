import { describe, it, expect, beforeEach } from 'vitest'
import { ContextService } from './context.service'

describe('ContextService', () => {
  let service: ContextService

  beforeEach(() => {
    service = new ContextService('/test/project')
  })

  describe('addFileToAgent / getAgentFiles', () => {
    it('adds a file to an agent context', () => {
      service.addFileToAgent('agent-1', '/test/project/src/main.ts')
      expect(service.getAgentFiles('agent-1')).toEqual(['/test/project/src/main.ts'])
    })

    it('does not duplicate files', () => {
      service.addFileToAgent('agent-1', '/test/project/src/main.ts')
      service.addFileToAgent('agent-1', '/test/project/src/main.ts')
      expect(service.getAgentFiles('agent-1')).toHaveLength(1)
    })

    it('supports multiple agents', () => {
      service.addFileToAgent('agent-1', '/a.ts')
      service.addFileToAgent('agent-2', '/b.ts')
      expect(service.getAgentFiles('agent-1')).toEqual(['/a.ts'])
      expect(service.getAgentFiles('agent-2')).toEqual(['/b.ts'])
    })
  })

  describe('removeFileFromAgent', () => {
    it('removes a file from agent context', () => {
      service.addFileToAgent('agent-1', '/a.ts')
      service.addFileToAgent('agent-1', '/b.ts')
      service.removeFileFromAgent('agent-1', '/a.ts')
      expect(service.getAgentFiles('agent-1')).toEqual(['/b.ts'])
    })

    it('does nothing for unknown agent', () => {
      service.removeFileFromAgent('unknown', '/a.ts')
      expect(service.getAgentFiles('unknown')).toEqual([])
    })
  })

  describe('getAllContexts', () => {
    it('returns all agent-context associations', () => {
      service.addFileToAgent('agent-1', '/a.ts')
      service.addFileToAgent('agent-2', '/b.ts')
      const all = service.getAllContexts()
      expect(all).toEqual({
        'agent-1': ['/a.ts'],
        'agent-2': ['/b.ts']
      })
    })
  })
})
