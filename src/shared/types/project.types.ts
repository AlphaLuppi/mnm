import type { AppError } from './error.types'

export type BmadStructure = {
  detected: boolean
  hasBmadDir: boolean
  hasBmadOutputDir: boolean
  workflowFiles: string[]
  agentFiles: string[]
  outputArtifacts: string[]
}

export type ProjectSettings = {
  version: number
  driftThreshold: number
  recentProjects: string[]
}

export type ProjectInfo = {
  path: string
  name: string
  bmadStructure: BmadStructure
  settings: ProjectSettings
}

export type ProjectOpenResult =
  | { success: true; data: ProjectInfo }
  | { success: false; error: AppError }
