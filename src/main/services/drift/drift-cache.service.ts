import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import type { DriftReport, DriftCacheEntry, Concept } from '@shared/types/drift.types'

export class DriftCacheService {
  constructor(private cacheDir: string) {}

  computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16)
  }

  async getCachedResult(pairHash: string): Promise<DriftCacheEntry | null> {
    const filePath = join(this.cacheDir, `results-${pairHash}.json`)
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data) as DriftCacheEntry
    } catch {
      return null
    }
  }

  async cacheResult(pairHash: string, report: DriftReport): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true })
    const filePath = join(this.cacheDir, `results-${pairHash}.json`)
    const tempPath = `${filePath}.tmp`
    const entry: DriftCacheEntry = {
      pairHash,
      report,
      cachedAt: Date.now(),
      documentAHash: this.computeHash(report.documentA),
      documentBHash: this.computeHash(report.documentB)
    }
    await fs.writeFile(tempPath, JSON.stringify(entry, null, 2), 'utf-8')
    await fs.rename(tempPath, filePath)
  }

  async getCachedConcepts(docHash: string): Promise<Concept[] | null> {
    const filePath = join(this.cacheDir, `concepts-${docHash}.json`)
    try {
      const data = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(data) as Concept[]
    } catch {
      return null
    }
  }

  async cacheConcepts(docHash: string, concepts: Concept[]): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true })
    const filePath = join(this.cacheDir, `concepts-${docHash}.json`)
    const tempPath = `${filePath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(concepts, null, 2), 'utf-8')
    await fs.rename(tempPath, filePath)
  }
}
