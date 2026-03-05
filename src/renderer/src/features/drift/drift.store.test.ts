import { describe, it, expect, beforeEach } from 'vitest'
import { useDriftStore } from './drift.store'

describe('drift.store', () => {
  beforeEach(() => {
    useDriftStore.setState({
      alerts: [],
      checkProgress: null,
      isChecking: false,
      threshold: 50
    })
  })

  it('adds alert sorted by confidence descending', () => {
    const { addAlert } = useDriftStore.getState()
    addAlert({ id: 'a1', severity: 'warning', summary: 'Low', documents: ['/a', '/b'], confidence: 30 })
    addAlert({ id: 'a2', severity: 'critical', summary: 'High', documents: ['/c', '/d'], confidence: 90 })

    const { alerts } = useDriftStore.getState()
    expect(alerts).toHaveLength(2)
    expect(alerts[0].id).toBe('a2')
    expect(alerts[1].id).toBe('a1')
  })

  it('marks alert as new on add', () => {
    const { addAlert } = useDriftStore.getState()
    addAlert({ id: 'a1', severity: 'info', summary: 'Test', documents: ['/a', '/b'], confidence: 50 })

    const { alerts } = useDriftStore.getState()
    expect(alerts[0].isNew).toBe(true)
    expect(alerts[0].timestamp).toBeGreaterThan(0)
  })

  it('removes alert by id', () => {
    const { addAlert } = useDriftStore.getState()
    addAlert({ id: 'a1', severity: 'info', summary: 'Test', documents: ['/a', '/b'], confidence: 50 })
    addAlert({ id: 'a2', severity: 'info', summary: 'Test2', documents: ['/c', '/d'], confidence: 60 })

    useDriftStore.getState().removeAlert('a1')
    const { alerts } = useDriftStore.getState()
    expect(alerts).toHaveLength(1)
    expect(alerts[0].id).toBe('a2')
  })

  it('marks alert as seen', () => {
    const { addAlert } = useDriftStore.getState()
    addAlert({ id: 'a1', severity: 'info', summary: 'Test', documents: ['/a', '/b'], confidence: 50 })

    useDriftStore.getState().markAlertSeen('a1')
    const { alerts } = useDriftStore.getState()
    expect(alerts[0].isNew).toBe(false)
  })

  it('sets threshold', () => {
    useDriftStore.getState().setThreshold(75)
    expect(useDriftStore.getState().threshold).toBe(75)
  })

  it('sets check progress', () => {
    useDriftStore.getState().setCheckProgress({ completed: 1, total: 3, currentPair: ['/a', '/b'] })
    const { checkProgress } = useDriftStore.getState()
    expect(checkProgress).toEqual({ completed: 1, total: 3, currentPair: ['/a', '/b'] })
  })

  it('clears all alerts', () => {
    const { addAlert } = useDriftStore.getState()
    addAlert({ id: 'a1', severity: 'info', summary: 'Test', documents: ['/a', '/b'], confidence: 50 })
    addAlert({ id: 'a2', severity: 'info', summary: 'Test2', documents: ['/c', '/d'], confidence: 60 })

    useDriftStore.getState().clearAlerts()
    expect(useDriftStore.getState().alerts).toHaveLength(0)
  })
})
