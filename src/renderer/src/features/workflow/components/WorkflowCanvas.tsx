import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type NodeTypes
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
  onNodeSelect?: (nodeId: string | null) => void
}

export function WorkflowCanvas({ nodes, edges, onNodeSelect }: WorkflowCanvasProps) {
  return (
    <div className="h-full w-full bg-[var(--color-bg-base)]" role="img" aria-label="Diagramme de workflow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesFocusable
        edgesFocusable={false}
        nodesDraggable={false}
        onNodeClick={(_event, node) => onNodeSelect?.(node.id)}
        onPaneClick={() => onNodeSelect?.(null)}
      >
        <Controls />
        <MiniMap nodeColor="#3b82f6" maskColor="rgba(0,0,0,0.7)" />
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
      </ReactFlow>
    </div>
  )
}
