import { useCallback } from 'react'
import { useDriftStore } from '../drift.store'

export function DriftSettings() {
  const threshold = useDriftStore((s) => s.threshold)
  const setThreshold = useDriftStore((s) => s.setThreshold)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.min(100, Math.max(0, Number(e.target.value)))
      setThreshold(value)
      window.electronAPI.invoke('settings:update', {
        key: 'drift.confidenceThreshold',
        value
      })
    },
    [setThreshold]
  )

  return (
    <div className="p-3 border border-[var(--color-border)] rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--color-text-secondary)]">Seuil de confiance</span>
        <span className="text-xs font-mono text-[var(--color-text-primary)]">{threshold}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={threshold}
        onChange={handleChange}
        className="w-full h-1 accent-[var(--color-accent)] cursor-pointer"
      />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-[var(--color-text-tertiary)]">Sensible</span>
        <span className="text-[10px] text-[var(--color-text-tertiary)]">Strict</span>
      </div>
    </div>
  )
}
