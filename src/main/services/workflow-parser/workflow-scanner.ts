import { readdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import type { WorkflowSourceFormat } from '@shared/types/workflow.types'

const WORKFLOW_EXTENSIONS: Record<string, WorkflowSourceFormat> = {
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown'
}

export function detectFormat(filePath: string): WorkflowSourceFormat | null {
  const ext = extname(filePath).toLowerCase()
  return WORKFLOW_EXTENSIONS[ext] ?? null
}

export async function scanWorkflowFiles(projectPath: string): Promise<string[]> {
  const bmadDir = join(projectPath, '_bmad')
  const files: string[] = []

  try {
    await scanDirectory(bmadDir, files)
  } catch {
    // _bmad directory doesn't exist
    return []
  }

  return files.filter((f) => {
    const ext = extname(f).toLowerCase()
    return ext in WORKFLOW_EXTENSIONS
  })
}

async function scanDirectory(dir: string, results: string[]): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    try {
      const stats = await stat(fullPath)
      if (stats.isDirectory()) {
        await scanDirectory(fullPath, results)
      } else if (stats.isFile()) {
        // Only include workflow files (workflow.yaml, workflow.md, etc.)
        const name = entry.toLowerCase()
        if (name.includes('workflow') || name.includes('config')) {
          results.push(fullPath)
        }
      }
    } catch {
      // Skip inaccessible files
    }
  }
}
