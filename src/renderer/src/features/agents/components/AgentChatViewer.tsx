import { useRef, useEffect, useState, useCallback } from 'react'
import { useAgentChat } from '../hooks/useAgentChat'
import { ChatMessage } from './ChatMessage'
import { CheckpointMarker } from './CheckpointMarker'
import type { ChatEntry } from '@shared/types/chat.types'

type AgentChatViewerProps = {
  agentId: string
  scrollToCheckpoint?: string
  onCheckpointClick?: (checkpointId: string) => void
  onBack?: () => void
}

export function AgentChatViewer({
  agentId,
  scrollToCheckpoint,
  onCheckpointClick,
  onBack
}: AgentChatViewerProps) {
  const { entries, isLoading, error } = useAgentChat(agentId)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const prevEntriesLengthRef = useRef(0)

  // Scroll to checkpoint when prop changes
  useEffect(() => {
    if (!scrollToCheckpoint || entries.length === 0) return

    const element = scrollContainerRef.current?.querySelector(
      `[data-checkpoint-id="${scrollToCheckpoint}"]`
    )

    if (element) {
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches

      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
        block: 'center'
      })

      const entry = entries.find((e) => e.checkpoint === scrollToCheckpoint)
      if (entry) {
        setHighlightedId(entry.id)
        setTimeout(() => setHighlightedId(null), 2000)
      }
    }
  }, [scrollToCheckpoint, entries])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!autoScroll) return
    if (entries.length > prevEntriesLengthRef.current) {
      const container = scrollContainerRef.current
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
    prevEntriesLengthRef.current = entries.length
  }, [entries.length, autoScroll])

  // Detect user scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 50
    setAutoScroll(isAtBottom)
  }, [])

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex animate-pulse gap-3">
            <div className="h-7 w-7 rounded-full bg-bg-elevated" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-bg-elevated" />
              <div className="h-4 w-full rounded bg-bg-elevated" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-text-muted">
        <p className="text-sm text-status-red">{error.message}</p>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
        <p className="text-sm">Aucun message</p>
        <p className="text-xs">L&apos;agent n&apos;a pas encore produit d&apos;output.</p>
      </div>
    )
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-default bg-bg-surface px-4 py-2">
        {onBack && (
          <button
            className="rounded px-2 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent"
            onClick={onBack}
            aria-label="Retour a la liste des agents"
          >
            &larr; Retour
          </button>
        )}
        <span className="text-sm font-medium text-text-primary">
          Chat — Agent {agentId.slice(0, 8)}
        </span>
        <span className="ml-auto text-xs text-text-muted">{entries.length} messages</span>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label={`Chat de l'agent ${agentId.slice(0, 8)}`}
        onScroll={handleScroll}
      >
        {entries.map((entry) => (
          <EntryRenderer
            key={entry.id}
            entry={entry}
            isHighlighted={entry.id === highlightedId}
            onCheckpointClick={onCheckpointClick}
          />
        ))}
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && entries.length > 0 && (
        <button
          className="absolute bottom-4 right-4 rounded-full bg-accent px-3 py-1.5 text-xs text-white shadow-lg transition-colors hover:bg-accent-hover"
          onClick={() => {
            setAutoScroll(true)
            const container = scrollContainerRef.current
            if (container) {
              container.scrollTop = container.scrollHeight
            }
          }}
        >
          Defiler vers le bas
        </button>
      )}
    </div>
  )
}

type EntryRendererProps = {
  entry: ChatEntry
  isHighlighted: boolean
  onCheckpointClick?: (checkpointId: string) => void
}

function EntryRenderer({ entry, isHighlighted, onCheckpointClick }: EntryRendererProps) {
  if (entry.checkpoint) {
    return (
      <>
        <CheckpointMarker
          checkpointId={entry.checkpoint}
          label={entry.content}
          timestamp={entry.timestamp}
          onClick={onCheckpointClick}
        />
        <ChatMessage
          role={entry.role}
          content={entry.content}
          timestamp={entry.timestamp}
          isHighlighted={isHighlighted}
        />
      </>
    )
  }

  return (
    <ChatMessage
      role={entry.role}
      content={entry.content}
      timestamp={entry.timestamp}
      isHighlighted={isHighlighted}
    />
  )
}

export type { AgentChatViewerProps }
