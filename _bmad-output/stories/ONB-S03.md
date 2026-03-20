# ONB-S03 — Import Jira Intelligent

> **Epic** : ONB — Onboarding Cascade (Noyau C)
> **Sprint** : Batch 14
> **Assignation** : Tom (backend + frontend)
> **Effort** : M (5 SP, 3-4j)
> **Bloque par** : TECH-06 (tables import_jobs), ONB-S01 (onboarding service)
> **Debloque** : —
> **ADR** : —

---

## Contexte

MnM dispose deja d'une table `import_jobs` (TECH-06) qui stocke les metadata d'import. ONB-S03 implemente un service d'import Jira complet qui permet aux utilisateurs de :

1. **Connecter un projet Jira** via URL de base + token API personnel (PAT)
2. **Mapper les champs Jira vers MnM** — types d'issues, statuts, priorites, assignees
3. **Importer en batch** — les projets Jira deviennent des `projects` MnM, les issues Jira deviennent des `issues` MnM
4. **Deduplication** — si un import est relance, les issues deja importees (identifiees par `identifier` unique) sont mises a jour plutot que dupliquees
5. **Suivi de progression** — l'import_job est mis a jour en temps reel (progressDone/progressTotal)

### Mapping des champs Jira → MnM

| Champ Jira | Champ MnM (issues) | Notes |
|-----------|-------------------|-------|
| `key` | `identifier` | Ex: "PROJ-123" — unique, utilise pour dedup |
| `fields.summary` | `title` | Texte brut |
| `fields.description` | `description` | Conversion ADF → Markdown si possible, sinon texte brut |
| `fields.status.name` | `status` | Mapping configurable: "To Do"→"backlog", "In Progress"→"in_progress", "Done"→"done" |
| `fields.priority.name` | `priority` | Mapping: "Highest"/"High"→"high", "Medium"→"medium", "Low"/"Lowest"→"low" |
| `fields.issuetype.name` | metadata `jiraIssueType` | Stocke dans JSONB, pas de mapping direct |
| `fields.parent.key` | `parentId` | Lookup par identifier du parent importe |
| `fields.project.key` | `projectId` | Lookup ou creation du projet MnM |
| `fields.assignee.emailAddress` | `assigneeUserId` | Lookup par email dans company_memberships |
| `fields.created` | `createdAt` | Preserve la date originale |

### Mapping des projets Jira → MnM

| Champ Jira | Champ MnM (projects) | Notes |
|-----------|---------------------|-------|
| `key` | metadata `jiraProjectKey` | Utilise pour dedup |
| `name` | `name` | Nom du projet |
| `description` | `description` | Description du projet |
| — | `status` | Defaut: "active" |

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| TECH-06 | DONE | Table `import_jobs` (id, companyId, source, status, config, progressTotal, progressDone, error) |
| TECH-01 | DONE | PostgreSQL externe |
| ONB-S01 | DONE | Onboarding service, routes, patterns |
| RBAC-S04 | DONE | requirePermission middleware |
| OBS-S02 | DONE | emitAudit helper |

---

## Deliverables

### Backend

1. **Jira field mapping config** — `server/src/services/jira-field-mapping.ts`
   - `DEFAULT_STATUS_MAP` — mapping statut Jira → MnM
   - `DEFAULT_PRIORITY_MAP` — mapping priorite Jira → MnM
   - `mapJiraIssueToMnm(jiraIssue, config)` — transforme un issue Jira en insert MnM
   - `mapJiraProjectToMnm(jiraProject, companyId)` — transforme un projet Jira en insert MnM
   - Types: `JiraIssue`, `JiraProject`, `JiraFieldMappingConfig`

2. **Jira API client** — `server/src/services/jira-client.ts`
   - `createJiraClient(baseUrl, email, apiToken)` — factory
   - `fetchProjects()` — GET /rest/api/3/project
   - `fetchIssuesBatch(projectKey, startAt, maxResults)` — GET /rest/api/3/search avec JQL
   - `fetchIssue(issueKey)` — GET /rest/api/3/issue/{key}
   - Gestion pagination (startAt + maxResults)
   - Gestion erreurs (401 auth, 404 not found, rate limiting)
   - Type: `JiraClientConfig`

3. **Import service** — `server/src/services/jira-import.ts`
   - `startImport(companyId, config)` — cree un import_job, lance l'import async
   - `processImport(jobId)` — orchestre l'import (fetch → map → upsert)
   - `deduplicateIssue(identifier, companyId)` — check si issue existe deja via `identifier`
   - `deduplicateProject(jiraKey, companyId)` — check si projet existe deja
   - `getImportStatus(jobId)` — retourne le status du job
   - `listImportJobs(companyId)` — liste les jobs d'import pour une company
   - `cancelImport(jobId)` — annule un import en cours
   - Batch processing: 50 issues par batch avec update progression
   - Error handling: erreurs par issue loggees dans metadata, import continue

4. **Validators** — `server/src/services/jira-validators.ts`
   - `importConfigSchema` — Zod schema pour config d'import
   - `jiraConnectionSchema` — Zod schema pour connexion Jira
   - Validation baseUrl format, token non-vide

5. **Routes API** — `server/src/routes/jira-import.ts`
   - `POST /api/companies/:companyId/import/jira/connect` — tester la connexion Jira
   - `POST /api/companies/:companyId/import/jira/preview` — preview des projets/issues disponibles
   - `POST /api/companies/:companyId/import/jira/start` — lancer l'import
   - `GET /api/companies/:companyId/import/jira/jobs` — lister les jobs d'import
   - `GET /api/companies/:companyId/import/jira/jobs/:jobId` — status d'un job
   - `POST /api/companies/:companyId/import/jira/jobs/:jobId/cancel` — annuler un import
   - Protection: `requirePermission("projects.manage")`
   - Audit: `emitAudit` sur start, complete, cancel, error

6. **Types** — `packages/shared/src/jira-import-types.ts`
   - `ImportJobStatus` = "pending" | "running" | "completed" | "failed" | "cancelled"
   - `JiraImportConfig` — baseUrl, email, apiToken, projectKeys, fieldMapping
   - `JiraImportPreview` — projects[], issueCount
   - `JiraImportProgress` — jobId, status, progressTotal, progressDone, errors[]

7. **Barrel exports** — `server/src/services/index.ts`, `server/src/routes/index.ts`

8. **App.ts mounting** — Mount import routes

### Frontend

9. **API client** — `ui/src/api/jira-import.ts`
   - `jiraImportApi.connect(companyId, config)` — POST connect
   - `jiraImportApi.preview(companyId, config)` — POST preview
   - `jiraImportApi.start(companyId, config)` — POST start
   - `jiraImportApi.listJobs(companyId)` — GET jobs
   - `jiraImportApi.getJob(companyId, jobId)` — GET job status
   - `jiraImportApi.cancel(companyId, jobId)` — POST cancel

10. **Query keys** — `ui/src/lib/queryKeys.ts`
    - `jiraImport.jobs` key
    - `jiraImport.jobDetail` key

11. **JiraImportPage** — `ui/src/pages/JiraImport.tsx`
    - 3-step wizard: Connect → Configure → Import
    - Step 1: Jira URL + email + API token form + test connection button
    - Step 2: Project selection checkboxes + field mapping preview
    - Step 3: Import progress with real-time updates (polling)
    - Import history table below wizard

12. **Route + Sidebar** — Route `/settings/import/jira`, sidebar entry under Settings

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Jira connection test
**Given** an admin user with a valid Jira PAT
**When** they POST `/api/companies/:companyId/import/jira/connect` with baseUrl, email, apiToken
**Then** the endpoint validates the credentials by calling Jira API and returns `{ connected: true, serverInfo: {...} }`

### AC2 — Preview available projects
**Given** a valid Jira connection
**When** they POST `/api/companies/:companyId/import/jira/preview`
**Then** the endpoint returns a list of Jira projects with issue counts

### AC3 — Start import
**Given** a valid config with selected projects
**When** they POST `/api/companies/:companyId/import/jira/start`
**Then** an `import_job` is created with status "pending" and import begins asynchronously

### AC4 — Field mapping
**Given** a Jira issue with status "In Progress" and priority "High"
**When** the import processes this issue
**Then** it creates an MnM issue with `status = "in_progress"` and `priority = "high"`

### AC5 — Deduplication by identifier
**Given** a Jira issue "PROJ-123" already imported
**When** the import encounters "PROJ-123" again
**Then** the existing issue is updated (not duplicated) based on `identifier = "PROJ-123"`

### AC6 — Project creation
**Given** a Jira project "MYPROJ" not yet in MnM
**When** the import processes it
**Then** a new `projects` row is created with `name` from Jira and the project's issues are linked

### AC7 — Progress tracking
**Given** an import job with 200 issues
**When** 100 issues have been imported
**Then** the job shows `progressDone = 100, progressTotal = 200`

### AC8 — Error resilience
**Given** an import of 100 issues where issue #42 has invalid data
**When** the import processes issue #42
**Then** the error is logged in job metadata but import continues with remaining issues

### AC9 — Cancel import
**Given** a running import
**When** POST `/api/companies/:companyId/import/jira/jobs/:jobId/cancel` is called
**Then** the import stops, status = "cancelled", already imported data is preserved

### AC10 — Audit trail
**Given** an import completes
**When** all issues are imported
**Then** audit events are emitted: "import.started", "import.completed" with `{ source: "jira", issueCount, projectCount }`

### AC11 — Permission enforcement
**Given** a user without `projects.manage` permission
**When** they try to start an import
**Then** they receive 403 Forbidden

### AC12 — data-testid coverage
**Given** all interactive/verifiable elements
**When** the import page renders
**Then** every element has a `data-testid` attribute with prefix `onb-s03-`

---

## data-testid Mapping Table

| Element | data-testid | File |
|---------|------------|------|
| Import page container | `onb-s03-import-page` | JiraImport.tsx |
| Step indicator | `onb-s03-step-indicator` | JiraImport.tsx |
| Jira URL input | `onb-s03-jira-url` | JiraImport.tsx |
| Jira email input | `onb-s03-jira-email` | JiraImport.tsx |
| Jira token input | `onb-s03-jira-token` | JiraImport.tsx |
| Test connection button | `onb-s03-test-connection` | JiraImport.tsx |
| Connection status | `onb-s03-connection-status` | JiraImport.tsx |
| Project list container | `onb-s03-project-list` | JiraImport.tsx |
| Project checkbox | `onb-s03-project-checkbox-{key}` | JiraImport.tsx |
| Select all button | `onb-s03-select-all` | JiraImport.tsx |
| Field mapping preview | `onb-s03-field-mapping` | JiraImport.tsx |
| Start import button | `onb-s03-start-import` | JiraImport.tsx |
| Progress bar | `onb-s03-progress-bar` | JiraImport.tsx |
| Progress text | `onb-s03-progress-text` | JiraImport.tsx |
| Cancel import button | `onb-s03-cancel-import` | JiraImport.tsx |
| Import status badge | `onb-s03-import-status` | JiraImport.tsx |
| Error list | `onb-s03-error-list` | JiraImport.tsx |
| History table | `onb-s03-history-table` | JiraImport.tsx |
| History row | `onb-s03-history-row-{id}` | JiraImport.tsx |
| Next step button | `onb-s03-next-step` | JiraImport.tsx |
| Back step button | `onb-s03-back-step` | JiraImport.tsx |
| Dedup indicator | `onb-s03-dedup-indicator` | JiraImport.tsx |

---

## Test Cases (file-content based)

### Backend — Jira Field Mapping (T01-T06)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T01 | DEFAULT_STATUS_MAP exists | jira-field-mapping.ts | `DEFAULT_STATUS_MAP` |
| T02 | DEFAULT_PRIORITY_MAP exists | jira-field-mapping.ts | `DEFAULT_PRIORITY_MAP` |
| T03 | mapJiraIssueToMnm function | jira-field-mapping.ts | `function\s+mapJiraIssueToMnm` |
| T04 | mapJiraProjectToMnm function | jira-field-mapping.ts | `function\s+mapJiraProjectToMnm` |
| T05 | JiraIssue type exported | jira-field-mapping.ts | `export.*JiraIssue` |
| T06 | Status mapping includes backlog | jira-field-mapping.ts | `backlog` |

### Backend — Jira Client (T07-T13)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T07 | createJiraClient factory | jira-client.ts | `function\s+createJiraClient` |
| T08 | fetchProjects function | jira-client.ts | `fetchProjects` |
| T09 | fetchIssuesBatch function | jira-client.ts | `fetchIssuesBatch` |
| T10 | Uses /rest/api/3/ | jira-client.ts | `/rest/api/3/` or `rest/api/3` |
| T11 | Pagination support (startAt) | jira-client.ts | `startAt` |
| T12 | Authorization header | jira-client.ts | `Authorization` or `authorization` |
| T13 | Base64 encoding for auth | jira-client.ts | `btoa` or `Buffer.from` or `base64` |

### Backend — Import Service (T14-T22)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T14 | startImport function | jira-import.ts | `function\s+startImport` |
| T15 | processImport function | jira-import.ts | `function\s+processImport` |
| T16 | deduplicateIssue function | jira-import.ts | `deduplicateIssue` or `deduplicate` |
| T17 | Uses importJobs table | jira-import.ts | `importJobs` |
| T18 | Uses issues table | jira-import.ts | `issues` |
| T19 | Uses projects table | jira-import.ts | `projects` |
| T20 | Batch size configured | jira-import.ts | `50` or `batchSize` or `BATCH_SIZE` |
| T21 | getImportStatus function | jira-import.ts | `getImportStatus` |
| T22 | listImportJobs function | jira-import.ts | `listImportJobs` |

### Backend — Validators (T23-T25)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T23 | importConfigSchema Zod | jira-validators.ts | `importConfigSchema` |
| T24 | jiraConnectionSchema Zod | jira-validators.ts | `jiraConnectionSchema` |
| T25 | Uses z.object | jira-validators.ts | `z\.object` |

### Backend — Routes (T26-T35)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T26 | POST connect route | routes/jira-import.ts | `router.post.*connect` |
| T27 | POST preview route | routes/jira-import.ts | `router.post.*preview` |
| T28 | POST start route | routes/jira-import.ts | `router.post.*start` |
| T29 | GET jobs list route | routes/jira-import.ts | `router.get.*jobs` |
| T30 | GET job detail route | routes/jira-import.ts | `router.get.*jobs.*jobId` or `router.get.*:jobId` |
| T31 | POST cancel route | routes/jira-import.ts | `router.post.*cancel` |
| T32 | Uses requirePermission | routes/jira-import.ts | `requirePermission` |
| T33 | Uses assertCompanyAccess | routes/jira-import.ts | `assertCompanyAccess` |
| T34 | Uses emitAudit | routes/jira-import.ts | `emitAudit` |
| T35 | Route barrel export | routes/index.ts | `jiraImportRoutes` |

### Backend — Barrel & App (T36-T39)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T36 | Service barrel export (jira-import) | services/index.ts | `jiraImportService` or `jira-import` |
| T37 | Service barrel export (jira-client) | services/index.ts | `jiraClient` or `jira-client` or `createJiraClient` |
| T38 | Service barrel export (field-mapping) | services/index.ts | `jiraFieldMapping` or `jira-field-mapping` or `mapJiraIssueToMnm` |
| T39 | App.ts mounts jira import routes | app.ts | `jiraImport` or `jira-import` |

### Backend — Shared Types (T40-T43)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T40 | ImportJobStatus type | jira-import-types.ts | `ImportJobStatus` |
| T41 | JiraImportConfig type | jira-import-types.ts | `JiraImportConfig` |
| T42 | JiraImportPreview type | jira-import-types.ts | `JiraImportPreview` |
| T43 | JiraImportProgress type | jira-import-types.ts | `JiraImportProgress` |

### Frontend — API Client (T44-T50)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T44 | jiraImportApi.connect exists | api/jira-import.ts | `connect.*companyId` |
| T45 | jiraImportApi.preview exists | api/jira-import.ts | `preview.*companyId` |
| T46 | jiraImportApi.start exists | api/jira-import.ts | `start.*companyId` |
| T47 | jiraImportApi.listJobs exists | api/jira-import.ts | `listJobs.*companyId` |
| T48 | jiraImportApi.getJob exists | api/jira-import.ts | `getJob.*companyId` |
| T49 | jiraImportApi.cancel exists | api/jira-import.ts | `cancel.*companyId` |
| T50 | API barrel export | api/index.ts | `jiraImportApi` |

### Frontend — Query Keys (T51-T52)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T51 | jiraImport jobs query key | lib/queryKeys.ts | `jiraImport` |
| T52 | jiraImport detail query key | lib/queryKeys.ts | `jiraImport.*detail` or `jiraImport.*jobDetail` |

### Frontend — JiraImport Page (T53-T65)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T53 | Component exported | pages/JiraImport.tsx | `export.*JiraImport` or `export default` |
| T54 | data-testid import-page | pages/JiraImport.tsx | `onb-s03-import-page` |
| T55 | data-testid jira-url | pages/JiraImport.tsx | `onb-s03-jira-url` |
| T56 | data-testid jira-email | pages/JiraImport.tsx | `onb-s03-jira-email` |
| T57 | data-testid jira-token | pages/JiraImport.tsx | `onb-s03-jira-token` |
| T58 | data-testid test-connection | pages/JiraImport.tsx | `onb-s03-test-connection` |
| T59 | data-testid connection-status | pages/JiraImport.tsx | `onb-s03-connection-status` |
| T60 | data-testid project-list | pages/JiraImport.tsx | `onb-s03-project-list` |
| T61 | data-testid start-import | pages/JiraImport.tsx | `onb-s03-start-import` |
| T62 | data-testid progress-bar | pages/JiraImport.tsx | `onb-s03-progress-bar` |
| T63 | data-testid history-table | pages/JiraImport.tsx | `onb-s03-history-table` |
| T64 | data-testid cancel-import | pages/JiraImport.tsx | `onb-s03-cancel-import` |
| T65 | data-testid field-mapping | pages/JiraImport.tsx | `onb-s03-field-mapping` |

### Frontend — Route & Sidebar (T66-T68)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T66 | Route registered | App.tsx or routes config | `JiraImport` or `jira-import` or `import/jira` |
| T67 | Sidebar entry | Sidebar.tsx or layout | `import` or `Import` or `Jira` |
| T68 | Uses RequirePermission | pages/JiraImport.tsx or route config | `RequirePermission` or `projects.manage` |

---

## Notes techniques

- La table `import_jobs` existe deja (TECH-06). Les champs `source`, `config` (JSONB), `progressTotal`, `progressDone`, `error`, `status` sont disponibles.
- Le champ `identifier` sur `issues` est unique (uniqueIndex) — utilise pour la deduplication.
- L'import est asynchrone: le POST /start retourne immediatement avec le jobId, le client poll GET /jobs/:jobId pour suivre la progression.
- Les credentials Jira (apiToken) ne sont PAS stockees en DB — elles sont transmises dans la requete et utilisees uniquement pendant l'import.
- Le batch size de 50 est un compromis entre performance et feedback de progression.
- Les erreurs par issue sont accumulees dans `config.errors[]` sur le job, permettant un rapport post-import.
- Le mapping de statut est configurable via le champ `config.statusMapping` du job. Si non fourni, `DEFAULT_STATUS_MAP` est utilise.
