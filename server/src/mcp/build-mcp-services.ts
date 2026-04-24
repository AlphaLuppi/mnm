/**
 * Build the services object injected into all MCP tool & resource handlers.
 * Each property corresponds to a `services.xxx` call in tool files.
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { configLayerItems, configLayers, type Db } from "@mnm/db";
import { GitlabProvider, LocalBareRepoProvider, ShaCache, type GitProvider } from "@mnm/git-provider";
import { governedWorkflowService, GovernedWorkflowError } from "../services/governed-workflows.js";
import { WORKFLOW_ERROR_CODES } from "@mnm/governed-workflows";
import { projectService } from "../services/projects.js";
import { agentService } from "../services/agents.js";
import { issueService } from "../services/issues.js";
import { configLayerService } from "../services/config-layer.js";
import { configLayerConflictService } from "../services/config-layer-conflict.js";
import { traceService } from "../services/trace-service.js";
import { dashboardService } from "../services/dashboard.js";
import { chatService } from "../services/chat.js";
import { chatSharingService } from "../services/chat-sharing.js";
import { documentService } from "../services/document.js";
import { folderService } from "../services/folder.js";
import { artifactService } from "../services/artifact.js";
import { deployManagerService } from "../services/deploy-manager.js";
import { sandboxManagerService } from "../services/sandbox-manager.js";
import { accessService } from "../services/access.js";
import { onboardingService } from "../services/onboarding.js";
import { inviteService } from "../services/invite.js";
import { auditService } from "../services/audit.js";
import { a2aBusService } from "../services/a2a-bus.js";
import { a2aPermissionsService } from "../services/a2a-permissions.js";
import { heartbeatService } from "../services/heartbeat.js";
import type { McpServices } from "./registry/types.js";

/**
 * Build a companyId -> GitProvider resolver. Multi-tenant prod stores each
 * company's git backend as a `git_provider` config_layer_item in a
 * company-scoped, enforced layer. Shape of the configJson:
 *   { kind: "gitlab", providerId, baseUrl, projectId, token }
 *   { kind: "local",  providerId, repoDir }
 *
 * Lookup strategy: direct query over config_layer_items joined to
 * config_layers, filtered to enforced company-scope non-archived layers.
 * We intentionally do NOT route through configLayerConflictService.mergePreview
 * here because mergePreview takes an agentId (cast to uuid inside its CTE)
 * and this is a company-scoped lookup with no meaningful agent id.
 *
 * The config-layer system guarantees a company has at most one active
 * git_provider item under the company-enforced layer (UI validation +
 * `config_layers_company_name_scope_uq` + `config_layer_items_layer_name_uq`
 * combined enforce the invariant).
 *
 * Fallback: when no git_provider item exists for the company, we fall back
 * to process env vars (dev / local bootstrap). When a company declares an
 * item with an unknown kind or missing fields, we fail-closed with
 * GIT_PROVIDER_MISCONFIG rather than silently fall back.
 *
 * Providers are cached per companyId for the lifetime of the process. When
 * a company rotates credentials, restart is required — the config-layer UI
 * already warns users about this (spec §5).
 */
export function createResolveGitProvider(db: Db): (companyId: string) => Promise<GitProvider> {
  const cache = new Map<string, GitProvider>();

  return async function resolveGitProvider(companyId: string): Promise<GitProvider> {
    const cached = cache.get(companyId);
    if (cached) return cached;

    // Direct query over config_layer_items for company-enforced git_provider
    // items. We intentionally do NOT route through mergePreview here because
    // it takes an agentId and this is a company-scoped lookup. The
    // config-layer system guarantees a company has at most one active
    // git_provider item in the company-enforced layer.
    const rows = await db
      .select({ configJson: configLayerItems.configJson })
      .from(configLayerItems)
      .innerJoin(configLayers, eq(configLayerItems.layerId, configLayers.id))
      .where(
        and(
          eq(configLayerItems.companyId, companyId),
          eq(configLayerItems.itemType, "git_provider"),
          eq(configLayerItems.enabled, true),
          eq(configLayers.scope, "company"),
          eq(configLayers.enforced, true),
          isNull(configLayers.archivedAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      const provider = buildEnvFallbackProvider();
      cache.set(companyId, provider);
      return provider;
    }

    const cfg = rows[0]!.configJson as { kind?: string } & Record<string, unknown>;
    let provider: GitProvider;
    if (cfg.kind === "gitlab") {
      const { providerId, baseUrl, projectId, token } = cfg as {
        providerId?: string; baseUrl?: string; projectId?: string; token?: string;
      };
      if (!providerId || !baseUrl || !projectId || !token) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
          `Company ${companyId} git_provider item is missing required gitlab fields.`,
          ["Set providerId, baseUrl, projectId, token on the git_provider config layer item."],
        );
      }
      provider = new GitlabProvider({ providerId, baseUrl, projectId, token });
    } else if (cfg.kind === "local") {
      const { providerId, repoDir } = cfg as { providerId?: string; repoDir?: string };
      if (!providerId || !repoDir) {
        throw new GovernedWorkflowError(
          WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
          `Company ${companyId} git_provider item is missing required local fields.`,
          ["Set providerId and repoDir on the git_provider config layer item."],
        );
      }
      provider = new LocalBareRepoProvider({ providerId, repoDir });
    } else {
      throw new GovernedWorkflowError(
        WORKFLOW_ERROR_CODES.GIT_PROVIDER_MISCONFIG,
        `Company ${companyId} git_provider item has unknown kind: ${String(cfg.kind)}`,
        ["Supported kinds are 'gitlab' and 'local'."],
      );
    }

    cache.set(companyId, provider);
    return provider;
  };
}

function buildEnvFallbackProvider(): GitProvider {
  // In local_trusted (dev) mode, default to a local bare repo at the seed
  // script's canonical path (`~/.mnm/dev-workflows-bare/repo.git`). Devs can
  // run `bun run seed:hello-world` and `bun run dev` without touching env
  // vars. In authenticated (prod) mode the fallback path shouldn't be hit at
  // all — companies are expected to declare a `git_provider` config_layer_item
  // — but if one is missing we still default to gitlab so the startup crash
  // happens at first fetch rather than silently binding to an empty repo.
  const deploymentMode = process.env.MNM_DEPLOYMENT_MODE ?? "local_trusted";
  const defaultMode = deploymentMode === "local_trusted" ? "local" : "gitlab";
  const mode = process.env.MNM_GIT_PROVIDER ?? defaultMode;
  if (mode === "local") {
    const defaultRepoDir = join(homedir(), ".mnm", "dev-workflows-bare", "repo.git");
    const repoDir = process.env.MNM_GIT_LOCAL_PATH ?? defaultRepoDir;
    return new LocalBareRepoProvider({ providerId: "local:mnm-workflows", repoDir });
  }
  return new GitlabProvider({
    providerId: "gitlab:mnm-workflows",
    baseUrl: process.env.GITLAB_BASE_URL!,
    projectId: process.env.GITLAB_PROJECT_ID!,
    token: process.env.GITLAB_TOKEN!,
  });
}

export function buildMcpServices(db: Db): McpServices {
  const resolveGitProvider = createResolveGitProvider(db);
  const shaCache = new ShaCache();
  return {
    db,
    resolveGitProvider,
    projects: projectService(db),
    agents: agentService(db),
    issues: issueService(db),
    configLayers: configLayerService(db),
    configLayerConflict: configLayerConflictService(db),
    traces: traceService(db),
    dashboard: dashboardService(db),
    chat: chatService(db),
    chatSharing: chatSharingService(db),
    documents: documentService(db),
    folders: folderService(db),
    artifacts: artifactService(db),
    deployManager: deployManagerService(db),
    sandboxManager: sandboxManagerService(db),
    access: accessService(db),
    onboarding: onboardingService(db),
    invite: inviteService(db),
    audit: auditService(db),
    a2aBus: a2aBusService(db),
    a2aPermissions: a2aPermissionsService(db),
    heartbeat: heartbeatService(db),
    governedWorkflows: governedWorkflowService(db, { resolveGitProvider, shaCache }),
  };
}
