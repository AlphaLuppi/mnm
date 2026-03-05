export type DriftSeverity = 'critical' | 'warning' | 'info'

export type Concept = {
  id: string
  name: string
  description: string
  sourceSection: string
  sourceLineRange: [number, number]
}

export type DriftResult = {
  id: string
  parentConcept: Concept
  childConcept: Concept | null
  type: 'contradiction' | 'missing' | 'outdated' | 'ambiguous'
  description: string
  confidence: number
  severity: DriftSeverity
}

export type DriftReport = {
  id: string
  documentA: string
  documentB: string
  timestamp: number
  drifts: DriftResult[]
  overallConfidence: number
  pipelineLatencyMs: number
  llmLatencyMs: number
}

export type DocumentPair = {
  parent: string
  child: string
  relationship: 'brief-prd' | 'prd-architecture' | 'architecture-story' | 'story-code'
}

export type DriftCacheEntry = {
  pairHash: string
  report: DriftReport
  cachedAt: number
  documentAHash: string
  documentBHash: string
}
