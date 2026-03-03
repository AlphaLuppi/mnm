import { create } from 'zustand'
import type { ContextFile } from './context.types'

type ContextState = {
  files: Map<string, ContextFile>
  selectedStoryFilter: string | null

  addFile: (file: ContextFile) => void
  removeFile: (path: string) => void
  updateFileStatus: (path: string, updates: Partial<ContextFile>) => void
  setAgentFiles: (agentId: string, filePaths: string[]) => void
  removeAgentFromFiles: (agentId: string) => void
  setStoryFilter: (storyId: string | null) => void
  markFileModified: (path: string, agentId?: string) => void
  getFilesForCurrentView: () => ContextFile[]
  getAgentsForFile: (filePath: string) => string[]
}

export const useContextStore = create<ContextState>((set, get) => ({
  files: new Map(),
  selectedStoryFilter: null,

  addFile: (file) =>
    set((state) => {
      const next = new Map(state.files)
      next.set(file.path, file)
      return { files: next }
    }),

  removeFile: (path) =>
    set((state) => {
      const next = new Map(state.files)
      next.delete(path)
      return { files: next }
    }),

  updateFileStatus: (path, updates) =>
    set((state) => {
      const next = new Map(state.files)
      const existing = next.get(path)
      if (existing) {
        next.set(path, { ...existing, ...updates })
      }
      return { files: next }
    }),

  setAgentFiles: (agentId, filePaths) =>
    set((state) => {
      const next = new Map(state.files)
      // Remove agent from files no longer in the list
      for (const [path, file] of next) {
        if (!filePaths.includes(path) && file.agentIds.includes(agentId)) {
          next.set(path, {
            ...file,
            agentIds: file.agentIds.filter((id) => id !== agentId)
          })
        }
      }
      // Add agent to new files
      for (const filePath of filePaths) {
        const existing = next.get(filePath)
        if (existing && !existing.agentIds.includes(agentId)) {
          next.set(filePath, {
            ...existing,
            agentIds: [...existing.agentIds, agentId]
          })
        }
      }
      return { files: next }
    }),

  removeAgentFromFiles: (agentId) =>
    set((state) => {
      const next = new Map(state.files)
      for (const [path, file] of next) {
        if (file.agentIds.includes(agentId)) {
          next.set(path, {
            ...file,
            agentIds: file.agentIds.filter((id) => id !== agentId)
          })
        }
      }
      return { files: next }
    }),

  setStoryFilter: (storyId) => set({ selectedStoryFilter: storyId }),

  markFileModified: (path, agentId) =>
    set((state) => {
      const next = new Map(state.files)
      const existing = next.get(path)
      if (existing) {
        next.set(path, {
          ...existing,
          isModified: true,
          lastModified: Date.now(),
          lastModifiedBy: agentId
        })
      }
      return { files: next }
    }),

  getFilesForCurrentView: () => {
    const { files, selectedStoryFilter } = get()
    const all = Array.from(files.values())
    if (!selectedStoryFilter) return all
    return all.filter((f) => f.storyId === selectedStoryFilter)
  },

  getAgentsForFile: (filePath) => {
    const file = get().files.get(filePath)
    return file?.agentIds ?? []
  }
}))
