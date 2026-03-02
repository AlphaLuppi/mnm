import type { TimelineEventCategory } from '@shared/types/timeline.types'

type TimelinePointProps = {
  color: string
  isSelected: boolean
  category: TimelineEventCategory
  onClick: () => void
}

const CATEGORY_SHAPES: Record<TimelineEventCategory, string> = {
  checkpoint: 'rounded-full',
  'file-write': 'rounded-sm',
  'tool-call': 'rounded-full',
  error: 'rotate-45 rounded-sm',
  'status-change': 'rounded-full',
  progress: 'rounded-full'
}

export function TimelinePoint({ color, isSelected, category, onClick }: TimelinePointProps) {
  const shape = CATEGORY_SHAPES[category] ?? 'rounded-full'

  return (
    <button
      className={`h-2.5 w-2.5 ${shape} transition-transform duration-150 hover:scale-150 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none animate-slide-in motion-reduce:animate-none ${isSelected ? 'ring-2 ring-white/50 scale-150' : ''}`}
      style={{ backgroundColor: color }}
      onClick={onClick}
      aria-label={`Evenement ${category}`}
    />
  )
}

export type { TimelinePointProps }
