import { useCallback, useState } from 'react'
import { useDriftStore } from '../drift.store'
import { DriftAlertCard } from './DriftAlertCard'
import { DriftDiffView } from './DriftDiffView'

export function DriftAlertList() {
  const alerts = useDriftStore((s) => s.alerts)
  const markAlertSeen = useDriftStore((s) => s.markAlertSeen)
  const removeAlert = useDriftStore((s) => s.removeAlert)
  const [viewingAlert, setViewingAlert] = useState<string | null>(null)

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
      setViewingAlert(id)
    },
    [markAlertSeen]
  )

  const handleIgnore = useCallback(
    (id: string) => {
      markAlertSeen(id)
      removeAlert(id)
    },
    [markAlertSeen, removeAlert]
  )

  const handleCloseView = useCallback(() => setViewingAlert(null), [])

  const activeAlert = alerts.find((a) => a.id === viewingAlert)

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

      {activeAlert && (
        <DriftDiffView
          documents={activeAlert.documents}
          onClose={handleCloseView}
        />
      )}
    </>
  )
}
