import { promises as fs } from 'node:fs'
import type { LLMService } from '@main/services/llm/llm.service'
import { DriftCacheService } from './drift-cache.service'
import { parseMarkdownToAST, extractTextContent } from './markdown-parser'
import type { DriftReport } from '@shared/types/drift.types'
import { logger } from '@main/utils/logger'

export class DriftEngineService {
  constructor(
    private llmService: LLMService,
    private cacheService: DriftCacheService
  ) {}

  async analyzePair(docA: string, docB: string): Promise<DriftReport> {
    const pipelineStart = performance.now()

    // 1. Read files
    const [contentA, contentB] = await Promise.all([
      fs.readFile(docA, 'utf-8'),
      fs.readFile(docB, 'utf-8')
    ])

    // 2. Check cache
    const pairHash = this.cacheService.computeHash(contentA + contentB)
    const cached = await this.cacheService.getCachedResult(pairHash)
    if (cached) {
      logger.info('drift-engine', 'Cache hit', { pairHash })
      return cached.report
    }

    // 3. Parse Markdown AST
    const astA = parseMarkdownToAST(contentA)
    const astB = parseMarkdownToAST(contentB)

    // 4. Extract text for LLM
    const textA = extractTextContent(astA)
    const textB = extractTextContent(astB)

    const pipelineLatencyMs = performance.now() - pipelineStart
    logger.info('drift-engine', `Pipeline local latency: ${pipelineLatencyMs.toFixed(1)}ms`)

    // 5. Send to LLM for comparison
    const llmStart = performance.now()
    const report = await this.llmService.compareDocuments(textA, textB)
    const llmLatencyMs = performance.now() - llmStart

    // 6. Enrich report with metadata
    const enrichedReport: DriftReport = {
      ...report,
      documentA: docA,
      documentB: docB,
      timestamp: Date.now(),
      pipelineLatencyMs,
      llmLatencyMs
    }

    // 7. Cache results (fire-and-forget)
    this.cacheService.cacheResult(pairHash, enrichedReport).catch(() => {
      logger.warn('drift-engine', 'Failed to cache drift result')
    })

    return enrichedReport
  }
}
