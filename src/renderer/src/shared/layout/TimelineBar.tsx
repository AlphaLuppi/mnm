import { useRef, useState, useCallback } from 'react'
import { useTimelineStore } from '@renderer/features/agents/timeline.store'
import { TimelinePoint } from '@renderer/features/agents/components/TimelinePoint'
import { Tooltip } from '@renderer/shared/components/Tooltip'

type TimelineBarProps = {
  onEventClick?: (eventId: string, checkpointId?: string, agentId?: string) => void
}

export function TimelineBar({ onEventClick }: TimelineBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStartX, setDragStartX] = useState(0)

  const events = useTimelineStore((state) => state.getEventsInView())
  const viewWindow = useTimelineStore((state) => state.viewWindow)
  const selectedEventId = useTimelineStore((state) => state.selectedEventId)
  const selectEvent = useTimelineStore((state) => state.selectEvent)
  const setViewWindow = useTimelineStore((state) => state.setViewWindow)
  const getAgentColor = useTimelineStore((state) => state.getAgentColor)

  const timeRange = viewWindow.end - viewWindow.start

  const getPositionPercent = useCallback(
    (timestamp: number): number => {
      if (timeRange <= 0) return 50
      return ((timestamp - viewWindow.start) / timeRange) * 100
    },
    [viewWindow.start, timeRange]
  )

  const getTimeLabels = useCallback((): { label: string; position: number }[] => {
    const labels: { label: string; position: number }[] = []
    const labelCount = 6
    for (let i = 0; i <= labelCount; i++) {
      const timestamp = viewWindow.start + (timeRange * i) / labelCount
      const date = new Date(timestamp)
      labels.push({
        label: date.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        position: (i / labelCount) * 100
      })
    }
    return labels
  }, [viewWindow.start, timeRange])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStartX(e.clientX)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const containerWidth = containerRef.current.offsetWidth
    const deltaX = e.clientX - dragStartX
    const timeDelta = (deltaX / containerWidth) * timeRange
    setViewWindow(viewWindow.start - timeDelta, viewWindow.end - timeDelta)
    setDragStartX(e.clientX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = e.deltaY > 0 ? 1.2 : 0.8
    const center = (viewWindow.start + viewWindow.end) / 2
    const halfRange = (timeRange * zoomFactor) / 2
    setViewWindow(center - halfRange, center + halfRange)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = timeRange * 0.1
    switch (e.key) {
      case 'ArrowLeft':
        setViewWindow(viewWindow.start - step, viewWindow.end - step)
        break
      case 'ArrowRight':
        setViewWindow(viewWindow.start + step, viewWindow.end + step)
        break
      case '+':
      case '=': {
        const centerIn = (viewWindow.start + viewWindow.end) / 2
        const halfIn = (timeRange * 0.8) / 2
        setViewWindow(centerIn - halfIn, centerIn + halfIn)
        break
      }
      case '-': {
        const centerOut = (viewWindow.start + viewWindow.end) / 2
        const halfOut = (timeRange * 1.2) / 2
        setViewWindow(centerOut - halfOut, centerOut + halfOut)
        break
      }
    }
  }

  const handleEventClick = (eventId: string) => {
    selectEvent(eventId)
    const event = events.find((ev) => ev.id === eventId)
    if (event) {
      onEventClick?.(eventId, event.checkpointId, event.agentId)
    }
  }

  const timeLabels = getTimeLabels()

  if (events.length === 0) {
    return (
      <footer
        id="timeline-bar"
        role="region"
        aria-label="Timeline d'activite"
        className="flex h-[120px] shrink-0 items-center justify-center border-t border-border-default bg-bg-surface"
      >
        <div className="flex flex-col items-center gap-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-text-muted opacity-40"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M12 7v5l3 3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <p className="text-sm text-text-muted">Aucune activite</p>
        </div>
      </footer>
    )
  }

  return (
    <footer
      ref={containerRef}
      id="timeline-bar"
      className="relative h-[120px] w-full shrink-0 select-none overflow-hidden border-t border-border-default bg-bg-surface"
      role="slider"
      aria-label="Timeline d'activite des agents"
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Time axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex h-6 items-center border-t border-border-default/50">
        {timeLabels.map(({ label, position }) => (
          <span
            key={`${label}-${position}`}
            className="absolute -translate-x-1/2 font-mono text-xs text-text-muted"
            style={{ left: `${position}%` }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Event dots area */}
      <div className="absolute bottom-8 left-0 right-0 top-4 px-4">
        {events.map((event) => {
          const position = getPositionPercent(event.timestamp)
          const color = getAgentColor(event.agentId)

          return (
            <div
              key={event.id}
              className="absolute -translate-x-1/2"
              style={{ left: `${position}%`, top: `${getAgentRow(event.agentId)}px` }}
            >
              <Tooltip
                content={
                  <div className="flex max-w-[250px] flex-col gap-1">
                    <span className="font-mono text-xs text-text-muted">
                      {new Date(event.timestamp).toLocaleTimeString('fr-FR')}
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      Agent {event.agentId.slice(0, 8)}
                    </span>
                    <span className="line-clamp-2 text-xs text-text-secondary">
                      {event.description ?? event.label}
                    </span>
                  </div>
                }
              >
                <TimelinePoint
                  color={color}
                  isSelected={event.id === selectedEventId}
                  category={event.category}
                  onClick={() => handleEventClick(event.id)}
                />
              </Tooltip>
            </div>
          )
        })}
      </div>
    </footer>
  )
}

function getAgentRow(agentId: string): number {
  let hash = 0
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) % 4
  }
  return hash * 18
}

export type { TimelineBarProps }
