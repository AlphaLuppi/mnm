import { useCallback, useState } from 'react'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from '@renderer/components/ui/resizable'
import { PaneHeader } from './PaneHeader'
import { PaneEmptyState } from './PaneEmptyState'
import { useNavigationStore } from '@renderer/stores/navigation.store'
import { useNavigationSync } from '@renderer/shared/hooks/useNavigationSync'

type ThreePaneLayoutProps = {
  contextContent?: React.ReactNode
  agentsContent?: React.ReactNode
  testsContent?: React.ReactNode
}

const PANE_CONFIG = {
  context: { title: 'Contexte', defaultSize: 25, minSize: 14, maxSize: 40 },
  agents: { title: 'Agents', defaultSize: 50, minSize: 28, maxSize: 70 },
  tests: { title: 'Tests & Validation', defaultSize: 25, minSize: 14, maxSize: 40 }
} as const

type PaneId = 'context' | 'agents' | 'tests'

export function ThreePaneLayout({
  contextContent,
  agentsContent,
  testsContent
}: ThreePaneLayoutProps) {
  const { maximizedPane, breakpoint, setPaneSizes, maximizePane, restorePane } =
    useNavigationStore()

  const [narrowActiveTab, setNarrowActiveTab] = useState<PaneId>('agents')

  const handleLayout = useCallback(
    (layout: Record<string, number>) => {
      setPaneSizes({
        context: layout['pane-context'] ?? 25,
        agents: layout['pane-agents'] ?? 50,
        tests: layout['pane-tests'] ?? 25
      })
    },
    [setPaneSizes]
  )

  const handleDoubleClick = useCallback(
    (pane: PaneId) => {
      if (maximizedPane === pane) {
        restorePane()
      } else {
        maximizePane(pane)
      }
    },
    [maximizedPane, maximizePane, restorePane]
  )

  const compact = breakpoint === 'compact'
  const sync = useNavigationSync()

  // Synchronized stub content — will be replaced by real content from Epics 2-7
  const syncedContext = sync.storyId ? (
    <SyncedPaneStub pane="Contexte" label={sync.label} />
  ) : undefined
  const syncedAgents = sync.storyId ? (
    <SyncedPaneStub pane="Agents" label={sync.label} />
  ) : undefined
  const syncedTests = sync.storyId ? (
    <SyncedPaneStub pane="Tests" label={sync.label} />
  ) : undefined

  const paneContent: Record<PaneId, { content: React.ReactNode; empty: { title: string; description: string } }> = {
    context: {
      content: contextContent ?? syncedContext,
      empty: { title: 'Aucun fichier de contexte', description: 'Selectionnez une story pour voir les fichiers' }
    },
    agents: {
      content: agentsContent ?? syncedAgents,
      empty: { title: 'Aucun agent actif', description: 'Selectionnez une story pour voir les agents' }
    },
    tests: {
      content: testsContent ?? syncedTests,
      empty: { title: 'Aucun test disponible', description: 'Selectionnez une story pour voir les tests' }
    }
  }

  // Narrow breakpoint: 2 panes + tab toggle
  if (breakpoint === 'narrow') {
    const activePane = narrowActiveTab

    return (
      <div className="flex h-full flex-col">
        {/* Tab toggle for hidden pane */}
        <div className="flex shrink-0 border-b border-border-default bg-bg-surface">
          {(['context', 'agents', 'tests'] as const).map((pane) => (
            <button
              key={pane}
              onClick={() => setNarrowActiveTab(pane)}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                narrowActiveTab === pane
                  ? 'border-b-2 border-accent text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {PANE_CONFIG[pane].title}
            </button>
          ))}
        </div>

        {/* Show the selected pane full-width */}
        <div className="flex-1 overflow-hidden">
          <div
            id={`pane-${activePane}`}
            tabIndex={0}
            className="flex h-full flex-col bg-bg-surface"
          >
            <PaneHeader
              title={PANE_CONFIG[activePane].title}
              compact={false}
            />
            <div className="flex-1 overflow-auto">
              {paneContent[activePane].content ?? (
                <PaneEmptyState {...paneContent[activePane].empty} />
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Full / Compact: 3 resizable panes
  return (
    <ResizablePanelGroup orientation="horizontal" onLayoutChanged={handleLayout}>
      <ResizablePanel
        id="pane-context"
        defaultSize={PANE_CONFIG.context.defaultSize}
        minSize={PANE_CONFIG.context.minSize}
        maxSize={PANE_CONFIG.context.maxSize}
      >
        <div id="pane-context" tabIndex={0} className="flex h-full flex-col bg-bg-surface">
          <PaneHeader
            title={PANE_CONFIG.context.title}
            onDoubleClick={() => handleDoubleClick('context')}
            compact={compact}
          />
          <div className="flex-1 overflow-auto">
            {contextContent ?? <PaneEmptyState {...paneContent.context.empty} />}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle aria-label="Redimensionner" />

      <ResizablePanel
        id="pane-agents"
        defaultSize={PANE_CONFIG.agents.defaultSize}
        minSize={PANE_CONFIG.agents.minSize}
        maxSize={PANE_CONFIG.agents.maxSize}
      >
        <div id="pane-agents" tabIndex={0} className="flex h-full flex-col bg-bg-surface">
          <PaneHeader
            title={PANE_CONFIG.agents.title}
            onDoubleClick={() => handleDoubleClick('agents')}
            compact={compact}
          />
          <div className="flex-1 overflow-auto">
            {agentsContent ?? <PaneEmptyState {...paneContent.agents.empty} />}
          </div>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle aria-label="Redimensionner" />

      <ResizablePanel
        id="pane-tests"
        defaultSize={PANE_CONFIG.tests.defaultSize}
        minSize={PANE_CONFIG.tests.minSize}
        maxSize={PANE_CONFIG.tests.maxSize}
      >
        <div id="pane-tests" tabIndex={0} className="flex h-full flex-col bg-bg-surface">
          <PaneHeader
            title={PANE_CONFIG.tests.title}
            onDoubleClick={() => handleDoubleClick('tests')}
            compact={compact}
          />
          <div className="flex-1 overflow-auto">
            {testsContent ?? <PaneEmptyState {...paneContent.tests.empty} />}
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function SyncedPaneStub({ pane, label }: { pane: string; label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
      <p className="text-sm text-text-secondary">{pane}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}
