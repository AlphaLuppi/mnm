export type ContextFile = {
  path: string
  name: string
  extension: string
  relativePath: string
  agentIds: string[]
  isModified: boolean
  lastModified: number
  lastModifiedBy?: string
  storyId?: string
}
