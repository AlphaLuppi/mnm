import { useEffect, useState, useRef, useCallback } from 'react'

type DiffData = {
  sourceContent: string
  derivedContent: string
}

type DriftDiffViewProps = {
  documents: [string, string]
  onClose: () => void
}

export function DriftDiffView({ documents, onClose }: DriftDiffViewProps) {
  const [diffData, setDiffData] = useState<DiffData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)

  useEffect(() => {
    Promise.all([
      window.electronAPI.invoke('git:show-file', { path: documents[0], commitHash: 'HEAD' }),
      window.electronAPI.invoke('git:show-file', { path: documents[1], commitHash: 'HEAD' })
    ])
      .then(([source, derived]) => {
        setDiffData({ sourceContent: source, derivedContent: derived })
        setLoading(false)
      })
      .catch((err) => {
        setError((err as Error).message ?? 'Erreur lors du chargement')
        setLoading(false)
      })
  }, [documents])

  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (syncing.current) return
    syncing.current = true

    const from = source === 'left' ? leftRef.current : rightRef.current
    const to = source === 'left' ? rightRef.current : leftRef.current
    if (from && to) {
      to.scrollTop = from.scrollTop
    }

    requestAnimationFrame(() => {
      syncing.current = false
    })
  }, [])

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const fileName = (path: string) => path.split('/').pop() ?? path

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-base)]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Drift: {fileName(documents[0])} ↔ {fileName(documents[1])}
        </h2>
        <button
          onClick={onClose}
          className="px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded border border-[var(--color-border)]"
        >
          Fermer
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-xs text-[var(--color-text-tertiary)]">
            Chargement des documents...
          </div>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {diffData && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Source document */}
          <div className="flex-1 flex flex-col border-r border-[var(--color-border)]">
            <div className="px-3 py-2 bg-[var(--color-surface)] text-[10px] font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              {fileName(documents[0])} (source)
            </div>
            <div
              ref={leftRef}
              className="flex-1 overflow-auto p-4"
              onScroll={() => handleScroll('left')}
            >
              <pre className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap font-mono leading-relaxed">
                {diffData.sourceContent}
              </pre>
            </div>
          </div>

          {/* Right: Derived document */}
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-2 bg-[var(--color-surface)] text-[10px] font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              {fileName(documents[1])} (derive)
            </div>
            <div
              ref={rightRef}
              className="flex-1 overflow-auto p-4"
              onScroll={() => handleScroll('right')}
            >
              <pre className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap font-mono leading-relaxed">
                {diffData.derivedContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
