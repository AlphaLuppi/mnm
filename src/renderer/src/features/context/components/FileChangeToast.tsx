import { toast } from '@renderer/shared/components/Toaster'
import type { FileChangeNotification } from '../notification.types'

const CHANGE_TYPE_LABELS: Record<string, string> = {
  create: 'créé',
  modify: 'modifié',
  delete: 'supprimé'
}

const CHANGE_TYPE_ICONS: Record<string, string> = {
  create: '+',
  modify: '~',
  delete: '-'
}

export function showFileChangeToast(notification: FileChangeNotification): void {
  const label = CHANGE_TYPE_LABELS[notification.changeType] ?? 'modifié'
  const icon = CHANGE_TYPE_ICONS[notification.changeType] ?? '~'

  const parts: string[] = []
  if (notification.agentName) {
    parts.push(`Par ${notification.agentName}`)
  }

  const otherAgents = notification.affectedAgentIds.filter(
    (id) => id !== notification.agentId
  )
  if (otherAgents.length > 0) {
    parts.push(`Impact potentiel sur : ${otherAgents.join(', ')}`)
  }

  toast({
    title: `${icon} ${notification.fileName} ${label}`,
    description: parts.length > 0 ? parts.join(' — ') : undefined,
    duration: 3000
  })
}
