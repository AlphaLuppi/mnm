import { useDriftStore } from '../drift.store'

export function DriftCheckProgress() {
  const checkProgress = useDriftStore((s) => s.checkProgress)
  const isChecking = useDriftStore((s) => s.isChecking)

  if (!isChecking && !checkProgress) return null

  const completed = checkProgress?.completed ?? 0
  const total = checkProgress?.total ?? 0
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  const currentPair = checkProgress?.currentPair

  const fileName = (path: string) => path.split('/').pop() ?? path

  return (
    <div className="p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
        <span className="text-xs text-[var(--color-text-secondary)]">
          Analyse en cours... {completed}/{total}
        </span>
      </div>

      <div className="w-full h-1.5 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {currentPair && currentPair[0] && (
        <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1.5 truncate">
          {fileName(currentPair[0])} ↔ {fileName(currentPair[1])}
        </p>
      )}
    </div>
  )
}
