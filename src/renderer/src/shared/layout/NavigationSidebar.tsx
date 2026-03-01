import { useHierarchyStore } from '@renderer/stores/hierarchy.store'
import type { EpicInfo, StoryInfo, TaskInfo } from '@shared/types/story.types'

export function NavigationSidebar() {
  const hierarchy = useHierarchyStore((s) => s.hierarchy)

  if (hierarchy.status !== 'success') {
    return (
      <nav className="flex w-60 shrink-0 flex-col border-r border-border-default bg-bg-surface">
        <div className="p-3 text-xs text-text-muted">
          {hierarchy.status === 'loading' ? 'Chargement...' : 'Aucune hierarchie'}
        </div>
      </nav>
    )
  }

  return (
    <nav
      className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-border-default bg-bg-surface"
      aria-label="Project navigation"
    >
      <div role="tree" aria-label={hierarchy.data.projectName} className="py-2">
        {hierarchy.data.epics.map((epic) => (
          <EpicNode key={epic.id} epic={epic} />
        ))}
      </div>
    </nav>
  )
}

function EpicNode({ epic }: { epic: EpicInfo }) {
  const selectedEpicId = useHierarchyStore((s) => s.selectedEpicId)
  const selectedStoryId = useHierarchyStore((s) => s.selectedStoryId)
  const expandedNodes = useHierarchyStore((s) => s.expandedNodes)
  const selectEpic = useHierarchyStore((s) => s.selectEpic)
  const toggleExpanded = useHierarchyStore((s) => s.toggleExpanded)

  const isExpanded = expandedNodes.has(epic.id)
  const isSelected = selectedEpicId === epic.id && !selectedStoryId

  return (
    <div role="treeitem" aria-level={1} aria-expanded={isExpanded} aria-selected={isSelected}>
      <div
        className={`flex cursor-pointer items-center gap-1 px-3 py-1.5 text-xs transition-colors hover:bg-bg-elevated ${
          isSelected ? 'border-l-2 border-accent bg-accent/10 text-text-primary' : 'text-text-secondary'
        }`}
        onClick={() => selectEpic(epic.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') selectEpic(epic.id)
          if (e.key === 'ArrowRight' && !isExpanded) toggleExpanded(epic.id)
          if (e.key === 'ArrowLeft' && isExpanded) toggleExpanded(epic.id)
        }}
        tabIndex={isSelected ? 0 : -1}
      >
        <button
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            toggleExpanded(epic.id)
          }}
          aria-label={isExpanded ? 'Replier' : 'Deplier'}
        >
          <ChevronIcon rotated={isExpanded} />
        </button>
        <span className="truncate font-medium">
          E{epic.number}: {epic.title}
        </span>
      </div>
      {isExpanded && (
        <div role="group">
          {epic.stories.map((story) => (
            <StoryNode key={story.id} story={story} />
          ))}
        </div>
      )}
    </div>
  )
}

function StoryNode({ story }: { story: StoryInfo }) {
  const selectedStoryId = useHierarchyStore((s) => s.selectedStoryId)
  const selectedTaskId = useHierarchyStore((s) => s.selectedTaskId)
  const expandedNodes = useHierarchyStore((s) => s.expandedNodes)
  const selectStory = useHierarchyStore((s) => s.selectStory)
  const toggleExpanded = useHierarchyStore((s) => s.toggleExpanded)

  const isExpanded = expandedNodes.has(story.id)
  const isSelected = selectedStoryId === story.id && !selectedTaskId
  const hasChildren = story.tasks.length > 0
  const completedCount = story.tasks.filter((t) => t.completed).length

  return (
    <div
      role="treeitem"
      aria-level={2}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
    >
      <div
        className={`flex cursor-pointer items-center gap-1 py-1.5 pl-7 pr-3 text-xs transition-colors hover:bg-bg-elevated ${
          isSelected ? 'border-l-2 border-accent bg-accent/10 text-text-primary' : 'text-text-secondary'
        }`}
        onClick={() => selectStory(story.epicId, story.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') selectStory(story.epicId, story.id)
          if (e.key === 'ArrowRight' && hasChildren && !isExpanded) toggleExpanded(story.id)
          if (e.key === 'ArrowLeft' && hasChildren && isExpanded) toggleExpanded(story.id)
        }}
        tabIndex={isSelected ? 0 : -1}
      >
        {hasChildren && (
          <button
            className="flex h-4 w-4 shrink-0 items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(story.id)
            }}
            aria-label={isExpanded ? 'Replier' : 'Deplier'}
          >
            <ChevronIcon rotated={isExpanded} />
          </button>
        )}
        <span className="truncate">S{story.number}: {story.title}</span>
        {hasChildren && (
          <span className="ml-auto shrink-0 text-text-muted">
            {completedCount}/{story.tasks.length}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div role="group">
          {story.tasks.map((task) => (
            <TaskNode key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskNode({ task }: { task: TaskInfo }) {
  const selectedTaskId = useHierarchyStore((s) => s.selectedTaskId)
  const selectTask = useHierarchyStore((s) => s.selectTask)

  const isSelected = selectedTaskId === task.id

  return (
    <div role="treeitem" aria-level={3} aria-selected={isSelected}>
      <div
        className={`flex cursor-pointer items-center gap-2 py-1 pl-12 pr-3 text-xs transition-colors hover:bg-bg-elevated ${
          isSelected ? 'border-l-2 border-accent bg-accent/10 text-text-primary' : 'text-text-secondary'
        }`}
        onClick={() => selectTask(task.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') selectTask(task.id)
        }}
        tabIndex={isSelected ? 0 : -1}
      >
        <span className={task.completed ? 'text-status-green' : 'text-text-muted'}>
          {task.completed ? '\u2713' : '\u25CB'}
        </span>
        <span className="truncate">{task.title}</span>
      </div>
    </div>
  )
}

function ChevronIcon({ rotated = false }: { rotated?: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={`text-text-muted transition-transform ${rotated ? 'rotate-90' : ''}`}
    >
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
