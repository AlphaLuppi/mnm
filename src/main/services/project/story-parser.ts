import { readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { ProjectHierarchy, EpicInfo, StoryInfo } from '@shared/types/story.types'
import { logger } from '@main/utils/logger'

export async function parseProjectHierarchy(projectPath: string): Promise<ProjectHierarchy> {
  const epicsPath = join(projectPath, '_bmad-output', 'planning-artifacts', 'epics.md')
  try {
    const content = await readFile(epicsPath, 'utf-8')
    return parseEpicsMarkdown(content, basename(projectPath))
  } catch {
    logger.warn('story-parser', 'Could not read epics.md', { path: epicsPath })
    return { projectName: basename(projectPath), epics: [] }
  }
}

export function parseEpicsMarkdown(content: string, projectName: string): ProjectHierarchy {
  const epics: EpicInfo[] = []
  const lines = content.split('\n')

  let currentEpic: EpicInfo | null = null
  let currentStory: StoryInfo | null = null
  // Only parse the detailed sections (## Epic N), skip summary (### Epic N)
  let inDetailedSection = false

  for (const line of lines) {
    // Match detailed Epic headers: "## Epic N : Title"
    const epicDetailMatch = line.match(/^##\s+Epic\s+(\d+)\s*[:\.]\s*(.+)/)
    if (epicDetailMatch) {
      inDetailedSection = true
      // Push previous story/epic
      if (currentStory && currentEpic) {
        currentEpic.stories.push(currentStory)
        currentStory = null
      }
      if (currentEpic) {
        epics.push(currentEpic)
      }

      const epicNum = parseInt(epicDetailMatch[1], 10)
      currentEpic = {
        id: `epic-${epicNum}`,
        number: epicNum,
        title: epicDetailMatch[2].trim(),
        description: '',
        stories: []
      }
      continue
    }

    // Skip summary section entries (### Epic N in the summary list)
    if (!inDetailedSection) continue

    // Match Story headers: "### Story N.M : Title"
    const storyMatch = line.match(/^###\s+Story\s+(\d+\.\d+)\s*[:\.]\s*(.+)/)
    if (storyMatch && currentEpic) {
      if (currentStory) {
        currentEpic.stories.push(currentStory)
      }
      currentStory = {
        id: `story-${storyMatch[1]}`,
        epicId: currentEpic.id,
        number: storyMatch[1],
        title: storyMatch[2].trim(),
        tasks: []
      }
      continue
    }

    // Match task checkboxes: "- [ ] Task text" or "- [x] Task text"
    const taskMatch = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)/)
    if (taskMatch && currentStory) {
      const taskIndex = currentStory.tasks.length + 1
      currentStory.tasks.push({
        id: `task-${currentStory.number}.${taskIndex}`,
        storyId: currentStory.id,
        title: taskMatch[2].trim(),
        completed: taskMatch[1].toLowerCase() === 'x'
      })
    }
  }

  // Push last story and epic
  if (currentStory && currentEpic) {
    currentEpic.stories.push(currentStory)
  }
  if (currentEpic) {
    epics.push(currentEpic)
  }

  return { projectName, epics }
}
