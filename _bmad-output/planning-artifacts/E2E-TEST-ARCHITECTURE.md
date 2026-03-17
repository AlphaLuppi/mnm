# E2E Test Architecture -- MnM

> **Date**: 2026-03-17
> **Auteur**: QA Architect
> **Statut**: Approuve

---

## 1. Overview

| Propriete          | Valeur                                     |
|--------------------|--------------------------------------------|
| Framework          | Playwright 1.58+                           |
| Lanceur            | `pnpm test:e2e`                            |
| Video capture      | Activee sur chaque test                    |
| Screenshot         | Sur echec uniquement                       |
| Reporter           | HTML + List console                        |
| Seed system        | HTTP API via Better Auth + e2e-seed route  |
| Cleanup            | Truncate test data via API teardown        |
| Auth strategy      | Programmatic login, stored auth state/role |
| Isolation           | Chaque role = contexte stocke separe       |
| Parallel execution | Activee (fullyParallel: true)              |

### Architecture Principles

1. **API-first seeding**: Seed data via Better Auth sign-up + server `/api/e2e-seed/*` endpoints (requires `MNM_E2E_SEED=true` on server).
2. **Role-based auth fixtures**: 4 pre-authenticated browser contexts (admin, manager, contributor, viewer) stored as JSON files.
3. **Multi-tenant isolation**: Two test companies (AlphaCorp, BetaCorp) for cross-tenant tests.
4. **Graceful degradation**: Docker-dependent tests (containers, SSO) skip gracefully when services unavailable.
5. **Deterministic data**: All seed data uses fixed UUIDs for stable test references.

---

## 2. Seed Data Design

### 2.1 Companies

| Nom                    | Issue Prefix | Tier        | SSO  | Invitation Only | Notes                              |
|------------------------|-------------|-------------|------|-----------------|------------------------------------|
| **NovaTech Solutions** | NTS         | enterprise  | true | false           | Entreprise principale, toutes features activees |
| **Atelier Numerique**  | ATN         | free        | false| true            | Secondaire, tests d'isolation multi-tenant |

### 2.2 Users (per company)

#### NovaTech Solutions

| Email                          | Name                | Role        | Instance Role  |
|--------------------------------|---------------------|-------------|----------------|
| admin@novatech.test            | Sophie Durand       | admin       | instance_admin |
| manager@novatech.test          | Pierre Martin       | manager     | --             |
| contributor@novatech.test      | Camille Leroy       | contributor | --             |
| viewer@novatech.test           | Thomas Bernard      | viewer      | --             |

#### Atelier Numerique

| Email                          | Name                | Role        | Notes                          |
|--------------------------------|---------------------|-------------|--------------------------------|
| admin@atelier.test             | Marie Dupont        | admin       | Pour tests isolation cross-tenant |

### 2.3 Agents (NovaTech)

| Nom                 | Role     | Adapter        | Status | Icon    | Notes                    |
|---------------------|----------|----------------|--------|---------|--------------------------|
| Claude Stratege     | ceo      | claude_local   | active | crown   | CEO de la hierarchie     |
| Marcus Architecte   | cto      | claude_local   | active | cpu     | Reporte au CEO           |
| Luna Developpeur    | engineer | claude_local   | idle   | code    | Reporte au CTO           |
| Aria QA             | qa       | process        | idle   | bug     | Reporte au CTO           |
| Phoenix DevOps      | devops   | process        | paused | rocket  | Pour tests containers    |

### 2.4 Projects (NovaTech)

| Nom                          | Status       | Couleur  | Lead Agent       |
|------------------------------|-------------|----------|------------------|
| Migration Cloud AWS          | in_progress | #6366f1  | Marcus Architecte|
| Refonte UX Mobile            | planned     | #ec4899  | --               |
| Audit Securite Q1 2026       | completed   | #22c55e  | --               |

### 2.5 Workflows (NovaTech)

| Template Nom                | Stages                                        | Default |
|----------------------------|-----------------------------------------------|---------|
| Pipeline CI/CD Standard    | Analyse > Dev > Review > QA > Deploy          | true    |
| Audit Securite             | Scan > Analyse > Rapport > Validation HITL    | false   |

### 2.6 Additional Seed Data

- **Chat channels**: 1 open channel per active agent (NovaTech)
- **Audit events**: 10 sample events (member.added, agent.created, workflow.started, etc.)
- **Automation cursors**: Company-level cursor at "assisted", project-level at "manual"
- **Container profiles**: "Standard Dev" profile (1CPU, 512MB)
- **Goals**: 1 company-level goal "Croissance Q1 2026"

---

## 3. Test Organization

```
e2e/
  global-setup.ts           # Seed DB via API, create auth states per role
  global-teardown.ts        # Cleanup test data via API
  fixtures/
    auth.fixture.ts         # Extended Playwright fixtures: adminPage, managerPage, etc.
    seed-data.ts            # All seed data constants (IDs, emails, passwords, etc.)
    test-helpers.ts         # Common test utilities (waitForApi, assertAuditEvent, etc.)
  tests/
    auth/
      login.spec.ts               # Sign-in form, error states, redirect
      signup.spec.ts              # Sign-up form, duplicate email, password validation
      signout.spec.ts             # Sign-out via avatar menu, session invalidation
    members/
      members-list.spec.ts        # Members table, search, filters, role badges
      invite-member.spec.ts       # Single email invite, pending state
      bulk-csv-invite.spec.ts     # CSV upload, progress, deduplication
    rbac/
      route-enforcement.spec.ts   # 403 on unauthorized routes (viewer -> admin pages)
      navigation-hiding.spec.ts   # Nav items hidden per role
      permission-matrix.spec.ts   # Admin RBAC matrix UI, toggle permissions
    orchestration/
      workflow-crud.spec.ts       # Create, read, update, delete workflow templates
      workflow-editor.spec.ts     # Drag-and-drop stage editor, save
      hitl-validation.spec.ts     # Approve/reject HITL stage
    projects/
      project-access.spec.ts      # Project memberships CRUD, scope filtering
    chat/
      agent-chat.spec.ts          # Send message via WebSocket, receive response
    containers/
      container-status.spec.ts    # Container profiles list, instance status (skip if no Docker)
    audit/
      audit-log.spec.ts           # Audit trail display, filters (actor, action, date)
      audit-export.spec.ts        # CSV/JSON export of audit data
    drift/
      drift-monitor.spec.ts       # Drift reports list, items, decision actions
    dashboard/
      dashboard-cards.spec.ts     # KPI cards render, timeline chart, k-anonymity
    sso/
      sso-config.spec.ts          # SSO config CRUD (SAML/OIDC form, status)
    onboarding/
      onboarding-wizard.spec.ts   # CEO wizard steps, cascade hierarchy, completion
    settings/
      automation-cursors.spec.ts  # Cursor positions, hierarchy enforcement
      company-settings.spec.ts    # Company name, budget, invitation-only toggle
```

---

## 4. Test Patterns

### 4.1 RBAC Enforcement Pattern (same test, 4 roles, different outcomes)

```typescript
import { test, expect } from "../fixtures/auth.fixture";

const rbacMatrix = [
  { role: "admin",       fixture: "adminPage",       expected: 200 },
  { role: "manager",     fixture: "managerPage",     expected: 200 },
  { role: "contributor", fixture: "contributorPage",  expected: 403 },
  { role: "viewer",      fixture: "viewerPage",       expected: 403 },
] as const;

for (const { role, fixture, expected } of rbacMatrix) {
  test(`${role} gets ${expected} on admin endpoint`, async ({ [fixture]: page }) => {
    const res = await page.request.get("/api/companies/:id/settings");
    expect(res.status()).toBe(expected);
  });
}
```

### 4.2 WebSocket Testing Pattern

```typescript
test("receives real-time chat message", async ({ adminPage }) => {
  // 1. Navigate to chat page
  await adminPage.goto("/chat");

  // 2. Open WebSocket listener
  const wsPromise = adminPage.waitForEvent("websocket");
  // OR use page.evaluate to listen on window.WebSocket

  // 3. Trigger action via API
  await adminPage.request.post("/api/chat/channels/:id/messages", {
    data: { content: "Hello from test" },
  });

  // 4. Assert UI updates
  await expect(adminPage.locator('[data-testid="chat-message"]')).toContainText("Hello from test");
});
```

### 4.3 Audit Trail Verification Pattern

```typescript
async function assertAuditEvent(
  request: APIRequestContext,
  companyId: string,
  expectedAction: string,
  expectedTargetType: string,
) {
  const res = await request.get(`/api/companies/${companyId}/audit`, {
    params: { action: expectedAction, limit: "1" },
  });
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.events.length).toBeGreaterThan(0);
  expect(body.events[0].action).toBe(expectedAction);
  expect(body.events[0].targetType).toBe(expectedTargetType);
}

// Usage in test:
test("creating agent emits audit event", async ({ adminPage }) => {
  // ... create agent via UI ...
  await assertAuditEvent(adminPage.request, COMPANY_ID, "agent.created", "agent");
});
```

### 4.4 Docker-dependent Tests (Graceful Skip)

```typescript
test.beforeEach(async ({ request }) => {
  const res = await request.get("/api/health");
  const health = await res.json();
  if (!health.docker?.available) {
    test.skip(true, "Docker not available - skipping container tests");
  }
});
```

### 4.5 Multi-Tenant Isolation Pattern

```typescript
test("company A cannot see company B data", async ({ adminPage }) => {
  // Admin is authenticated for NovaTech (company A)
  const res = await adminPage.request.get(
    `/api/companies/${ATELIER_COMPANY_ID}/agents`
  );
  // Should get 403 (not a member of Atelier Numerique)
  expect(res.status()).toBe(403);
});
```

---

## 5. Auth Strategy

### 5.1 Global Setup Flow

1. **Wait for server** health check (`GET /api/health`)
2. **Register 5 test users** via `POST /api/auth/sign-up/email` (or sign-in if exists)
3. **Seed company memberships** via `POST /api/e2e-seed/ensure-multi-role-access`
4. **Save 4 auth states** to `e2e/.auth/{role}StorageState.json`
5. **Seed business data** (agents, projects, workflows) via dedicated seed endpoints

### 5.2 Auth State Files

| File                                    | User                   | Role        |
|-----------------------------------------|------------------------|-------------|
| `e2e/.auth/adminStorageState.json`      | admin@novatech.test    | admin       |
| `e2e/.auth/managerStorageState.json`    | manager@novatech.test  | manager     |
| `e2e/.auth/contributorStorageState.json`| contributor@novatech.test | contributor |
| `e2e/.auth/viewerStorageState.json`     | viewer@novatech.test   | viewer      |
| `e2e/.auth/storageState.json`           | admin@novatech.test    | admin (legacy compat) |

---

## 6. Video Capture Configuration

### Playwright Config

```typescript
use: {
  video: "on",                          // Record every test
  screenshot: "only-on-failure",        // Screenshot on failure
  trace: "on-first-retry",             // Full trace on retry
}
```

### Video Storage

- Location: `test-results/` (default Playwright output)
- Naming: `{test-file}-{test-title}/video.webm`
- Access: Via HTML report (`pnpm test:e2e:report`)

### HTML Report

- Auto-generated at `playwright-report/`
- Contains: test results, screenshots, videos, traces
- Open with: `pnpm test:e2e:report` or `npx playwright show-report`

---

## 7. CI/CD Integration

### Environment Variables Required

| Variable        | Value (CI)                                          | Required |
|-----------------|-----------------------------------------------------|----------|
| `MNM_BASE_URL`  | `http://localhost:3100`                             | Yes      |
| `DATABASE_URL`  | `postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test` | Yes |
| `MNM_E2E_SEED`  | `true`                                              | Yes      |
| `CI`            | `true`                                              | Auto     |

### Docker Services

```bash
# Start test services
docker compose -f docker-compose.test.yml up -d

# Wait for healthy
docker compose -f docker-compose.test.yml ps --filter "health=healthy"

# Run tests
MNM_E2E_SEED=true pnpm test:e2e

# Cleanup
docker compose -f docker-compose.test.yml down -v
```

---

## 8. Coverage Matrix (69 B2B Stories)

| Epic    | Stories | Test Files Expected           | Priority |
|---------|---------|-------------------------------|----------|
| TECH    | 8       | health, schema, config        | P1       |
| RBAC    | 7       | route-enforcement, nav, matrix| P0       |
| MU      | 6       | login, signup, signout, invite| P0       |
| ORCH    | 5       | workflow CRUD, editor, HITL   | P1       |
| PROJ    | 4       | project-access                | P1       |
| OBS     | 4       | audit-log, audit-export       | P1       |
| CHAT    | 4       | agent-chat                    | P2       |
| CONT    | 6       | container-status              | P2       |
| DRIFT   | 3       | drift-monitor                 | P2       |
| DASH    | 3       | dashboard-cards               | P1       |
| DUAL    | 3       | automation-cursors            | P2       |
| SSO     | 3       | sso-config                    | P2       |
| ONB     | 4       | onboarding-wizard             | P2       |
| A2A     | 4       | (API tests in existing specs) | P3       |
| COMP    | 3       | (API tests in existing specs) | P3       |

P0 = Must have for launch, P1 = Important, P2 = Nice to have, P3 = Future

---

## 9. Extensibility Guidelines

### Adding a New Test Suite

1. Create `e2e/tests/{feature}/{test-name}.spec.ts`
2. Import fixture from `../fixtures/auth.fixture`
3. Use seed data constants from `../fixtures/seed-data`
4. Follow naming convention: `{EPIC}-{feature}.spec.ts` for API, `.browser.ts` for UI
5. Use `data-testid` attributes for element selection
6. Add to this architecture doc's coverage matrix

### Adding New Seed Data

1. Add constants to `e2e/fixtures/seed-data.ts`
2. Add seed logic to `e2e/global-setup.ts`
3. Add cleanup logic to `e2e/global-teardown.ts`
4. Document in this file's "Seed Data Design" section
