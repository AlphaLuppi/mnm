import { useState, useCallback } from 'react'
import type { ContextFileDragData } from '@renderer/features/context/context-dnd.types'

type AgentDropZoneProps = {
  agentId: string
  onFileDrop: (agentId: string, filePath: string) => void
  children: React.ReactNode
}

export function AgentDropZone({ agentId, onFileDrop, children }: AgentDropZoneProps) {
  const [isOver, setIsOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsOver(false)

      try {
        const raw = e.dataTransfer.getData('application/json')
        const data = JSON.parse(raw) as ContextFileDragData

        if (data.type === 'context-file') {
          onFileDrop(agentId, data.filePath)
        }
      } catch {
        // Invalid drag data — ignore
      }
    },
    [agentId, onFileDrop]
  )

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={
        isOver
          ? 'rounded-lg border-2 border-accent bg-accent/10 transition-colors duration-150'
          : 'rounded-lg border-2 border-transparent transition-colors duration-150'
      }
      aria-dropeffect="copy"
      aria-label={`Zone de dépôt pour l'agent ${agentId}`}
    >
      {children}
    </div>
  )
}
