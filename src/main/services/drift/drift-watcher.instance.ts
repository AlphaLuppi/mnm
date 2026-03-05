import { DriftWatcherService } from './drift-watcher.service'
import { DocumentPairRegistry } from './document-pair-registry'
import { getDriftEngine } from './drift-engine.instance'
import { eventBus } from '@main/utils/event-bus'
import { sendStream } from '@main/ipc/streams'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@main/utils/logger'

let driftWatcher: DriftWatcherService | null = null
let pairRegistry: DocumentPairRegistry | null = null

export async function initDriftWatcher(projectPath: string): Promise<DriftWatcherService | null> {
  const engine = getDriftEngine()
  if (!engine) {
    logger.info('drift-watcher', 'Drift engine not available, skipping watcher init')
    return null
  }

  pairRegistry = new DocumentPairRegistry(projectPath)

  // Load pairs from settings
  const settingsPath = join(projectPath, '.mnm', 'settings.json')
  let confidenceThreshold = 50

  try {
    const raw = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(raw) as {
      drift?: { documentPairs?: unknown[]; confidenceThreshold?: number }
    }
    pairRegistry.loadFromSettings(settings as never)
    confidenceThreshold = settings.drift?.confidenceThreshold ?? 50
  } catch {
    logger.info('drift-watcher', 'No settings.json found, using default config')
  }

  const streamSender = { send: sendStream as (channel: string, data: unknown) => void }

  driftWatcher = new DriftWatcherService(
    engine,
    pairRegistry,
    eventBus,
    streamSender,
    { confidenceThreshold, debounceMs: 500 }
  )

  driftWatcher.start()
  return driftWatcher
}

export function getDriftWatcher(): DriftWatcherService | null {
  return driftWatcher
}

export function getPairRegistry(): DocumentPairRegistry | null {
  return pairRegistry
}
