import { promises as fs } from 'node:fs'
import { join, dirname } from 'node:path'

export type ResolutionEntry = {
  driftId: string
  documentA?: string
  documentB?: string
  driftHash?: string
  action: 'fix-source' | 'fix-derived' | 'ignore'
  resolvedAt: number
  resolvedBy: 'user' | 'agent'
}

export class DriftHistoryService {
  private historyPath: string

  constructor(cacheDir: string) {
    this.historyPath = join(cacheDir, 'history.json')
  }

  async addResolution(entry: ResolutionEntry): Promise<void> {
    const history = await this.getHistory()
    history.push(entry)

    await fs.mkdir(dirname(this.historyPath), { recursive: true })
    const tempPath = `${this.historyPath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(history, null, 2), 'utf-8')
    await fs.rename(tempPath, this.historyPath)
  }

  async getHistory(): Promise<ResolutionEntry[]> {
    try {
      const raw = await fs.readFile(this.historyPath, 'utf-8')
      return JSON.parse(raw) as ResolutionEntry[]
    } catch {
      return []
    }
  }

  async isIgnored(documentA: string, documentB: string, driftHash: string): Promise<boolean> {
    const history = await this.getHistory()
    return history.some(
      (entry) =>
        entry.action === 'ignore' &&
        entry.documentA === documentA &&
        entry.documentB === documentB &&
        entry.driftHash === driftHash
    )
  }
}
