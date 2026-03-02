import { useState } from 'react'
import { AgentList } from './AgentList'
import { AgentChatViewer } from './AgentChatViewer'
import { useTimelineStore } from '../timeline.store'

type AgentsPaneView =
  | { mode: 'list' }
  | { mode: 'chat'; agentId: string; scrollToCheckpoint?: string }

type AgentsPaneProps = {
  initialView?: AgentsPaneView
}

export function AgentsPane({ initialView }: AgentsPaneProps) {
  const [view, setView] = useState<AgentsPaneView>(initialView ?? { mode: 'list' })
  const selectEvent = useTimelineStore((state) => state.selectEvent)

  const handleAgentDoubleClick = (agentId: string) => {
    setView({ mode: 'chat', agentId })
  }

  const handleBack = () => {
    setView({ mode: 'list' })
  }

  const handleCheckpointClick = (checkpointId: string) => {
    if (view.mode === 'chat') {
      setView({ ...view, scrollToCheckpoint: checkpointId })
    }
    // Highlight matching event in timeline
    const events = useTimelineStore.getState().events
    const matchingEvent = events.find((e) => e.checkpointId === checkpointId)
    if (matchingEvent) {
      selectEvent(matchingEvent.id)
    }
  }

  if (view.mode === 'chat') {
    return (
      <AgentChatViewer
        agentId={view.agentId}
        scrollToCheckpoint={view.scrollToCheckpoint}
        onCheckpointClick={handleCheckpointClick}
        onBack={handleBack}
      />
    )
  }

  return <AgentList onOpenChatViewer={handleAgentDoubleClick} />
}

export function navigateToAgentChat(
  setView: (view: AgentsPaneView) => void,
  agentId: string,
  checkpointId?: string
): void {
  setView({ mode: 'chat', agentId, scrollToCheckpoint: checkpointId })
}

export type { AgentsPaneView, AgentsPaneProps }
