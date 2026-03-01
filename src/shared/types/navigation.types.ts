export type NavigationLevel = 'project' | 'epic' | 'story' | 'task'

export type BreadcrumbSegment = {
  id: string
  label: string
  level: NavigationLevel
}
