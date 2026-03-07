type UnsavedChangesDialogProps = {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  open,
  onSave,
  onDiscard,
  onCancel
}: UnsavedChangesDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unsaved-dialog-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        <h2
          id="unsaved-dialog-title"
          className="text-lg font-medium text-[var(--color-text-primary)]"
        >
          Modifications non sauvegardees
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Le workflow contient des modifications non sauvegardees. Que souhaitez-vous faire ?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onDiscard}
            className="rounded px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Ne pas sauvegarder
          </button>
          <button
            onClick={onSave}
            className="rounded bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-80 transition-opacity"
          >
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  )
}
