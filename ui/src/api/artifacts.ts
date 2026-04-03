import { api } from "./client";
import type { Artifact, ArtifactVersion } from "@mnm/shared";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const artifactsApi = {
  create(companyId: string, input: { title: string; artifactType?: string; content: string; sourceChannelId?: string; sourceMessageId?: string }) {
    return api.post<Artifact>(`/companies/${companyId}/artifacts`, input);
  },

  list(companyId: string, opts?: { channelId?: string; artifactType?: string; limit?: number; offset?: number }) {
    return api.get<{ artifacts: Artifact[]; total: number }>(
      `/companies/${companyId}/artifacts${buildQuery(opts as Record<string, string | number | undefined> ?? {})}`,
    );
  },

  getById(companyId: string, id: string) {
    return api.get<Artifact>(`/companies/${companyId}/artifacts/${id}`);
  },

  update(companyId: string, id: string, input: { title?: string; content?: string; changeSummary?: string }) {
    return api.patch<Artifact>(`/companies/${companyId}/artifacts/${id}`, input);
  },

  delete(companyId: string, id: string) {
    return api.delete(`/companies/${companyId}/artifacts/${id}`);
  },

  getVersions(companyId: string, id: string) {
    return api.get<ArtifactVersion[]>(`/companies/${companyId}/artifacts/${id}/versions`);
  },

  getVersion(companyId: string, id: string, versionId: string) {
    return api.get<ArtifactVersion>(`/companies/${companyId}/artifacts/${id}/versions/${versionId}`);
  },
};
