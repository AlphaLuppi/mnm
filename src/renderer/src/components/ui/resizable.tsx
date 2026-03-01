import {
  Group,
  Panel,
  Separator
} from 'react-resizable-panels'
import type { ComponentProps } from 'react'

export function ResizablePanelGroup({
  className = '',
  ...props
}: ComponentProps<typeof Group>) {
  return (
    <Group
      className={`flex h-full w-full ${className}`}
      {...props}
    />
  )
}

export function ResizablePanel({
  className = '',
  ...props
}: ComponentProps<typeof Panel>) {
  return <Panel className={`${className}`} {...props} />
}

export function ResizableHandle({
  withHandle = false,
  className = '',
  ...props
}: ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) {
  return (
    <Separator
      className={`relative flex w-px items-center justify-center bg-border-default after:absolute after:inset-y-0 after:-left-1 after:-right-1 hover:bg-border-active transition-colors ${className}`}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-8 w-3 items-center justify-center rounded-sm border border-border-default bg-bg-elevated">
          <svg
            width="6"
            height="10"
            viewBox="0 0 6 10"
            fill="none"
            className="text-text-muted"
          >
            <circle cx="1" cy="1" r="0.75" fill="currentColor" />
            <circle cx="1" cy="5" r="0.75" fill="currentColor" />
            <circle cx="1" cy="9" r="0.75" fill="currentColor" />
            <circle cx="5" cy="1" r="0.75" fill="currentColor" />
            <circle cx="5" cy="5" r="0.75" fill="currentColor" />
            <circle cx="5" cy="9" r="0.75" fill="currentColor" />
          </svg>
        </div>
      )}
    </Separator>
  )
}
