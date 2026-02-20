export interface AIProvider {
  id: string;
  name: string;
  detect(): Promise<ProviderState>;
}

export interface ProviderState {
  provider: string;
  presence: ProviderPresence;
  sessions: ProviderSession[];
  teams: ProviderTeam[];
  commands: ProviderCommand[];
}

export interface ProviderPresence {
  installed: boolean;
  configured: boolean;
  version?: string;
}

export interface ProviderSession {
  id: string;
  provider: string;
  branch?: string;
  lastActivity: number;
  isActive: boolean;
  pid?: number;
  agentCount: number;
  agents: ProviderAgent[];
}

export interface ProviderAgent {
  id: string;
  name: string;
  sessionId: string;
}

export interface ProviderTeam {
  name: string;
  members: { name: string; agentType: string }[];
  taskCount?: number;
}

export interface ProviderCommand {
  name: string;
  filePath: string;
  category?: string;
}
