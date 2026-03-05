import Anthropic from '@anthropic-ai/sdk'
import type { LLMService } from './llm.service'
import type { DriftReport, Concept, DriftResult } from '@shared/types/drift.types'
import type { AppError } from '@shared/types/error.types'

const MAX_RETRIES = 2
const BASE_DELAY_MS = 1000

export class ClaudeLLMService implements LLMService {
  private client: Anthropic

  private model: string

  constructor(
    apiKey: string,
    model: string = 'claude-sonnet-4-6'
  ) {
    this.model = model
    if (!apiKey) {
      throw {
        code: 'LLM_NO_API_KEY',
        message: 'Cle API Claude requise pour la drift detection',
        source: 'claude-llm-service'
      } satisfies AppError
    }
    this.client = new Anthropic({ apiKey })
  }

  async compareDocuments(parentDoc: string, childDoc: string): Promise<DriftReport> {
    return this.withRetry(() => this.doCompareDocuments(parentDoc, childDoc))
  }

  async extractConcepts(document: string): Promise<Concept[]> {
    return this.withRetry(() => this.doExtractConcepts(document))
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }
    throw {
      code: 'LLM_TIMEOUT',
      message: `LLM call failed after ${MAX_RETRIES + 1} attempts`,
      source: 'claude-llm-service',
      details: lastError
    } satisfies AppError
  }

  private async doCompareDocuments(parentDoc: string, childDoc: string): Promise<DriftReport> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Analyze these two documents for drift/inconsistencies between them. The first is the parent (source of truth), the second is the child (derived document).

PARENT DOCUMENT:
${parentDoc}

CHILD DOCUMENT:
${childDoc}

Return a JSON object with this exact structure:
{
  "drifts": [
    {
      "type": "contradiction" | "missing" | "outdated" | "ambiguous",
      "description": "description of the inconsistency",
      "confidence": 0-100,
      "severity": "critical" | "warning" | "info",
      "parentSection": "section name in parent",
      "childSection": "section name in child or null"
    }
  ],
  "overallConfidence": 0-100
}

Only return valid JSON, no markdown fences or other text.`
        }
      ]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text) as {
      drifts: {
        type: string
        description: string
        confidence: number
        severity: string
        parentSection: string
        childSection: string | null
      }[]
      overallConfidence: number
    }

    const drifts: DriftResult[] = parsed.drifts.map((d, i) => ({
      id: `drift-${i}`,
      parentConcept: {
        id: `parent-${i}`,
        name: d.parentSection,
        description: '',
        sourceSection: d.parentSection,
        sourceLineRange: [0, 0] as [number, number]
      },
      childConcept: d.childSection
        ? {
            id: `child-${i}`,
            name: d.childSection,
            description: '',
            sourceSection: d.childSection,
            sourceLineRange: [0, 0] as [number, number]
          }
        : null,
      type: d.type as DriftResult['type'],
      description: d.description,
      confidence: d.confidence,
      severity: d.severity as DriftResult['severity']
    }))

    return {
      id: `report-${Date.now()}`,
      documentA: '',
      documentB: '',
      timestamp: Date.now(),
      drifts,
      overallConfidence: parsed.overallConfidence,
      pipelineLatencyMs: 0,
      llmLatencyMs: 0
    }
  }

  private async doExtractConcepts(document: string): Promise<Concept[]> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Extract the key concepts from this document. Return a JSON array with this structure:
[
  {
    "name": "concept name",
    "description": "brief description",
    "section": "section header where found"
  }
]

DOCUMENT:
${document}

Only return valid JSON, no markdown fences or other text.`
        }
      ]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text) as { name: string; description: string; section: string }[]

    return parsed.map((c, i) => ({
      id: `concept-${i}`,
      name: c.name,
      description: c.description,
      sourceSection: c.section,
      sourceLineRange: [0, 0] as [number, number]
    }))
  }
}
