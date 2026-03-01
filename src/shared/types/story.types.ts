export type EpicInfo = {
  id: string
  number: number
  title: string
  description: string
  stories: StoryInfo[]
}

export type StoryInfo = {
  id: string
  epicId: string
  number: string
  title: string
  tasks: TaskInfo[]
}

export type TaskInfo = {
  id: string
  storyId: string
  title: string
  completed: boolean
}

export type ProjectHierarchy = {
  projectName: string
  epics: EpicInfo[]
}
