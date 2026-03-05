import { useEffect } from 'react'
import { useDriftStore } from '../drift.store'

export function useDriftStreams(): void {
  const addAlert = useDriftStore((s) => s.addAlert)
  const setCheckProgress = useDriftStore((s) => s.setCheckProgress)
  const setIsChecking = useDriftStore((s) => s.setIsChecking)

  useEffect(() => {
    const api = window.electronAPI

    const unsubAlert = api.on('stream:drift-alert', (data) => {
      addAlert({
        id: data.id,
        severity: data.severity as 'critical' | 'warning' | 'info',
        summary: data.summary,
        documents: data.documents,
        confidence: data.confidence
      })
    })

    const unsubProgress = api.on('stream:drift-progress', (data) => {
      if (data.completed >= data.total) {
        setCheckProgress(null)
        setIsChecking(false)
      } else {
        setCheckProgress(data)
      }
    })

    const unsubStatus = api.on('stream:drift-status', (data) => {
      setIsChecking(data.status === 'analyzing')
    })

    return () => {
      unsubAlert()
      unsubProgress()
      unsubStatus()
    }
  }, [addAlert, setCheckProgress, setIsChecking])
}
