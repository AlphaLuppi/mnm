import { useEffect } from 'react'
import { AppHeader } from './AppHeader'
import { ThreePaneLayout } from './ThreePaneLayout'
import { TimelineBar } from './TimelineBar'
import { MinResolutionOverlay } from './MinResolutionOverlay'
import { OpenProjectScreen } from './OpenProjectScreen'
import { NavigationSidebar } from './NavigationSidebar'
import { BmadWarningBanner } from '@renderer/shared/components/BmadWarningBanner'
import { CommandPalette } from '@renderer/shared/components/CommandPalette'
import { useNavigationStore } from '@renderer/stores/navigation.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { useHierarchyStore } from '@renderer/stores/hierarchy.store'
import type { Breakpoint } from '@renderer/stores/navigation.store'

function getBreakpoint(width: number): Breakpoint {
  if (width < 1024) return 'minimum'
  if (width < 1280) return 'narrow'
  if (width < 1440) return 'compact'
  return 'full'
}

export function AppShell() {
  const breakpoint = useNavigationStore((s) => s.breakpoint)
  const setBreakpoint = useNavigationStore((s) => s.setBreakpoint)
  const project = useProjectStore((s) => s.project)
  const loadHierarchy = useHierarchyStore((s) => s.loadHierarchy)
  const navigateUp = useHierarchyStore((s) => s.navigateUp)

  // Window resize → breakpoint
  useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getBreakpoint(window.innerWidth))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setBreakpoint])

  // Load hierarchy when project loads
  useEffect(() => {
    if (project.status === 'success') {
      loadHierarchy()
    }
  }, [project.status, loadHierarchy])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Skip if a dialog is open (let Escape close the dialog instead)
      if (document.querySelector('[role="dialog"]') && e.key !== 'Escape') {
        return
      }

      switch (e.key) {
        case '1':
          document.getElementById('pane-context')?.focus()
          break
        case '2':
          document.getElementById('pane-agents')?.focus()
          break
        case '3':
          document.getElementById('pane-tests')?.focus()
          break
        case 'Escape':
          if (!document.querySelector('[role="dialog"]')) {
            navigateUp()
          }
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigateUp])

  // No project loaded — show OpenProjectScreen
  if (project.status === 'idle' || project.status === 'error') {
    return (
      <OpenProjectScreen
        error={project.status === 'error' ? project.error : undefined}
      />
    )
  }

  // Loading project
  if (project.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base text-text-primary">
        <div className="animate-pulse text-text-muted">Chargement du projet...</div>
      </div>
    )
  }

  // Project loaded — render the full layout
  const showBmadWarning = !project.data.bmadStructure.detected

  return (
    <div className="flex h-screen flex-col bg-bg-base text-text-primary">
      {/* Skip links */}
      <a
        href="#pane-context"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-accent focus:p-2 focus:text-white"
      >
        Aller au volet Contexte
      </a>
      <a
        href="#pane-agents"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-accent focus:p-2 focus:text-white"
      >
        Aller au volet Agents
      </a>
      <a
        href="#pane-tests"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-accent focus:p-2 focus:text-white"
      >
        Aller au volet Tests
      </a>
      <a
        href="#timeline-bar"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-accent focus:p-2 focus:text-white"
      >
        Aller a la timeline
      </a>

      <AppHeader
        projectName={project.data.name}
        bmadDetected={project.data.bmadStructure.detected}
      />

      {showBmadWarning && <BmadWarningBanner />}

      <div className="flex flex-1 overflow-hidden">
        <NavigationSidebar />
        <main className="flex-1 overflow-hidden">
          <ThreePaneLayout />
        </main>
      </div>

      <TimelineBar />

      <CommandPalette />

      {breakpoint === 'minimum' && <MinResolutionOverlay />}
    </div>
  )
}
