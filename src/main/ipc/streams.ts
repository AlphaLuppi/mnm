import type { BrowserWindow } from 'electron'
import type { IpcStreamChannels } from '@shared/ipc-channels'

let mainWindow: BrowserWindow | null = null

export function setStreamTarget(window: BrowserWindow): void {
  mainWindow = window
}

export function sendStream<T extends keyof IpcStreamChannels>(
  channel: T,
  data: IpcStreamChannels[T]
): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}
