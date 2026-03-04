import { parseDiffHunks } from '../utils/diff-parser'

type FileDiffViewerProps = {
  diff: string
  commitA: string
  commitB: string
}

export function FileDiffViewer({ diff, commitA, commitB }: FileDiffViewerProps) {
  const hunks = parseDiffHunks(diff)

  if (hunks.length === 0) {
    return (
      <div className="p-4 text-sm text-text-muted">
        Aucune différence
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-text-muted border-b border-border-default">
        <span className="font-mono text-xs">{commitA.slice(0, 7)}</span>
        <span>vs</span>
        <span className="font-mono text-xs">
          {commitB === 'HEAD' ? 'Actuel' : commitB.slice(0, 7)}
        </span>
      </div>

      <div className="font-mono text-sm">
        {hunks.map((hunk, i) => (
          <div key={i}>
            <div className="bg-bg-elevated px-4 py-1 text-xs text-text-muted">
              {hunk.header}
            </div>
            {hunk.lines.map((line, j) => (
              <div
                key={j}
                className={`flex px-4 py-0.5 ${getDiffLineClass(line.type)}`}
              >
                <span className="inline-block w-8 shrink-0 text-right text-text-muted select-none mr-3">
                  {line.lineNumber ?? ''}
                </span>
                <span className="mr-2 text-text-muted select-none">{line.prefix}</span>
                <span className="whitespace-pre">{line.content}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function getDiffLineClass(type: 'addition' | 'deletion' | 'context'): string {
  switch (type) {
    case 'addition':
      return 'bg-status-green/10 text-status-green'
    case 'deletion':
      return 'bg-status-red/10 text-status-red'
    case 'context':
      return 'text-text-secondary'
  }
}
