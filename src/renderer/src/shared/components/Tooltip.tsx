import { useState, useRef, type ReactNode } from 'react'

type TooltipProps = {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), 200)
  }

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(false)
  }

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 rounded-md border border-border-default bg-bg-elevated px-3 py-2 shadow-lg ${side === 'top' ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : 'top-full left-1/2 mt-2 -translate-x-1/2'}`}
        >
          {content}
        </div>
      )}
    </div>
  )
}
