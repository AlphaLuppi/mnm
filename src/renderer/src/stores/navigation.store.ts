import { create } from 'zustand'

export type Breakpoint = 'full' | 'compact' | 'narrow' | 'minimum'

export type PaneId = 'context' | 'agents' | 'tests'

export type PaneSizes = {
  context: number
  agents: number
  tests: number
}

type NavigationState = {
  paneSizes: PaneSizes
  collapsedPanes: Set<PaneId>
  maximizedPane: PaneId | null
  previousSizes: PaneSizes | null
  breakpoint: Breakpoint
  timelineHeight: number

  setPaneSizes: (sizes: PaneSizes) => void
  togglePane: (pane: PaneId) => void
  maximizePane: (pane: PaneId) => void
  restorePane: () => void
  setBreakpoint: (bp: Breakpoint) => void
  setTimelineHeight: (height: number) => void
}

const DEFAULT_SIZES: PaneSizes = { context: 25, agents: 50, tests: 25 }

export const useNavigationStore = create<NavigationState>((set) => ({
  paneSizes: { ...DEFAULT_SIZES },
  collapsedPanes: new Set(),
  maximizedPane: null,
  previousSizes: null,
  breakpoint: 'full',
  timelineHeight: 120,

  setPaneSizes: (sizes) => set({ paneSizes: sizes }),

  togglePane: (pane) =>
    set((state) => {
      const next = new Set(state.collapsedPanes)
      if (next.has(pane)) {
        next.delete(pane)
      } else {
        next.add(pane)
      }
      return { collapsedPanes: next }
    }),

  maximizePane: (pane) =>
    set((state) => ({
      maximizedPane: pane,
      previousSizes: { ...state.paneSizes },
      paneSizes: {
        context: pane === 'context' ? 100 : 0,
        agents: pane === 'agents' ? 100 : 0,
        tests: pane === 'tests' ? 100 : 0
      }
    })),

  restorePane: () =>
    set((state) => ({
      maximizedPane: null,
      paneSizes: state.previousSizes ?? { ...DEFAULT_SIZES },
      previousSizes: null
    })),

  setBreakpoint: (bp) => set({ breakpoint: bp }),

  setTimelineHeight: (height) => set({ timelineHeight: Math.min(200, Math.max(80, height)) })
}))
