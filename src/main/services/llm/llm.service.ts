import type { DriftReport, Concept } from '@shared/types/drift.types'

export interface LLMService {
  compareDocuments(parentDoc: string, childDoc: string): Promise<DriftReport>
  extractConcepts(document: string): Promise<Concept[]>
}
