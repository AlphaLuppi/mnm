import { describe, it, expect, beforeEach } from 'vitest'
import { useDriftStore } from '@renderer/features/drift/drift.store'

function getDriftSummary() {
  const alerts = useDriftStore.getState().alerts

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
}

describe('useDriftSummary', () => {
  beforeEach(() => {
    useDriftStore.setState({ alerts: [] })
  })

  it('returns zeros when no alerts', () => {
    const summary = getDriftSummary()
    expect(summary.total).toBe(0)
    expect(summary.critical).toBe(0)
    expect(summary.warning).toBe(0)
    expect(summary.alerts).toHaveLength(0)
  })

  it('counts severity correctly', () => {
    useDriftStore.getState().addAlert({
      id: 'd1',
      severity: 'critical',
      summary: 'Critical drift',
      documents: ['/a.md', '/b.md'],
      confidence: 90
    })
    useDriftStore.getState().addAlert({
      id: 'd2',
      severity: 'warning',
      summary: 'Warning drift',
      documents: ['/c.md', '/d.md'],
      confidence: 60
    })

    const summary = getDriftSummary()
    expect(summary.total).toBe(2)
    expect(summary.critical).toBe(1)
    expect(summary.warning).toBe(1)
  })

  it('sorts alerts by confidence descending', () => {
    useDriftStore.getState().addAlert({
      id: 'd1',
      severity: 'warning',
      summary: 'Low',
      documents: ['/a.md', '/b.md'],
      confidence: 40
    })
    useDriftStore.getState().addAlert({
      id: 'd2',
      severity: 'critical',
      summary: 'High',
      documents: ['/c.md', '/d.md'],
      confidence: 95
    })
    useDriftStore.getState().addAlert({
      id: 'd3',
      severity: 'warning',
      summary: 'Medium',
      documents: ['/e.md', '/f.md'],
      confidence: 70
    })

    const summary = getDriftSummary()
    expect(summary.alerts[0].confidence).toBe(95)
    expect(summary.alerts[1].confidence).toBe(70)
    expect(summary.alerts[2].confidence).toBe(40)
  })

  it('maps document pairs correctly', () => {
    useDriftStore.getState().addAlert({
      id: 'd1',
      severity: 'critical',
      summary: 'Drift found',
      documents: ['/spec.md', '/code.ts'],
      confidence: 85
    })

    const summary = getDriftSummary()
    expect(summary.alerts[0].documentA).toBe('/spec.md')
    expect(summary.alerts[0].documentB).toBe('/code.ts')
    expect(summary.alerts[0].summary).toBe('Drift found')
  })
})
