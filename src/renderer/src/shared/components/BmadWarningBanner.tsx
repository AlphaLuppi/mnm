import { useState } from 'react'

export function BmadWarningBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex items-center gap-3 border-b border-status-orange/30 bg-status-orange/10 px-4 py-2">
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0 text-status-orange"
      >
        <path
          d="M8 1L15 14H1L8 1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M8 6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </svg>
      <p className="flex-1 text-xs text-status-orange">
        Structure BMAD non detectee — les dossiers <code className="font-mono">_bmad/</code> et{' '}
        <code className="font-mono">_bmad-output/</code> sont attendus.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-xs text-text-muted hover:text-text-secondary"
      >
        Fermer
      </button>
    </div>
  )
}
