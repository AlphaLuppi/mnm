export type FileHistoryEntry = {
  hash: string
  date: string
  author: string
  message: string
}

export type FileVersionView = {
  content: string
  commitHash: string
  commitDate: string
  commitMessage: string
}

export type DiffLine = {
  type: 'addition' | 'deletion' | 'context'
  content: string
  prefix: string
  lineNumber: number | null
}

export type DiffHunk = {
  header: string
  lines: DiffLine[]
}
