import { WidgetCard } from './WidgetCard'
import { StoryProgressBar } from './StoryProgressBar'
import { useStoriesProgress } from '../hooks/useStoriesProgress'
import type { StoryProgressItem } from '../hooks/useStoriesProgress'

export function StoriesProgress() {
  const storiesState = useStoriesProgress()

  if (storiesState.status === 'loading') {
    return (
      <WidgetCard title="Stories">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded bg-[var(--color-border)] animate-pulse" />
          ))}
        </div>
      </WidgetCard>
    )
  }

  if (storiesState.status === 'error') {
    return (
      <WidgetCard title="Stories">
        <div role="alert" className="text-sm text-red-400 p-2">
          {storiesState.error.message}
        </div>
      </WidgetCard>
    )
  }

  if (storiesState.status === 'idle') {
    return null
  }

  const stories = storiesState.data

  if (stories.length === 0) {
    return (
      <WidgetCard title="Stories">
        <div role="status" className="flex flex-col items-center gap-2 py-6 text-[var(--color-text-muted)]">
          <span className="text-sm">Aucune story detectee</span>
          <span className="text-xs">Les stories sont parsees depuis _bmad-output/</span>
        </div>
      </WidgetCard>
    )
  }

  const byEpic = groupByEpic(stories)

  return (
    <WidgetCard title="Stories">
      <div role="region" aria-label="Progression des stories" className="space-y-4">
        {Object.entries(byEpic).map(([epicId, epicStories]) => (
          <EpicGroup key={epicId} epicId={epicId} stories={epicStories} />
        ))}
      </div>
    </WidgetCard>
  )
}

type EpicGroupProps = {
  epicId: string
  stories: StoryProgressItem[]
}

function EpicGroup({ epicId, stories }: EpicGroupProps) {
  const epicTitle = stories[0]?.epicTitle || `Epic ${epicId}`
  const epicCompleted = stories.filter((s) => s.ratio >= 1.0).length
  const epicTotal = stories.length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">{epicTitle}</h4>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {epicCompleted}/{epicTotal}
        </span>
      </div>
      <div className="space-y-1.5">
        {stories.map((story) => (
          <StoryRow key={story.id} story={story} />
        ))}
      </div>
    </div>
  )
}

type StoryRowProps = {
  story: StoryProgressItem
}

function StoryRow({ story }: StoryRowProps) {
  const isDone = story.ratio >= 1.0

  return (
    <div
      className="flex items-center gap-3 w-full text-left px-2 py-1 rounded transition-colors duration-200"
      aria-label={`Story ${story.number} ${story.title}: ${story.tasksCompleted}/${story.tasksTotal} taches${isDone ? ' - termine' : ''}`}
    >
      <span className="text-xs text-[var(--color-text-tertiary)] w-8 shrink-0 font-mono">
        {story.number}
      </span>
      <span className="text-sm text-[var(--color-text-primary)] truncate flex-1">{story.title}</span>
      <StoryProgressBar ratio={story.ratio} className="w-24 shrink-0" />
      <span className="text-xs text-[var(--color-text-tertiary)] w-10 text-right shrink-0">
        {story.tasksCompleted}/{story.tasksTotal}
      </span>
      {isDone && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 shrink-0">
          Done
        </span>
      )}
    </div>
  )
}

function groupByEpic(stories: StoryProgressItem[]): Record<string, StoryProgressItem[]> {
  const groups: Record<string, StoryProgressItem[]> = {}
  for (const story of stories) {
    if (!groups[story.epicId]) {
      groups[story.epicId] = []
    }
    groups[story.epicId].push(story)
  }
  return groups
}
