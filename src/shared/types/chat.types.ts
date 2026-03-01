export type ChatRole = 'user' | 'assistant' | 'system'

export type ChatEntry = {
  id: string
  agentId: string
  role: ChatRole
  content: string
  checkpoint?: string
  timestamp: number
}
