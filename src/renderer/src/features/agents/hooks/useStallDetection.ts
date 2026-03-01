import { useEffect } from 'react'
import { useAgentsStore } from '../agents.store'

const STALL_CHECK_INTERVAL_MS = 5_000

export function useStallDetection(): void {
  useEffect(() => {
    const interval = setInterval(() => {
      useAgentsStore.setState({ _tick: Date.now() })
    }, STALL_CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])
}
