type AgentProgressBarProps = {
  completed: number
  total: number
  className?: string
}

export function AgentProgressBar({ completed, total, className = '' }: AgentProgressBarProps) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
        {total > 0 ? (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="animate-progress-indeterminate h-full w-1/3 rounded-full bg-accent" />
        )}
      </div>
      <span className="shrink-0 font-mono text-xs text-text-muted">
        {completed}/{total}
      </span>
    </div>
  )
}

export type { AgentProgressBarProps }
