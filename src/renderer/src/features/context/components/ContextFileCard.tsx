import { useState } from 'react'
import { getFileIcon } from '../utils/file-icons'
import type { ContextFile } from '../context.types'
import type { ContextFileDragData } from '../context-dnd.types'

type ContextFileCardProps = {
  file: ContextFile
  onRemove?: (filePath: string, agentId: string) => void
  onShowHistory?: (filePath: string) => void
}

export function ContextFileCard({ file, onRemove, onShowHistory }: ContextFileCardProps) {
  const icon = getFileIcon(file.extension)
  const [isDragging, setIsDragging] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const dragData: ContextFileDragData = {
      type: 'context-file',
      filePath: file.path,
      fileName: file.name
    }
    e.dataTransfer.setData('application/json', JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'copy'
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const handleRemove = (agentId: string) => {
    setIsRemoving(true)
    onRemove?.(file.path, agentId)
  }

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg bg-bg-surface p-3
                 border border-border-default hover:border-border-active
                 transition-all duration-150
                 motion-safe:animate-slide-in
                 ${isDragging ? 'opacity-50 border-dashed' : ''}
                 ${isRemoving ? 'motion-safe:animate-fade-out' : ''}`}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      data-file-path={file.path}
      role="listitem"
      aria-roledescription="draggable"
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

      {/* History button */}
      {onShowHistory && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShowHistory(file.path)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded px-1.5 py-0.5 text-xs text-text-muted hover:text-accent hover:bg-bg-elevated"
          aria-label={`Voir l'historique Git de ${file.name}`}
        >
          Historique
        </button>
      )}

      {/* Badges + remove buttons */}
      <div className="flex flex-wrap items-center gap-1">
        {file.isModified && (
          <span className="inline-flex items-center rounded-full bg-status-orange/20 px-2 py-0.5 text-xs font-medium text-status-orange">
            Modifié
          </span>
        )}
        {file.agentIds.map((agentId) => (
          <span
            key={agentId}
            className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent"
          >
            {agentId}
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove(agentId)
                }}
                className="ml-0.5 hidden rounded-full p-0.5 text-accent hover:bg-accent/30 hover:text-text-primary group-hover:inline-flex"
                aria-label={`Retirer ${file.name} du contexte de ${agentId}`}
                title={`Retirer du contexte de ${agentId}`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
