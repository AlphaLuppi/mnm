import { useState } from 'react'
import type { ContextFileDragData } from '../context-dnd.types'

type ContextDragWrapperProps = {
  filePath: string
  fileName: string
  children: React.ReactNode
}

export function ContextDragWrapper({ filePath, fileName, children }: ContextDragWrapperProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const dragData: ContextFileDragData = {
      type: 'context-file',
      filePath,
      fileName
    }
    e.dataTransfer.setData('application/json', JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = 'copy'
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={isDragging ? 'opacity-50 border-dashed' : ''}
      aria-roledescription="draggable"
    >
      {children}
    </div>
  )
}
