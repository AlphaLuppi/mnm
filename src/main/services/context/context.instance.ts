import { ContextService } from './context.service'

let contextService: ContextService | null = null

export function initContextService(projectPath: string): ContextService {
  contextService = new ContextService(projectPath)
  return contextService
}

export function getContextService(): ContextService | null {
  return contextService
}
