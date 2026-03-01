export function MinResolutionOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/95">
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          className="text-text-muted"
        >
          <rect
            x="4"
            y="10"
            width="40"
            height="28"
            rx="3"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M16 42h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M24 38v4" stroke="currentColor" strokeWidth="2" />
        </svg>
        <p className="text-lg font-semibold text-text-primary">Resolution insuffisante</p>
        <p className="max-w-sm text-sm text-text-muted">
          MnM necessite un ecran d&apos;au moins 1024px de large pour fonctionner correctement.
        </p>
      </div>
    </div>
  )
}
