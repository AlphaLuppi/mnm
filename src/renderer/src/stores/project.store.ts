import { create } from 'zustand'
import type { ProjectInfo, ProjectOpenResult } from '@shared/types/project.types'
import type { AsyncState } from '@shared/types/async-state.types'

type ProjectStoreState = {
  project: AsyncState<ProjectInfo>
  openProject: (path?: string) => Promise<void>
  clearProject: () => void
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  project: { status: 'idle' },

  openProject: async (path?: string) => {
    set({ project: { status: 'loading' } })

    try {
      const result = window.electronAPI.invoke('project:open', {
        path: path ?? ''
      }) as Promise<ProjectOpenResult>

      const resolved = await result

      if (resolved.success) {
        set({ project: { status: 'success', data: resolved.data } })
      } else {
        if (resolved.error.code === 'USER_CANCELLED') {
          set({ project: { status: 'idle' } })
          return
        }
        set({ project: { status: 'error', error: resolved.error } })
      }
    } catch {
      set({
        project: {
          status: 'error',
          error: {
            code: 'IPC_ERROR',
            message: 'Erreur de communication avec le processus principal',
            source: 'project-store'
          }
        }
      })
    }
  },

  clearProject: () => set({ project: { status: 'idle' } })
}))
