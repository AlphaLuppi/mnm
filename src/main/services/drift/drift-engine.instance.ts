import { DriftEngineService } from './drift-engine.service'
import { DriftCacheService } from './drift-cache.service'
import { ClaudeLLMService } from '@main/services/llm/claude-llm.service'
import { join } from 'node:path'
import { promises as fs } from 'node:fs'
import { logger } from '@main/utils/logger'

let driftEngine: DriftEngineService | null = null

export async function initDriftEngine(projectPath: string): Promise<DriftEngineService | null> {
  const settingsPath = join(projectPath, '.mnm', 'settings.json')

  let apiKey = ''
  let model = 'claude-sonnet-4-6'

  try {
    const raw = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(raw) as { llm?: { apiKey?: string; model?: string } }
    apiKey = settings.llm?.apiKey ?? ''
    model = settings.llm?.model ?? model
  } catch {
    logger.info('drift-engine', 'No settings.json found, drift engine disabled')
    return null
  }

  if (!apiKey) {
    logger.warn('drift-engine', 'No API key configured, drift engine disabled')
    return null
  }

  try {
    const llmService = new ClaudeLLMService(apiKey, model)
    const cacheDir = join(projectPath, '.mnm', 'drift-cache')
    const cacheService = new DriftCacheService(cacheDir)
    driftEngine = new DriftEngineService(llmService, cacheService)
    return driftEngine
  } catch (error) {
    logger.error('drift-engine', 'Failed to initialize drift engine', { error })
    return null
  }
}

export function getDriftEngine(): DriftEngineService | null {
  return driftEngine
}
