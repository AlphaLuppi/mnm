import { ipcMain, dialog, BrowserWindow } from 'electron'
import type { IpcInvokeChannels, GitStatus, ProjectFileInfo } from '@shared/ipc-channels'
import type { ProjectOpenResult } from '@shared/types/project.types'
import type { ProjectHierarchy } from '@shared/types/story.types'
import type { AgentInfo } from '@shared/types/agent.types'
import type { ChatEntry } from '@shared/types/chat.types'
import type { AppError } from '@shared/types/error.types'
import { loadProject } from '@main/services/project/project-loader.service'
import { parseProjectHierarchy } from '@main/services/project/story-parser'
import { getActiveProjectPath, setActiveProjectPath } from '@main/services/project/active-project'
import { getAgentHarness } from '@main/services/agent/agent-harness.instance'
import { getGitService, initGitService } from '@main/services/git/git.instance'
import { initFileWatcher } from '@main/services/file-watcher/file-watcher.instance'
import { getContextService, initContextService } from '@main/services/context/context.instance'
import { getDriftEngine, initDriftEngine } from '@main/services/drift/drift-engine.instance'
import { initDriftWatcher, getDriftWatcher, getPairRegistry } from '@main/services/drift/drift-watcher.instance'
import { ManualDriftCheckService } from '@main/services/drift/manual-drift-check.service'
import { DriftResolutionService } from '@main/services/drift/drift-resolution.service'
import { DriftHistoryService } from '@main/services/drift/drift-history.service'
import { parseWorkflow, parseAllWorkflows } from '@main/services/workflow-parser'
import { sendStream } from '@main/ipc/streams'
import type { DriftReport } from '@shared/types/drift.types'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { logger } from '@main/utils/logger'

type HandlerMap = {
  [K in keyof IpcInvokeChannels]?: (
    args: IpcInvokeChannels[K]['args']
  ) => Promise<IpcInvokeChannels[K]['result']>
}

const handlers: HandlerMap = {
  'project:open': async (args): Promise<ProjectOpenResult> => {
    try {
      let projectPath = args.path

      if (!projectPath) {
        const mainWindow = BrowserWindow.getFocusedWindow()
        const result = await dialog.showOpenDialog(mainWindow!, {
          properties: ['openDirectory'],
          title: 'Ouvrir un projet',
          buttonLabel: 'Ouvrir'
        })

        if (result.canceled || result.filePaths.length === 0) {
          return {
            success: false,
            error: {
              code: 'USER_CANCELLED',
              message: 'Selection annulee',
              source: 'project:open'
            }
          }
        }

        projectPath = result.filePaths[0]
      }

      const projectInfo = await loadProject(projectPath)
      setActiveProjectPath(projectPath)

      // Update agent harness with new project path
      const harness = getAgentHarness()
      if (harness) {
        harness.updateProjectPath(projectPath)
      }

      // Init git service, context service, drift engine, and file watcher for this project
      initGitService(projectPath)
      initContextService(projectPath)
      initDriftEngine(projectPath)
        .then(() => initDriftWatcher(projectPath))
        .catch(() => {
          logger.warn('ipc-handlers', 'Drift engine/watcher initialization skipped')
        })
      const watcher = initFileWatcher()
      watcher.start(projectPath)

      return { success: true, data: projectInfo }
    } catch (error) {
      const appError = error as AppError
      return {
        success: false,
        error: {
          code: appError.code ?? 'PROJECT_LOAD_FAILED',
          message: appError.message ?? 'Erreur lors du chargement du projet',
          source: appError.source ?? 'project:open',
          details: appError.details
        }
      }
    }
  },

  'stories:list': async (): Promise<ProjectHierarchy> => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) {
      return { projectName: '', epics: [] }
    }
    return parseProjectHierarchy(projectPath)
  },

  'agent:launch': async (args): Promise<{ agentId: string }> => {
    const harness = getAgentHarness()
    if (!harness) {
      throw { code: 'NO_PROJECT', message: 'Aucun projet ouvert', source: 'agent:launch' }
    }
    const agentId = harness.launchAgent(args)
    return { agentId }
  },

  'agent:stop': async (args): Promise<void> => {
    const harness = getAgentHarness()
    if (!harness) {
      throw { code: 'NO_PROJECT', message: 'Aucun projet ouvert', source: 'agent:stop' }
    }
    await harness.stopAgent(args.agentId)
  },

  'agent:list': async (): Promise<AgentInfo[]> => {
    const harness = getAgentHarness()
    if (!harness) return []
    return harness.listAgents()
  },

  'agent:get-chat': async (args): Promise<ChatEntry[]> => {
    const harness = getAgentHarness()
    if (!harness) return []
    return harness.getAgentChat(args.agentId, args.fromCheckpoint)
  },

  'git:status': async (): Promise<GitStatus> => {
    const git = getGitService()
    if (!git) {
      return { current: null, tracking: null, files: [], ahead: 0, behind: 0 }
    }
    return git.getStatus()
  },

  'git:log': async (args) => {
    const git = getGitService()
    if (!git) return []
    return git.getLog(args.count)
  },

  'git:show-file': async (args) => {
    const git = getGitService()
    if (!git) return ''
    return git.showFile(args.path, args.commitHash)
  },

  'git:file-history': async (args) => {
    const git = getGitService()
    if (!git) return []
    return git.getFileHistory(args.filePath, args.count)
  },

  'git:file-diff': async (args) => {
    const git = getGitService()
    if (!git) return ''
    return git.getDiff(args.commitA, args.commitB)
  },

  'drift:check': async (args): Promise<DriftReport> => {
    const engine = getDriftEngine()
    if (!engine) {
      throw {
        code: 'DRIFT_ENGINE_UNAVAILABLE',
        message: 'Drift engine non disponible. Verifiez la cle API dans .mnm/settings.json',
        source: 'drift:check'
      }
    }
    return engine.analyzePair(args.docA, args.docB)
  },

  'context:add-to-agent': async (args): Promise<void> => {
    const ctx = getContextService()
    if (!ctx) {
      throw { code: 'NO_PROJECT', message: 'Aucun projet ouvert', source: 'context:add-to-agent' }
    }
    ctx.addFileToAgent(args.agentId, args.filePath)
  },

  'context:remove-from-agent': async (args): Promise<void> => {
    const ctx = getContextService()
    if (!ctx) {
      throw { code: 'NO_PROJECT', message: 'Aucun projet ouvert', source: 'context:remove-from-agent' }
    }
    ctx.removeFileFromAgent(args.agentId, args.filePath)
  },

  'context:list-project-files': async (): Promise<ProjectFileInfo[]> => {
    const ctx = getContextService()
    if (!ctx) return []
    return ctx.listProjectFiles()
  },

  'drift:check-multiple': async (args) => {
    const engine = getDriftEngine()
    if (!engine) {
      throw {
        code: 'DRIFT_ENGINE_UNAVAILABLE',
        message: 'Drift engine non disponible',
        source: 'drift:check-multiple'
      }
    }
    const streamSender = { send: sendStream as (channel: string, data: unknown) => void }
    const service = new ManualDriftCheckService(engine, streamSender)
    const reports = await service.runManualCheck(args.pairs)
    return { reports }
  },

  'drift:list-pairs': async () => {
    const registry = getPairRegistry()
    if (!registry) return []
    return registry.getAllPairs()
  },

  'drift:resolve': async (args): Promise<void> => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) {
      throw { code: 'NO_PROJECT', message: 'Aucun projet ouvert', source: 'drift:resolve' }
    }
    const cacheDir = join(projectPath, '.mnm', 'drift-cache')
    const historyService = new DriftHistoryService(cacheDir)
    const streamSender = { send: sendStream as (channel: string, data: unknown) => void }
    const resolutionService = new DriftResolutionService(historyService, streamSender)
    await resolutionService.resolveDrift(args.driftId, args.action)
  },

  'settings:update': async (args): Promise<void> => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) {
      throw { code: 'NO_PROJECT', message: 'Aucun projet ouvert', source: 'settings:update' }
    }

    const settingsPath = join(projectPath, '.mnm', 'settings.json')
    let settings: Record<string, unknown> = {}

    try {
      const raw = await fs.readFile(settingsPath, 'utf-8')
      settings = JSON.parse(raw) as Record<string, unknown>
    } catch {
      // File doesn't exist yet
    }

    // Support dot-notation keys like "drift.confidenceThreshold"
    const keys = args.key.split('.')
    let current: Record<string, unknown> = settings
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {}
      }
      current = current[keys[i]] as Record<string, unknown>
    }
    current[keys[keys.length - 1]] = args.value

    await fs.mkdir(join(projectPath, '.mnm'), { recursive: true })
    const tempPath = `${settingsPath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(settings, null, 2), 'utf-8')
    await fs.rename(tempPath, settingsPath)

    // Hot-reload threshold if it changed
    if (args.key === 'drift.confidenceThreshold') {
      const watcher = getDriftWatcher()
      if (watcher) {
        watcher.stop()
        // Re-init watcher with new config
        await initDriftWatcher(projectPath)
      }
    }

    sendStream('stream:settings-changed', { key: args.key, value: args.value })
    logger.info('ipc-handlers', `Settings updated: ${args.key}`)
  },

  'workflow:parse': async (args) => {
    return parseWorkflow(args.filePath)
  },

  'workflow:list': async () => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return []
    return parseAllWorkflows(projectPath)
  },

  'settings:get': async (args) => {
    const projectPath = getActiveProjectPath()
    if (!projectPath) return null

    const settingsPath = join(projectPath, '.mnm', 'settings.json')
    try {
      const raw = await fs.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(raw) as Record<string, unknown>

      const keys = args.key.split('.')
      let current: unknown = settings
      for (const key of keys) {
        if (current && typeof current === 'object') {
          current = (current as Record<string, unknown>)[key]
        } else {
          return null
        }
      }
      return current ?? null
    } catch {
      return null
    }
  }
}

export function registerInvokeHandlers(): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    if (handler) {
      ipcMain.handle(channel, async (_event, args) => {
        try {
          return await handler(args)
        } catch (error) {
          logger.error('ipc-handlers', `Error in ${channel}`, { error })
          throw error
        }
      })
    }
  }
  logger.info('ipc-handlers', `Registered ${Object.keys(handlers).length} IPC handlers`)
}
