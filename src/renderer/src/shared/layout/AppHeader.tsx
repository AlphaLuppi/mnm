import { useHierarchyStore } from '@renderer/stores/hierarchy.store'
import { FileChangeBadge } from '@renderer/features/context/components/FileChangeBadge'

type AppHeaderProps = {
  projectName?: string
  bmadDetected?: boolean
}

export function AppHeader({ projectName, bmadDetected }: AppHeaderProps) {
  return (
    <header
      role="banner"
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border-default bg-bg-surface px-4"
    >
      <span className="text-sm font-bold text-text-primary">MnM</span>
      {projectName && (
        <>
          <span className="text-text-muted">/</span>
          <NavigationBreadcrumb projectName={projectName} />
          <span
            className={`ml-1 inline-block h-2 w-2 rounded-full ${
              bmadDetected ? 'bg-status-green' : 'bg-status-gray'
            }`}
            title={bmadDetected ? 'BMAD detecte' : 'BMAD non detecte'}
          />
        </>
      )}
      {!projectName && (
        <>
          <span className="text-text-muted">/</span>
          <span className="text-sm text-text-secondary">Aucun projet</span>
        </>
      )}

      {/* File change badge + Cmd+K hint */}
      <div className="ml-auto flex items-center gap-3">
        <FileChangeBadge />
      </div>
      <div>
        <kbd className="rounded border border-border-default px-1.5 py-0.5 text-[10px] text-text-muted">
          ⌘K
        </kbd>
      </div>
    </header>
  )
}

function NavigationBreadcrumb({ projectName }: { projectName: string }) {
  const breadcrumb = useHierarchyStore((s) => s.breadcrumb())
  const navigateTo = useHierarchyStore((s) => s.navigateTo)

  // If no hierarchy loaded yet, just show project name
  if (breadcrumb.length === 0) {
    return <span className="text-sm text-text-primary">{projectName}</span>
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1">
        {breadcrumb.map((segment, index) => {
          const isLast = index === breadcrumb.length - 1
          return (
            <li key={segment.id} className="flex items-center gap-1">
              {index > 0 && <span className="text-text-muted">&gt;</span>}
              {isLast ? (
                <span className="text-sm font-medium text-text-primary" aria-current="page">
                  {segment.label}
                </span>
              ) : (
                <button
                  className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                  onClick={() => navigateTo(segment.level, segment.id)}
                >
                  {segment.label}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
