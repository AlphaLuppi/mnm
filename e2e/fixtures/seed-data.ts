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
