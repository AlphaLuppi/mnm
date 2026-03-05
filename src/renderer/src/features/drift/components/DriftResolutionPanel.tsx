import { useEffect, useState, useCallback } from 'react'
import { toast } from '@renderer/shared/components/Toaster'

type DriftResolutionPanelProps = {
  documents: [string, string]
  alertId: string
  summary: string
  onClose: () => void
}

export function DriftResolutionPanel({
  documents,
  alertId,
  summary,
  onClose
}: DriftResolutionPanelProps) {
  const [sourceContent, setSourceContent] = useState('')
  const [derivedContent, setDerivedContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      window.electronAPI.invoke('git:show-file', { path: documents[0], commitHash: 'HEAD' }),
      window.electronAPI.invoke('git:show-file', { path: documents[1], commitHash: 'HEAD' })
    ])
      .then(([source, derived]) => {
        setSourceContent(source)
        setDerivedContent(derived)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [documents])

  const handleFixSource = useCallback(async () => {
    await window.electronAPI.invoke('agent:launch', {
      task: `Corriger le document ${documents[0]} pour resoudre le drift: ${summary}`,
      context: [documents[0], documents[1]]
    })
    await window.electronAPI.invoke('drift:resolve', { driftId: alertId, action: 'fix-source' })
    toast({ title: `Agent lance pour corriger ${fileName(documents[0])}`, duration: 3000 })
    onClose()
  }, [documents, alertId, summary, onClose])

  const handleFixDerived = useCallback(async () => {
    await window.electronAPI.invoke('agent:launch', {
      task: `Corriger le document ${documents[1]} pour resoudre le drift: ${summary}`,
      context: [documents[0], documents[1]]
    })
    await window.electronAPI.invoke('drift:resolve', { driftId: alertId, action: 'fix-derived' })
    toast({ title: `Agent lance pour corriger ${fileName(documents[1])}`, duration: 3000 })
    onClose()
  }, [documents, alertId, summary, onClose])

  const handleIgnore = useCallback(async () => {
    await window.electronAPI.invoke('drift:resolve', { driftId: alertId, action: 'ignore' })
    toast({ title: 'Drift ignore', duration: 3000 })
    onClose()
  }, [alertId, onClose])

  const fileName = (path: string) => path.split('/').pop() ?? path

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-base)]">
        <div className="animate-pulse text-xs text-[var(--color-text-tertiary)]">Chargement...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-base)]">
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Resolution: {fileName(documents[0])} ↔ {fileName(documents[1])}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFixSource}
            className="px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90"
          >
            Corriger la source
          </button>
          <button
            onClick={handleFixDerived}
            className="px-3 py-1.5 text-xs bg-[var(--color-accent)] text-white rounded hover:opacity-90"
          >
            Corriger le derive
          </button>
          <button
            onClick={handleIgnore}
            className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded border border-[var(--color-border)]"
          >
            Ignorer
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
          >
            Fermer
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <p className="text-xs text-[var(--color-text-secondary)]">{summary}</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-[var(--color-border)]">
          <div className="px-3 py-2 bg-[var(--color-surface)] text-[10px] font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
            {fileName(documents[0])} (source)
          </div>
          <div className="flex-1 overflow-auto p-4">
            <pre className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap font-mono leading-relaxed">
              {sourceContent}
            </pre>
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="px-3 py-2 bg-[var(--color-surface)] text-[10px] font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
            {fileName(documents[1])} (derive)
          </div>
          <div className="flex-1 overflow-auto p-4">
            <pre className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap font-mono leading-relaxed">
              {derivedContent}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
