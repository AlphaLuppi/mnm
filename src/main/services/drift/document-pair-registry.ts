import { resolve, normalize } from 'node:path'
import type { DocumentPair } from '@shared/types/drift.types'

export class DocumentPairRegistry {
  private pairs: DocumentPair[] = []
  private fileIndex: Map<string, DocumentPair[]> = new Map()

  constructor(private projectRoot: string) {}

  loadFromSettings(settings: { drift?: { documentPairs?: DocumentPair[] } }): void {
    const configuredPairs = settings.drift?.documentPairs ?? []
    for (const pair of configuredPairs) {
      this.registerPair({
        ...pair,
        parent: resolve(this.projectRoot, pair.parent),
        child: resolve(this.projectRoot, pair.child)
      })
    }
  }

  registerPair(pair: DocumentPair): void {
    this.pairs.push(pair)
    this.addToIndex(normalize(pair.parent), pair)
    this.addToIndex(normalize(pair.child), pair)
  }

  getPairsForFile(filePath: string): DocumentPair[] {
    return this.fileIndex.get(normalize(filePath)) ?? []
  }

  getAllPairs(): DocumentPair[] {
    return [...this.pairs]
  }

  private addToIndex(key: string, pair: DocumentPair): void {
    const existing = this.fileIndex.get(key) ?? []
    existing.push(pair)
    this.fileIndex.set(key, existing)
  }
}
