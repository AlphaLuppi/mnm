import type { IpcInvokeChannels, IpcStreamChannels } from '../shared/ipc-channels'

export type ElectronAPI = {
  invoke: <T extends keyof IpcInvokeChannels>(
    channel: T,
    args: IpcInvokeChannels[T]['args']
  ) => Promise<IpcInvokeChannels[T]['result']>

  on: <T extends keyof IpcStreamChannels>(
    channel: T,
    callback: (data: IpcStreamChannels[T]) => void
  ) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
