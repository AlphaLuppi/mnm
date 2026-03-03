import { getFileIcon } from '../utils/file-icons'
import type { ContextFile } from '../context.types'

type ContextFileCardProps = {
  file: ContextFile
}

export function ContextFileCard({ file }: ContextFileCardProps) {
  const icon = getFileIcon(file.extension)

  return (
    <div
      className="group flex items-center gap-3 rounded-lg bg-bg-surface p-3
                 border border-border-default hover:border-border-active
                 transition-colors duration-150
                 motion-safe:animate-slide-in"
      draggable="true"
      data-file-path={file.path}
      role="listitem"
      aria-label={`Fichier ${file.name}, utilisé par ${file.agentIds.length} agent(s)`}
    >
      {/* File type icon */}
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-bg-elevated font-mono text-xs font-bold ${icon.color}`}
      >
        {icon.label}
      </span>

      {/* File info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium text-text-primary">
          {file.name}
        </p>
        <p className="truncate text-sm text-text-muted">
          {file.relativePath}
        </p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1">
        {file.isModified && (
          <span className="inline-flex items-center rounded-full bg-status-orange/20 px-2 py-0.5 text-xs font-medium text-status-orange">
            Modifié
          </span>
        )}
        {file.agentIds.map((agentId) => (
          <span
            key={agentId}
            className="inline-flex items-center rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent"
          >
            {agentId}
          </span>
        ))}
      </div>
    </div>
  )
}
