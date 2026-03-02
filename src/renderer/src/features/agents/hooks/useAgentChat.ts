import { useEffect, useRef, useState } from 'react'
import type { ChatEntry } from '@shared/types/chat.types'
import type { AppError } from '@shared/types/error.types'

type AgentChatState = {
  entries: ChatEntry[]
  isLoading: boolean
  error: AppError | null
}

export function useAgentChat(agentId: string | null): AgentChatState {
  const [entries, setEntries] = useState<ChatEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<AppError | null>(null)
  const entryIdsRef = useRef(new Set<string>())

  useEffect(() => {
    if (!agentId) {
      setEntries([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    window.electronAPI
      .invoke('agent:get-chat', { agentId })
      .then((history) => {
        setEntries(history)
        entryIdsRef.current = new Set(history.map((e) => e.id))
        setIsLoading(false)
      })
      .catch((err) => {
        setError({
          code: 'AGENT_CHAT_FETCH_FAILED',
          message: "Impossible de charger le chat de l'agent",
          source: 'useAgentChat',
          details: err
        })
        setIsLoading(false)
      })
  }, [agentId])

  useEffect(() => {
    if (!agentId) return

    const cleanup = window.electronAPI.on('stream:agent-chat', (entry) => {
      if (entry.agentId !== agentId) return
      if (entryIdsRef.current.has(entry.id)) return

      entryIdsRef.current.add(entry.id)
      setEntries((prev) => [...prev, entry])
    })

    return cleanup
  }, [agentId])

  return { entries, isLoading, error }
}
