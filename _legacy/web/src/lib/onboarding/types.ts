export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  action?: ChatAction;
}

export type ChatAction =
  | { type: "api_key_input" }
  | { type: "quick_actions"; actions: string[] }
  | { type: "analyze_project" }
  | { type: "terminal_or_api_key" };

export interface ProjectContext {
  hasRepository: boolean;
  repositoryPath?: string;
  specCount: number;
  workflowCount: number;
  hasApiKey: boolean;
  discoveryComplete: boolean;
  claudeCodeInstalled?: boolean;
  claudeCodeConfigured?: boolean;
  claudeCLIAuthenticated?: boolean;
  claudeCLIVersion?: string;
  canChat: boolean;
}

export interface OnboardingState {
  messages: ChatMessage[];
  context: ProjectContext;
  step: "initial" | "analyzing" | "configured" | "complete";
}
