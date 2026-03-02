import simpleGit from 'simple-git'
import type { SimpleGit } from 'simple-git'
import type { GitLogEntry, GitStatusResult, GitFileStatus } from './git.types'

export class GitService {
  private git: SimpleGit

  constructor(projectPath: string) {
    this.git = simpleGit(projectPath)
  }

  async getLog(count: number = 50): Promise<GitLogEntry[]> {
    const log = await this.git.log({ maxCount: count })
    return log.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name,
      files: []
    }))
  }

  async getStatus(): Promise<GitStatusResult> {
    const status = await this.git.status()
    return {
      current: status.current,
      tracking: status.tracking,
      files: status.files.map((f) => ({
        path: f.path,
        status: this.mapFileStatus(f.working_dir, f.index)
      })),
      ahead: status.ahead,
      behind: status.behind
    }
  }

  async getFileHistory(filePath: string, count: number = 20): Promise<GitLogEntry[]> {
    const log = await this.git.log({ maxCount: count, file: filePath })
    return log.all.map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
      author: entry.author_name,
      files: [filePath]
    }))
  }

  async showFile(filePath: string, commitHash: string): Promise<string> {
    return this.git.show([`${commitHash}:${filePath}`])
  }

  async getDiff(commitA: string, commitB: string): Promise<string> {
    return this.git.diff([commitA, commitB])
  }

  private mapFileStatus(workingDir: string, index: string): GitFileStatus['status'] {
    if (workingDir === '?' || index === '?') return 'untracked'
    if (workingDir === 'D' || index === 'D') return 'deleted'
    if (workingDir === 'A' || index === 'A') return 'added'
    if (workingDir === 'R' || index === 'R') return 'renamed'
    return 'modified'
  }
}
