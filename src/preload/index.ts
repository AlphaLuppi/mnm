import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI } from './api'

const electronAPI: ElectronAPI = {
  invoke: (channel, args) => ipcRenderer.invoke(channel, args),

  on: (channel, callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: never): void => {
      callback(data)
    }
    ipcRenderer.on(channel, handler)
    return (): void => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
