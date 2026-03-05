import { useState, useCallback } from 'react'
import { useDriftShortcut } from '../hooks/useDriftShortcut'
import { DriftCheckDialog } from './DriftCheckDialog'
import { DriftCheckProgress } from './DriftCheckProgress'
import { DriftAlertList } from './DriftAlertList'
import { DriftSettings } from './DriftSettings'

export function DriftPanel() {
  const [dialogOpen, setDialogOpen] = useState(false)

  const openDialog = useCallback(() => setDialogOpen(true), [])
  const closeDialog = useCallback(() => setDialogOpen(false), [])

  useDriftShortcut(openDialog)

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
  const shortcutLabel = isMac ? '⌘⇧D' : 'Ctrl+Shift+D'

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
        <DriftAlertList />
        <DriftSettings />
      </div>

      <DriftCheckDialog open={dialogOpen} onClose={closeDialog} />
    </div>
  )
}
