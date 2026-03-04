import { useState } from 'react'
import { useFileVersion } from '../hooks/useFileVersion'
import { FileDiffViewer } from './FileDiffViewer'

type FileVersionViewerProps = {
  filePath: string
  commitHash: string
  commitMessage: string
  commitDate: string
  commitAuthor: string
}

export function FileVersionViewer({
  filePath,
  commitHash,
  commitMessage,
  commitDate,
  commitAuthor
}: FileVersionViewerProps) {
  const version = useFileVersion(filePath, commitHash)
  const [showDiff, setShowDiff] = useState(false)
  const [diff, setDiff] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  const handleCompare = async () => {
    setDiffLoading(true)
    try {
      const result = await window.electronAPI.invoke('git:file-diff', {
        commitA: commitHash,
        commitB: 'HEAD'
      })
      setDiff(result)
      setShowDiff(true)
    } catch {
      setDiff(null)
    }
    setDiffLoading(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border-default px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-accent">{commitHash.slice(0, 7)}</span>
          <span className="text-xs text-text-muted">{commitDate}</span>
          <span className="text-xs text-text-muted">— {commitAuthor}</span>
        </div>
        <p className="mt-1 truncate text-sm text-text-primary">{commitMessage}</p>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setShowDiff(false)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              !showDiff
                ? 'bg-accent text-white'
                : 'text-text-muted hover:bg-bg-elevated hover:text-text-secondary'
            }`}
          >
            Version
          </button>
          <button
            onClick={handleCompare}
            disabled={diffLoading}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              showDiff
                ? 'bg-accent text-white'
                : 'text-text-muted hover:bg-bg-elevated hover:text-text-secondary'
            }`}
          >
            {diffLoading ? 'Chargement...' : 'Comparer avec l\'actuel'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {showDiff && diff !== null ? (
          <FileDiffViewer diff={diff} commitA={commitHash} commitB="HEAD" />
        ) : (
          <FileContentView state={version} />
        )}
      </div>
    </div>
  )
}

function FileContentView({ state }: { state: ReturnType<typeof useFileVersion> }) {
  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse h-4 rounded bg-bg-elevated" />
        ))}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="p-4 text-sm text-status-red">
        {state.error.message}
      </div>
    )
  }

  if (state.status !== 'success') return null

  const lines = state.data.split('\n')

  return (
    <div className="font-mono text-sm">
      {lines.map((line, i) => (
        <div key={i} className="flex hover:bg-bg-elevated">
          <span className="inline-block w-12 shrink-0 pr-3 text-right text-text-muted select-none">
            {i + 1}
          </span>
          <span className="whitespace-pre text-text-secondary">{line}</span>
        </div>
      ))}
    </div>
  )
}
