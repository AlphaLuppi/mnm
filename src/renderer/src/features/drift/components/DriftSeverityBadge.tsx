import type { DriftSeverity } from '@shared/types/drift.types'

type DriftSeverityBadgeProps = {
  severity: DriftSeverity
}

const config: Record<DriftSeverity, { label: string; bg: string; text: string; icon: string }> = {
  critical: { label: 'Critique', bg: 'bg-red-500/15', text: 'text-red-400', icon: '!!' },
  warning: { label: 'Attention', bg: 'bg-amber-500/15', text: 'text-amber-400', icon: '!' },
  info: { label: 'Info', bg: 'bg-blue-500/15', text: 'text-blue-400', icon: 'i' }
}

export function DriftSeverityBadge({ severity }: DriftSeverityBadgeProps) {
  const { label, bg, text, icon } = config[severity]

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${bg} ${text}`}>
      <span className="font-bold">{icon}</span>
      {label}
    </span>
  )
}
