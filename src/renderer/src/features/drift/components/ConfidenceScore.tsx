type ConfidenceScoreProps = {
  value: number
}

export function ConfidenceScore({ value }: ConfidenceScoreProps) {
  const color =
    value >= 80
      ? 'text-red-400'
      : value >= 50
        ? 'text-amber-400'
        : 'text-[var(--color-text-tertiary)]'

  return (
    <span
      className={`text-xs font-mono ${color}`}
      aria-label={`Score de confiance: ${value}%`}
    >
      {value}%
    </span>
  )
}
