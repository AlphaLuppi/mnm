import { useContextStore } from '../context.store'

export function FileChangeBadge() {
  const count = useContextStore((s) => s.pendingNotificationCount)

  if (count === 0) return null

  return (
    <span
      className="inline-flex items-center rounded-full bg-status-orange/20 px-1.5 py-0.5 text-xs font-medium text-status-orange motion-safe:animate-number-pop"
      aria-label={`${count} modification${count > 1 ? 's' : ''} non lue${count > 1 ? 's' : ''}`}
    >
      {count}
    </span>
  )
}
