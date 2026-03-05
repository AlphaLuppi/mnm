import { create } from 'zustand'
import type { DriftSeverity } from '@shared/types/drift.types'

export type DriftAlert = {
  id: string
  severity: DriftSeverity
  summary: string
  documents: [string, string]
  confidence: number
  isNew: boolean
  timestamp: number
}

export type DriftCheckProgress = {
  completed: number
  total: number
  currentPair: [string, string]
}

type DriftState = {
  alerts: DriftAlert[]
  checkProgress: DriftCheckProgress | null
  isChecking: boolean
  threshold: number

  addAlert: (alert: Omit<DriftAlert, 'isNew' | 'timestamp'>) => void
  removeAlert: (id: string) => void
  markAlertSeen: (id: string) => void
  setCheckProgress: (progress: DriftCheckProgress | null) => void
  setIsChecking: (checking: boolean) => void
  setThreshold: (threshold: number) => void
  clearAlerts: () => void
}

export const useDriftStore = create<DriftState>((set) => ({
  alerts: [],
  checkProgress: null,
  isChecking: false,
  threshold: 50,

  addAlert: (alert) =>
    set((state) => ({
      alerts: [
        { ...alert, isNew: true, timestamp: Date.now() },
        ...state.alerts
      ].sort((a, b) => b.confidence - a.confidence)
    })),

  removeAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.filter((a) => a.id !== id)
    })),

  markAlertSeen: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, isNew: false } : a
      )
    })),

  setCheckProgress: (checkProgress) => set({ checkProgress }),
  setIsChecking: (isChecking) => set({ isChecking }),
  setThreshold: (threshold) => set({ threshold }),
  clearAlerts: () => set({ alerts: [] })
}))
