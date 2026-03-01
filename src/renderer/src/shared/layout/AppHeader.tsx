export function AppHeader() {
  return (
    <header
      role="banner"
      className="flex h-12 shrink-0 items-center border-b border-border-default bg-bg-surface px-4"
    >
      <span className="text-sm font-bold text-text-primary">MnM</span>
      <span className="mx-3 text-text-muted">/</span>
      <span className="text-sm text-text-secondary">Aucun projet</span>
    </header>
  )
}
