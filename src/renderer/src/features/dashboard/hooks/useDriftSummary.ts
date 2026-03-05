import { useMemo } from 'react'
import { useDriftStore } from '@renderer/features/drift/drift.store'
import type { DriftsSummary } from '../dashboard.types'

export function useDriftSummary(): DriftsSummary {
  const alerts = useDriftStore((s) => s.alerts)

  return useMemo(() => {
    const items = alerts
      .map((alert) => ({
        id: alert.id,
        documentA: alert.documents[0],
        documentB: alert.documents[1],
        confidence: alert.confidence,
        severity: alert.severity,
        summary: alert.summary
      }))
      .sort((a, b) => b.confidence - a.confidence)

    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      alerts: items
    }
  }, [alerts])
}
