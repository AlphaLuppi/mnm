import type { ContentDocument } from "./content-blocks.js";

export interface UserWidgetDataSource {
  endpoint: string;
  params?: Record<string, unknown>;
  refreshInterval?: number; // seconds, minimum 60
}

export interface UserWidget {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  description: string | null;
  blocks: ContentDocument;
  dataSource: UserWidgetDataSource | null;
  position: number;
  span: number;
  createdByAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}
