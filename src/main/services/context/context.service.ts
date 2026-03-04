import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ProjectFileInfo } from '@shared/ipc-channels'

type AgentContextState = Record<string, string[]>

export class ContextService {
  private projectPath: string
  private agentContexts: AgentContextState = {}

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  addFileToAgent(agentId: string, filePath: string): void {
    if (!this.agentContexts[agentId]) {
      this.agentContexts[agentId] = []
    }
    if (!this.agentContexts[agentId].includes(filePath)) {
      this.agentContexts[agentId].push(filePath)
    }
  }

  removeFileFromAgent(agentId: string, filePath: string): void {
    if (!this.agentContexts[agentId]) return
    this.agentContexts[agentId] = this.agentContexts[agentId].filter((p) => p !== filePath)
  }

  getAgentFiles(agentId: string): string[] {
    return this.agentContexts[agentId] ?? []
  }

  getAllContexts(): AgentContextState {
    return { ...this.agentContexts }
  }

  async listProjectFiles(): Promise<ProjectFileInfo[]> {
    const files: ProjectFileInfo[] = []
    await this.walkDir(this.projectPath, '', files)
    return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  }

  private async walkDir(dir: string, relative: string, out: ProjectFileInfo[]): Promise<void> {
    const IGNORED = new Set(['node_modules', '.git', '.mnm', 'dist', 'out', '.next', 'coverage'])
    const CODE_EXTENSIONS = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml',
      '.md', '.css', '.html', '.svg', '.toml', '.env'
    ])

    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (IGNORED.has(entry.name) || entry.name.startsWith('.')) continue

      const fullPath = path.join(dir, entry.name)
      const relPath = relative ? `${relative}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        await this.walkDir(fullPath, relPath, out)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        if (CODE_EXTENSIONS.has(ext)) {
          out.push({
            path: fullPath,
            name: entry.name,
            relativePath: relPath,
            extension: ext
          })
        }
      }
    }
  }
}
