# TECH-03 : Infrastructure de Test (Factories + Seed) — Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | TECH-03 |
| **Titre** | Infrastructure de Test (Factories + Seed) |
| **Epic** | Epic 0 — Infrastructure & Setup |
| **Sprint** | Sprint 0 (prerequis) |
| **Effort** | M (5 SP, 3-4j) |
| **Assignation** | Tom (backend) |
| **Bloque par** | TECH-01 (PostgreSQL externe) |
| **Debloque** | Tous les tests E2E et d'integration du pipeline B2B |
| **Type** | Infrastructure-only (pas de composant UI) |

---

## Description

### Objectif

Creer une infrastructure de test robuste et reutilisable pour le monorepo MnM. Cela inclut :

1. **Factories TypeScript** — Fonctions qui generent des donnees de test realistes avec des defaults sensibles et la possibilite de les surcharger (override pattern).
2. **Helpers de test** — Utilitaires de setup/teardown pour les tests d'integration (connexion DB, nettoyage, migrations).
3. **Seed E2E** — Script de seed dedie aux tests Playwright E2E, base sur les factories.
4. **Pattern "Mock LLM, never mock DB"** — Documentation et exemples du pattern fondamental de test chez MnM.

### Ce qui a change depuis l'ecriture de l'epic

L'epic originale mentionne "Seed E2E Cypress" — le projet utilise **Playwright** (pas Cypress). Les factories doivent cibler Playwright pour les E2E et Vitest pour les tests unitaires/integration.

L'epic mentionne aussi "embedded-postgres pour integration" — le projet dispose deja de `docker-compose.test.yml` (TECH-02) avec un PostgreSQL isole sur le port 5433. Les tests d'integration utiliseront cette infrastructure Docker plutot qu'embedded-postgres.

### Etat actuel du code

| Fichier | Role | Etat |
|---------|------|------|
| `packages/db/src/seed.ts` | Seed dev avec donnees B2B | Existe (enrichi par TECH-01) |
| `packages/db/src/client.ts` | Client Drizzle + migrations | Existe, exporte `createDb` et `Db` |
| `packages/db/src/schema/index.ts` | Export de 48 tables Drizzle | Existe |
| `server/src/__tests__/health.test.ts` | Test unitaire avec mock DB | Existe — pattern a suivre pour les mocks |
| `server/vitest.config.ts` | Config vitest serveur | Existe, minimaliste |
| `vitest.config.ts` | Config vitest racine (projects) | Existe, liste les projets |
| `playwright.config.ts` | Config Playwright E2E | Existe, API-only, port 3100 |
| `docker-compose.test.yml` | PG test port 5433 + Redis port 6380 | Existe (TECH-02) |
| `e2e/tests/TECH-01.spec.ts` | E2E tests existants | Existe — pattern Playwright a suivre |

**Constats** :
1. **Aucune factory n'existe** — Les tests existants creent des mocks ad-hoc (voir `health.test.ts` avec `createMockDb`).
2. **Le seed existant est pour le dev** — Il utilise des IDs hardcodes (`seed-admin-001`) et `onConflictDoNothing`. Il ne convient pas pour les tests qui doivent creer des donnees isolees a chaque run.
3. **48 tables dans le schema** — Les factories doivent couvrir les entites principales (company, user, agent, project, issue, workflow) et permettre de creer facilement les graphes de dependances (company → membership → agent → issue).
4. **Pattern mock existant** — `health.test.ts` montre un bon pattern de mock pour les tests unitaires : mock du `db` object avec `vi.fn()`. Les factories doivent supporter les deux modes (plain objects pour unit tests, insertion DB pour integration).

---

## Taches d'Implementation

### T1 : Creer le package `packages/test-utils`

Creer un nouveau package dans le monorepo dedie aux utilitaires de test. Ce package est importe par `server`, `packages/db`, et `e2e`.

**Fichiers a creer** :

```
packages/test-utils/
  package.json
  tsconfig.json
  src/
    index.ts              — Export principal
    factories/
      index.ts            — Re-export de toutes les factories
      company.factory.ts  — createTestCompany
      user.factory.ts     — createTestUser
      agent.factory.ts    — createTestAgent
      project.factory.ts  — createTestProject
      issue.factory.ts    — createTestIssue
      workflow.factory.ts — createTestWorkflow
      membership.factory.ts — createTestCompanyMembership + createTestProjectMembership
      permission.factory.ts — createTestPermissionGrant
    helpers/
      index.ts            — Re-export
      db-setup.ts         — setupTestDb, teardownTestDb, cleanTestDb
      seed-e2e.ts         — seedE2eScenario
      mock-llm.ts         — createMockLlmProvider, LLM mock utilities
    types.ts              — Types partages pour les factories
```

**`package.json`** :

```json
{
  "name": "@mnm/test-utils",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./factories": "./src/factories/index.ts",
    "./helpers": "./src/helpers/index.ts"
  },
  "dependencies": {
    "@mnm/db": "workspace:*",
    "@mnm/shared": "workspace:*"
  },
  "devDependencies": {
    "vitest": "^3.0.5",
    "typescript": "^5.7.3"
  }
}
```

**`tsconfig.json`** :

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

### T2 : Implementer les types partages pour les factories

**Fichier** : `packages/test-utils/src/types.ts`

```typescript
import type { Db } from "@mnm/db/client";

/**
 * Mode d'execution d'une factory :
 * - "plain" : retourne un objet JS sans insertion en DB (pour tests unitaires)
 * - "db"    : insere en DB et retourne le row insere (pour tests d'integration)
 */
export type FactoryMode = "plain" | "db";

/**
 * Context passe aux factories en mode "db".
 * Contient la connexion DB et optionnellement un companyId par defaut.
 */
export type FactoryContext = {
  db: Db;
  defaultCompanyId?: string;
  defaultUserId?: string;
};

/**
 * Resultat d'une factory. Le type differe selon le mode.
 * En mode "plain" : l'objet brut (pour assertions, mocks).
 * En mode "db"    : le row retourne par Drizzle (avec id genere, timestamps, etc.).
 */
export type FactoryResult<TPlain, TInserted> = {
  plain: TPlain;
  db: TInserted;
};
```

### T3 : Implementer la factory `createTestCompany`

**Fichier** : `packages/test-utils/src/factories/company.factory.ts`

La factory genere un objet `companies` avec des defaults realistes. Chaque appel produit un nom unique via un compteur interne.

```typescript
import { companies } from "@mnm/db/schema";
import type { Db } from "@mnm/db/client";

let companyCounter = 0;

export type TestCompanyOverrides = {
  name?: string;
  description?: string;
  status?: string;
  issuePrefix?: string;
  budgetMonthlyCents?: number;
  tier?: string;
  ssoEnabled?: boolean;
  maxUsers?: number;
  parentCompanyId?: string;
};

/**
 * Genere les donnees pour une company de test.
 * En mode "plain" (pas de `db`), retourne un objet JS brut.
 * En mode "db", insere dans PostgreSQL et retourne le row.
 */
export function buildTestCompany(overrides: TestCompanyOverrides = {}) {
  companyCounter++;
  return {
    name: overrides.name ?? `Test Company ${companyCounter}`,
    description: overrides.description ?? `Auto-generated test company #${companyCounter}`,
    status: overrides.status ?? "active",
    issuePrefix: overrides.issuePrefix ?? `TC${companyCounter}`,
    budgetMonthlyCents: overrides.budgetMonthlyCents ?? 100_000,
    tier: overrides.tier ?? "business",
    ssoEnabled: overrides.ssoEnabled ?? false,
    maxUsers: overrides.maxUsers ?? 50,
    parentCompanyId: overrides.parentCompanyId ?? undefined,
  };
}

export async function createTestCompany(db: Db, overrides: TestCompanyOverrides = {}) {
  const data = buildTestCompany(overrides);
  const [row] = await db.insert(companies).values(data).returning();
  return row!;
}
```

**Design decisions** :
- `buildTestCompany` : retourne un objet brut (mode "plain", pour unit tests)
- `createTestCompany` : insere en DB (mode "db", pour integration tests)
- Le compteur `companyCounter` garantit l'unicite de `issuePrefix` (contrainte unique en DB)
- Les overrides sont optionnels — chaque champ a un default realiste

### T4 : Implementer la factory `createTestUser`

**Fichier** : `packages/test-utils/src/factories/user.factory.ts`

```typescript
import { authUsers } from "@mnm/db/schema";
import type { Db } from "@mnm/db/client";
import { randomUUID } from "node:crypto";

let userCounter = 0;

export type TestUserOverrides = {
  id?: string;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string;
};

export function buildTestUser(overrides: TestUserOverrides = {}) {
  userCounter++;
  const now = new Date();
  return {
    id: overrides.id ?? `test-user-${randomUUID()}`,
    name: overrides.name ?? `Test User ${userCounter}`,
    email: overrides.email ?? `test-user-${userCounter}-${Date.now()}@mnm.test`,
    emailVerified: overrides.emailVerified ?? true,
    image: overrides.image ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createTestUser(db: Db, overrides: TestUserOverrides = {}) {
  const data = buildTestUser(overrides);
  const [row] = await db.insert(authUsers).values(data).returning();
  return row!;
}
```

**Design decisions** :
- `id` utilise `randomUUID()` car `authUsers.id` est `text` (pas UUID auto-genere)
- Email inclut un timestamp pour l'unicite entre les runs
- `emailVerified: true` par defaut — la plupart des tests ne se preoccupent pas de la verification email

### T5 : Implementer la factory `createTestAgent`

**Fichier** : `packages/test-utils/src/factories/agent.factory.ts`

```typescript
import { agents } from "@mnm/db/schema";
import type { Db } from "@mnm/db/client";

let agentCounter = 0;

export type TestAgentOverrides = {
  companyId?: string;
  name?: string;
  role?: string;
  title?: string;
  status?: string;
  reportsTo?: string;
  adapterType?: string;
  adapterConfig?: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
  budgetMonthlyCents?: number;
  isolationMode?: string;
};

export function buildTestAgent(
  companyId: string,
  overrides: TestAgentOverrides = {},
) {
  agentCounter++;
  return {
    companyId: overrides.companyId ?? companyId,
    name: overrides.name ?? `Test Agent ${agentCounter}`,
    role: overrides.role ?? "engineer",
    title: overrides.title ?? `Test Engineer ${agentCounter}`,
    status: overrides.status ?? "idle",
    reportsTo: overrides.reportsTo ?? undefined,
    adapterType: overrides.adapterType ?? "process",
    adapterConfig: overrides.adapterConfig ?? { command: "echo", args: ["test"] },
    runtimeConfig: overrides.runtimeConfig ?? {},
    budgetMonthlyCents: overrides.budgetMonthlyCents ?? 10_000,
    isolationMode: overrides.isolationMode ?? "process",
  };
}

export async function createTestAgent(
  db: Db,
  companyId: string,
  overrides: TestAgentOverrides = {},
) {
  const data = buildTestAgent(companyId, overrides);
  const [row] = await db.insert(agents).values(data).returning();
  return row!;
}
```

**Design decisions** :
- `companyId` est un parametre obligatoire (FK non-nullable)
- L'`adapterConfig` par defaut utilise un simple `echo` — pas de vrai processus
- Le role par defaut est `engineer` (le plus commun dans les tests)

### T6 : Implementer la factory `createTestProject`

**Fichier** : `packages/test-utils/src/factories/project.factory.ts`

```typescript
import { projects } from "@mnm/db/schema";
import type { Db } from "@mnm/db/client";

let projectCounter = 0;

export type TestProjectOverrides = {
  companyId?: string;
  goalId?: string;
  name?: string;
  description?: string;
  status?: string;
  leadAgentId?: string;
  color?: string;
};

export function buildTestProject(
  companyId: string,
  overrides: TestProjectOverrides = {},
) {
  projectCounter++;
  return {
    companyId: overrides.companyId ?? companyId,
    goalId: overrides.goalId ?? undefined,
    name: overrides.name ?? `Test Project ${projectCounter}`,
    description: overrides.description ?? `Auto-generated test project #${projectCounter}`,
    status: overrides.status ?? "in_progress",
    leadAgentId: overrides.leadAgentId ?? undefined,
    color: overrides.color ?? "#4F46E5",
  };
}

export async function createTestProject(
  db: Db,
  companyId: string,
  overrides: TestProjectOverrides = {},
) {
  const data = buildTestProject(companyId, overrides);
  const [row] = await db.insert(projects).values(data).returning();
  return row!;
}
```

### T7 : Implementer la factory `createTestIssue`

**Fichier** : `packages/test-utils/src/factories/issue.factory.ts`

```typescript
import { issues } from "@mnm/db/schema";
import type { Db } from "@mnm/db/client";

let issueCounter = 0;

export type TestIssueOverrides = {
  companyId?: string;
  projectId?: string;
  goalId?: string;
  parentId?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeAgentId?: string;
  assigneeUserId?: string;
  createdByAgentId?: string;
  createdByUserId?: string;
};

export function buildTestIssue(
  companyId: string,
  overrides: TestIssueOverrides = {},
) {
  issueCounter++;
  return {
    companyId: overrides.companyId ?? companyId,
    projectId: overrides.projectId ?? undefined,
    goalId: overrides.goalId ?? undefined,
    parentId: overrides.parentId ?? undefined,
    title: overrides.title ?? `Test Issue ${issueCounter}`,
    description: overrides.description ?? `Auto-generated test issue #${issueCounter}`,
    status: overrides.status ?? "todo",
    priority: overrides.priority ?? "medium",
    assigneeAgentId: overrides.assigneeAgentId ?? undefined,
    assigneeUserId: overrides.assigneeUserId ?? undefined,
    createdByAgentId: overrides.createdByAgentId ?? undefined,
    createdByUserId: overrides.createdByUserId ?? undefined,
  };
}

export async function createTestIssue(
  db: Db,
  companyId: string,
  overrides: TestIssueOverrides = {},
) {
  const data = buildTestIssue(companyId, overrides);
  const [row] = await db.insert(issues).values(data).returning();
  return row!;
}
```

### T8 : Implementer la factory `createTestWorkflow`

**Fichier** : `packages/test-utils/src/factories/workflow.factory.ts`

```typescript
import { workflowTemplates, workflowInstances, stageInstances } from "@mnm/db/schema";
import type { WorkflowStageTemplateDef } from "@mnm/db/schema";
import type { Db } from "@mnm/db/client";

let workflowCounter = 0;

// ── Workflow Template ──────────────────────────────────────────────────────

export type TestWorkflowTemplateOverrides = {
  companyId?: string;
  name?: string;
  description?: string;
  stages?: WorkflowStageTemplateDef[];
  isDefault?: boolean;
  createdFrom?: string;
};

const DEFAULT_STAGES: WorkflowStageTemplateDef[] = [
  { order: 1, name: "Plan", agentRole: "ceo", autoTransition: false, acceptanceCriteria: ["Requirements defined"] },
  { order: 2, name: "Implement", agentRole: "engineer", autoTransition: false, acceptanceCriteria: ["Code written", "Tests pass"] },
  { order: 3, name: "Review", agentRole: "qa", autoTransition: true, acceptanceCriteria: ["QA approved"] },
];

export function buildTestWorkflowTemplate(
  companyId: string,
  overrides: TestWorkflowTemplateOverrides = {},
) {
  workflowCounter++;
  return {
    companyId: overrides.companyId ?? companyId,
    name: overrides.name ?? `Test Workflow ${workflowCounter}`,
    description: overrides.description ?? `Auto-generated test workflow template #${workflowCounter}`,
    stages: overrides.stages ?? DEFAULT_STAGES,
    isDefault: overrides.isDefault ?? false,
    createdFrom: overrides.createdFrom ?? "test",
  };
}

export async function createTestWorkflowTemplate(
  db: Db,
  companyId: string,
  overrides: TestWorkflowTemplateOverrides = {},
) {
  const data = buildTestWorkflowTemplate(companyId, overrides);
  const [row] = await db.insert(workflowTemplates).values(data).returning();
  return row!;
}

// ── Workflow Instance ──────────────────────────────────────────────────────

export type TestWorkflowInstanceOverrides = {
  companyId?: string;
  templateId?: string;
  projectId?: string;
  name?: string;
  description?: string;
  status?: string;
  createdByUserId?: string;
};

export async function createTestWorkflowInstance(
  db: Db,
  companyId: string,
  templateId: string,
  overrides: TestWorkflowInstanceOverrides = {},
) {
  const [row] = await db
    .insert(workflowInstances)
    .values({
      companyId: overrides.companyId ?? companyId,
      templateId: overrides.templateId ?? templateId,
      projectId: overrides.projectId ?? undefined,
      name: overrides.name ?? `Test Workflow Instance ${workflowCounter}`,
      description: overrides.description ?? undefined,
      status: overrides.status ?? "active",
      createdByUserId: overrides.createdByUserId ?? undefined,
    })
    .returning();
  return row!;
}

// ── Convenience: Full Workflow (template + instance + stages) ──────────────

export type FullTestWorkflow = {
  template: Awaited<ReturnType<typeof createTestWorkflowTemplate>>;
  instance: Awaited<ReturnType<typeof createTestWorkflowInstance>>;
};

/**
 * Cree un workflow complet de test : template + instance.
 * Utile pour les tests d'integration qui ont besoin d'un workflow fonctionnel.
 */
export async function createFullTestWorkflow(
  db: Db,
  companyId: string,
  overrides: TestWorkflowTemplateOverrides & TestWorkflowInstanceOverrides = {},
) {
  const template = await createTestWorkflowTemplate(db, companyId, overrides);
  const instance = await createTestWorkflowInstance(db, companyId, template.id, overrides);
  return { template, instance };
}
```

### T9 : Implementer les factories de membership et permission

**Fichier** : `packages/test-utils/src/factories/membership.factory.ts`

```typescript
import { companyMemberships, projectMemberships } from "@mnm/db/schema";
import type { Db } from "@mnm/db/client";

// ── Company Membership ─────────────────────────────────────────────────────

export type TestCompanyMembershipOverrides = {
  companyId?: string;
  principalType?: string;
  principalId?: string;
  status?: string;
  membershipRole?: string;
  businessRole?: string;
};

export async function createTestCompanyMembership(
  db: Db,
  companyId: string,
  principalId: string,
  overrides: TestCompanyMembershipOverrides = {},
) {
  const [row] = await db
    .insert(companyMemberships)
    .values({
      companyId: overrides.companyId ?? companyId,
      principalType: overrides.principalType ?? "user",
      principalId: overrides.principalId ?? principalId,
      status: overrides.status ?? "active",
      membershipRole: overrides.membershipRole ?? "member",
      businessRole: overrides.businessRole ?? "contributor",
    })
    .returning();
  return row!;
}

// ── Project Membership ──────────────────────────────────────────────────────

export type TestProjectMembershipOverrides = {
  companyId?: string;
  userId?: string;
  projectId?: string;
  role?: string;
  grantedBy?: string;
};

export async function createTestProjectMembership(
  db: Db,
  companyId: string,
  userId: string,
  projectId: string,
  overrides: TestProjectMembershipOverrides = {},
) {
  const [row] = await db
    .insert(projectMemberships)
    .values({
      companyId: overrides.companyId ?? companyId,
      userId: overrides.userId ?? userId,
      projectId: overrides.projectId ?? projectId,
      role: overrides.role ?? "contributor",
      grantedBy: overrides.grantedBy ?? undefined,
    })
    .returning();
  return row!;
}
```

**Fichier** : `packages/test-utils/src/factories/permission.factory.ts`

```typescript
import { principalPermissionGrants, instanceUserRoles } from "@mnm/db/schema";
import type { Db } from "@mnm/db/client";

// ── Permission Grant ────────────────────────────────────────────────────────

export type TestPermissionGrantOverrides = {
  companyId?: string;
  principalType?: string;
  principalId?: string;
  permissionKey?: string;
  grantedByUserId?: string;
};

export async function createTestPermissionGrant(
  db: Db,
  companyId: string,
  principalId: string,
  permissionKey: string,
  overrides: TestPermissionGrantOverrides = {},
) {
  const [row] = await db
    .insert(principalPermissionGrants)
    .values({
      companyId: overrides.companyId ?? companyId,
      principalType: overrides.principalType ?? "user",
      principalId: overrides.principalId ?? principalId,
      permissionKey: overrides.permissionKey ?? permissionKey,
      grantedByUserId: overrides.grantedByUserId ?? principalId,
    })
    .returning();
  return row!;
}

/**
 * Accorde toutes les permissions standard a un principal dans une company.
 * Utile pour creer un admin de test rapidement.
 */
export async function grantAllTestPermissions(
  db: Db,
  companyId: string,
  principalId: string,
) {
  const permissions = [
    "company:manage",
    "agents:manage",
    "projects:manage",
    "issues:manage",
    "members:manage",
  ];
  const grants = [];
  for (const perm of permissions) {
    const grant = await createTestPermissionGrant(db, companyId, principalId, perm);
    grants.push(grant);
  }
  return grants;
}

// ── Instance Role ───────────────────────────────────────────────────────────

export async function createTestInstanceRole(
  db: Db,
  userId: string,
  role: string = "instance_admin",
) {
  const [row] = await db
    .insert(instanceUserRoles)
    .values({ userId, role })
    .returning();
  return row!;
}
```

### T10 : Implementer les helpers de setup/teardown DB

**Fichier** : `packages/test-utils/src/helpers/db-setup.ts`

Ce module fournit des fonctions pour connecter, migrer et nettoyer une base de test PostgreSQL. Il est utilise dans les `beforeAll` / `afterAll` des tests d'integration Vitest.

```typescript
import { createDb, applyPendingMigrations } from "@mnm/db/client";
import type { Db } from "@mnm/db/client";
import { sql } from "drizzle-orm";

/**
 * URL par defaut pour les tests d'integration.
 * Pointe vers le PostgreSQL de docker-compose.test.yml (port 5433).
 */
const DEFAULT_TEST_DATABASE_URL =
  "postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test";

export type TestDbContext = {
  db: Db;
  databaseUrl: string;
};

/**
 * Initialise une connexion DB de test.
 * - Se connecte a PostgreSQL (docker-compose.test.yml ou env var)
 * - Execute les migrations Drizzle
 * - Retourne le context DB pour les factories
 *
 * Usage dans un test Vitest :
 * ```ts
 * let ctx: TestDbContext;
 * beforeAll(async () => { ctx = await setupTestDb(); });
 * afterAll(async () => { await teardownTestDb(ctx); });
 * beforeEach(async () => { await cleanTestDb(ctx); });
 * ```
 */
export async function setupTestDb(
  databaseUrl?: string,
): Promise<TestDbContext> {
  const url = databaseUrl ?? process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  await applyPendingMigrations(url);
  const db = createDb(url);
  return { db, databaseUrl: url };
}

/**
 * Ferme la connexion DB de test.
 * Appeler dans afterAll().
 */
export async function teardownTestDb(_ctx: TestDbContext): Promise<void> {
  // Le driver postgres-js ferme automatiquement les connexions
  // quand le process se termine. Pour un nettoyage explicite,
  // on pourrait stocker la reference `sql` du driver, mais
  // Vitest kill le process apres chaque fichier de test.
  // Pas de cleanup explicite necessaire pour l'instant.
}

/**
 * Nettoie toutes les tables de test (TRUNCATE CASCADE).
 * Appeler dans beforeEach() pour isoler les tests.
 *
 * IMPORTANT : Cette fonction TRUNCATE toutes les tables applicatives.
 * Elle ne touche PAS aux tables de migration Drizzle.
 */
export async function cleanTestDb(ctx: TestDbContext): Promise<void> {
  // Les tables sont listees dans l'ordre inverse des dependances FK
  // pour eviter les erreurs de contraintes (TRUNCATE CASCADE resout ca aussi).
  const tables = [
    "stage_instances",
    "workflow_instances",
    "workflow_templates",
    "issue_attachments",
    "issue_comments",
    "issue_approvals",
    "issue_read_states",
    "issue_labels",
    "issues",
    "labels",
    "cost_events",
    "heartbeat_run_events",
    "heartbeat_runs",
    "approval_comments",
    "approvals",
    "activity_log",
    "agent_task_sessions",
    "agent_wakeup_requests",
    "agent_runtime_state",
    "agent_api_keys",
    "agent_config_revisions",
    "project_workspaces",
    "project_goals",
    "project_memberships",
    "projects",
    "goals",
    "agents",
    "principal_permission_grants",
    "company_memberships",
    "company_secret_versions",
    "company_secrets",
    "invites",
    "join_requests",
    "inbox_dismissals",
    "automation_cursors",
    "chat_messages",
    "chat_channels",
    "credential_proxy_rules",
    "container_instances",
    "container_profiles",
    "audit_events",
    "sso_configurations",
    "import_jobs",
    "assets",
    "companies",
    "instance_user_roles",
    "session",
    "account",
    "verification",
    "user",
  ];

  await ctx.db.execute(
    sql.raw(`TRUNCATE TABLE ${tables.map((t) => `"${t}"`).join(", ")} CASCADE`),
  );
}
```

**Design decisions** :
- `TRUNCATE CASCADE` est plus rapide que `DELETE` pour les tests
- La liste des tables est explicite plutot qu'une requete `information_schema` — c'est plus previsible et evite de truncate les tables de migration
- `setupTestDb` execute les migrations automatiquement — les tests n'ont pas a s'en soucier
- L'URL par defaut pointe vers `docker-compose.test.yml` (port 5433) — pas de conflit avec le dev

### T11 : Implementer le seed E2E

**Fichier** : `packages/test-utils/src/helpers/seed-e2e.ts`

Ce script cree un scenario complet pour les tests Playwright E2E. Il est distinct du seed de dev (`packages/db/src/seed.ts`).

```typescript
import type { Db } from "@mnm/db/client";
import { createTestCompany } from "../factories/company.factory.js";
import { createTestUser } from "../factories/user.factory.js";
import { createTestAgent } from "../factories/agent.factory.js";
import { createTestProject } from "../factories/project.factory.js";
import { createTestIssue } from "../factories/issue.factory.js";
import { createTestCompanyMembership } from "../factories/membership.factory.js";
import { grantAllTestPermissions, createTestInstanceRole } from "../factories/permission.factory.js";

export type E2eScenarioData = {
  admin: Awaited<ReturnType<typeof createTestUser>>;
  company: Awaited<ReturnType<typeof createTestCompany>>;
  ceo: Awaited<ReturnType<typeof createTestAgent>>;
  cto: Awaited<ReturnType<typeof createTestAgent>>;
  engineer: Awaited<ReturnType<typeof createTestAgent>>;
  qa: Awaited<ReturnType<typeof createTestAgent>>;
  project: Awaited<ReturnType<typeof createTestProject>>;
  issues: Awaited<ReturnType<typeof createTestIssue>>[];
};

/**
 * Cree un scenario E2E complet avec toutes les entites necessaires.
 *
 * Hierarchy :
 *   admin user (instance_admin)
 *     → company (owner membership + all permissions)
 *       → CEO agent
 *         → CTO agent (reports to CEO)
 *           → Engineer agent (reports to CTO)
 *           → QA agent (reports to CTO)
 *       → Project (lead: CEO)
 *         → 3 issues (assigned to engineer, qa, unassigned)
 */
export async function seedE2eScenario(db: Db): Promise<E2eScenarioData> {
  // ── Admin user ──────────────────────────────────────────────
  const admin = await createTestUser(db, {
    id: "e2e-admin-001",
    name: "E2E Admin",
    email: "e2e-admin@mnm.test",
  });
  await createTestInstanceRole(db, admin.id, "instance_admin");

  // ── Company ─────────────────────────────────────────────────
  const company = await createTestCompany(db, {
    name: "E2E Test Corp",
    issuePrefix: "E2E",
    budgetMonthlyCents: 500_000,
  });

  // ── Membership + permissions ────────────────────────────────
  await createTestCompanyMembership(db, company.id, admin.id, {
    membershipRole: "owner",
  });
  await grantAllTestPermissions(db, company.id, admin.id);

  // ── Agent hierarchy ─────────────────────────────────────────
  const ceo = await createTestAgent(db, company.id, {
    name: "CEO Agent",
    role: "ceo",
    title: "Chief Executive Officer",
    budgetMonthlyCents: 150_000,
  });
  const cto = await createTestAgent(db, company.id, {
    name: "CTO Agent",
    role: "cto",
    title: "Chief Technology Officer",
    reportsTo: ceo.id,
    budgetMonthlyCents: 120_000,
  });
  const engineer = await createTestAgent(db, company.id, {
    name: "Engineer Agent",
    role: "engineer",
    title: "Software Engineer",
    reportsTo: cto.id,
    budgetMonthlyCents: 100_000,
  });
  const qa = await createTestAgent(db, company.id, {
    name: "QA Agent",
    role: "qa",
    title: "Quality Assurance",
    reportsTo: cto.id,
    budgetMonthlyCents: 80_000,
  });

  // ── Project ─────────────────────────────────────────────────
  const project = await createTestProject(db, company.id, {
    name: "E2E Test Project",
    leadAgentId: ceo.id,
  });

  // ── Issues ──────────────────────────────────────────────────
  const issue1 = await createTestIssue(db, company.id, {
    projectId: project.id,
    title: "Implement feature X",
    status: "todo",
    priority: "high",
    assigneeAgentId: engineer.id,
    createdByAgentId: ceo.id,
  });
  const issue2 = await createTestIssue(db, company.id, {
    projectId: project.id,
    title: "Write tests for feature X",
    status: "todo",
    priority: "high",
    assigneeAgentId: qa.id,
    createdByAgentId: cto.id,
  });
  const issue3 = await createTestIssue(db, company.id, {
    projectId: project.id,
    title: "Design review",
    status: "backlog",
    priority: "medium",
    createdByAgentId: ceo.id,
  });

  return {
    admin,
    company,
    ceo,
    cto,
    engineer,
    qa,
    project,
    issues: [issue1, issue2, issue3],
  };
}
```

### T12 : Implementer les utilitaires de mock LLM

**Fichier** : `packages/test-utils/src/helpers/mock-llm.ts`

Ce module documente et implemente le pattern "Mock LLM providers, NEVER mock the DB".

```typescript
import { vi } from "vitest";

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  PATTERN FONDAMENTAL : Mock LLM providers, NEVER mock the DB          │
 * │                                                                        │
 * │  Pourquoi :                                                            │
 * │  - Les LLM sont non-deterministes, couteux et lents                    │
 * │  - La DB est la source de verite — la mocker cache les vrais bugs     │
 * │  - Les tests d'integration DOIVENT tester les vraies requetes SQL      │
 * │  - Les factories inserent de vraies donnees dans PostgreSQL            │
 * │                                                                        │
 * │  ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
 * │  │  Test    │───>│  Code    │───>│  Real DB │  ← TOUJOURS reel         │
 * │  │          │    │  Under   │    │ (PG test)│                          │
 * │  │          │    │  Test    │    └──────────┘                          │
 * │  │          │    │          │───>│  Mock LLM│  ← TOUJOURS mocke       │
 * │  └──────────┘    └──────────┘    └──────────┘                          │
 * │                                                                        │
 * │  Exception : Les tests unitaires de composants UI purs peuvent        │
 * │  utiliser des mocks DB legers (voir health.test.ts).                   │
 * │  Mais les tests de services/routes doivent TOUJOURS utiliser           │
 * │  la vraie DB via les factories.                                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Response type for mocked LLM completions.
 */
export type MockLlmResponse = {
  content: string;
  model?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason?: string;
};

/**
 * Cree un mock de provider LLM pour les tests.
 *
 * Usage :
 * ```ts
 * const llm = createMockLlmProvider({
 *   responses: [
 *     { content: "Analyzing drift..." },
 *     { content: "No drift detected." },
 *   ],
 * });
 *
 * // Injecter dans le service
 * const driftService = new DriftService({ llmProvider: llm });
 *
 * // Le service utilise les reponses predefinies
 * const result = await driftService.analyzeDrift(file);
 * expect(result.hasDrift).toBe(false);
 *
 * // Verifier que le LLM a ete appele
 * expect(llm.complete).toHaveBeenCalledTimes(2);
 * ```
 */
export function createMockLlmProvider(config: {
  responses?: MockLlmResponse[];
  shouldError?: Error;
} = {}) {
  const { responses = [{ content: "mock response" }], shouldError } = config;
  let callIndex = 0;

  return {
    complete: vi.fn().mockImplementation(async () => {
      if (shouldError) throw shouldError;
      const response = responses[callIndex % responses.length];
      callIndex++;
      return {
        content: response?.content ?? "mock response",
        model: response?.model ?? "mock-model",
        usage: response?.usage ?? { inputTokens: 100, outputTokens: 50 },
        stopReason: response?.stopReason ?? "end_turn",
      };
    }),

    stream: vi.fn().mockImplementation(async function* () {
      if (shouldError) throw shouldError;
      const response = responses[callIndex % responses.length];
      callIndex++;
      yield { type: "text", text: response?.content ?? "mock response" };
    }),

    /** Reset le compteur de reponses et les mocks */
    reset: () => {
      callIndex = 0;
    },
  };
}

/**
 * Cree un mock de provider LLM qui echoue systematiquement.
 * Utile pour tester le comportement de degradation gracieuse.
 */
export function createFailingLlmProvider(error?: Error) {
  return createMockLlmProvider({
    shouldError: error ?? new Error("LLM provider unavailable"),
  });
}
```

### T13 : Creer le scenario de test compose ("happy path")

**Fichier** : `packages/test-utils/src/factories/scenario.factory.ts`

Ce module fournit un one-liner pour creer un graphe complet d'entites de test.

```typescript
import type { Db } from "@mnm/db/client";
import { createTestCompany } from "./company.factory.js";
import { createTestUser } from "./user.factory.js";
import { createTestAgent } from "./agent.factory.js";
import { createTestProject } from "./project.factory.js";
import { createTestCompanyMembership } from "./membership.factory.js";
import { grantAllTestPermissions, createTestInstanceRole } from "./permission.factory.js";

/**
 * Cree un scenario de test minimal mais complet :
 * - 1 user (instance_admin)
 * - 1 company (avec membership owner)
 * - 1 agent (engineer)
 * - 1 project
 * - Toutes les permissions
 *
 * Usage :
 * ```ts
 * const { user, company, agent, project } = await createTestScenario(db);
 * ```
 */
export async function createTestScenario(db: Db) {
  const user = await createTestUser(db);
  await createTestInstanceRole(db, user.id);

  const company = await createTestCompany(db);
  await createTestCompanyMembership(db, company.id, user.id, {
    membershipRole: "owner",
  });
  await grantAllTestPermissions(db, company.id, user.id);

  const agent = await createTestAgent(db, company.id);
  const project = await createTestProject(db, company.id, {
    leadAgentId: agent.id,
  });

  return { user, company, agent, project };
}

/**
 * Cree un scenario multi-company pour les tests d'isolation :
 * - 2 users dans 2 companies differentes
 * - Verifie que les donnees ne fuitent pas entre companies
 *
 * Usage :
 * ```ts
 * const { companyA, companyB, userA, userB } = await createIsolationScenario(db);
 * // userA ne doit PAS voir les donnees de companyB
 * ```
 */
export async function createIsolationScenario(db: Db) {
  const userA = await createTestUser(db, { name: "User A" });
  const companyA = await createTestCompany(db, { name: "Company A", issuePrefix: "ISOA" });
  await createTestCompanyMembership(db, companyA.id, userA.id, { membershipRole: "owner" });
  await grantAllTestPermissions(db, companyA.id, userA.id);

  const userB = await createTestUser(db, { name: "User B" });
  const companyB = await createTestCompany(db, { name: "Company B", issuePrefix: "ISOB" });
  await createTestCompanyMembership(db, companyB.id, userB.id, { membershipRole: "owner" });
  await grantAllTestPermissions(db, companyB.id, userB.id);

  return { userA, companyA, userB, companyB };
}
```

### T14 : Exporter tout depuis `index.ts`

**Fichier** : `packages/test-utils/src/index.ts`

```typescript
export * from "./factories/index.js";
export * from "./helpers/index.js";
export type * from "./types.js";
```

**Fichier** : `packages/test-utils/src/factories/index.ts`

```typescript
export { buildTestCompany, createTestCompany, type TestCompanyOverrides } from "./company.factory.js";
export { buildTestUser, createTestUser, type TestUserOverrides } from "./user.factory.js";
export { buildTestAgent, createTestAgent, type TestAgentOverrides } from "./agent.factory.js";
export { buildTestProject, createTestProject, type TestProjectOverrides } from "./project.factory.js";
export { buildTestIssue, createTestIssue, type TestIssueOverrides } from "./issue.factory.js";
export {
  buildTestWorkflowTemplate,
  createTestWorkflowTemplate,
  createTestWorkflowInstance,
  createFullTestWorkflow,
  type TestWorkflowTemplateOverrides,
  type TestWorkflowInstanceOverrides,
} from "./workflow.factory.js";
export {
  createTestCompanyMembership,
  createTestProjectMembership,
  type TestCompanyMembershipOverrides,
  type TestProjectMembershipOverrides,
} from "./membership.factory.js";
export {
  createTestPermissionGrant,
  grantAllTestPermissions,
  createTestInstanceRole,
  type TestPermissionGrantOverrides,
} from "./permission.factory.js";
export { createTestScenario, createIsolationScenario } from "./scenario.factory.js";
```

**Fichier** : `packages/test-utils/src/helpers/index.ts`

```typescript
export {
  setupTestDb,
  teardownTestDb,
  cleanTestDb,
  type TestDbContext,
} from "./db-setup.js";
export { seedE2eScenario, type E2eScenarioData } from "./seed-e2e.js";
export {
  createMockLlmProvider,
  createFailingLlmProvider,
  type MockLlmResponse,
} from "./mock-llm.js";
```

### T15 : Ajouter le package au workspace pnpm et a la config vitest

**Fichier** : `pnpm-workspace.yaml` — ajouter `packages/test-utils` s'il n'est pas deja couvert par un glob `packages/*`.

**Fichier** : `vitest.config.ts` (racine) — ajouter `packages/test-utils` aux projets :

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/db",
      "packages/adapters/opencode-local",
      "packages/test-utils",
      "server",
      "ui",
      "cli",
    ],
  },
});
```

### T16 : Ecrire des tests unitaires pour les factories elles-memes

**Fichier** : `packages/test-utils/src/__tests__/factories.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  buildTestCompany,
  buildTestUser,
  buildTestAgent,
  buildTestProject,
  buildTestIssue,
  buildTestWorkflowTemplate,
} from "../factories/index.js";

describe("buildTestCompany", () => {
  it("generates unique names and issuePrefixes", () => {
    const a = buildTestCompany();
    const b = buildTestCompany();
    expect(a.name).not.toBe(b.name);
    expect(a.issuePrefix).not.toBe(b.issuePrefix);
  });

  it("accepts overrides", () => {
    const c = buildTestCompany({ name: "Custom", tier: "enterprise" });
    expect(c.name).toBe("Custom");
    expect(c.tier).toBe("enterprise");
  });

  it("has sensible defaults", () => {
    const c = buildTestCompany();
    expect(c.status).toBe("active");
    expect(c.budgetMonthlyCents).toBe(100_000);
    expect(c.ssoEnabled).toBe(false);
  });
});

describe("buildTestUser", () => {
  it("generates unique emails", () => {
    const a = buildTestUser();
    const b = buildTestUser();
    expect(a.email).not.toBe(b.email);
    expect(a.id).not.toBe(b.id);
  });

  it("defaults to emailVerified: true", () => {
    const u = buildTestUser();
    expect(u.emailVerified).toBe(true);
  });
});

describe("buildTestAgent", () => {
  it("requires companyId", () => {
    const a = buildTestAgent("company-123");
    expect(a.companyId).toBe("company-123");
    expect(a.role).toBe("engineer");
    expect(a.adapterType).toBe("process");
  });

  it("accepts role override", () => {
    const a = buildTestAgent("company-123", { role: "ceo", title: "CEO" });
    expect(a.role).toBe("ceo");
    expect(a.title).toBe("CEO");
  });
});

describe("buildTestProject", () => {
  it("requires companyId", () => {
    const p = buildTestProject("company-123");
    expect(p.companyId).toBe("company-123");
    expect(p.status).toBe("in_progress");
  });
});

describe("buildTestIssue", () => {
  it("requires companyId", () => {
    const i = buildTestIssue("company-123");
    expect(i.companyId).toBe("company-123");
    expect(i.status).toBe("todo");
    expect(i.priority).toBe("medium");
  });
});

describe("buildTestWorkflowTemplate", () => {
  it("generates default stages", () => {
    const w = buildTestWorkflowTemplate("company-123");
    expect(w.stages).toHaveLength(3);
    expect(w.stages[0].name).toBe("Plan");
    expect(w.stages[1].name).toBe("Implement");
    expect(w.stages[2].name).toBe("Review");
  });
});
```

### T17 : Creer un script executable pour le seed E2E

**Fichier** : `packages/test-utils/src/seed-e2e-runner.ts`

Script executable via `tsx` pour seeder la DB de test avant les runs Playwright.

```typescript
import { createDb } from "@mnm/db/client";
import { seedE2eScenario } from "./helpers/seed-e2e.js";
import { cleanTestDb, setupTestDb } from "./helpers/db-setup.js";

const url = process.env.TEST_DATABASE_URL
  ?? process.env.DATABASE_URL
  ?? "postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test";

console.log("Setting up E2E test database...");
const ctx = await setupTestDb(url);

console.log("Cleaning existing data...");
await cleanTestDb(ctx);

console.log("Seeding E2E scenario...");
const data = await seedE2eScenario(ctx.db);

console.log("E2E seed complete:");
console.log(`  Admin:    ${data.admin.email} (${data.admin.id})`);
console.log(`  Company:  ${data.company.name} (${data.company.id})`);
console.log(`  Agents:   CEO, CTO, Engineer, QA`);
console.log(`  Project:  ${data.project.name}`);
console.log(`  Issues:   ${data.issues.length} issues`);

process.exit(0);
```

**Script npm** dans `package.json` racine :
```json
{
  "scripts": {
    "test:seed": "tsx packages/test-utils/src/seed-e2e-runner.ts"
  }
}
```

---

## Acceptance Criteria

### AC-1 : Factories generent des donnees realistes en mode "plain"
```
Given les fonctions build* (buildTestCompany, buildTestUser, buildTestAgent, etc.)
When un test unitaire appelle buildTestCompany()
Then un objet JS est retourne avec des defaults realistes
  And chaque appel successif produit des valeurs uniques (name, email, issuePrefix)
  And aucune connexion DB n'est necessaire
  And les overrides sont appliques quand fournis
```

### AC-2 : Factories inserent en DB en mode "db"
```
Given les fonctions create* (createTestCompany, createTestUser, createTestAgent, etc.)
  And une connexion DB de test active (docker-compose.test.yml)
When un test d'integration appelle createTestCompany(db)
Then un row est insere dans la table companies
  And le row retourne contient un id UUID genere
  And les timestamps createdAt/updatedAt sont remplis
  And les overrides sont appliques quand fournis
```

### AC-3 : Setup/teardown DB fonctionnel
```
Given docker-compose.test.yml actif (port 5433)
When un test appelle setupTestDb()
Then les migrations sont appliquees automatiquement
  And un context TestDbContext est retourne avec la connexion DB
When un test appelle cleanTestDb(ctx)
Then toutes les tables applicatives sont videes (TRUNCATE CASCADE)
  And les tables de migration Drizzle ne sont PAS touchees
```

### AC-4 : Seed E2E cree un scenario complet
```
Given une DB de test vide (apres cleanTestDb)
When seedE2eScenario(db) est appele
Then un admin user est cree avec role instance_admin
  And une company est creee avec membership owner
  And 4 agents sont crees avec une hierarchie (CEO → CTO → Engineer/QA)
  And un project est cree avec lead agent
  And 3 issues sont creees avec des assignees differents
  And toutes les permissions sont accordees a l'admin
```

### AC-5 : Mock LLM providers disponible
```
Given les fonctions createMockLlmProvider et createFailingLlmProvider
When un test cree un mock LLM avec des reponses predefinies
Then le mock retourne les reponses dans l'ordre
  And le mock trace les appels (toHaveBeenCalledTimes)
  And createFailingLlmProvider rejette systematiquement
```

### AC-6 : Scenarios composes fonctionnels
```
Given la fonction createTestScenario(db)
When un test d'integration l'appelle
Then un graphe complet (user + company + agent + project) est cree en un seul appel
  And toutes les FK sont coherentes
  And toutes les permissions sont en place
```

### AC-7 : Tests unitaires des factories passent
```
Given les tests dans packages/test-utils/src/__tests__/factories.test.ts
When pnpm test:run est execute
Then tous les tests de factories passent
  And les build* fonctions generent des valeurs uniques
  And les overrides sont correctement appliques
```

### AC-8 : Package installe dans le workspace
```
Given le package @mnm/test-utils dans packages/test-utils/
When pnpm install est execute
Then le package est resolu dans le workspace
  And les autres packages peuvent l'importer via "@mnm/test-utils"
  And TypeScript resout les types correctement
```

---

## data-test-id

**N/A** — Cette story est infrastructure-only. Aucun composant UI n'est ajoute ou modifie.

Les elements verifiables sont des modules TypeScript et des scripts CLI :

| Element | Verification |
|---------|-------------|
| `buildTestCompany()` | Test unitaire : retourne objet avec defaults |
| `createTestCompany(db)` | Test integration : insere en DB |
| `buildTestUser()` | Test unitaire : email unique |
| `createTestUser(db)` | Test integration : insere en DB |
| `buildTestAgent(companyId)` | Test unitaire : companyId requis |
| `createTestAgent(db, companyId)` | Test integration : insere en DB |
| `buildTestProject(companyId)` | Test unitaire : defaults |
| `createTestProject(db, companyId)` | Test integration : insere en DB |
| `buildTestIssue(companyId)` | Test unitaire : defaults |
| `createTestIssue(db, companyId)` | Test integration : insere en DB |
| `buildTestWorkflowTemplate(companyId)` | Test unitaire : 3 stages par defaut |
| `createTestWorkflowTemplate(db, companyId)` | Test integration : insere en DB |
| `createFullTestWorkflow(db, companyId)` | Test integration : template + instance |
| `setupTestDb()` | Test integration : connexion + migrations |
| `cleanTestDb(ctx)` | Test integration : TRUNCATE CASCADE |
| `seedE2eScenario(db)` | Test integration : scenario complet |
| `createMockLlmProvider()` | Test unitaire : mock fonctionnel |
| `createTestScenario(db)` | Test integration : graphe complet |
| `createIsolationScenario(db)` | Test integration : 2 companies isolees |
| `pnpm test:seed` | Script CLI : seed E2E executable |

---

## Notes Techniques d'Implementation

### Pattern "build" vs "create"

Chaque entite a deux fonctions :

| Fonction | Mode | Usage | Connexion DB |
|----------|------|-------|-------------|
| `buildTestX()` | plain | Tests unitaires, assertions, mocks | Non |
| `createTestX(db)` | db | Tests d'integration, E2E seed | Oui |

`buildTestX` retourne un objet brut qui correspond aux colonnes de la table Drizzle. Il peut etre utilise pour :
- Creer des mocks dans les tests unitaires
- Generer des donnees de reference pour les assertions
- Passer en parametre a un service sans toucher la DB

`createTestX` appelle `buildTestX` en interne, puis insere via `db.insert().values().returning()`.

### Compteurs atomiques vs UUID

Les factories utilisent des compteurs incrementaux (`companyCounter++`, `userCounter++`) pour generer des noms uniques. Cela est plus lisible dans les logs de test que des UUID aleatoires :
- `Test Company 1`, `Test Company 2` vs `Test Company a7f3b2c1-...`
- `test-user-1@mnm.test` vs `test-user-a7f3b2c1@mnm.test`

Les IDs reels sont generes par PostgreSQL (`defaultRandom()` pour UUID, ou `text` pour users).

### TRUNCATE vs DELETE pour le cleanup

`cleanTestDb` utilise `TRUNCATE TABLE ... CASCADE` plutot que `DELETE FROM` :
- **Performance** : TRUNCATE ne genere pas de WAL entries pour chaque row
- **Completeness** : CASCADE reset aussi les sequences (auto-increment)
- **Simplicite** : Une seule requete vs N requetes DELETE

Le trade-off est que TRUNCATE acquiert un `ACCESS EXCLUSIVE` lock, ce qui bloque les lectures concurrentes. C'est acceptable pour les tests car chaque test file a sa propre DB logique (grace au cleanup en `beforeEach`).

### Integration avec Playwright pour E2E

Les tests Playwright E2E ne peuvent pas importer `@mnm/test-utils` directement (ils tournent dans un process Playwright separe). Le pattern est :

1. **Avant le run** : `pnpm test:seed` execute le seed via `tsx`
2. **Pendant le run** : Playwright teste l'API HTTP/UI avec les donnees seedees
3. **IDs deterministes** : Le seed E2E utilise des IDs fixes (`e2e-admin-001`) pour que les tests puissent les referencer

Alternative : Creer un endpoint API `/api/test/seed` (gate par `NODE_ENV=test`) que Playwright appelle dans un `globalSetup`. A evaluer avec l'equipe.

### Mock LLM — Injection de dependance

Le `createMockLlmProvider` retourne un objet avec les methodes `complete` et `stream`. Les services qui utilisent un LLM doivent accepter un provider en parametre (injection de dependance) :

```typescript
// Service
class DriftService {
  constructor(private llm: LlmProvider) {}
  async analyze(file: string) {
    const result = await this.llm.complete({ prompt: `Analyze ${file}` });
    return result;
  }
}

// Test
const llm = createMockLlmProvider({ responses: [{ content: "no drift" }] });
const service = new DriftService(llm);
```

Si un service utilise un LLM global (import direct), il faudra utiliser `vi.mock()` pour remplacer le module. Le mock factory est concu pour les deux patterns.

---

## Edge Cases et Scenarios d'Erreur

### E1 : Compteur non-reset entre les fichiers de test
```
Given les compteurs globaux (companyCounter, userCounter, etc.)
When deux fichiers de test s'executent en sequence dans le meme process
Then les compteurs continuent d'incrementer
  And les noms/emails restent uniques
  And ce n'est PAS un bug — c'est voulu pour eviter les collisions
```

### E2 : issuePrefix collision en DB
```
Given buildTestCompany() qui genere issuePrefix: "TC1", "TC2", etc.
When deux tests creent des companies sans cleanup entre les deux
Then le deuxieme insert peut echouer si "TC1" existe deja (unique constraint)
  And la solution est d'appeler cleanTestDb() dans beforeEach()
  And l'override explicite de issuePrefix resout aussi le probleme
```

### E3 : docker-compose.test.yml non demarre
```
Given les tests d'integration qui appellent setupTestDb()
When PostgreSQL n'est pas accessible sur le port 5433
Then setupTestDb() echoue avec une erreur de connexion
  And le message d'erreur est clair : "Connection refused on port 5433"
  And la solution est documentee : "pnpm test:docker:up"
```

### E4 : Migration echoue dans setupTestDb
```
Given une migration avec un breaking change
When setupTestDb() tente d'appliquer les migrations
Then applyPendingMigrations() echoue
  And l'erreur SQL est propagee au test
  And le developpeur doit resoudre le conflit de migration
```

### E5 : Factory appelee sans companyId
```
Given createTestAgent(db, companyId) ou companyId est undefined
When la factory tente d'inserer en DB
Then l'insertion echoue (FK non-nullable sur company_id)
  And TypeScript previent ce cas a la compilation (parametre requis)
```

### E6 : Cleanup partiel (certaines tables manquantes)
```
Given cleanTestDb() avec une liste de tables hard-codee
When une nouvelle table est ajoutee au schema
  And elle n'est pas ajoutee a la liste cleanTestDb()
Then des donnees residuelles peuvent rester apres cleanup
  And la solution est d'ajouter la table a la liste dans cleanTestDb()
  And un test de validation peut verifier que toutes les tables sont couvertes
```

---

## Dependances Sortantes (ce que TECH-03 debloque)

| Story | Raison |
|-------|--------|
| Tous les tests E2E | Les factories fournissent les donnees de test |
| RBAC-S01 | Tests de hasPermission necessitent des users/companies/permissions de test |
| RBAC-S02 | Tests des 9 permission keys |
| RBAC-S04 | Tests d'enforcement sur 22 routes |
| MU-S01 | Tests d'invitations email |
| MU-S02 | Tests de la page membres |
| ORCH-S01 | Tests de la state machine XState |
| OBS-S01 | Tests des audit events |

---

## Fichiers Impactes (Resume)

| Fichier | Action | Tache |
|---------|--------|-------|
| `packages/test-utils/package.json` | Creer | T1 |
| `packages/test-utils/tsconfig.json` | Creer | T1 |
| `packages/test-utils/src/types.ts` | Creer | T2 |
| `packages/test-utils/src/factories/company.factory.ts` | Creer | T3 |
| `packages/test-utils/src/factories/user.factory.ts` | Creer | T4 |
| `packages/test-utils/src/factories/agent.factory.ts` | Creer | T5 |
| `packages/test-utils/src/factories/project.factory.ts` | Creer | T6 |
| `packages/test-utils/src/factories/issue.factory.ts` | Creer | T7 |
| `packages/test-utils/src/factories/workflow.factory.ts` | Creer | T8 |
| `packages/test-utils/src/factories/membership.factory.ts` | Creer | T9 |
| `packages/test-utils/src/factories/permission.factory.ts` | Creer | T9 |
| `packages/test-utils/src/factories/scenario.factory.ts` | Creer | T13 |
| `packages/test-utils/src/factories/index.ts` | Creer | T14 |
| `packages/test-utils/src/helpers/db-setup.ts` | Creer | T10 |
| `packages/test-utils/src/helpers/seed-e2e.ts` | Creer | T11 |
| `packages/test-utils/src/helpers/mock-llm.ts` | Creer | T12 |
| `packages/test-utils/src/helpers/index.ts` | Creer | T14 |
| `packages/test-utils/src/index.ts` | Creer | T14 |
| `packages/test-utils/src/__tests__/factories.test.ts` | Creer | T16 |
| `packages/test-utils/src/seed-e2e-runner.ts` | Creer | T17 |
| `vitest.config.ts` | Modifier | T15 — Ajouter packages/test-utils |
| `package.json` | Modifier | T17 — Ajouter script test:seed |

---

## Criteres de Definition of Done

- [ ] Package `@mnm/test-utils` cree dans `packages/test-utils/` avec `package.json` et `tsconfig.json`
- [ ] 8 factories implementees : company, user, agent, project, issue, workflow (template + instance), membership (company + project), permission
- [ ] Chaque factory a une version `build*` (plain) et `create*` (DB)
- [ ] Chaque `build*` genere des valeurs uniques entre appels successifs
- [ ] Chaque `create*` insere en DB et retourne le row avec `.returning()`
- [ ] `setupTestDb()` se connecte, applique les migrations, retourne un context
- [ ] `cleanTestDb()` fait TRUNCATE CASCADE sur toutes les tables applicatives
- [ ] `seedE2eScenario()` cree un scenario complet (admin + company + agents + project + issues)
- [ ] `createMockLlmProvider()` genere un mock LLM fonctionnel avec `vi.fn()`
- [ ] `createTestScenario()` cree un graphe minimal en un seul appel
- [ ] `createIsolationScenario()` cree 2 companies isolees pour tester le multi-tenant
- [ ] Tests unitaires des factories passent (`pnpm test:run`)
- [ ] Le pattern "Mock LLM, never mock DB" est documente dans `mock-llm.ts`
- [ ] Script `pnpm test:seed` executable pour le seed E2E
- [ ] `vitest.config.ts` racine inclut `packages/test-utils`
- [ ] `pnpm install` resout `@mnm/test-utils` dans le workspace
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
