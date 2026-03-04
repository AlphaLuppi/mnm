import { useState, useEffect } from 'react'
import type { AsyncState } from '@shared/types/async-state.types'

export function useFileVersion(
  filePath: string | null,
  commitHash: string | null
): AsyncState<string> {
  const [state, setState] = useState<AsyncState<string>>({ status: 'idle' })

  useEffect(() => {
    if (!filePath || !commitHash) {
      setState({ status: 'idle' })
      return
    }

    setState({ status: 'loading' })

    window.electronAPI
      .invoke('git:show-file', { path: filePath, commitHash })
      .then((content) => {
        setState({ status: 'success', data: content })
      })
      .catch(() => {
        setState({
          status: 'error',
          error: {
            code: 'GIT_SHOW_FAILED',
            message: 'Impossible de charger la version du fichier',
            source: 'useFileVersion'
          }
        })
      })
  }, [filePath, commitHash])

  return state
}
