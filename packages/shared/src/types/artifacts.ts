export type ArtifactType = "markdown" | "code" | "diagram" | "spreadsheet" | "html";

export interface ArtifactVersion {
  id: string;
  artifactId: string;
  versionNumber: number;
  content: string;
  changeSummary: string | null;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  createdAt: string;
}

export interface Artifact {
  id: string;
  companyId: string;
  title: string;
  artifactType: ArtifactType;
  language: string | null;
  currentVersionId: string | null;
  sourceChannelId: string | null;
  sourceMessageId: string | null;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  currentVersion?: ArtifactVersion;
}
