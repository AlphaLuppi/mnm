import { useCallback, useState } from 'react'
import { useDriftStore } from '../drift.store'
import { DriftAlertCard } from './DriftAlertCard'
import { DriftDiffView } from './DriftDiffView'
import { DriftResolutionPanel } from './DriftResolutionPanel'
import { toast } from '@renderer/shared/components/Toaster'

export function DriftAlertList() {
  const alerts = useDriftStore((s) => s.alerts)
  const markAlertSeen = useDriftStore((s) => s.markAlertSeen)
  const removeAlert = useDriftStore((s) => s.removeAlert)
  const [viewingAlert, setViewingAlert] = useState<string | null>(null)
  const [resolvingAlert, setResolvingAlert] = useState<string | null>(null)

  const handleView = useCallback(
    (id: string) => {
      markAlertSeen(id)
      setViewingAlert(id)
    },
    [markAlertSeen]
  )

  const handleFix = useCallback(
    (id: string) => {
      markAlertSeen(id)
      setResolvingAlert(id)
    },
    [markAlertSeen]
  )

  const handleIgnore = useCallback(
    async (id: string) => {
      markAlertSeen(id)
      try {
        await window.electronAPI.invoke('drift:resolve', { driftId: id, action: 'ignore' })
        removeAlert(id)
        toast({ title: 'Drift ignore', duration: 3000 })
      } catch {
        toast({ title: 'Erreur lors de la resolution', duration: 3000 })
      }
    },
    [markAlertSeen, removeAlert]
  )

  const handleCloseView = useCallback(() => setViewingAlert(null), [])
  const handleCloseResolve = useCallback(() => setResolvingAlert(null), [])

  const activeViewAlert = alerts.find((a) => a.id === viewingAlert)
  const activeResolveAlert = alerts.find((a) => a.id === resolvingAlert)

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Alertes
          </h4>
          {alerts.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
              {alerts.length}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-3 h-3 rounded-full bg-green-500 mb-2" />
            <p className="text-xs text-[var(--color-text-tertiary)]">Aucun drift detecte</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <DriftAlertCard
              key={alert.id}
              id={alert.id}
              severity={alert.severity}
              summary={alert.summary}
              documents={alert.documents}
              confidence={alert.confidence}
              isNew={alert.isNew}
              onView={handleView}
              onFix={handleFix}
              onIgnore={handleIgnore}
            />
          ))
        )}
      </div>

      {activeViewAlert && (
        <DriftDiffView
          documents={activeViewAlert.documents}
          onClose={handleCloseView}
        />
      )}

      {activeResolveAlert && (
        <DriftResolutionPanel
          documents={activeResolveAlert.documents}
          alertId={activeResolveAlert.id}
          summary={activeResolveAlert.summary}
          onClose={handleCloseResolve}
        />
      )}
    </>
  )
}
