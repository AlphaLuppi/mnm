/**
 * E2E Seed Data — Realistic business data for MnM test suite.
 *
 * All IDs are deterministic UUIDs for stable test references.
 * Data is designed around two French companies:
 *   - NovaTech Solutions (main test company, all features)
 *   - Atelier Numerique (secondary, cross-tenant isolation tests)
 *
 * This file is ONLY constants — no DB calls.
 * Actual seeding happens in global-setup.ts via API calls.
 */

// ─── Deterministic UUIDs ────────────────────────────────────────────────────
// These are pre-generated stable UUIDs to use in seed data.
// They allow tests to reference entities without querying the DB.

export const IDS = {
  // Companies
  NOVATECH_COMPANY: "a1000000-0000-4000-8000-000000000001",
  ATELIER_COMPANY: "a2000000-0000-4000-8000-000000000002",

  // Users (Better Auth generates its own IDs, but we track them here after creation)
  // These are placeholder — actual IDs come from auth sign-up response
  NOVATECH_ADMIN_USER: "", // set at runtime
  NOVATECH_MANAGER_USER: "", // set at runtime
  NOVATECH_CONTRIBUTOR_USER: "", // set at runtime
  NOVATECH_VIEWER_USER: "", // set at runtime
  ATELIER_ADMIN_USER: "", // set at runtime

  // Agents (NovaTech)
  AGENT_CLAUDE_STRATEGE: "b1000000-0000-4000-8000-000000000001",
  AGENT_MARCUS_ARCHITECTE: "b1000000-0000-4000-8000-000000000002",
  AGENT_LUNA_DEVELOPPEUR: "b1000000-0000-4000-8000-000000000003",
  AGENT_ARIA_QA: "b1000000-0000-4000-8000-000000000004",
  AGENT_PHOENIX_DEVOPS: "b1000000-0000-4000-8000-000000000005",

  // Projects (NovaTech)
  PROJECT_MIGRATION_CLOUD: "c1000000-0000-4000-8000-000000000001",
  PROJECT_REFONTE_UX: "c1000000-0000-4000-8000-000000000002",
  PROJECT_AUDIT_SECURITE: "c1000000-0000-4000-8000-000000000003",

  // Workflow Templates (NovaTech)
  WORKFLOW_TPL_CICD: "d1000000-0000-4000-8000-000000000001",
  WORKFLOW_TPL_AUDIT: "d1000000-0000-4000-8000-000000000002",

  // Workflow Instances
  WORKFLOW_INST_MIGRATION: "d2000000-0000-4000-8000-000000000001",

  // Goals
  GOAL_CROISSANCE_Q1: "e1000000-0000-4000-8000-000000000001",

  // Chat Channels
  CHAT_CHANNEL_CLAUDE: "f1000000-0000-4000-8000-000000000001",
  CHAT_CHANNEL_MARCUS: "f1000000-0000-4000-8000-000000000002",

  // Container Profiles
  CONTAINER_PROFILE_STD: "f2000000-0000-4000-8000-000000000001",

  // Automation Cursors
  CURSOR_COMPANY_LEVEL: "f3000000-0000-4000-8000-000000000001",
  CURSOR_PROJECT_LEVEL: "f3000000-0000-4000-8000-000000000002",

  // Traces
  TRACE_COMPLETED: "f4000000-0000-4000-8000-000000000001",
  TRACE_RUNNING: "f4000000-0000-4000-8000-000000000002",
  TRACE_PARENT: "f4000000-0000-4000-8000-000000000003",
  TRACE_CHILD_1: "f4000000-0000-4000-8000-000000000004",
  TRACE_CHILD_2: "f4000000-0000-4000-8000-000000000005",

  // Trace Observations (completed trace — 10 observations simulating a code review)
  OBS_INIT: "f5000000-0000-4000-8000-000000000001",
  OBS_READ_SPEC: "f5000000-0000-4000-8000-000000000002",
  OBS_ANALYZE_CODE: "f5000000-0000-4000-8000-000000000003",
  OBS_GENERATION_PLAN: "f5000000-0000-4000-8000-000000000004",
  OBS_TOOL_GREP: "f5000000-0000-4000-8000-000000000005",
  OBS_TOOL_READ_FILE: "f5000000-0000-4000-8000-000000000006",
  OBS_GENERATION_REVIEW: "f5000000-0000-4000-8000-000000000007",
  OBS_TOOL_WRITE_FILE: "f5000000-0000-4000-8000-000000000008",
  OBS_TOOL_RUN_TESTS: "f5000000-0000-4000-8000-000000000009",
  OBS_FINAL_SUMMARY: "f5000000-0000-4000-8000-00000000000a",

  // Trace Observations (running trace — 3 in-progress)
  OBS_RUNNING_INIT: "f5100000-0000-4000-8000-000000000001",
  OBS_RUNNING_GEN: "f5100000-0000-4000-8000-000000000002",
  OBS_RUNNING_TOOL: "f5100000-0000-4000-8000-000000000003",

  // Trace Observations (parent trace — 2 obs)
  OBS_PARENT_INIT: "f5200000-0000-4000-8000-000000000001",
  OBS_PARENT_DELEGATE: "f5200000-0000-4000-8000-000000000002",

  // Trace Observations (child traces — 2 obs each)
  OBS_CHILD1_INIT: "f5300000-0000-4000-8000-000000000001",
  OBS_CHILD1_WORK: "f5300000-0000-4000-8000-000000000002",
  OBS_CHILD2_INIT: "f5400000-0000-4000-8000-000000000001",
  OBS_CHILD2_WORK: "f5400000-0000-4000-8000-000000000002",

  // Trace Lenses
  LENS_PERFORMANCE: "f6000000-0000-4000-8000-000000000001",
  LENS_ERROR_ANALYSIS: "f6000000-0000-4000-8000-000000000002",

  // Trace Lens Results
  LENS_RESULT_PERF_COMPLETED: "f7000000-0000-4000-8000-000000000001",
} as const;

// Mutable copy for runtime ID tracking (user IDs from auth)
export const runtimeIds: Record<string, string> = { ...IDS };

// ─── Auth Credentials ───────────────────────────────────────────────────────

export const TEST_PASSWORD = "E2eTestPass!2026";

export const USERS = {
  novaTechAdmin: {
    name: "Sophie Durand",
    email: "admin@novatech.test",
    password: TEST_PASSWORD,
    businessRole: "admin" as const,
    company: "novatech",
  },
  novaTechManager: {
    name: "Pierre Martin",
    email: "manager@novatech.test",
    password: TEST_PASSWORD,
    businessRole: "manager" as const,
    company: "novatech",
  },
  novaTechContributor: {
    name: "Camille Leroy",
    email: "contributor@novatech.test",
    password: TEST_PASSWORD,
    businessRole: "contributor" as const,
    company: "novatech",
  },
  novaTechViewer: {
    name: "Thomas Bernard",
    email: "viewer@novatech.test",
    password: TEST_PASSWORD,
    businessRole: "viewer" as const,
    company: "novatech",
  },
  atelierAdmin: {
    name: "Marie Dupont",
    email: "admin@atelier.test",
    password: TEST_PASSWORD,
    businessRole: "admin" as const,
    company: "atelier",
  },
} as const;

export type TestUserKey = keyof typeof USERS;

// ─── Companies ──────────────────────────────────────────────────────────────

export const COMPANIES = {
  novatech: {
    id: IDS.NOVATECH_COMPANY,
    name: "NovaTech Solutions",
    description: "Plateforme IA enterprise pour orchestration d'agents intelligents",
    issuePrefix: "NTS",
    tier: "enterprise",
    ssoEnabled: true,
    invitationOnly: false,
    brandColor: "#6366f1",
    budgetMonthlyCents: 500000, // 5000 EUR
    maxUsers: 100,
    a2aDefaultPolicy: "allow",
  },
  atelier: {
    id: IDS.ATELIER_COMPANY,
    name: "Atelier Numerique",
    description: "Studio de creation digitale specialise en IA generative",
    issuePrefix: "ATN",
    tier: "free",
    ssoEnabled: false,
    invitationOnly: true,
    brandColor: "#ec4899",
    budgetMonthlyCents: 50000, // 500 EUR
    maxUsers: 10,
    a2aDefaultPolicy: "deny",
  },
} as const;

// ─── Agents (NovaTech) ─────────────────────────────────────────────────────

export const AGENTS = [
  {
    id: IDS.AGENT_CLAUDE_STRATEGE,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Claude Stratege",
    role: "ceo",
    title: "Directeur Strategique IA",
    icon: "crown",
    status: "active",
    adapterType: "claude_local",
    capabilities: "Strategic planning, resource allocation, decision making",
    reportsTo: null,
    budgetMonthlyCents: 200000,
    isolationMode: "process",
  },
  {
    id: IDS.AGENT_MARCUS_ARCHITECTE,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Marcus Architecte",
    role: "cto",
    title: "Architecte Technique Principal",
    icon: "cpu",
    status: "active",
    adapterType: "claude_local",
    capabilities: "Architecture design, code review, technical decisions",
    reportsTo: IDS.AGENT_CLAUDE_STRATEGE,
    budgetMonthlyCents: 150000,
    isolationMode: "process",
  },
  {
    id: IDS.AGENT_LUNA_DEVELOPPEUR,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Luna Developpeur",
    role: "engineer",
    title: "Ingenieure Full-Stack",
    icon: "code",
    status: "idle",
    adapterType: "claude_local",
    capabilities: "Full-stack development, TypeScript, React, Node.js",
    reportsTo: IDS.AGENT_MARCUS_ARCHITECTE,
    budgetMonthlyCents: 100000,
    isolationMode: "process",
  },
  {
    id: IDS.AGENT_ARIA_QA,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Aria QA",
    role: "qa",
    title: "Ingenieure Qualite",
    icon: "bug",
    status: "idle",
    adapterType: "process",
    capabilities: "Testing, E2E, unit tests, security audit",
    reportsTo: IDS.AGENT_MARCUS_ARCHITECTE,
    budgetMonthlyCents: 80000,
    isolationMode: "process",
  },
  {
    id: IDS.AGENT_PHOENIX_DEVOPS,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Phoenix DevOps",
    role: "devops",
    title: "Ingenieur Infrastructure",
    icon: "rocket",
    status: "paused",
    adapterType: "process",
    capabilities: "CI/CD, Docker, Kubernetes, monitoring",
    reportsTo: IDS.AGENT_MARCUS_ARCHITECTE,
    budgetMonthlyCents: 90000,
    isolationMode: "container",
  },
] as const;

// ─── Projects (NovaTech) ────────────────────────────────────────────────────

export const PROJECTS = [
  {
    id: IDS.PROJECT_MIGRATION_CLOUD,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Migration Cloud AWS",
    description: "Migration de l'infrastructure on-premise vers AWS avec conteneurisation des services critiques",
    status: "in_progress",
    color: "#6366f1",
    leadAgentId: IDS.AGENT_MARCUS_ARCHITECTE,
  },
  {
    id: IDS.PROJECT_REFONTE_UX,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Refonte UX Mobile",
    description: "Redesign complet de l'application mobile pour ameliorer l'experience utilisateur B2B",
    status: "planned",
    color: "#ec4899",
    leadAgentId: null,
  },
  {
    id: IDS.PROJECT_AUDIT_SECURITE,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Audit Securite Q1 2026",
    description: "Audit complet de securite: OWASP Top 10, pentest, compliance RGPD",
    status: "completed",
    color: "#22c55e",
    leadAgentId: null,
  },
] as const;

// ─── Goals (NovaTech) ───────────────────────────────────────────────────────

export const GOALS = [
  {
    id: IDS.GOAL_CROISSANCE_Q1,
    companyId: IDS.NOVATECH_COMPANY,
    title: "Croissance Q1 2026",
    description: "Atteindre 50 entreprises clientes actives d'ici fin mars 2026",
    level: "company",
    status: "active",
  },
] as const;

// ─── Workflow Templates (NovaTech) ──────────────────────────────────────────

export const WORKFLOW_TEMPLATES = [
  {
    id: IDS.WORKFLOW_TPL_CICD,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Pipeline CI/CD Standard",
    description: "Pipeline standard pour le developpement continu avec review et QA",
    isDefault: true,
    createdFrom: "custom",
    stages: [
      {
        order: 0,
        name: "Analyse",
        description: "Analyse des specifications et planification technique",
        agentRole: "cto",
        autoTransition: false,
        acceptanceCriteria: ["Specs techniques validees", "Estimation effort completee"],
        requiredFiles: [],
        prePrompts: ["Analyser les specifications fournies et proposer une architecture"],
      },
      {
        order: 1,
        name: "Developpement",
        description: "Implementation du code et tests unitaires",
        agentRole: "engineer",
        autoTransition: false,
        acceptanceCriteria: ["Code implemente", "Tests unitaires passes"],
        requiredFiles: [],
        prePrompts: [],
      },
      {
        order: 2,
        name: "Code Review",
        description: "Revue de code par l'architecte",
        agentRole: "cto",
        autoTransition: false,
        hitlRequired: true,
        hitlRoles: ["admin", "manager"],
        acceptanceCriteria: ["Review approuve", "Pas de vulnerabilites"],
      },
      {
        order: 3,
        name: "QA",
        description: "Tests d'integration et E2E",
        agentRole: "qa",
        autoTransition: false,
        acceptanceCriteria: ["Tests E2E passes", "Pas de regression"],
      },
      {
        order: 4,
        name: "Deploiement",
        description: "Deploiement en production avec rollback automatique",
        agentRole: "devops",
        autoTransition: true,
        acceptanceCriteria: ["Deploy reussi", "Health check OK"],
      },
    ],
  },
  {
    id: IDS.WORKFLOW_TPL_AUDIT,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Audit Securite",
    description: "Workflow d'audit de securite avec validation humaine obligatoire",
    isDefault: false,
    createdFrom: "custom",
    stages: [
      {
        order: 0,
        name: "Scan Automatise",
        description: "Execution des scanners de vulnerabilites",
        agentRole: "qa",
        autoTransition: true,
        acceptanceCriteria: ["Scan termine sans erreur"],
      },
      {
        order: 1,
        name: "Analyse des Resultats",
        description: "Analyse et classification des vulnerabilites trouvees",
        agentRole: "cto",
        autoTransition: false,
        acceptanceCriteria: ["Toutes les CVE classifiees"],
      },
      {
        order: 2,
        name: "Rapport",
        description: "Generation du rapport d'audit detaille",
        agentRole: "cto",
        autoTransition: false,
        acceptanceCriteria: ["Rapport genere", "Recommendations incluses"],
      },
      {
        order: 3,
        name: "Validation HITL",
        description: "Validation humaine du rapport final",
        agentRole: "ceo",
        autoTransition: false,
        hitlRequired: true,
        hitlRoles: ["admin"],
        acceptanceCriteria: ["Rapport valide par un admin", "Plan d'action defini"],
      },
    ],
  },
] as const;

// ─── Container Profiles (NovaTech) ──────────────────────────────────────────

export const CONTAINER_PROFILES = [
  {
    id: IDS.CONTAINER_PROFILE_STD,
    companyId: IDS.NOVATECH_COMPANY,
    name: "Standard Dev",
    description: "Profil standard pour agents de developpement",
    cpuMillicores: 1000,
    memoryMb: 512,
    diskMb: 2048,
    timeoutSeconds: 3600,
    gpuEnabled: false,
    networkPolicy: "isolated",
    isDefault: true,
    dockerImage: "node:20-alpine",
    maxContainers: 5,
    credentialProxyEnabled: true,
    networkMode: "isolated",
  },
] as const;

// ─── Automation Cursors (NovaTech) ──────────────────────────────────────────

export const AUTOMATION_CURSORS = [
  {
    id: IDS.CURSOR_COMPANY_LEVEL,
    companyId: IDS.NOVATECH_COMPANY,
    level: "company",
    targetId: null,
    position: "assisted",
    ceiling: "auto",
  },
  {
    id: IDS.CURSOR_PROJECT_LEVEL,
    companyId: IDS.NOVATECH_COMPANY,
    level: "project",
    targetId: IDS.PROJECT_MIGRATION_CLOUD,
    position: "manual",
    ceiling: "assisted",
  },
] as const;

// ─── Audit Events (NovaTech) — sample events for audit log tests ────────────

export const SAMPLE_AUDIT_EVENTS = [
  {
    action: "member.added",
    actorType: "user",
    targetType: "membership",
    severity: "info",
    metadata: { role: "contributor", email: "contributor@novatech.test" },
  },
  {
    action: "agent.created",
    actorType: "user",
    targetType: "agent",
    severity: "info",
    metadata: { agentName: "Luna Developpeur", role: "engineer" },
  },
  {
    action: "workflow.started",
    actorType: "user",
    targetType: "workflow_instance",
    severity: "info",
    metadata: { workflowName: "Pipeline CI/CD Standard" },
  },
  {
    action: "permission.granted",
    actorType: "user",
    targetType: "permission",
    severity: "warning",
    metadata: { permissionKey: "agents:create", grantedTo: "Pierre Martin" },
  },
  {
    action: "company.settings_updated",
    actorType: "user",
    targetType: "company",
    severity: "info",
    metadata: { field: "invitationOnly", oldValue: false, newValue: true },
  },
  {
    action: "agent.status_changed",
    actorType: "system",
    targetType: "agent",
    severity: "info",
    metadata: { agentName: "Phoenix DevOps", from: "active", to: "paused" },
  },
  {
    action: "sso.configured",
    actorType: "user",
    targetType: "sso_configuration",
    severity: "warning",
    metadata: { provider: "saml", domain: "novatech.test" },
  },
  {
    action: "project.created",
    actorType: "user",
    targetType: "project",
    severity: "info",
    metadata: { projectName: "Migration Cloud AWS" },
  },
  {
    action: "hitl.approved",
    actorType: "user",
    targetType: "stage_instance",
    severity: "info",
    metadata: { stageName: "Code Review", workflowName: "Pipeline CI/CD Standard" },
  },
  {
    action: "container.started",
    actorType: "system",
    targetType: "container_instance",
    severity: "info",
    metadata: { agentName: "Phoenix DevOps", profile: "Standard Dev" },
  },
] as const;

// ─── Permission Keys by Role (reference for RBAC tests) ────────────────────

export const PERMISSION_KEYS_ADMIN = [
  "agents:create", "agents:launch", "agents:manage_containers",
  "users:invite", "users:manage_permissions",
  "tasks:assign", "tasks:assign_scope",
  "joins:approve",
  "projects:create", "projects:manage_members",
  "workflows:create", "workflows:enforce",
  "company:manage_settings", "company:manage_sso",
  "audit:read", "audit:export",
  "stories:create", "stories:edit",
  "dashboard:view", "chat:agent",
] as const;

export const PERMISSION_KEYS_VIEWER = [
  "audit:read", "dashboard:view",
] as const;

// ─── Traces (NovaTech) ───────────────────────────────────────────────────────

const HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString();
const HALF_HOUR_AGO = new Date(Date.now() - 1_800_000).toISOString();
const TWENTY_MIN_AGO = new Date(Date.now() - 1_200_000).toISOString();
const TEN_MIN_AGO = new Date(Date.now() - 600_000).toISOString();
const FIVE_MIN_AGO = new Date(Date.now() - 300_000).toISOString();

export const TRACES = [
  // 1. Completed trace — code review by Marcus (10 observations)
  {
    id: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    agentId: IDS.AGENT_MARCUS_ARCHITECTE,
    parentTraceId: null,
    name: "Code Review: Migration API endpoints",
    status: "completed",
    startedAt: HOUR_AGO,
    completedAt: HALF_HOUR_AGO,
    totalDurationMs: 1_800_000,
    totalTokensIn: 45_200,
    totalTokensOut: 12_800,
    totalCostUsd: "0.1840",
    metadata: { trigger: "workflow", reviewType: "architecture" },
    tags: ["code-review", "migration"],
  },
  // 2. Running trace — Luna actively developing
  {
    id: IDS.TRACE_RUNNING,
    companyId: IDS.NOVATECH_COMPANY,
    agentId: IDS.AGENT_LUNA_DEVELOPPEUR,
    parentTraceId: null,
    name: "Implement auth middleware refactor",
    status: "running",
    startedAt: TEN_MIN_AGO,
    completedAt: null,
    totalDurationMs: null,
    totalTokensIn: 8_400,
    totalTokensOut: 3_200,
    totalCostUsd: "0.0420",
    metadata: { trigger: "manual" },
    tags: ["auth", "refactor"],
  },
  // 3. Parent trace (orchestration) — Claude delegates to sub-agents
  {
    id: IDS.TRACE_PARENT,
    companyId: IDS.NOVATECH_COMPANY,
    agentId: IDS.AGENT_CLAUDE_STRATEGE,
    parentTraceId: null,
    name: "Orchestrate: Security Audit Pipeline",
    status: "completed",
    startedAt: HOUR_AGO,
    completedAt: TWENTY_MIN_AGO,
    totalDurationMs: 2_400_000,
    totalTokensIn: 62_000,
    totalTokensOut: 18_500,
    totalCostUsd: "0.2560",
    metadata: { trigger: "workflow", pipelineType: "audit" },
    tags: ["orchestration", "security"],
  },
  // 4. Child trace 1 — Marcus does architecture review (sub of parent)
  {
    id: IDS.TRACE_CHILD_1,
    companyId: IDS.NOVATECH_COMPANY,
    agentId: IDS.AGENT_MARCUS_ARCHITECTE,
    parentTraceId: IDS.TRACE_PARENT,
    name: "Sub: Architecture vulnerability scan",
    status: "completed",
    startedAt: new Date(Date.now() - 3_000_000).toISOString(),
    completedAt: HALF_HOUR_AGO,
    totalDurationMs: 1_200_000,
    totalTokensIn: 28_000,
    totalTokensOut: 8_500,
    totalCostUsd: "0.1160",
    metadata: { delegatedBy: IDS.AGENT_CLAUDE_STRATEGE },
    tags: ["security", "architecture"],
  },
  // 5. Child trace 2 — Aria does QA testing (sub of parent)
  {
    id: IDS.TRACE_CHILD_2,
    companyId: IDS.NOVATECH_COMPANY,
    agentId: IDS.AGENT_ARIA_QA,
    parentTraceId: IDS.TRACE_PARENT,
    name: "Sub: Security test suite execution",
    status: "completed",
    startedAt: HALF_HOUR_AGO,
    completedAt: TWENTY_MIN_AGO,
    totalDurationMs: 600_000,
    totalTokensIn: 15_000,
    totalTokensOut: 4_200,
    totalCostUsd: "0.0610",
    metadata: { delegatedBy: IDS.AGENT_CLAUDE_STRATEGE },
    tags: ["security", "testing"],
  },
] as const;

// ─── Trace Observations ─────────────────────────────────────────────────────

export const TRACE_OBSERVATIONS = [
  // --- Completed trace: 10 observations (code review flow) ---
  {
    id: IDS.OBS_INIT,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "event",
    name: "trace.init",
    status: "completed",
    startedAt: HOUR_AGO,
    completedAt: HOUR_AGO,
    durationMs: 5,
    metadata: { message: "Code review session started" },
  },
  {
    id: IDS.OBS_READ_SPEC,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "span",
    name: "Read specification document",
    status: "completed",
    startedAt: HOUR_AGO,
    completedAt: new Date(Date.now() - 3_540_000).toISOString(),
    durationMs: 60_000,
    input: { file: "docs/api-migration-spec.md" },
    output: { lines: 342 },
  },
  {
    id: IDS.OBS_ANALYZE_CODE,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "span",
    name: "Analyze existing codebase",
    status: "completed",
    startedAt: new Date(Date.now() - 3_540_000).toISOString(),
    completedAt: new Date(Date.now() - 3_300_000).toISOString(),
    durationMs: 240_000,
    input: { directory: "server/src/routes/" },
    output: { filesAnalyzed: 12, issuesFound: 3 },
  },
  {
    id: IDS.OBS_GENERATION_PLAN,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "generation",
    name: "Generate review plan",
    status: "completed",
    startedAt: new Date(Date.now() - 3_300_000).toISOString(),
    completedAt: new Date(Date.now() - 3_240_000).toISOString(),
    durationMs: 60_000,
    model: "claude-sonnet-4-20250514",
    inputTokens: 8_200,
    outputTokens: 2_400,
    totalTokens: 10_600,
    costUsd: "0.0380",
  },
  {
    id: IDS.OBS_TOOL_GREP,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: IDS.OBS_ANALYZE_CODE,
    type: "span",
    name: "grep: deprecated API patterns",
    status: "completed",
    startedAt: new Date(Date.now() - 3_240_000).toISOString(),
    completedAt: new Date(Date.now() - 3_180_000).toISOString(),
    durationMs: 60_000,
    input: { pattern: "app.get\\(/api/v1", directory: "server/" },
    output: { matches: 7 },
  },
  {
    id: IDS.OBS_TOOL_READ_FILE,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: IDS.OBS_ANALYZE_CODE,
    type: "span",
    name: "read_file: routes/users.ts",
    status: "completed",
    startedAt: new Date(Date.now() - 3_180_000).toISOString(),
    completedAt: new Date(Date.now() - 3_120_000).toISOString(),
    durationMs: 60_000,
    input: { file: "server/src/routes/users.ts" },
    output: { lines: 185 },
  },
  {
    id: IDS.OBS_GENERATION_REVIEW,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "generation",
    name: "Generate code review feedback",
    status: "completed",
    startedAt: new Date(Date.now() - 3_120_000).toISOString(),
    completedAt: new Date(Date.now() - 2_700_000).toISOString(),
    durationMs: 420_000,
    model: "claude-sonnet-4-20250514",
    inputTokens: 22_000,
    outputTokens: 6_800,
    totalTokens: 28_800,
    costUsd: "0.0980",
  },
  {
    id: IDS.OBS_TOOL_WRITE_FILE,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "span",
    name: "write_file: review-report.md",
    status: "completed",
    startedAt: new Date(Date.now() - 2_700_000).toISOString(),
    completedAt: new Date(Date.now() - 2_400_000).toISOString(),
    durationMs: 300_000,
    input: { file: "docs/review-report.md" },
    output: { bytesWritten: 4_280 },
  },
  {
    id: IDS.OBS_TOOL_RUN_TESTS,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "span",
    name: "run_tests: affected modules",
    status: "completed",
    startedAt: new Date(Date.now() - 2_400_000).toISOString(),
    completedAt: new Date(Date.now() - 2_100_000).toISOString(),
    durationMs: 300_000,
    input: { command: "pnpm test --filter server" },
    output: { passed: 42, failed: 0, skipped: 2 },
  },
  {
    id: IDS.OBS_FINAL_SUMMARY,
    traceId: IDS.TRACE_COMPLETED,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "generation",
    name: "Generate final summary",
    status: "completed",
    startedAt: new Date(Date.now() - 2_100_000).toISOString(),
    completedAt: HALF_HOUR_AGO,
    durationMs: 300_000,
    model: "claude-sonnet-4-20250514",
    inputTokens: 15_000,
    outputTokens: 3_600,
    totalTokens: 18_600,
    costUsd: "0.0480",
  },

  // --- Running trace: 3 observations (in-progress dev work) ---
  {
    id: IDS.OBS_RUNNING_INIT,
    traceId: IDS.TRACE_RUNNING,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "event",
    name: "trace.init",
    status: "completed",
    startedAt: TEN_MIN_AGO,
    completedAt: TEN_MIN_AGO,
    durationMs: 3,
    metadata: { message: "Development session started" },
  },
  {
    id: IDS.OBS_RUNNING_GEN,
    traceId: IDS.TRACE_RUNNING,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "generation",
    name: "Plan auth middleware changes",
    status: "completed",
    startedAt: TEN_MIN_AGO,
    completedAt: FIVE_MIN_AGO,
    durationMs: 300_000,
    model: "claude-sonnet-4-20250514",
    inputTokens: 6_200,
    outputTokens: 2_400,
    totalTokens: 8_600,
    costUsd: "0.0310",
  },
  {
    id: IDS.OBS_RUNNING_TOOL,
    traceId: IDS.TRACE_RUNNING,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "span",
    name: "write_file: middleware/auth-v2.ts",
    status: "started",
    startedAt: FIVE_MIN_AGO,
    completedAt: null,
    durationMs: null,
    input: { file: "server/src/middleware/auth-v2.ts" },
  },

  // --- Parent trace: 2 observations (orchestration) ---
  {
    id: IDS.OBS_PARENT_INIT,
    traceId: IDS.TRACE_PARENT,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "event",
    name: "trace.init",
    status: "completed",
    startedAt: HOUR_AGO,
    completedAt: HOUR_AGO,
    durationMs: 4,
    metadata: { message: "Security audit pipeline orchestration started" },
  },
  {
    id: IDS.OBS_PARENT_DELEGATE,
    traceId: IDS.TRACE_PARENT,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "generation",
    name: "Plan sub-agent delegation",
    status: "completed",
    startedAt: HOUR_AGO,
    completedAt: new Date(Date.now() - 3_300_000).toISOString(),
    durationMs: 300_000,
    model: "claude-sonnet-4-20250514",
    inputTokens: 12_000,
    outputTokens: 3_800,
    totalTokens: 15_800,
    costUsd: "0.0520",
  },

  // --- Child trace 1: 2 observations (architecture scan) ---
  {
    id: IDS.OBS_CHILD1_INIT,
    traceId: IDS.TRACE_CHILD_1,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "event",
    name: "trace.init",
    status: "completed",
    startedAt: new Date(Date.now() - 3_000_000).toISOString(),
    completedAt: new Date(Date.now() - 3_000_000).toISOString(),
    durationMs: 3,
    metadata: { message: "Architecture vulnerability scan started" },
  },
  {
    id: IDS.OBS_CHILD1_WORK,
    traceId: IDS.TRACE_CHILD_1,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "span",
    name: "Scan dependency tree",
    status: "completed",
    startedAt: new Date(Date.now() - 3_000_000).toISOString(),
    completedAt: HALF_HOUR_AGO,
    durationMs: 1_200_000,
    input: { command: "npm audit --json" },
    output: { vulnerabilities: { high: 0, medium: 2, low: 5 } },
  },

  // --- Child trace 2: 2 observations (QA testing) ---
  {
    id: IDS.OBS_CHILD2_INIT,
    traceId: IDS.TRACE_CHILD_2,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "event",
    name: "trace.init",
    status: "completed",
    startedAt: HALF_HOUR_AGO,
    completedAt: HALF_HOUR_AGO,
    durationMs: 2,
    metadata: { message: "Security test suite started" },
  },
  {
    id: IDS.OBS_CHILD2_WORK,
    traceId: IDS.TRACE_CHILD_2,
    companyId: IDS.NOVATECH_COMPANY,
    parentObservationId: null,
    type: "span",
    name: "Run OWASP security tests",
    status: "completed",
    startedAt: HALF_HOUR_AGO,
    completedAt: TWENTY_MIN_AGO,
    durationMs: 600_000,
    input: { command: "pnpm test:security" },
    output: { passed: 28, failed: 1, skipped: 0 },
  },
] as const;

// ─── Trace Lenses (NovaTech) ─────────────────────────────────────────────────
// userId will be set at runtime to the admin user

export const TRACE_LENSES = [
  {
    id: IDS.LENS_PERFORMANCE,
    companyId: IDS.NOVATECH_COMPANY,
    userId: "__RUNTIME_ADMIN_USER__", // replaced at seed time
    name: "Performance Bottleneck Analysis",
    prompt: "Analyze this trace for performance bottlenecks. Identify the slowest operations, token-heavy generations, and suggest optimizations to reduce latency and cost.",
    scope: { global: true },
    isTemplate: true,
    isActive: true,
  },
  {
    id: IDS.LENS_ERROR_ANALYSIS,
    companyId: IDS.NOVATECH_COMPANY,
    userId: "__RUNTIME_ADMIN_USER__",
    name: "Error & Failure Pattern Detection",
    prompt: "Examine this trace for errors, failures, and anomalies. Identify failed tool calls, unexpected outputs, and suggest root causes.",
    scope: { agentIds: [IDS.AGENT_MARCUS_ARCHITECTE, IDS.AGENT_LUNA_DEVELOPPEUR] },
    isTemplate: false,
    isActive: true,
  },
] as const;

// ─── Trace Lens Results (NovaTech) ───────────────────────────────────────────

export const TRACE_LENS_RESULTS = [
  {
    id: IDS.LENS_RESULT_PERF_COMPLETED,
    lensId: IDS.LENS_PERFORMANCE,
    traceId: IDS.TRACE_COMPLETED,
    workflowInstanceId: null,
    companyId: IDS.NOVATECH_COMPANY,
    userId: "__RUNTIME_ADMIN_USER__",
    resultMarkdown: `## Performance Analysis: Code Review

### Summary
The code review trace completed in 30 minutes with 58,000 total tokens.

### Bottlenecks Identified
1. **Code review generation** (7m) — largest single operation, 28.8K tokens
2. **Write file** (5m) — slow file write for 4KB report
3. **Test execution** (5m) — 42 tests took 5 minutes

### Cost Breakdown
- Total: $0.184
- Generations: $0.184 (3 LLM calls)
- Tools: $0.00 (no cost)

### Recommendations
- Consider streaming review output to reduce perceived latency
- Cache test results for unchanged modules`,
    resultStructured: {
      totalDurationMs: 1_800_000,
      totalTokens: 58_000,
      totalCost: 0.184,
      bottlenecks: ["generation:review", "span:write_file", "span:run_tests"],
    },
    modelUsed: "claude-sonnet-4-20250514",
    inputTokens: 4_200,
    outputTokens: 1_800,
    costUsd: "0.0190",
  },
] as const;

// ─── Auth State Paths ───────────────────────────────────────────────────────

export const AUTH_STATE_DIR = "e2e/.auth";
export const AUTH_STATES = {
  admin: `${AUTH_STATE_DIR}/adminStorageState.json`,
  manager: `${AUTH_STATE_DIR}/managerStorageState.json`,
  contributor: `${AUTH_STATE_DIR}/contributorStorageState.json`,
  viewer: `${AUTH_STATE_DIR}/viewerStorageState.json`,
  // Legacy compatibility (used by existing browser tests)
  default: `${AUTH_STATE_DIR}/storageState.json`,
} as const;

// ─── URL Helpers ────────────────────────────────────────────────────────────

export const BASE_URL = process.env.MNM_BASE_URL ?? "http://localhost:3100";

export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export function companyApiUrl(companyId: string, path: string): string {
  return `${BASE_URL}/api/companies/${companyId}${path}`;
}
