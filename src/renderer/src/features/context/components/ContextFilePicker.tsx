import { useState, useCallback, useRef, useEffect } from 'react'
import type { ProjectFileInfo } from '@shared/ipc-channels'
import { getFileIcon } from '../utils/file-icons'

type ContextFilePickerProps = {
  onFileSelect: (file: ProjectFileInfo) => void
}

export function ContextFilePicker({ onFileSelect }: ContextFilePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [files, setFiles] = useState<ProjectFileInfo[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.invoke(
        'context:list-project-files',
        undefined as void
      )
      setFiles(result)
    } catch {
      setFiles([])
    }
    setLoading(false)
  }, [])

  const handleOpen = () => {
    setIsOpen(true)
    setSearch('')
    loadFiles()
  }

  const handleClose = () => {
    setIsOpen(false)
    setSearch('')
  }

  const handleSelect = (file: ProjectFileInfo) => {
    onFileSelect(file)
    handleClose()
  }

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        handleClose()
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const filtered = search
    ? files.filter(
        (f) =>
          f.name.toLowerCase().includes(search.toLowerCase()) ||
          f.relativePath.toLowerCase().includes(search.toLowerCase())
      )
    : files

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded px-2 py-1 text-xs text-text-muted hover:bg-bg-elevated hover:text-text-secondary transition-colors"
        aria-label="Ajouter un fichier de contexte"
      >
        + Ajouter
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50">
          <div
            ref={dialogRef}
            role="dialog"
            aria-label="Sélection de fichier"
            className="w-full max-w-md rounded-lg border border-border-default bg-bg-surface shadow-lg"
          >
            <div className="border-b border-border-default p-3">
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un fichier..."
                className="w-full rounded bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            <div className="max-h-64 overflow-auto p-1">
              {loading && (
                <p className="px-3 py-2 text-sm text-text-muted">Chargement...</p>
              )}
              {!loading && filtered.length === 0 && (
                <p className="px-3 py-2 text-sm text-text-muted">Aucun fichier trouvé</p>
              )}
              {!loading &&
                filtered.slice(0, 50).map((file) => {
                  const icon = getFileIcon(file.extension)
                  return (
                    <button
                      key={file.path}
                      onClick={() => handleSelect(file)}
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-bg-elevated transition-colors"
                    >
                      <span className={`font-mono text-xs font-bold ${icon.color}`}>
                        {icon.label}
                      </span>
                      <span className="truncate text-text-primary">{file.name}</span>
                      <span className="ml-auto truncate text-xs text-text-muted">
                        {file.relativePath}
                      </span>
                    </button>
                  )
                })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
