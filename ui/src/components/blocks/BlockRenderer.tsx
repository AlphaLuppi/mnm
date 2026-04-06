// Placeholder for BlockRenderer — full implementation in BF-05

export interface BlockContext {
  surface: "issue" | "inbox" | "dashboard";
  surfaceId?: string;
  companyId: string;
  onAction: (action: string, payload?: Record<string, unknown>) => Promise<void>;
  hasPermission: (slug: string) => boolean;
}
