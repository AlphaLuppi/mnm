import { useEffect, useState, useCallback } from 'react'
import { useAgentsStore } from '../agents.store'
import { AgentCard } from './AgentCard'
import { AgentDropZone } from './AgentDropZone'
import { useContextStore } from '@renderer/features/context/context.store'
import type { ContextFile } from '@renderer/features/context/context.types'

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

  const addFile = useContextStore((s) => s.addFile)
  const setAgentFiles = useContextStore((s) => s.setAgentFiles)

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

  const handleFileDrop = useCallback(
    async (agentId: string, filePath: string) => {
      // Ensure file exists in context store
      const existing = useContextStore.getState().files.get(filePath)
      if (!existing) {
        const name = filePath.split('/').pop() ?? filePath
        const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
        const newFile: ContextFile = {
          path: filePath,
          name,
          extension: ext,
          relativePath: filePath,
          agentIds: [agentId],
          isModified: false,
          lastModified: Date.now()
        }
        addFile(newFile)
      } else {
        // Add agent to existing file
        const currentFiles = useContextStore.getState().files
        const agentFilePaths = Array.from(currentFiles.values())
          .filter((f) => f.agentIds.includes(agentId))
          .map((f) => f.path)
        setAgentFiles(agentId, [...agentFilePaths, filePath])
      }

      // Persist via IPC
      try {
        await window.electronAPI.invoke('context:add-to-agent', { agentId, filePath })
      } catch {
        // IPC error — optimistic update stays
      }
    },
    [addFile, setAgentFiles]
  )

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
        <AgentDropZone key={id} agentId={id} onFileDrop={handleFileDrop}>
          <AgentCard
            agentId={id}
            isSelected={id === selectedId}
            onSelect={handleSelect}
            onDoubleClick={handleDoubleClick}
          />
        </AgentDropZone>
      ))}
    </div>
  )
}

export type { AgentListProps }
