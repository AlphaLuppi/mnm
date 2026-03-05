import { useState, useEffect, useCallback } from 'react'
import { useDriftStore } from '../drift.store'

type DocumentPairInfo = {
  parent: string
  child: string
  relationship: string
}

type DriftCheckDialogProps = {
  open: boolean
  onClose: () => void
}

export function DriftCheckDialog({ open, onClose }: DriftCheckDialogProps) {
  const [pairs, setPairs] = useState<DocumentPairInfo[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const setIsChecking = useDriftStore((s) => s.setIsChecking)

  useEffect(() => {
    if (!open) return
    window.electronAPI.invoke('drift:list-pairs', undefined).then((result) => {
      const pairList = result as DocumentPairInfo[]
      setPairs(pairList)
      setSelected(new Set(pairList.map((_, i) => i)))
    })
  }, [open])

  const togglePair = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const handleRun = useCallback(async () => {
    const selectedPairs = pairs.filter((_, i) => selected.has(i))
    if (selectedPairs.length === 0) return

    setLoading(true)
    setIsChecking(true)
    try {
      await window.electronAPI.invoke('drift:check-multiple', {
        pairs: selectedPairs.map((p) => ({ docA: p.parent, docB: p.child }))
      })
    } finally {
      setLoading(false)
      onClose()
    }
  }, [pairs, selected, onClose, setIsChecking])

  if (!open) return null

  const fileName = (path: string) => path.split('/').pop() ?? path

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-xl w-[480px] max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Verifier le drift
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Selectionnez les paires de documents a analyser
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {pairs.length === 0 ? (
            <p className="text-xs text-[var(--color-text-tertiary)] text-center py-8">
              Aucune paire configuree dans .mnm/settings.json
            </p>
          ) : (
            pairs.map((pair, i) => (
              <label
                key={i}
                className="flex items-start gap-3 p-2 rounded hover:bg-[var(--color-bg-hover)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => togglePair(i)}
                  className="mt-0.5 accent-[var(--color-accent)]"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-primary)]">
                    {fileName(pair.parent)} ↔ {fileName(pair.child)}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-tertiary)]">
                    {pair.relationship}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded"
          >
            Annuler
          </button>
          <button
            onClick={handleRun}
            disabled={loading || selected.size === 0}
            className="px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Analyse...' : `Analyser (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
