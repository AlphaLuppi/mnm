import { GitlabProvider, type GitProvider } from "@mnm/git-provider";
import { eq, and, isNull } from "drizzle-orm";
import { configLayers, configLayerItems, type Db } from "@mnm/db";

export interface BuildSourceProviderInput {
  db: Db;
  companyId: string;
  /**
   * The full HTTPS URL of the plugin repo, e.g.
   * https://lab.cbainfo.fr/genia/hub/creation/symfony-upgrade-tests
   */
  url: string;
}

interface ParsedRepoUrl {
  baseUrl: string;
  projectPath: string;
}

export function parseGitlabRepoUrl(url: string): ParsedRepoUrl {
  const u = new URL(url);
  const baseUrl = `${u.protocol}//${u.host}`;
  const projectPath = u.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
  if (!projectPath || projectPath.indexOf("/") < 0) {
    throw new Error(`Cannot parse GitLab project path from URL: ${url}`);
  }
  return { baseUrl, projectPath };
}

/**
 * Look up the company's git_provider config layer item, reuse its credentials,
 * but build a GitlabProvider pointing at the plugin URL (different projectId).
 *
 * Assumption: plugin repo lives on the same GitLab instance as the company
 * workflows repo, accessible with the same PAT. V1 demo constraint.
 */
export async function buildSourceProvider(
  input: BuildSourceProviderInput,
): Promise<GitProvider> {
  const { baseUrl, projectPath } = parseGitlabRepoUrl(input.url);

  // Find git_provider config item — same pattern as resolveGitProvider does.
  // It is stored as item_type="git_provider" in some company-scoped layer.
  const rows = await input.db
    .select({ configJson: configLayerItems.configJson })
    .from(configLayerItems)
    .innerJoin(configLayers, eq(configLayerItems.layerId, configLayers.id))
    .where(
      and(
        eq(configLayerItems.companyId, input.companyId),
        eq(configLayerItems.itemType, "git_provider"),
        eq(configLayerItems.enabled, true),
        eq(configLayers.scope, "company"),
        eq(configLayers.enforced, true),
        isNull(configLayers.archivedAt),
      ),
    );

  if (rows.length === 0) {
    throw new Error("GIT_PROVIDER_MISCONFIG: company has no git_provider configured");
  }

  const config = (rows[0]!.configJson ?? {}) as {
    kind?: string;
    baseUrl?: string;
    token?: string;
  };

  if (config.kind !== "gitlab") {
    throw new Error(
      `Source provider build only supports kind=gitlab in V1, got kind=${config.kind ?? "unknown"}`,
    );
  }
  if (!config.baseUrl || !config.token) {
    throw new Error("GIT_PROVIDER_MISCONFIG: kind=gitlab but baseUrl/token missing");
  }
  if (config.baseUrl.replace(/\/$/, "") !== baseUrl.replace(/\/$/, "")) {
    throw new Error(
      `Plugin URL host (${baseUrl}) differs from company GitLab base (${config.baseUrl}). V1 only supports same instance.`,
    );
  }

  return new GitlabProvider({
    providerId: `gitlab:plugin-source:${projectPath}`,
    baseUrl: config.baseUrl,
    projectId: projectPath,
    token: config.token,
  });
}
