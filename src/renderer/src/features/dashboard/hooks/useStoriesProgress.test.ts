import { describe, it, expect } from 'vitest'
import type { ProjectHierarchy } from '@shared/types/story.types'

function flattenHierarchy(hierarchy: ProjectHierarchy) {
  const items: Array<{
    id: string
    number: string
    title: string
    epicId: string
    epicTitle: string
    tasksTotal: number
    tasksCompleted: number
    ratio: number
  }> = []

  for (const epic of hierarchy.epics) {
    for (const story of epic.stories) {
      const tasksTotal = story.tasks.length
      const tasksCompleted = story.tasks.filter((t) => t.completed).length
      items.push({
        id: story.id,
        number: story.number,
        title: story.title,
        epicId: epic.id,
        epicTitle: epic.title,
        tasksTotal,
        tasksCompleted,
        ratio: tasksTotal > 0 ? tasksCompleted / tasksTotal : 0
      })
    }
  }
  return items
}

describe('useStoriesProgress (flattenHierarchy)', () => {
  it('returns empty array for empty hierarchy', () => {
    const result = flattenHierarchy({ projectName: 'test', epics: [] })
    expect(result).toEqual([])
  })

  it('flattens stories with task progress', () => {
    const hierarchy: ProjectHierarchy = {
      projectName: 'mnm',
      epics: [
        {
          id: 'epic-1',
          number: 1,
          title: 'Foundation',
          description: '',
          stories: [
            {
              id: 'story-1.1',
              epicId: 'epic-1',
              number: '1.1',
              title: 'Scaffold',
              tasks: [
                { id: 't1', storyId: 'story-1.1', title: 'Task 1', completed: true },
                { id: 't2', storyId: 'story-1.1', title: 'Task 2', completed: false },
                { id: 't3', storyId: 'story-1.1', title: 'Task 3', completed: true }
              ]
            }
          ]
        }
      ]
    }

    const result = flattenHierarchy(hierarchy)
    expect(result).toHaveLength(1)
    expect(result[0].tasksTotal).toBe(3)
    expect(result[0].tasksCompleted).toBe(2)
    expect(result[0].ratio).toBeCloseTo(2 / 3)
    expect(result[0].epicTitle).toBe('Foundation')
  })

  it('handles fully completed stories', () => {
    const hierarchy: ProjectHierarchy = {
      projectName: 'mnm',
      epics: [
        {
          id: 'epic-1',
          number: 1,
          title: 'Foundation',
          description: '',
          stories: [
            {
              id: 'story-1.1',
              epicId: 'epic-1',
              number: '1.1',
              title: 'Done story',
              tasks: [
                { id: 't1', storyId: 'story-1.1', title: 'Task 1', completed: true },
                { id: 't2', storyId: 'story-1.1', title: 'Task 2', completed: true }
              ]
            }
          ]
        }
      ]
    }

    const result = flattenHierarchy(hierarchy)
    expect(result[0].ratio).toBe(1.0)
  })

  it('handles stories with no tasks', () => {
    const hierarchy: ProjectHierarchy = {
      projectName: 'mnm',
      epics: [
        {
          id: 'epic-1',
          number: 1,
          title: 'Foundation',
          description: '',
          stories: [
            {
              id: 'story-1.1',
              epicId: 'epic-1',
              number: '1.1',
              title: 'Empty story',
              tasks: []
            }
          ]
        }
      ]
    }

    const result = flattenHierarchy(hierarchy)
    expect(result[0].ratio).toBe(0)
    expect(result[0].tasksTotal).toBe(0)
  })

  it('flattens across multiple epics', () => {
    const hierarchy: ProjectHierarchy = {
      projectName: 'mnm',
      epics: [
        {
          id: 'epic-1',
          number: 1,
          title: 'Foundation',
          description: '',
          stories: [
            { id: 'story-1.1', epicId: 'epic-1', number: '1.1', title: 'S1', tasks: [] }
          ]
        },
        {
          id: 'epic-2',
          number: 2,
          title: 'Agents',
          description: '',
          stories: [
            { id: 'story-2.1', epicId: 'epic-2', number: '2.1', title: 'S2', tasks: [] },
            { id: 'story-2.2', epicId: 'epic-2', number: '2.2', title: 'S3', tasks: [] }
          ]
        }
      ]
    }

    const result = flattenHierarchy(hierarchy)
    expect(result).toHaveLength(3)
    expect(result[0].epicTitle).toBe('Foundation')
    expect(result[1].epicTitle).toBe('Agents')
  })
})
