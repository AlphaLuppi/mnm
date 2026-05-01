---
name: testing
description: Patterns de tests MnM (Vitest unit + Playwright E2E + RLS testing). Auto-loaded quand tu édites des tests ou ajoutes du code testable.
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "e2e/**/*.ts"
  - "vitest.config.ts"
  - "playwright.config.ts"
---

# Testing MnM — Patterns à suivre

Stack : **Vitest 3** (unit + integration) + **Playwright 1.58** (E2E). Workspace monorepo avec `vitest.config.ts` racine déclarant les projets (`server`, `ui`, `cli`, `packages/*`). Chaque package a son propre `vitest.config.ts` (server : `testTimeout: 30_000` pour les ops git Windows).

## Run commands

```bash
bun run test                      # Vitest watch sur tous les projets
bun run test:run                  # Vitest run-once (CI)
bun run test:e2e                  # Playwright complet (api + browser + browser-rbac)
bun run test:e2e:isolated         # Playwright dans Docker isolé (recommandé local)
bun --cwd server test path/to     # Lancer un test spécifique sur un workspace
```

## Tests unit Vitest

- **Emplacement** : `__tests__/` à côté du source. Ex : `server/src/services/foo.ts` → `server/src/services/__tests__/foo.test.ts`. Les fichiers à la racine `server/src/__tests__/*.test.ts` sont aussi acceptés.
- **Naming** : `*.test.ts` pour unit, `*.e2e.test.ts` pour integration multi-modules dans Vitest (ne pas confondre avec Playwright `.spec.ts`).
- **Structure** : `describe` par feature/fonction, `it` par scénario. Imports depuis `vitest` : `describe, it, expect, vi, beforeEach, beforeAll`.
- **Mocking** : `vi.fn().mockResolvedValue(...)` / `vi.fn().mockImplementation(...)`. Voir `server/src/__tests__/health.test.ts` pour le pattern mock Drizzle `db.execute` / `db.select().from().where()`.
- **HTTP** : `supertest` + `express()` standalone — monter la route à tester sur un app minimal (`app.use("/health", healthRoutes(mockDb, opts))`), pas besoin de tout le serveur.

## Tests RLS — pattern critique multi-tenant

**Toute nouvelle table company-scoped DOIT avoir un test RLS.** Le test vérifie que la policy `tenant_isolation` empêche un tenant A de voir les données du tenant B.

Pattern minimal (inspiré de `packages/db/src/migrations/0065_governed_workflows.test.ts` pour le check structure SQL, étendu pour le runtime) :

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { setupTestDb, createTestCompany } from "@mnm/test-utils";
import { sql } from "drizzle-orm";

describe("RLS isolation — my_table", () => {
  let db, companyA, companyB;

  beforeAll(async () => {
    db = await setupTestDb();
    companyA = await createTestCompany(db, { name: "A" });
    companyB = await createTestCompany(db, { name: "B" });
    // Insert rows in both tenants (bypass RLS via direct SQL ou superuser)
    await db.insert(myTable).values([
      { companyId: companyA.id, /* ... */ },
      { companyId: companyB.id, /* ... */ },
    ]);
  });

  it("isolates rows by tenant context", async () => {
    await db.execute(sql`SET LOCAL app.current_company_id = ${companyA.id}`);
    const rows = await db.select().from(myTable);
    expect(rows).toHaveLength(1);
    expect(rows[0].companyId).toBe(companyA.id);
  });

  it("fail-closed when no tenant context is set", async () => {
    await db.execute(sql`RESET app.current_company_id`);
    const rows = await db.select().from(myTable);
    expect(rows).toHaveLength(0);
  });
});
```

Côté migration, vérifier dans le test fichier-SQL que la table active bien RLS + FORCE + policy RESTRICTIVE :
```ts
expect(sql).toMatch(/ALTER TABLE "my_table" ENABLE ROW LEVEL SECURITY/);
expect(sql).toMatch(/ALTER TABLE "my_table" FORCE ROW LEVEL SECURITY/);
expect(sql).toMatch(/CREATE POLICY "tenant_isolation".*AS RESTRICTIVE.*current_setting\('app\.current_company_id', true\)::uuid/);
```

## Tests E2E Playwright

- **Emplacement** : `e2e/tests/*.spec.ts` (project `api`, file-content) ou `*.browser.ts` (project `browser`, vraie UI). Suffixe `.rbac.browser.ts` pour le project `browser-rbac`.
- **Nommage** : préfixe par story (`ORCH-S05.spec.ts`, `MU-S06-ui.browser.ts`). Cas numérotés `T01`, `T02` ou `AC-1`, `AC-2`.
- **Setup** : `e2e/global-setup.ts` registre 5 users (admin/manager/contributor/viewer/atelierAdmin), seed via `POST /api/e2e-seed/ensure-multi-role-access`, sauvegarde les storage states dans `e2e/.auth/`. **Requiert** `MNM_E2E_SEED=true` côté serveur.
- **Mode dual** : le setup détecte `deploymentMode` via `/api/health` — `local_trusted` skip l'auth (cookies vides), `authenticated` fait le flow Better Auth complet.
- **Browser tests** : utilisent le storageState admin par défaut. Skipper proprement quand le mode ne convient pas :
  ```ts
  test.beforeEach(async ({ request }) => {
    const res = await request.get("/api/health");
    const body = await res.json();
    if (body.deploymentMode === "local_trusted") {
      test.skip(true, "Sign-out UI hidden in local_trusted");
    }
  });
  ```
- **Locators** : toujours par `data-testid` (`page.locator('[data-testid="orch-s05-save-btn"]')`), jamais par texte ou classe CSS. Les testid suivent le pattern `<story>-<slot>` (ex `mu-s06-user-avatar`, `orch-s05-stage-card-${index}`).
- **API tests file-content** : pattern `readFile(path, "utf-8")` + `expect(src).toMatch(/regex/)` pour valider la structure du code (existence de fonction exportée, présence de testid, etc.). Cf. `ORCH-S05.spec.ts` (68 cas).

## Factories & helpers — `@mnm/test-utils`

Réutiliser plutôt que recréer :
- **Factories** : `buildTestX` (objet plain, pour unit) vs `createTestX(db, overrides?)` (insert DB, retourne la row). Disponibles : Company, User, Agent, Project, Issue, CompanyMembership, ProjectMembership, PermissionGrant.
- **Helpers DB** : `setupTestDb()` (applique migrations, retourne Drizzle Db, fallback `postgresql://postgres:postgres@localhost:5433/mnm_test`), `cleanTestDb(db)` (TRUNCATE CASCADE de toutes les tables `public` sauf `__drizzle*`).
- **Scenario complet** : `seedE2eScenario(db)` retourne `{ admin, company, ceoAgent, engineerAgent, project, issue }` avec memberships + permissions admin grantées.
- **Mock LLM** : `createMockLlmProvider()` pour les chemins enrichissement Gold sans appeler `claude -p`.

## Coverage & qualité

- **Cible** : 80 % minimum sur les nouveaux fichiers (CLAUDE.md global). Tester les chemins erreur (DB down, auth refusée, RLS qui bloque).
- **Toujours QC après PM/dev/QA** : build, migration, server up, UI green, E2E vert. Ne jamais marquer DONE sans preuve runtime — pas seulement TypeScript qui passe.
- Pour les modifs UI : vérifier la story `e2e/tests/<story>.spec.ts` est mise à jour si tu changes un testid.

## Anti-patterns

- **Ne pas mocker la DB pour les tests integration** — Mocked tests passent et la migration prod casse. Utilise `setupTestDb` + un Postgres réel.
- **Ne pas oublier le test RLS sur une nouvelle table company-scoped** — Sans test, on découvre la fuite cross-tenant en prod.
- **Ne pas utiliser `setInterval` / polling dans les tests** — Idem code prod : passer par SSE / live-events ou les helpers `expect.poll(() => ..., { timeout })` de Playwright si attente nécessaire.
- **Ne pas locator par texte** — Les libellés FR/EN changent. Toujours `data-testid`.
- **Ne pas commit de tests `.skip` permanents** — Si un test est cassé, le réparer ou le supprimer ; sinon il pourrit silencieusement.
- **Ne pas mélanger Vitest et Playwright** — `*.test.ts` = Vitest (workspaces), `*.spec.ts` = Playwright (`e2e/tests/`). Le runner ne s'y retrouve pas si on mélange.
