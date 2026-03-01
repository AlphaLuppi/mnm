type PaneEmptyStateProps = {
  title: string
  description: string
  icon?: React.ReactNode
}

export function PaneEmptyState({ title, description, icon }: PaneEmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
      {icon ?? (
        <svg
          width="40"
          height="40"
          viewBox="0 0 40 40"
          fill="none"
          className="text-text-muted opacity-40"
        >
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>
      )}
      <p className="text-md font-medium text-text-secondary">{title}</p>
      <p className="text-sm text-text-muted">{description}</p>
    </div>
  )
}
