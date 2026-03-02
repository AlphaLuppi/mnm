import chokidar, { type FSWatcher } from 'chokidar'
import { eventBus } from '@main/utils/event-bus'
import { logger } from '@main/utils/logger'
import type { FileChangeEvent, WatcherOptions, WatcherStatus } from './file-watcher.types'
import { EventCorrelator } from './event-correlator'

export class FileWatcherService {
  private watcher: FSWatcher | null = null
  private correlator: EventCorrelator
  private status: WatcherStatus = 'idle'
  private options: WatcherOptions

  constructor(options: WatcherOptions = {}) {
    this.options = options
    this.correlator = new EventCorrelator()
  }

  start(projectPath: string): void {
    if (this.watcher) {
      this.stop()
    }

    const ignored = this.options.ignoredPatterns ?? [
      '**/node_modules/**',
      '**/.git/**',
      '**/.mnm/**',
      '**/dist/**',
      '**/out/**'
    ]

    this.watcher = chokidar.watch(projectPath, {
      ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: this.options.stabilityThreshold ?? 100,
        pollInterval: 50
      },
      usePolling: false
    })

    this.watcher.on('add', (path: string) => this.handleChange(path, 'create'))
    this.watcher.on('change', (path: string) => this.handleChange(path, 'modify'))
    this.watcher.on('unlink', (path: string) => this.handleChange(path, 'delete'))

    this.watcher.on('error', (error: unknown) => {
      this.status = 'error'
      logger.error('file-watcher', 'Watcher error', { error })
    })

    this.watcher.on('ready', () => {
      this.status = 'watching'
      logger.info('file-watcher', `Watching ${projectPath}`)
    })

    this.status = 'watching'
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.status = 'idle'
  }

  getCorrelator(): EventCorrelator {
    return this.correlator
  }

  getStatus(): WatcherStatus {
    return this.status
  }

  private handleChange(path: string, type: FileChangeEvent['type']): void {
    const event: FileChangeEvent = {
      path,
      type,
      timestamp: Date.now()
    }

    const correlated = this.correlator.correlate(event)

    eventBus.emit('file:changed', {
      path: correlated.path,
      type: correlated.type,
      agentId: correlated.agentId
    })
  }
}
