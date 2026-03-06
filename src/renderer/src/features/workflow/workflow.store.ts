import { create } from 'zustand'
import type { WorkflowGraph } from '@shared/types/workflow.types'
import type { AsyncState } from '@shared/types/async-state.types'

type WorkflowState = {
  workflows: AsyncState<WorkflowGraph[]>
  selectedWorkflowId: string | null
  selectedNodeId: string | null

  loadWorkflows: () => Promise<void>
  selectWorkflow: (id: string) => void
  selectNode: (id: string | null) => void
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflows: { status: 'idle' },
  selectedWorkflowId: null,
  selectedNodeId: null,

  loadWorkflows: async () => {
    set({ workflows: { status: 'loading' } })
    try {
      const graphs = await window.electronAPI.invoke('workflow:list', undefined)
      set({
        workflows: { status: 'success', data: graphs },
        selectedWorkflowId: graphs.length > 0 ? graphs[0].id : null
      })
    } catch {
      set({
        workflows: {
          status: 'error',
          error: {
            code: 'WORKFLOW_LOAD_FAILED',
            message: 'Impossible de charger les workflows',
            source: 'workflow-store'
          }
        }
      })
    }
  },

  selectWorkflow: (id) => set({ selectedWorkflowId: id, selectedNodeId: null }),
  selectNode: (id) => set({ selectedNodeId: id })
}))
