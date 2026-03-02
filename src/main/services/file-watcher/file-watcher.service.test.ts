import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'

// Mock chokidar
const mockWatcher = new EventEmitter() as EventEmitter & {
  close: ReturnType<typeof vi.fn>
}
mockWatcher.close = vi.fn().mockResolvedValue(undefined)

vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => mockWatcher)
  }
}))

// Mock event bus
const emitSpy = vi.fn()
vi.mock('@main/utils/event-bus', () => ({
  eventBus: {
    emit: (...args: unknown[]) => emitSpy(...args),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Mock logger
vi.mock('@main/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

import { FileWatcherService } from './file-watcher.service'

describe('FileWatcherService', () => {
  let service: FileWatcherService

  beforeEach(() => {
    vi.clearAllMocks()
    mockWatcher.removeAllListeners()
    service = new FileWatcherService()
  })

  afterEach(async () => {
    await service.stop()
  })

  it('starts watching a project path', async () => {
    const chokidar = await import('chokidar')
    service.start('/test/project')

    expect(chokidar.default.watch).toHaveBeenCalledWith(
      '/test/project',
      expect.objectContaining({
        persistent: true,
        ignoreInitial: true,
        usePolling: false
      })
    )
  })

  it('emits file:changed on file add', () => {
    service.start('/test/project')
    mockWatcher.emit('add', '/test/project/src/new-file.ts')

    expect(emitSpy).toHaveBeenCalledWith('file:changed', expect.objectContaining({
      path: '/test/project/src/new-file.ts',
      type: 'create'
    }))
  })

  it('emits file:changed on file change', () => {
    service.start('/test/project')
    mockWatcher.emit('change', '/test/project/src/main.ts')

    expect(emitSpy).toHaveBeenCalledWith('file:changed', expect.objectContaining({
      path: '/test/project/src/main.ts',
      type: 'modify'
    }))
  })

  it('emits file:changed on file unlink', () => {
    service.start('/test/project')
    mockWatcher.emit('unlink', '/test/project/src/old.ts')

    expect(emitSpy).toHaveBeenCalledWith('file:changed', expect.objectContaining({
      path: '/test/project/src/old.ts',
      type: 'delete'
    }))
  })

  it('stop closes the watcher', async () => {
    service.start('/test/project')
    await service.stop()

    expect(mockWatcher.close).toHaveBeenCalled()
    expect(service.getStatus()).toBe('idle')
  })

  it('correlates file changes with active agents', () => {
    service.start('/test/project')

    const correlator = service.getCorrelator()
    correlator.registerAgentProcess('agent-1', 12345)

    mockWatcher.emit('change', '/test/project/src/file.ts')

    expect(emitSpy).toHaveBeenCalledWith('file:changed', expect.objectContaining({
      agentId: 'agent-1'
    }))
  })

  it('uses custom ignored patterns', async () => {
    const chokidar = await import('chokidar')
    const customService = new FileWatcherService({
      ignoredPatterns: ['**/*.log']
    })
    customService.start('/test/project')

    expect(chokidar.default.watch).toHaveBeenCalledWith(
      '/test/project',
      expect.objectContaining({
        ignored: ['**/*.log']
      })
    )

    await customService.stop()
  })

  it('getStatus returns current status', () => {
    expect(service.getStatus()).toBe('idle')
    service.start('/test/project')
    expect(service.getStatus()).toBe('watching')
  })
})
