import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerInvokeHandlers } from '@main/ipc/handlers'
import { setStreamTarget, sendStream } from '@main/ipc/streams'
import { eventBus } from '@main/utils/event-bus'
import { logger } from '@main/utils/logger'
import type { MainEvents } from '@shared/events'

function wireEventBusToStreams(): void {
  const streamMap: {
    [K in keyof MainEvents]?: string
  } = {
    'agent:output': 'stream:agent-output',
    'agent:status': 'stream:agent-status',
    'agent:chat-entry': 'stream:agent-chat',
    'file:changed': 'stream:file-change',
    'drift:detected': 'stream:drift-alert',
    'workflow:node-status': 'stream:workflow-node',
    'test:result': 'stream:test-result'
  }

  for (const [busEvent, streamChannel] of Object.entries(streamMap)) {
    eventBus.on(busEvent as keyof MainEvents, (data) => {
      sendStream(streamChannel as never, data as never)
    })
  }

  logger.info('event-bus', 'Event bus wired to IPC streams')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  setStreamTarget(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.mnm')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerInvokeHandlers()
  wireEventBusToStreams()

  logger.info('app', 'MnM starting...')

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
