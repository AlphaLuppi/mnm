type AppHeaderProps = {
  projectName?: string
  bmadDetected?: boolean
}

export function AppHeader({ projectName, bmadDetected }: AppHeaderProps) {
  return (
    <header
      role="banner"
      className="flex h-12 shrink-0 items-center border-b border-border-default bg-bg-surface px-4"
    >
      <span className="text-sm font-bold text-text-primary">MnM</span>
      <span className="mx-3 text-text-muted">/</span>
      <span className="text-sm text-text-secondary">
        {projectName ?? 'Aucun projet'}
      </span>
      {projectName && (
        <span
          className={`ml-3 inline-block h-2 w-2 rounded-full ${
            bmadDetected ? 'bg-status-green' : 'bg-status-gray'
          }`}
          title={bmadDetected ? 'BMAD detecte' : 'BMAD non detecte'}
        />
      )}
    </header>
  )
}
