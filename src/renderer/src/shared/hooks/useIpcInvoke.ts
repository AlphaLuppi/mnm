import { useState, useCallback } from 'react'
import type { IpcInvokeChannels } from '@shared/ipc-channels'
import type { AppError } from '@shared/types/error.types'
import type { AsyncState } from '@shared/types/async-state.types'

export function useIpcInvoke<T extends keyof IpcInvokeChannels>(
  channel: T
): {
  state: AsyncState<IpcInvokeChannels[T]['result']>
  invoke: (args: IpcInvokeChannels[T]['args']) => Promise<IpcInvokeChannels[T]['result']>
} {
  const [state, setState] = useState<AsyncState<IpcInvokeChannels[T]['result']>>({
    status: 'idle'
  })

  const invoke = useCallback(
    async (args: IpcInvokeChannels[T]['args']): Promise<IpcInvokeChannels[T]['result']> => {
      setState({ status: 'loading' })
      try {
        const result = await window.electronAPI.invoke(channel, args)
        setState({ status: 'success', data: result })
        return result
      } catch (error) {
        const appError: AppError = {
          code: 'IPC_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          source: `ipc:${channel}`,
          details: error
        }
        setState({ status: 'error', error: appError })
        throw appError
      }
    },
    [channel]
  )

  return { state, invoke }
}
