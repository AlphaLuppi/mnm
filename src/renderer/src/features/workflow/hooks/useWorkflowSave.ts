import { useCallback, useEffect } from 'react'
import { useWorkflowStore } from '../workflow.store'

export function useWorkflowSave() {
  const saveWorkflow = useWorkflowStore((s) => s.saveWorkflow)
  const saveState = useWorkflowStore((s) => s.saveState)
  const unsavedChanges = useWorkflowStore((s) => s.unsavedChanges)
  const isEditMode = useWorkflowStore((s) => s.isEditMode)

  const handleSave = useCallback(async () => {
    if (!unsavedChanges) return
    await saveWorkflow()
  }, [unsavedChanges, saveWorkflow])

  // Cmd+S / Ctrl+S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && isEditMode) {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditMode, handleSave])

  return {
    save: handleSave,
    isSaving: saveState.status === 'loading',
    saveError: saveState.status === 'error' ? saveState.error : null,
    unsavedChanges
  }
}
