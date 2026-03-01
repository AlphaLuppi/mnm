import { useEffect } from 'react'
import type { IpcStreamChannels } from '@shared/ipc-channels'

export function useIpcStream<T extends keyof IpcStreamChannels>(
  channel: T,
  handler: (data: IpcStreamChannels[T]) => void
): void {
  useEffect(() => {
    const cleanup = window.electronAPI.on(channel, handler)
    return cleanup
  }, [channel, handler])
}
