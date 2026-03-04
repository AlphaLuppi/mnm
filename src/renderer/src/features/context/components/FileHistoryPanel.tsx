import { useFileHistory } from '../hooks/useFileHistory'

type FileHistoryPanelProps = {
  filePath: string
  onSelectCommit: (hash: string) => void
  selectedHash: string | null
  onClose: () => void
}

export function FileHistoryPanel({
  filePath,
  onSelectCommit,
  selectedHash,
  onClose
}: FileHistoryPanelProps) {
  const history = useFileHistory(filePath)

  const fileName = filePath.split('/').pop() ?? filePath

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-primary">Historique</h3>
          <p className="truncate text-xs text-text-muted">{fileName}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated hover:text-text-secondary"
          aria-label="Fermer l'historique"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {history.status === 'loading' && (
          <div className="flex flex-col gap-3 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-md bg-bg-elevated p-3">
                <div className="mb-2 h-3 w-20 rounded bg-border-default" />
                <div className="h-4 w-full rounded bg-border-default" />
              </div>
            ))}
          </div>
        )}

        {history.status === 'error' && (
          <div className="p-4 text-text-muted">
            <p className="text-sm">Erreur lors du chargement de l'historique</p>
            <p className="mt-1 text-xs text-status-red">{history.error.message}</p>
            <button
              onClick={history.retry}
              className="mt-2 rounded bg-bg-elevated px-3 py-1 text-xs text-text-secondary hover:text-text-primary"
            >
              Réessayer
            </button>
          </div>
        )}

        {history.status === 'success' && history.data.length === 0 && (
          <div className="p-4 text-sm text-text-muted">
            Aucun historique Git disponible
          </div>
        )}

        {history.status === 'success' && history.data.length > 0 && (
          <div className="relative flex flex-col gap-1 p-3 pl-6" role="list" aria-label="Historique Git">
            {/* Vertical timeline line */}
            <div className="absolute left-5 top-3 bottom-3 w-px bg-border-default" />

            {history.data.map((entry, index) => (
              <button
                key={entry.hash}
                onClick={() => onSelectCommit(entry.hash)}
                className={`relative flex flex-col gap-1 rounded-md p-3 text-left transition-colors
                  ${selectedHash === entry.hash
                    ? 'border border-accent bg-bg-elevated'
                    : 'border border-transparent hover:bg-bg-elevated'
                  }`}
                role="listitem"
                aria-selected={selectedHash === entry.hash}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute -left-3 top-4 h-2.5 w-2.5 rounded-full border-2
                    ${selectedHash === entry.hash
                      ? 'border-accent bg-accent'
                      : 'border-border-active bg-bg-surface'
                    }`}
                />

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent">
                    {entry.hash.slice(0, 7)}
                  </span>
                  <span className="text-xs text-text-muted">
                    {formatRelativeDate(entry.date)}
                  </span>
                  {index === 0 && (
                    <span className="text-xs font-medium text-status-green">dernier</span>
                  )}
                </div>
                <p className="truncate text-sm text-text-primary">{entry.message}</p>
                <p className="text-xs text-text-muted">{entry.author}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 60) return `${diffMins}m`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}j`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths}mo`
}
