import { GitService } from './git.service'

let gitService: GitService | null = null

export function initGitService(projectPath: string): GitService {
  gitService = new GitService(projectPath)
  return gitService
}

export function getGitService(): GitService | null {
  return gitService
}
