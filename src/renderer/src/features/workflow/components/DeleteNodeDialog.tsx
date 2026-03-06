type DeleteNodeDialogProps = {
  open: boolean
  nodeLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteNodeDialog({ open, nodeLabel, onConfirm, onCancel }: DeleteNodeDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
        <h2 id="delete-dialog-title" className="text-lg font-medium text-[var(--color-text-primary)]">
          Supprimer le noeud
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Supprimer le noeud &laquo;{nodeLabel}&raquo; ? Les connexions seront reconnectees
          automatiquement. Cette action est irreversible.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}
