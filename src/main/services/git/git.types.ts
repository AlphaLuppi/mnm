export type GitLogEntry = {
  hash: string
  date: string
  message: string
  author: string
  files: string[]
}

export type GitFileStatus = {
  path: string
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'
}

export type GitStatusResult = {
  current: string | null
  tracking: string | null
  files: GitFileStatus[]
  ahead: number
  behind: number
}
