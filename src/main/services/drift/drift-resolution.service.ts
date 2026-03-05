import type { DriftHistoryService } from './drift-history.service'
import { logger } from '@main/utils/logger'

type ResolveAction = 'fix-source' | 'fix-derived' | 'ignore'

type StreamSender = {
  send(channel: string, data: unknown): void
}

export class DriftResolutionService {
  constructor(
    private historyService: DriftHistoryService,
    private streamSender: StreamSender
  ) {}

  async resolveDrift(
    driftId: string,
    action: ResolveAction
  ): Promise<void> {
    logger.info('drift-resolution', 'Resolving drift', { driftId, action })

    await this.historyService.addResolution({
      driftId,
      action,
      resolvedAt: Date.now(),
      resolvedBy: 'user'
    })

    this.streamSender.send('stream:drift-resolved', { driftId, action })

    logger.info('drift-resolution', 'Drift resolved', { driftId, action })
  }
}
