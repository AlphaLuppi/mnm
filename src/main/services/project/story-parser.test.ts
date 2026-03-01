import { describe, it, expect } from 'vitest'
import { parseEpicsMarkdown } from './story-parser'

const SAMPLE_EPICS = `# MnM - Epic Breakdown

## Overview

Some intro text.

### Epic 1 : Foundation
### Epic 2 : Agents

## Epic 1 : Application Foundation & Project Shell

Description for epic 1.

### Story 1.1 : Project Scaffold, IPC Bridge & Event Bus

As a **developer**,
I want the foundation.

- [ ] Task 1: Scaffold project
- [x] Task 2: Create shared types
- [ ] Task 3: Setup IPC bridge

### Story 1.2 : Three-Pane Layout

As a **user**,
I want the layout.

- [x] Task 1: Create layout
- [x] Task 2: Add timeline

## Epic 2 : Agent Monitoring & Supervision

Description for epic 2.

### Story 2.1 : Agent Harness

As a **user**,
I want agent controls.

- [ ] Task 1: Launch agent
- [ ] Task 2: Stop agent
`

describe('parseEpicsMarkdown', () => {
  it('should parse epics from detailed sections', () => {
    const result = parseEpicsMarkdown(SAMPLE_EPICS, 'mnm')

    expect(result.projectName).toBe('mnm')
    expect(result.epics).toHaveLength(2)
    expect(result.epics[0].id).toBe('epic-1')
    expect(result.epics[0].title).toBe('Application Foundation & Project Shell')
    expect(result.epics[1].id).toBe('epic-2')
  })

  it('should parse stories within epics', () => {
    const result = parseEpicsMarkdown(SAMPLE_EPICS, 'mnm')

    expect(result.epics[0].stories).toHaveLength(2)
    expect(result.epics[0].stories[0].id).toBe('story-1.1')
    expect(result.epics[0].stories[0].title).toBe('Project Scaffold, IPC Bridge & Event Bus')
    expect(result.epics[0].stories[1].id).toBe('story-1.2')
  })

  it('should parse tasks with completion status', () => {
    const result = parseEpicsMarkdown(SAMPLE_EPICS, 'mnm')
    const story11 = result.epics[0].stories[0]

    expect(story11.tasks).toHaveLength(3)
    expect(story11.tasks[0].completed).toBe(false)
    expect(story11.tasks[0].title).toBe('Task 1: Scaffold project')
    expect(story11.tasks[1].completed).toBe(true)
    expect(story11.tasks[2].completed).toBe(false)
  })

  it('should skip summary section epics', () => {
    const result = parseEpicsMarkdown(SAMPLE_EPICS, 'mnm')
    // Only 2 epics from detailed section, not duplicates from summary
    expect(result.epics).toHaveLength(2)
  })

  it('should handle empty content', () => {
    const result = parseEpicsMarkdown('', 'test')
    expect(result.epics).toEqual([])
  })

  it('should count completed tasks', () => {
    const result = parseEpicsMarkdown(SAMPLE_EPICS, 'mnm')
    const story12 = result.epics[0].stories[1]

    expect(story12.tasks).toHaveLength(2)
    expect(story12.tasks.every((t) => t.completed)).toBe(true)
  })
})
