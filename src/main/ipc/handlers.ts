import { ipcMain, dialog, BrowserWindow } from 'electron'
import type { IpcInvokeChannels } from '@shared/ipc-channels'
import type { ProjectOpenResult } from '@shared/types/project.types'
import type { ProjectHierarchy } from '@shared/types/story.types'
import type { AppError } from '@shared/types/error.types'
import { loadProject } from '@main/services/project/project-loader.service'
import { parseProjectHierarchy } from '@main/services/project/story-parser'
import { getActiveProjectPath, setActiveProjectPath } from '@main/services/project/active-project'
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
