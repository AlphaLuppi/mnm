type StoryProgressBarProps = {
  ratio: number
  className?: string
}

export function StoryProgressBar({ ratio, className = '' }: StoryProgressBarProps) {
  const percentage = Math.round(ratio * 100)
  const isDone = ratio >= 1.0
  const barColor = isDone ? 'bg-green-500' : 'bg-[var(--color-accent)]'

  return (
    <div
      className={`h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percentage}% complete`}
    >
      <div
        className={`h-full rounded-full ${barColor} transition-[width] duration-300 ease-out motion-reduce:transition-none`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
