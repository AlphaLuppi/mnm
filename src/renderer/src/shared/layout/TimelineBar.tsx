export function TimelineBar() {
  return (
    <footer
      id="timeline-bar"
      role="region"
      aria-label="Timeline d'activite"
      className="flex h-[120px] shrink-0 items-center justify-center border-t border-border-default bg-bg-surface"
    >
      <div className="flex flex-col items-center gap-2">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          className="text-text-muted opacity-40"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-text-muted">Aucune activite</p>
      </div>
    </footer>
  )
}
