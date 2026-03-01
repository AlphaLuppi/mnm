import { promises as fs } from 'node:fs'
import { join, basename } from 'node:path'
import type { ProjectInfo, ProjectSettings } from '@shared/types/project.types'
import type { AppError } from '@shared/types/error.types'
import { detectBmadStructure } from './bmad-detector'
import { logger } from '@main/utils/logger'

const DEFAULT_SETTINGS: ProjectSettings = {
  version: 1,
  driftThreshold: 50,
  recentProjects: []
}

const DEFAULT_PROJECT_STATE = {
  version: 1,
  lastOpenedAt: null as string | null,
  navigationState: null
}

export async function loadProject(directoryPath: string): Promise<ProjectInfo> {
  logger.info('project-loader', 'Loading project', { path: directoryPath })

  // 1. Validate directory exists
  try {
    const stat = await fs.stat(directoryPath)
    if (!stat.isDirectory()) {
      throw createAppError('INVALID_DIRECTORY', "Le chemin specifie n'est pas un repertoire", directoryPath)
    }
  } catch (err) {
    if ((err as AppError).code === 'INVALID_DIRECTORY') throw err
    throw createAppError('INVALID_DIRECTORY', 'Repertoire inaccessible', directoryPath)
  }

  // 2. Validate Git repo
  const gitDir = join(directoryPath, '.git')
  try {
    await fs.access(gitDir)
  } catch {
    throw createAppError('NOT_GIT_REPO', "Ce repertoire n'est pas un repo Git", directoryPath)
  }

  // 3. Detect BMAD structure
  const bmadStructure = await detectBmadStructure(directoryPath)

  // 4. Initialize .mnm/ directory
  const mnmDir = join(directoryPath, '.mnm')
  await initializeMnmDirectory(mnmDir)

  // 5. Read or create settings
  const settingsPath = join(mnmDir, 'settings.json')
  const settings = await readOrCreateJson(settingsPath, DEFAULT_SETTINGS)

  // 6. Update project state
  const projectStatePath = join(mnmDir, 'project-state.json')
  const projectState = {
    ...DEFAULT_PROJECT_STATE,
    lastOpenedAt: new Date().toISOString()
  }
  await writeJsonAtomic(projectStatePath, projectState)

  // 7. Extract project name
  const name = await resolveProjectName(directoryPath)

  logger.info('project-loader', 'Project loaded successfully', {
    path: directoryPath,
    name,
    bmadDetected: bmadStructure.detected
  })

  return {
    path: directoryPath,
    name,
    bmadStructure,
    settings
  }
}

function createAppError(code: string, message: string, path: string): AppError {
  return {
    code,
    message,
    source: 'project-loader',
    details: { path }
  }
}

async function initializeMnmDirectory(mnmDir: string): Promise<void> {
  try {
    await fs.mkdir(mnmDir, { recursive: true })
  } catch {
    throw createAppError('PERMISSION_DENIED', 'Impossible de creer le repertoire .mnm/', mnmDir)
  }
}

async function readOrCreateJson<T extends Record<string, unknown>>(
  filePath: string,
  defaults: T
): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content) as Partial<T>
    return { ...defaults, ...parsed }
  } catch {
    await writeJsonAtomic(filePath, defaults)
    return defaults
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  const tempPath = filePath + '.tmp'
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
  await fs.rename(tempPath, filePath)
}

async function resolveProjectName(directoryPath: string): Promise<string> {
  try {
    const pkgPath = join(directoryPath, 'package.json')
    const pkgContent = await fs.readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(pkgContent) as Record<string, unknown>
    if (typeof pkg.name === 'string' && pkg.name.length > 0) {
      return pkg.name
    }
  } catch {
    // No package.json or invalid — fallback to directory name
  }
  return basename(directoryPath)
}
