import { describe, it, expect, beforeEach } from 'vitest'
import { DocumentPairRegistry } from './document-pair-registry'
import type { DocumentPair } from '@shared/types/drift.types'

describe('DocumentPairRegistry', () => {
  let registry: DocumentPairRegistry

  beforeEach(() => {
    registry = new DocumentPairRegistry('/project')
  })

  it('starts with no pairs', () => {
    expect(registry.getAllPairs()).toEqual([])
  })

  it('loads pairs from settings and resolves paths', () => {
    registry.loadFromSettings({
      drift: {
        documentPairs: [
          { parent: 'docs/prd.md', child: 'docs/architecture.md', relationship: 'prd-architecture' }
        ]
      }
    })

    const pairs = registry.getAllPairs()
    expect(pairs).toHaveLength(1)
    expect(pairs[0].parent).toBe('/project/docs/prd.md')
    expect(pairs[0].child).toBe('/project/docs/architecture.md')
  })

  it('looks up pairs by parent file path', () => {
    registry.registerPair({
      parent: '/project/prd.md',
      child: '/project/arch.md',
      relationship: 'prd-architecture'
    })

    const pairs = registry.getPairsForFile('/project/prd.md')
    expect(pairs).toHaveLength(1)
    expect(pairs[0].child).toBe('/project/arch.md')
  })

  it('looks up pairs by child file path', () => {
    registry.registerPair({
      parent: '/project/prd.md',
      child: '/project/arch.md',
      relationship: 'prd-architecture'
    })

    const pairs = registry.getPairsForFile('/project/arch.md')
    expect(pairs).toHaveLength(1)
    expect(pairs[0].parent).toBe('/project/prd.md')
  })

  it('returns empty array for unknown file', () => {
    registry.registerPair({
      parent: '/project/prd.md',
      child: '/project/arch.md',
      relationship: 'prd-architecture'
    })

    expect(registry.getPairsForFile('/project/unknown.md')).toEqual([])
  })

  it('returns multiple pairs for same file', () => {
    const pair1: DocumentPair = {
      parent: '/project/prd.md',
      child: '/project/arch.md',
      relationship: 'prd-architecture'
    }
    const pair2: DocumentPair = {
      parent: '/project/prd.md',
      child: '/project/stories.md',
      relationship: 'brief-prd'
    }

    registry.registerPair(pair1)
    registry.registerPair(pair2)

    const pairs = registry.getPairsForFile('/project/prd.md')
    expect(pairs).toHaveLength(2)
  })

  it('handles empty settings gracefully', () => {
    registry.loadFromSettings({})
    expect(registry.getAllPairs()).toEqual([])
  })
})
