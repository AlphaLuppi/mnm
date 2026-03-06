import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeTypes,
  type Connection
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { BmadStepNode } from './BmadStepNode'
import { BmadCheckNode } from './BmadCheckNode'
import { BmadActionNode } from './BmadActionNode'
import type { LayoutNode, LayoutEdge } from '../hooks/useWorkflowLayout'

const nodeTypes: NodeTypes = {
  step: BmadStepNode,
  check: BmadCheckNode,
  action: BmadActionNode
} as unknown as NodeTypes

type WorkflowCanvasProps = {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  isEditMode?: boolean
  onNodeSelect?: (nodeId: string | null) => void
  onEdgeClick?: (edgeId: string) => void
  onConnect?: (params: { source: string; target: string }) => void
  onEdgeUpdate?: (edgeId: string, newSource: string, newTarget: string) => void
}

export function WorkflowCanvas({
  nodes,
  edges,
  isEditMode = false,
  onNodeSelect,
  onEdgeClick,
  onConnect,
  onEdgeUpdate
}: WorkflowCanvasProps) {
  const handleConnect = (params: Connection) => {
    if (isEditMode && onConnect && params.source && params.target) {
      onConnect({ source: params.source, target: params.target })
    }
  }

  const isValidConnection = (connection: Connection | LayoutEdge) => {
    if (!connection.source || !connection.target) return false
    return connection.source !== connection.target
  }

  return (
    <div
      className={`h-full w-full bg-[var(--color-bg-base)] ${isEditMode ? 'ring-2 ring-[var(--color-accent)]/30 ring-inset' : ''}`}
      role="img"
      aria-label="Diagramme de workflow"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesFocusable
        edgesFocusable={isEditMode}
        nodesDraggable={isEditMode}
        nodesConnectable={isEditMode}
        onNodeClick={(_event, node) => onNodeSelect?.(node.id)}
        onPaneClick={() => onNodeSelect?.(null)}
        onEdgeClick={
          isEditMode
            ? (_event, edge) => onEdgeClick?.(edge.id)
            : undefined
        }
        onConnect={isEditMode ? handleConnect : undefined}
        onReconnect={
          isEditMode
            ? (oldEdge, newConnection) => {
                if (newConnection.source && newConnection.target) {
                  onEdgeUpdate?.(oldEdge.id, newConnection.source, newConnection.target)
                }
              }
            : undefined
        }
        isValidConnection={isEditMode ? isValidConnection : undefined}
      >
        <Controls />
        <MiniMap nodeColor="#3b82f6" maskColor="rgba(0,0,0,0.7)" />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
      </ReactFlow>
    </div>
  )
}
