import { useEffect } from 'react'
import { useDriftStore } from '../drift.store'

export function useDriftResolution(): void {
  const removeAlert = useDriftStore((s) => s.removeAlert)

  useEffect(() => {
    const unsub = window.electronAPI.on('stream:drift-resolved', (data) => {
      removeAlert(data.driftId)
    })
    return unsub
  }, [removeAlert])
}
