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

      // Init git service, context service, and file watcher for this project
      initGitService(projectPath)
      initContextService(projectPath)
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
