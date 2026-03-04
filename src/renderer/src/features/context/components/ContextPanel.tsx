import { useCallback } from 'react'
import { ContextFileCard } from './ContextFileCard'
import { ContextFilePicker } from './ContextFilePicker'
import { useContextFiles } from '../hooks/useContextFiles'
import { useContextStore } from '../context.store'
import type { ProjectFileInfo } from '@shared/ipc-channels'
import type { ContextFile } from '../context.types'

export function ContextPanel() {
  // Subscribe to file change streams + sync story filter
  useContextFiles()

  const files = useContextStore((s) => s.getFilesForCurrentView())
  const addFile = useContextStore((s) => s.addFile)
  const removeFile = useContextStore((s) => s.removeFile)
  const updateFileStatus = useContextStore((s) => s.updateFileStatus)

  const handleRemove = useCallback(
    async (filePath: string, agentId: string) => {
      try {
        await window.electronAPI.invoke('context:remove-from-agent', { agentId, filePath })
        // Update store: remove agent from file
        const file = useContextStore.getState().files.get(filePath)
        if (file) {
          const newAgentIds = file.agentIds.filter((id) => id !== agentId)
          if (newAgentIds.length === 0) {
            removeFile(filePath)
          } else {
            updateFileStatus(filePath, { agentIds: newAgentIds })
          }
        }
      } catch {
        // IPC error — store stays unchanged
      }
    },
    [removeFile, updateFileStatus]
  )

  const handleFilePickerSelect = useCallback(
    (fileInfo: ProjectFileInfo) => {
      // Add file to context store (no specific agent yet — user drags to agent)
      const existing = useContextStore.getState().files.get(fileInfo.path)
      if (!existing) {
        const newFile: ContextFile = {
          path: fileInfo.path,
          name: fileInfo.name,
          extension: fileInfo.extension,
          relativePath: fileInfo.relativePath,
          agentIds: [],
          isModified: false,
          lastModified: Date.now()
        }
        addFile(newFile)
      }
    },
    [addFile]
  )

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <h2 className="text-base font-semibold text-text-primary">Contexte</h2>
          <ContextFilePicker onFileSelect={handleFilePickerSelect} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-text-muted">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-bg-elevated font-mono text-lg text-text-muted">
            FI
          </span>
          <p className="text-base">Aucun fichier de contexte</p>
          <p className="text-sm text-center">
            Les fichiers apparaîtront ici quand un agent les consultera
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h2 className="text-base font-semibold text-text-primary">Contexte</h2>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-bg-elevated px-2 py-0.5 text-xs font-medium text-text-secondary">
            {files.length}
          </span>
          <ContextFilePicker onFileSelect={handleFilePickerSelect} />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div
          className="flex flex-col gap-2 p-3"
          role="list"
          aria-label="Fichiers de contexte"
        >
          {files.map((file) => (
            <ContextFileCard
              key={file.path}
              file={file}
              onRemove={handleRemove}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
