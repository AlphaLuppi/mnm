import { useEffect, useState } from 'react'
import { useAgentsStore } from '../agents.store'
import { AgentCard } from './AgentCard'

type AgentListProps = {
  onSelectAgent?: (agentId: string) => void
  onOpenChatViewer?: (agentId: string) => void
}

export function AgentList({ onSelectAgent, onOpenChatViewer }: AgentListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const agentIds = useAgentsStore((state) => Array.from(state.agents.keys()))
  const setAgents = useAgentsStore((state) => state.setAgents)
  const updateStatus = useAgentsStore((state) => state.updateStatus)
  const updateLastOutput = useAgentsStore((state) => state.updateLastOutput)

  // Fetch initial agent list on mount
  useEffect(() => {
    window.electronAPI
      .invoke('agent:list', undefined as void)
      .then((agents) => setAgents(agents))
      .catch(() => {
        // Store remains empty
      })
  }, [setAgents])

  // Subscribe to live status and output updates
  useEffect(() => {
    const cleanupStatus = window.electronAPI.on('stream:agent-status', (data) => {
      updateStatus(data.agentId, data.status, {
        lastError: data.lastError,
        progress: data.progress,
        blockingContext: data.blockingContext
      })
    })

    const cleanupOutput = window.electronAPI.on('stream:agent-output', (data) => {
      updateLastOutput(data.agentId, data.timestamp)
    })

    return () => {
      cleanupStatus()
      cleanupOutput()
    }
  }, [updateStatus, updateLastOutput])

  const handleSelect = (agentId: string) => {
    setSelectedId(agentId)
    onSelectAgent?.(agentId)
  }

  const handleDoubleClick = (agentId: string) => {
    onOpenChatViewer?.(agentId)
  }

  if (agentIds.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-text-muted">
        <p className="text-sm">Aucun agent actif</p>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-accent-hover">
          Lancer un agent
        </button>
      </div>
    )
  }

  return (
    <div role="list" aria-label="Liste des agents" className="flex flex-col gap-2 p-2">
      {agentIds.map((id) => (
        <AgentCard
          key={id}
          agentId={id}
          isSelected={id === selectedId}
          onSelect={handleSelect}
          onDoubleClick={handleDoubleClick}
        />
      ))}
    </div>
  )
}

export type { AgentListProps }
