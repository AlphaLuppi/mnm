import issueTools from "./issues.tool.js";
import agentTools from "./agents.tool.js";
import contextTools from "./context.tool.js";
import configLayerTools from "./config-layers.tool.js";
import traceTools from "./traces.tool.js";
import sandboxTools from "./sandbox.tool.js";
import usersTools from "./users.tool.js";
import adminTools from "./admin.tool.js";
import a2aTools from "./a2a.tool.js";
import chatTools from "./chat.tool.js";
import documentsTools from "./documents.tool.js";
import foldersTools from "./folders.tool.js";
import artifactsTools from "./artifacts.tool.js";
import projectTools from "./projects.tool.js";
import governedWorkflowTools from "./governed-workflows.tool.js";
// PAPERCLIP-PHASE2: Inbox Interactive — propose_task / ask_questions / request_confirmation
import threadInteractionTools from "./thread-interactions.tool.js";
// CONNECTORS-PLATFORM Sprint 2 — list / status / connect / wait / set_api_key
import connectorTools from "./connectors.tool.js";
// WORKFLOW-HOOKS T2.8 — list / get / create / update / delete / catalog / executions
import workflowHookTools from "./workflow-hooks.tool.js";

export const allToolDefiners = [issueTools, agentTools, contextTools, configLayerTools, traceTools, sandboxTools, usersTools, adminTools, a2aTools, chatTools, documentsTools, foldersTools, artifactsTools, projectTools, governedWorkflowTools, threadInteractionTools, connectorTools, workflowHookTools];
