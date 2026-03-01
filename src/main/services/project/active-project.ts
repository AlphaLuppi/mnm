let activeProjectPath: string | null = null

export function setActiveProjectPath(path: string): void {
  activeProjectPath = path
}

export function getActiveProjectPath(): string | null {
  return activeProjectPath
}
