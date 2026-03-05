import { useState, useCallback } from 'react'
import { useDriftStore } from '../drift.store'
import { useDriftShortcut } from '../hooks/useDriftShortcut'
import { DriftCheckDialog } from './DriftCheckDialog'
import { DriftCheckProgress } from './DriftCheckProgress'
import { DriftSettings } from './DriftSettings'

const severityColors: Record<string, string> = {
  critical: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400'
}

const severityIcons: Record<string, string> = {
  critical: '!!',
  warning: '!',
  info: 'i'
}

export function DriftPanel() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const alerts = useDriftStore((s) => s.alerts)
  const removeAlert = useDriftStore((s) => s.removeAlert)
  const markAlertSeen = useDriftStore((s) => s.markAlertSeen)

  const openDialog = useCallback(() => setDialogOpen(true), [])
  const closeDialog = useCallback(() => setDialogOpen(false), [])

  useDriftShortcut(openDialog)

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
  const shortcutLabel = isMac ? '⌘⇧D' : 'Ctrl+Shift+D'

  const fileName = (path: string) => path.split('/').pop() ?? path

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Drift
          </h3>
          <span className="text-[10px] text-[var(--color-text-tertiary)]">{shortcutLabel}</span>
        </div>
        <button
          onClick={openDialog}
          className="w-full px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90"
        >
          Verifier le drift
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <DriftCheckProgress />

        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-2 rounded border border-[var(--color-border)] ${
                  alert.isNew ? 'bg-[var(--color-bg-hover)]' : ''
                }`}
                onClick={() => markAlertSeen(alert.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${severityColors[alert.severity] ?? ''}`}>
                      {severityIcons[alert.severity] ?? '?'}
                    </span>
                    <span className="text-xs text-[var(--color-text-primary)]">
                      {alert.summary}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAlert(alert.id)
                    }}
                    className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                  >
                    ×
                  </button>
                </div>
                <div className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                  {fileName(alert.documents[0])} ↔ {fileName(alert.documents[1])}
                </div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">
                  Confiance: {alert.confidence}%
                </div>
              </div>
            ))}
          </div>
        )}

        {alerts.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-[var(--color-text-tertiary)]">Aucune alerte de drift</p>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
              Lancez une verification pour detecter les incoherences
            </p>
          </div>
        )}

        <DriftSettings />
      </div>

      <DriftCheckDialog open={dialogOpen} onClose={closeDialog} />
    </div>
  )
}
