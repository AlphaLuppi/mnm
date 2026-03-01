import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from './api'

const electronAPI: ElectronAPI = {
  invoke: (channel, args) => ipcRenderer.invoke(channel, args),

  on: (channel, callback) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (_event: Electron.IpcRendererEvent, ...args: any[]): void => {
      callback(args[0])
    }
    ipcRenderer.on(channel, handler)
    return (): void => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
