import { useState, useEffect } from 'react'
import type { AsyncState } from '@shared/types/async-state.types'
import type { FileHistoryEntry } from '../git-history.types'

export function useFileHistory(
  filePath: string | null,
  count: number = 20
): AsyncState<FileHistoryEntry[]> & { retry: () => void } {
  const [state, setState] = useState<AsyncState<FileHistoryEntry[]>>({
    status: 'idle'
  })

  const fetchHistory = () => {
    if (!filePath) {
      setState({ status: 'idle' })
      return
    }

    setState({ status: 'loading' })

    window.electronAPI
      .invoke('git:file-history', { filePath, count })
      .then((data) => {
        const entries = (data as { hash: string; date: string; author: string; message: string }[]).map((e) => ({
          hash: e.hash,
          date: e.date,
          author: e.author,
          message: e.message
        }))
        setState({ status: 'success', data: entries })
      })
      .catch(() => {
        setState({
          status: 'error',
          error: {
            code: 'GIT_HISTORY_FAILED',
            message: 'Impossible de charger l\'historique Git',
            source: 'useFileHistory'
          }
        })
      })
  }

  useEffect(() => {
    fetchHistory()
  }, [filePath, count])

  return { ...state, retry: fetchHistory }
}
