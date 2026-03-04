import type { DiffHunk } from '../git-history.types'

export function parseDiffHunks(rawDiff: string): DiffHunk[] {
  const lines = rawDiff.split('\n')
  const hunks: DiffHunk[] = []
  let currentHunk: DiffHunk | null = null
  let lineCounter = 0

  for (const line of lines) {
    if (line.startsWith('@@')) {
      currentHunk = { header: line, lines: [] }
      hunks.push(currentHunk)
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/)
      lineCounter = match ? parseInt(match[1], 10) : 0
      continue
    }

    if (!currentHunk) continue

    if (line.startsWith('+')) {
      currentHunk.lines.push({
        type: 'addition',
        content: line.slice(1),
        prefix: '+',
        lineNumber: lineCounter++
      })
    } else if (line.startsWith('-')) {
      currentHunk.lines.push({
        type: 'deletion',
        content: line.slice(1),
        prefix: '-',
        lineNumber: null
      })
    } else {
      currentHunk.lines.push({
        type: 'context',
        content: line.startsWith(' ') ? line.slice(1) : line,
        prefix: ' ',
        lineNumber: lineCounter++
      })
    }
  }

  return hunks
}
