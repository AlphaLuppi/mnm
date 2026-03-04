import { describe, it, expect } from 'vitest'
import { parseDiffHunks } from './diff-parser'

describe('parseDiffHunks', () => {
  it('parses a simple unified diff', () => {
    const diff = `@@ -1,3 +1,4 @@
 line1
-removed
+added
+new line
 line3`

    const hunks = parseDiffHunks(diff)
    expect(hunks).toHaveLength(1)
    expect(hunks[0].header).toBe('@@ -1,3 +1,4 @@')
    expect(hunks[0].lines).toHaveLength(5)

    expect(hunks[0].lines[0]).toEqual({
      type: 'context',
      content: 'line1',
      prefix: ' ',
      lineNumber: 1
    })
    expect(hunks[0].lines[1]).toEqual({
      type: 'deletion',
      content: 'removed',
      prefix: '-',
      lineNumber: null
    })
    expect(hunks[0].lines[2]).toEqual({
      type: 'addition',
      content: 'added',
      prefix: '+',
      lineNumber: 2
    })
    expect(hunks[0].lines[3]).toEqual({
      type: 'addition',
      content: 'new line',
      prefix: '+',
      lineNumber: 3
    })
    expect(hunks[0].lines[4]).toEqual({
      type: 'context',
      content: 'line3',
      prefix: ' ',
      lineNumber: 4
    })
  })

  it('handles multiple hunks', () => {
    const diff = `@@ -1,2 +1,2 @@
-old
+new
@@ -10,2 +10,2 @@
-old2
+new2`

    const hunks = parseDiffHunks(diff)
    expect(hunks).toHaveLength(2)
    expect(hunks[0].lines).toHaveLength(2)
    expect(hunks[1].lines).toHaveLength(2)
  })

  it('returns empty array for non-diff content', () => {
    const hunks = parseDiffHunks('no diff here')
    expect(hunks).toEqual([])
  })

  it('handles additions-only diff', () => {
    const diff = `@@ -0,0 +1,2 @@
+line1
+line2`

    const hunks = parseDiffHunks(diff)
    expect(hunks[0].lines).toHaveLength(2)
    expect(hunks[0].lines.every((l) => l.type === 'addition')).toBe(true)
  })

  it('handles deletions-only diff', () => {
    const diff = `@@ -1,2 +0,0 @@
-line1
-line2`

    const hunks = parseDiffHunks(diff)
    expect(hunks[0].lines).toHaveLength(2)
    expect(hunks[0].lines.every((l) => l.type === 'deletion')).toBe(true)
    expect(hunks[0].lines.every((l) => l.lineNumber === null)).toBe(true)
  })
})
