import type { DriftEngineService } from './drift-engine.service'
import type { DocumentPairRegistry } from './document-pair-registry'
import type { DriftResult, DriftSeverity, DocumentPair } from '@shared/types/drift.types'
import type { MainEvents } from '@shared/events'
import { logger } from '@main/utils/logger'

export type DriftWatcherConfig = {
  confidenceThreshold: number
  debounceMs: number
}

type EventBus = {
  on<K extends keyof MainEvents>(event: K, handler: (data: MainEvents[K]) => void): void
  emit<K extends keyof MainEvents>(event: K, data: MainEvents[K]): void
}

type StreamSender = {
  send(channel: string, data: unknown): void
}

export class DriftWatcherService {
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  constructor(
    private driftEngine: DriftEngineService,
    private pairRegistry: DocumentPairRegistry,
    private bus: EventBus,
    private streamSender: StreamSender,
    private config: DriftWatcherConfig
  ) {}

  start(): void {
    this.bus.on('file:changed', (event) => this.onFileChanged(event))
    logger.info('drift-watcher', 'Drift watcher started', {
      pairCount: this.pairRegistry.getAllPairs().length,
      threshold: this.config.confidenceThreshold
    })
  }

  stop(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
  }

  private onFileChanged(event: { path: string; type: string }): void {
    const pairs = this.pairRegistry.getPairsForFile(event.path)
    if (pairs.length === 0) return

    const existingTimer = this.debounceTimers.get(event.path)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
      this.debounceTimers.delete(event.path)
      this.analyzeAffectedPairs(pairs)
    }, this.config.debounceMs)

    this.debounceTimers.set(event.path, timer)
  }

  private async analyzeAffectedPairs(pairs: DocumentPair[]): Promise<void> {
    this.streamSender.send('stream:drift-status', {
      status: 'analyzing',
      pairCount: pairs.length
    })

    for (const pair of pairs) {
      try {
        const report = await this.driftEngine.analyzePair(pair.parent, pair.child)

        const significantDrifts = report.drifts.filter(
          (d) => d.confidence >= this.config.confidenceThreshold
        )

        if (significantDrifts.length > 0) {
          const severity = this.computeMaxSeverity(significantDrifts)

          this.bus.emit('drift:detected', {
            id: report.id,
            severity,
            documents: [pair.parent, pair.child]
          })

          this.streamSender.send('stream:drift-alert', {
            id: report.id,
            severity,
            summary: this.buildSummary(significantDrifts),
            documents: [pair.parent, pair.child],
            confidence: report.overallConfidence
          })
        }
      } catch (error) {
        logger.error('drift-watcher', 'Drift analysis failed', { pair, error })
      }
    }

    this.streamSender.send('stream:drift-status', {
      status: 'idle',
      pairCount: 0
    })
  }

  private computeMaxSeverity(drifts: DriftResult[]): DriftSeverity {
    if (drifts.some((d) => d.severity === 'critical')) return 'critical'
    if (drifts.some((d) => d.severity === 'warning')) return 'warning'
    return 'info'
  }

  private buildSummary(drifts: DriftResult[]): string {
    return `${drifts.length} drift(s) detected: ${drifts.map((d) => d.type).join(', ')}`
  }
}
