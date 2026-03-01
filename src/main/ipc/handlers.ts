import { ipcMain } from 'electron'
import type { IpcInvokeChannels, ProjectInfo } from '@shared/ipc-channels'
import { logger } from '@main/utils/logger'

type HandlerMap = {
  [K in keyof IpcInvokeChannels]?: (
    args: IpcInvokeChannels[K]['args']
  ) => Promise<IpcInvokeChannels[K]['result']>
}

const handlers: HandlerMap = {
  'project:open': async (args): Promise<ProjectInfo> => {
    logger.info('ipc-handlers', `project:open called with path: ${args.path}`)
    // Placeholder — real implementation in Story 1.3
    return {
      path: args.path,
      name: args.path.split('/').pop() ?? 'unknown',
      bmadDetected: false
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
