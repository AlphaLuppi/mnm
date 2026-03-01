import { useEffect } from 'react'
import { useAgentsStore } from '../agents.store'

export function useAgentStream(): void {
  const updateStatus = useAgentsStore((state) => state.updateStatus)
  const updateLastOutput = useAgentsStore((state) => state.updateLastOutput)

  useEffect(() => {
    const cleanupStatus = window.electronAPI.on('stream:agent-status', (data) => {
      updateStatus(data.agentId, data.status, data.lastError)
    })

    const cleanupOutput = window.electronAPI.on('stream:agent-output', (data) => {
      updateLastOutput(data.agentId, data.timestamp)
    })

    return () => {
      cleanupStatus()
      cleanupOutput()
    }
  }, [updateStatus, updateLastOutput])
}
