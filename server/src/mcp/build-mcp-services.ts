/**
 * Build the services object injected into all MCP tool & resource handlers.
 * Each property corresponds to a `services.xxx` call in tool files.
 */
import type { Db } from "@mnm/db";
import { projectService } from "../services/projects.js";
import { agentService } from "../services/agents.js";
import { issueService } from "../services/issues.js";
import { configLayerService } from "../services/config-layer.js";
import { configLayerConflictService } from "../services/config-layer-conflict.js";
import { workflowService } from "../services/workflows.js";
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

export function buildMcpServices(db: Db): McpServices {
  return {
    db,
    projects: projectService(db),
    agents: agentService(db),
    issues: issueService(db),
    configLayers: configLayerService(db),
    configLayerConflict: configLayerConflictService(db),
    workflows: workflowService(db),
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
  };
}
