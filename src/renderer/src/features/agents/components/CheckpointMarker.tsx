type CheckpointMarkerProps = {
  checkpointId: string
  label: string
  timestamp: number
  onClick?: (checkpointId: string) => void
}

export function CheckpointMarker({
  checkpointId,
  label,
  timestamp,
  onClick
}: CheckpointMarkerProps) {
  const time = new Date(timestamp)

  return (
    <div
      className="relative flex items-center gap-2 px-4 py-2"
      data-checkpoint-id={checkpointId}
    >
      <div className="flex-1 border-t border-dashed border-border-active" />

      <button
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border-active bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary transition-colors hover:border-accent/50 hover:bg-accent/10 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent"
        onClick={() => onClick?.(checkpointId)}
        aria-label={`Checkpoint: ${label}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        <span className="max-w-[200px] truncate">{label}</span>
        <span className="font-mono text-text-muted">
          {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </button>

      <div className="flex-1 border-t border-dashed border-border-active" />
    </div>
  )
}

export type { CheckpointMarkerProps }
