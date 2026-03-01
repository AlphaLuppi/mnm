import { describe, it, expect, beforeEach } from 'vitest'
import { useNavigationStore } from './navigation.store'

describe('useNavigationStore', () => {
  beforeEach(() => {
    useNavigationStore.setState({
      paneSizes: { context: 25, agents: 50, tests: 25 },
      collapsedPanes: new Set(),
      maximizedPane: null,
      previousSizes: null,
      breakpoint: 'full',
      timelineHeight: 120
    })
  })

  it('should have correct default values', () => {
    const state = useNavigationStore.getState()
    expect(state.paneSizes).toEqual({ context: 25, agents: 50, tests: 25 })
    expect(state.collapsedPanes.size).toBe(0)
    expect(state.maximizedPane).toBeNull()
    expect(state.breakpoint).toBe('full')
    expect(state.timelineHeight).toBe(120)
  })

  it('should update pane sizes', () => {
    useNavigationStore.getState().setPaneSizes({ context: 30, agents: 40, tests: 30 })
    expect(useNavigationStore.getState().paneSizes).toEqual({ context: 30, agents: 40, tests: 30 })
  })

  it('should toggle pane collapsed state', () => {
    const { togglePane } = useNavigationStore.getState()

    togglePane('context')
    expect(useNavigationStore.getState().collapsedPanes.has('context')).toBe(true)

    togglePane('context')
    expect(useNavigationStore.getState().collapsedPanes.has('context')).toBe(false)
  })

  it('should maximize a pane and save previous sizes', () => {
    useNavigationStore.getState().maximizePane('agents')
    const state = useNavigationStore.getState()

    expect(state.maximizedPane).toBe('agents')
    expect(state.paneSizes).toEqual({ context: 0, agents: 100, tests: 0 })
    expect(state.previousSizes).toEqual({ context: 25, agents: 50, tests: 25 })
  })

  it('should restore pane sizes after maximize', () => {
    useNavigationStore.getState().maximizePane('agents')
    useNavigationStore.getState().restorePane()
    const state = useNavigationStore.getState()

    expect(state.maximizedPane).toBeNull()
    expect(state.paneSizes).toEqual({ context: 25, agents: 50, tests: 25 })
    expect(state.previousSizes).toBeNull()
  })

  it('should restore defaults when no previous sizes exist', () => {
    useNavigationStore.getState().restorePane()
    expect(useNavigationStore.getState().paneSizes).toEqual({ context: 25, agents: 50, tests: 25 })
  })

  it('should update breakpoint', () => {
    useNavigationStore.getState().setBreakpoint('narrow')
    expect(useNavigationStore.getState().breakpoint).toBe('narrow')
  })

  it('should clamp timeline height between 80 and 200', () => {
    const { setTimelineHeight } = useNavigationStore.getState()

    setTimelineHeight(50)
    expect(useNavigationStore.getState().timelineHeight).toBe(80)

    setTimelineHeight(300)
    expect(useNavigationStore.getState().timelineHeight).toBe(200)

    setTimelineHeight(150)
    expect(useNavigationStore.getState().timelineHeight).toBe(150)
  })
})
