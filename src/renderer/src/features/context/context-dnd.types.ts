export type DragItemType = 'context-file'

export type ContextFileDragData = {
  type: DragItemType
  filePath: string
  fileName: string
}

export type DropResult = {
  agentId: string
  accepted: boolean
}
