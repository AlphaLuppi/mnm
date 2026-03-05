import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } }
  })
  return { default: MockAnthropic }
})

import { ClaudeLLMService } from './claude-llm.service'

describe('ClaudeLLMService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws LLM_NO_API_KEY when apiKey is empty', () => {
    expect(() => new ClaudeLLMService('')).toThrow()
    try {
      new ClaudeLLMService('')
    } catch (e) {
      const error = e as { code: string }
      expect(error.code).toBe('LLM_NO_API_KEY')
    }
  })

  it('creates service with valid API key', () => {
    const service = new ClaudeLLMService('sk-test-key')
    expect(service).toBeDefined()
  })

  describe('compareDocuments', () => {
    it('returns parsed drift report', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              drifts: [
                {
                  type: 'contradiction',
                  description: 'Version mismatch',
                  confidence: 85,
                  severity: 'warning',
                  parentSection: 'Overview',
                  childSection: 'Summary'
                }
              ],
              overallConfidence: 85
            })
          }
        ]
      })

      const service = new ClaudeLLMService('sk-test-key')
      const report = await service.compareDocuments('parent text', 'child text')

      expect(report.drifts).toHaveLength(1)
      expect(report.drifts[0].type).toBe('contradiction')
      expect(report.drifts[0].confidence).toBe(85)
      expect(report.overallConfidence).toBe(85)
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })
  })

  describe('extractConcepts', () => {
    it('returns parsed concepts', async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify([
              { name: 'Auth', description: 'JWT authentication', section: 'Security' }
            ])
          }
        ]
      })

      const service = new ClaudeLLMService('sk-test-key')
      const concepts = await service.extractConcepts('doc text')

      expect(concepts).toHaveLength(1)
      expect(concepts[0].name).toBe('Auth')
      expect(concepts[0].sourceSection).toBe('Security')
    })
  })

  describe('retry logic', () => {
    it('retries 2x with exponential backoff on failure', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue({
          content: [{ type: 'text', text: '{"drifts":[],"overallConfidence":0}' }]
        })

      const service = new ClaudeLLMService('sk-test-key')
      const report = await service.compareDocuments('a', 'b')

      expect(report.drifts).toHaveLength(0)
      expect(mockCreate).toHaveBeenCalledTimes(3)
    }, 15000)

    it('throws LLM_TIMEOUT after 3 failed attempts', async () => {
      mockCreate.mockRejectedValue(new Error('timeout'))

      const service = new ClaudeLLMService('sk-test-key')

      try {
        await service.compareDocuments('a', 'b')
        expect.unreachable('should have thrown')
      } catch (e) {
        const error = e as { code: string }
        expect(error.code).toBe('LLM_TIMEOUT')
      }
    }, 15000)
  })
})
