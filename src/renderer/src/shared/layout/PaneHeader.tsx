type PaneHeaderProps = {
  title: string
  onDoubleClick?: () => void
  compact?: boolean
}

export function PaneHeader({ title, onDoubleClick, compact = false }: PaneHeaderProps) {
  return (
    <div
      className="flex h-10 shrink-0 items-center border-b border-border-default px-3 select-none"
      onDoubleClick={onDoubleClick}
    >
      <h2 className="text-sm font-semibold text-text-primary">
        {compact ? title.charAt(0) : title}
      </h2>
    </div>
  )
}
