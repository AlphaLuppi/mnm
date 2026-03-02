import type { ChatRole } from '@shared/types/chat.types'

type ChatMessageProps = {
  role: ChatRole
  content: string
  timestamp: number
  isHighlighted?: boolean
}

const ROLE_CONFIG: Record<ChatRole, { icon: string; color: string; label: string }> = {
  user: { icon: 'U', color: 'text-accent', label: 'Utilisateur' },
  assistant: { icon: 'A', color: 'text-status-green', label: 'Assistant' },
  system: { icon: 'S', color: 'text-text-muted', label: 'Systeme' }
}

export function ChatMessage({ role, content, timestamp, isHighlighted }: ChatMessageProps) {
  const config = ROLE_CONFIG[role]
  const time = new Date(timestamp)

  return (
    <div
      role="listitem"
      className={`flex gap-3 px-4 py-3 transition-colors duration-200 ${isHighlighted ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-bg-elevated/50'}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-elevated text-xs font-bold ${config.color}`}
        aria-label={config.label}
      >
        {config.icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
          <span className="font-mono text-xs text-text-muted">
            {time.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </span>
        </div>

        <div className="whitespace-pre-wrap break-words text-sm text-text-primary">
          {renderContent(content)}
        </div>
      </div>
    </div>
  )
}

function renderContent(content: string): React.ReactNode {
  if (content.includes('```')) {
    const parts = content.split(/(```[\s\S]*?```)/g)
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('```') && part.endsWith('```')) {
            const code = part.slice(3, -3).replace(/^\w+\n/, '')
            return (
              <pre
                key={i}
                className="mt-2 overflow-x-auto rounded-md border border-border-default bg-bg-base p-3 font-mono text-xs"
              >
                <code>{code.trim()}</code>
              </pre>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </>
    )
  }

  if (content.startsWith('[Tool Call:') || content.startsWith('[Tool Result:')) {
    return (
      <div className="rounded-md border border-border-default bg-bg-base p-2 font-mono text-xs">
        {content}
      </div>
    )
  }

  if (content.startsWith('[Error]')) {
    return (
      <div className="rounded-md border border-status-red/30 bg-status-red/10 p-2 text-xs text-status-red">
        {content}
      </div>
    )
  }

  return content
}

export type { ChatMessageProps }
