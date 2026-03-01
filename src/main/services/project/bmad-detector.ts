import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { BmadStructure } from '@shared/types/project.types'

export async function detectBmadStructure(projectPath: string): Promise<BmadStructure> {
  const bmadDir = join(projectPath, '_bmad')
  const bmadOutputDir = join(projectPath, '_bmad-output')

  const hasBmadDir = await directoryExists(bmadDir)
  const hasBmadOutputDir = await directoryExists(bmadOutputDir)

  let workflowFiles: string[] = []
  let agentFiles: string[] = []
  let outputArtifacts: string[] = []

  if (hasBmadDir) {
    const entries = await scanDirectory(bmadDir)
    workflowFiles = entries.filter(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.md')
    )
    agentFiles = entries.filter((f) => f.includes('/agents/') || f.includes('/personas/'))
  }

  if (hasBmadOutputDir) {
    outputArtifacts = await scanDirectory(bmadOutputDir)
  }

  return {
    detected: hasBmadDir,
    hasBmadDir,
    hasBmadOutputDir,
    workflowFiles,
    agentFiles,
    outputArtifacts
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function scanDirectory(dirPath: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true, recursive: true })
    for (const entry of entries) {
      if (entry.isFile()) {
        const parentPath = entry.parentPath ?? entry.path
        results.push(join(parentPath, entry.name))
      }
    }
  } catch {
    // Directory not readable — return empty
  }
  return results
}
