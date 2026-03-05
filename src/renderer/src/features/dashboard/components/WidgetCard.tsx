import type { ReactNode } from 'react'

type WidgetCardProps = {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function WidgetCard({ title, icon, children, className = '' }: WidgetCardProps) {
  return (
    <section
      aria-label={title}
      className={`rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3 border-b border-[var(--color-border)] pb-2">
        {icon && <span className="text-[var(--color-text-tertiary)]">{icon}</span>}
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <div>{children}</div>
    </section>
  )
}
