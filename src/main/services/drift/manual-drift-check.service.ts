import type { DriftEngineService } from './drift-engine.service'
import type { DriftReport, DriftResult, DriftSeverity } from '@shared/types/drift.types'
import { logger } from '@main/utils/logger'

type StreamSender = {
  send(channel: string, data: unknown): void
}

export class ManualDriftCheckService {
  constructor(
    private driftEngine: DriftEngineService,
    private streamSender: StreamSender
  ) {}

  async runManualCheck(pairs: Array<{ docA: string; docB: string }>): Promise<DriftReport[]> {
    const reports: DriftReport[] = []

    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i]

      this.streamSender.send('stream:drift-progress', {
        completed: i,
        total: pairs.length,
        currentPair: [pair.docA, pair.docB]
      })

      try {
        const report = await this.driftEngine.analyzePair(pair.docA, pair.docB)
        reports.push(report)

        if (report.drifts.length > 0) {
          this.streamSender.send('stream:drift-alert', {
            id: report.id,
            severity: this.computeMaxSeverity(report.drifts),
            summary: `${report.drifts.length} drift(s) in ${pair.docA} <-> ${pair.docB}`,
            documents: [pair.docA, pair.docB],
            confidence: report.overallConfidence
          })
        }
      } catch (error) {
        logger.error('manual-drift-check', 'Pair analysis failed', { pair, error })
      }
    }

    this.streamSender.send('stream:drift-progress', {
      completed: pairs.length,
      total: pairs.length,
      currentPair: ['', '']
    })

    return reports
  }

  private computeMaxSeverity(drifts: DriftResult[]): DriftSeverity {
    if (drifts.some((d) => d.severity === 'critical')) return 'critical'
    if (drifts.some((d) => d.severity === 'warning')) return 'warning'
    return 'info'
  }
}
