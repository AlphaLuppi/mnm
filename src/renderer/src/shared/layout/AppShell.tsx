import { useEffect } from 'react'
import { AppHeader } from './AppHeader'
import { ThreePaneLayout } from './ThreePaneLayout'
import { TimelineBar } from './TimelineBar'
import { MinResolutionOverlay } from './MinResolutionOverlay'
import { useNavigationStore } from '@renderer/stores/navigation.store'
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

  // Window resize → breakpoint
  useEffect(() => {
    const handleResize = () => {
      setBreakpoint(getBreakpoint(window.innerWidth))
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setBreakpoint])

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
          // Placeholder: navigate up one level (Story 1.4)
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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

      <AppHeader />

      <main className="flex-1 overflow-hidden">
        <ThreePaneLayout />
      </main>

      <TimelineBar />

      {breakpoint === 'minimum' && <MinResolutionOverlay />}
    </div>
  )
}
