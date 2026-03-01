import type { ComponentProps } from 'react'
import type { HealthColor } from '../agents.store'

type HealthIndicatorProps = {
  color: HealthColor
  size?: 8 | 12 | 16
} & Omit<ComponentProps<'span'>, 'children'>

const COLOR_MAP: Record<HealthColor, { bg: string; pulse: string; label: string }> = {
  green: {
    bg: 'bg-status-green',
    pulse: 'animate-pulse-subtle',
    label: 'Agent actif'
  },
  orange: {
    bg: 'bg-status-orange',
    pulse: '',
    label: 'Agent en attente'
  },
  red: {
    bg: 'bg-status-red',
    pulse: 'animate-pulse-alert',
    label: 'Agent bloque ou crashe'
  },
  gray: {
    bg: 'bg-status-gray',
    pulse: '',
    label: 'Agent termine'
  }
}

const SIZE_MAP: Record<number, string> = {
  8: 'h-2 w-2',
  12: 'h-3 w-3',
  16: 'h-4 w-4'
}

export function HealthIndicator({
  color,
  size = 12,
  className = '',
  ...props
}: HealthIndicatorProps) {
  const colorConfig = COLOR_MAP[color]
  const sizeClass = SIZE_MAP[size]

  return (
    <span
      className={`inline-block rounded-full ${colorConfig.bg} ${sizeClass} ${colorConfig.pulse} motion-reduce:animate-none ${className}`}
      role="img"
      aria-label={colorConfig.label}
      {...props}
    />
  )
}

export type { HealthIndicatorProps }
