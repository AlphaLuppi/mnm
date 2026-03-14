# DRIFT-S01 : Drift Persistance DB -- Migration In-Memory vers PostgreSQL

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | DRIFT-S01 |
| **Titre** | Drift Persistance DB -- Migration In-Memory vers PostgreSQL |
| **Epic** | Epic DRIFT -- Drift Detection (Noyau A) |
| **Sprint** | Sprint 4 (Batch 8) |
| **Effort** | M (3 SP, 2-3j) |
| **Priorite** | P0 -- Dette technique critique (DT2) |
| **Assignation** | Tom (backend) |
| **Bloque par** | Aucune dependance bloquante directe (les tables cibles n'existent pas encore, elles seront creees par cette story) |
| **Debloque** | DRIFT-S02 (Drift monitor service), DRIFT-S03 (UI diff drift) |
| **ADR** | ADR-007 (Observabilite) |
| **Type** | Backend-only (schema DB + migration + service refactor + routes update, pas de composant UI) |
| **FRs couverts** | REQ-ORCH-05 (Drift detection basique <15min P0) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

Le systeme de drift actuel (`server/src/services/drift.ts`) utilise un **cache in-memory** (`reportCache = new Map()`) pour stocker les rapports de drift. C'est la dette technique DT2 identifiee dans les epics :

```typescript
// server/src/services/drift.ts ligne 21
const reportCache = new Map<string, DriftReport[]>();
```

Ce pattern a plusieurs problemes critiques pour le B2B enterprise :

1. **Perte de donnees au restart** -- tous les drift reports sont perdus quand le serveur redemarre
2. **Pas de multi-instance** -- en deployment multi-pod (Kubernetes), chaque instance a son propre cache isole
3. **Pas de multi-tenant** -- le cache utilise `projectId` comme cle mais ne filtre pas par `companyId` (violation RLS)
4. **Pas de pagination** -- `getDriftResults()` retourne TOUS les rapports d'un coup (MAX_REPORTS_PER_PROJECT = 50)
5. **Pas d'audit trail** -- les resolutions de drift (`resolveDrift()`) ne laissent aucune trace persistante
6. **Pas de scan status persistant** -- `scanStatusMap` est aussi in-memory, perdu au restart
7. **Pas de companyId** -- les DriftReport et DriftItem n'ont pas de champ companyId, incompatible avec RLS

### Ce que cette story construit

1. **2 nouvelles tables PostgreSQL** via Drizzle ORM :
   - `drift_reports` -- persiste les rapports de scan drift (1 rapport = 1 comparaison source/target)
   - `drift_items` -- persiste les items de drift individuels (1 item = 1 deviation detectee)

2. **Migration Drizzle** pour les 2 tables + indexes

3. **Service `drift-persistence.ts`** -- service CRUD PostgreSQL qui remplace le cache in-memory :
   - `createReport(input)` -- inserer un rapport + ses items en transaction
   - `getReportById(companyId, reportId)` -- recuperer un rapport avec ses items
   - `listReports(filters)` -- lister les rapports avec filtres et pagination
   - `countReports(filters)` -- compter les rapports selon filtres
   - `getItemById(companyId, itemId)` -- recuperer un item par ID
   - `resolveItem(companyId, itemId, decision, resolvedBy, note?)` -- resoudre un drift item
   - `listItems(filters)` -- lister les items avec filtres (par rapport, par severite, par decision)
   - `getScanStatus(companyId, projectId)` -- recuperer le dernier scan status depuis les rapports persistes
   - `deleteReportsForProject(companyId, projectId)` -- cleanup (soft delete via champ `deletedAt`)

4. **Refactoring `drift.ts`** -- remplacer `reportCache`, `scanStatusMap`, `scanAbortMap` par des appels au service de persistance :
   - `checkDrift()` ecrit en DB via `createReport()` au lieu de `cacheReport()`
   - `getDriftResults()` lit depuis la DB via `listReports()` au lieu du Map
   - `resolveDrift()` met a jour en DB via `resolveItem()` au lieu de la mutation in-memory
   - `getDriftScanStatus()` calcule le status depuis les rapports DB
   - L'`AbortController` pour les scans en cours reste in-memory (pas besoin de persister l'etat de process)

5. **Mise a jour des routes `drift.ts`** :
   - Passage du `db` au service drift
   - Ajout de `companyId` dans toutes les queries (RLS compliance)
   - Ajout de pagination (`limit`, `offset`) sur les endpoints de listing
   - Ajout du filtre par `severity` et `decision` sur les items

6. **Types partages** mis a jour dans `packages/shared/src/types/drift.ts` :
   - `DriftReport` enrichi avec `companyId`, `createdAt`, `updatedAt`
   - `DriftItem` enrichi avec `reportId`, `companyId`, `resolvedBy`
   - Nouveau type `DriftReportFilters` pour la pagination et les filtres
   - Nouveau type `DriftItemFilters` pour les filtres d'items

7. **Integration** barrel exports :
   - `packages/db/src/schema/index.ts` -- export `driftReports`, `driftItems`
   - `server/src/services/index.ts` -- export `driftPersistenceService`

### Ce que cette story ne fait PAS (scope)

- Pas de drift monitor temps reel (DRIFT-S02)
- Pas de UI drift (DRIFT-S03)
- Pas de WebSocket notifications pour les drifts
- Pas de detection automatique de drift basee sur les heartbeats
- Pas de comparaison attendu vs observe (workflow template vs execution) -- c'est DRIFT-S02
- Pas de suppression physique des anciens rapports (retention policy sera DRIFT-S02 ou une story technique)

---

## Etat Actuel du Code (Analyse)

### Service drift existant (`server/src/services/drift.ts`)

Le fichier actuel fait ~406 lignes et contient :

```typescript
// 3 Map in-memory -- TOUT est perdu au restart
const reportCache = new Map<string, DriftReport[]>();
const scanStatusMap = new Map<string, DriftScanStatus>();
const scanAbortMap = new Map<string, AbortController>();
```

**Fonctions existantes** :
- `checkDrift(projectId, sourceDoc, targetDoc, customInstructions?)` -- analyse drift LLM et cache le rapport
- `getDriftResults(projectId)` -- retourne les rapports du cache
- `resolveDrift(projectId, driftId, decision, note?)` -- mute un item in-memory
- `getDriftScanStatus(projectId)` -- retourne le scan status in-memory
- `cancelDriftScan(projectId)` -- annule un scan via AbortController
- `runDriftScan(projectId, workspacePath, scope)` -- lance un scan full

**Dependances** :
- `drift-analyzer.ts` -- appel LLM pour l'analyse (ne change pas)
- `drift-instructions.ts` -- chargement instructions custom (ne change pas)
- `drift-prompts.ts` -- prompts pour l'analyse LLM (ne change pas)

### Routes drift existantes (`server/src/routes/drift.ts`)

6 routes existantes :
- `POST /projects/:id/drift/check` -- lancer une analyse
- `GET /projects/:id/drift/results` -- lister les resultats
- `POST /projects/:id/drift/scan` -- lancer un scan complet
- `GET /projects/:id/drift/status` -- status du scan
- `DELETE /projects/:id/drift/scan` -- annuler un scan
- `PATCH /projects/:id/drift/:driftId` -- resoudre un drift item

### Types partages existants (`packages/shared/src/types/drift.ts`)

```typescript
export type DriftSeverity = "critical" | "moderate" | "minor";
export type DriftType = "scope_expansion" | "approach_change" | "design_deviation";
export type DriftRecommendation = "update_spec" | "recenter_code";
export type DriftDecision = "accepted" | "rejected" | "pending";

export interface DriftItem {
  id: string;
  severity: DriftSeverity;
  driftType: DriftType;
  confidence: number;
  description: string;
  recommendation: DriftRecommendation;
  sourceExcerpt: string;
  targetExcerpt: string;
  sourceDoc: string;
  targetDoc: string;
  decision: DriftDecision;
  decidedAt?: string;
  remediationNote?: string;
}

export interface DriftReport {
  id: string;
  projectId: string;
  sourceDoc: string;
  targetDoc: string;
  drifts: DriftItem[];
  checkedAt: string;
}
```

### Schema DB -- Aucune table drift n'existe

Les tables `drift_reports` et `drift_items` n'existent PAS encore. TECH-06 a cree 10 tables mais pas de table drift. Cette story cree ces tables from scratch.

---

## Schema des Nouvelles Tables

### Table `drift_reports`

```typescript
// packages/db/src/schema/drift_reports.ts
export const driftReports = pgTable(
  "drift_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    projectId: uuid("project_id").notNull().references(() => projects.id),
    sourceDoc: text("source_doc").notNull(),
    targetDoc: text("target_doc").notNull(),
    driftCount: integer("drift_count").notNull().default(0),
    scanScope: text("scan_scope"),  // "all", "planning", "implementation", ou null si check individuel
    status: text("status").notNull().default("completed"),  // "in_progress", "completed", "failed", "cancelled"
    errorMessage: text("error_message"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    companyProjectIdx: index("drift_reports_company_project_idx").on(table.companyId, table.projectId),
    companyCheckedIdx: index("drift_reports_company_checked_idx").on(table.companyId, table.checkedAt),
    projectStatusIdx: index("drift_reports_project_status_idx").on(table.companyId, table.projectId, table.status),
  }),
);
```

### Table `drift_items`

```typescript
// packages/db/src/schema/drift_items.ts
export const driftItems = pgTable(
  "drift_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    reportId: uuid("report_id").notNull().references(() => driftReports.id, { onDelete: "cascade" }),
    severity: text("severity").notNull(),  // "critical", "moderate", "minor"
    driftType: text("drift_type").notNull(),  // "scope_expansion", "approach_change", "design_deviation"
    confidence: real("confidence").notNull(),
    description: text("description").notNull(),
    recommendation: text("recommendation").notNull(),  // "update_spec", "recenter_code"
    sourceExcerpt: text("source_excerpt"),
    targetExcerpt: text("target_excerpt"),
    sourceDoc: text("source_doc").notNull(),
    targetDoc: text("target_doc").notNull(),
    decision: text("decision").notNull().default("pending"),  // "pending", "accepted", "rejected"
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: text("decided_by"),  // userId qui a pris la decision
    remediationNote: text("remediation_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    reportIdx: index("drift_items_report_idx").on(table.reportId),
    companySeverityIdx: index("drift_items_company_severity_idx").on(table.companyId, table.severity),
    companyDecisionIdx: index("drift_items_company_decision_idx").on(table.companyId, table.decision),
    companyReportSeverityIdx: index("drift_items_company_report_severity_idx").on(table.companyId, table.reportId, table.severity),
  }),
);
```

---

## Acceptance Criteria

### AC-1 : Tables creees par migration Drizzle

**Given** le serveur MnM
**When** la migration Drizzle s'execute
**Then** les tables `drift_reports` et `drift_items` sont creees avec tous les index

**Verification** : `pnpm db:generate && pnpm db:migrate` sans erreur + tables visibles dans PostgreSQL

### AC-2 : Persistance des rapports de drift (remplacement du Map in-memory)

**Given** un utilisateur lance un drift check sur un projet
**When** l'analyse LLM retourne des items de drift
**Then** le rapport est persiste dans `drift_reports` et les items dans `drift_items` avec `companyId` correct

**Given** le serveur redemarre
**When** un utilisateur requete les drift results
**Then** les rapports anterieurs sont toujours disponibles (pas de perte de donnees)

### AC-3 : Resolution persistante des drift items

**Given** un drift item en statut `pending`
**When** un utilisateur le resout (accepted/rejected) avec une note optionnelle
**Then** le champ `decision` est mis a jour en DB, `decidedAt` est set, `decidedBy` contient l'userId de l'acteur

**Given** le serveur redemarre
**When** on relit le drift item
**Then** la resolution est preservee

### AC-4 : Pagination et filtrage des rapports

**Given** un projet avec 60+ rapports de drift
**When** l'API GET /projects/:id/drift/results est appelee avec `limit=20&offset=0`
**Then** seuls les 20 premiers rapports sont retournes avec un header ou champ `total` indiquant le nombre total

**Given** un filtre par severite `severity=critical`
**When** l'API GET /projects/:id/drift/items est appelee
**Then** seuls les items de severite `critical` sont retournes

### AC-5 : Isolation multi-tenant (RLS compliance)

**Given** un drift report de la company A
**When** un utilisateur de la company B tente d'y acceder
**Then** le rapport n'est pas visible (filtre par `companyId` dans toutes les requetes)

### AC-6 : Compatibilite ascendante des routes existantes

**Given** les 6 routes drift existantes
**When** le refactoring est applique
**Then** les signatures et les reponses restent compatibles (memes champs dans le JSON de reponse)

**Given** le frontend existant qui appelle `GET /projects/:id/drift/results`
**When** la reponse est un tableau de DriftReport
**Then** le format est identique a l'ancien (avec les champs supplementaires `companyId`, `createdAt`, `updatedAt` ajoutes)

### AC-7 : Scan status derive des rapports DB

**Given** un scan en cours sur un projet
**When** l'API GET /projects/:id/drift/status est appelee
**Then** le status inclut `scanning`, `progress`, `completed`, `total`, `lastScanAt`, `lastScanIssueCount`

**Given** le serveur redemarre pendant un scan
**When** le status est requete
**Then** `scanning` retourne `false` et `lastScanAt` reflete le dernier scan complete (pas de scan fantome)

### AC-8 : Soft delete des rapports

**Given** un projet dont les rapports doivent etre nettoyes
**When** `deleteReportsForProject(companyId, projectId)` est appele
**Then** les rapports sont soft-deleted (`deletedAt` est set) mais les items restent accessibles via query directe avec flag `includeDeleted`

### AC-9 : Transaction atomique creation rapport + items

**Given** un drift check qui retourne 5 items
**When** le rapport est persiste
**Then** le rapport ET ses 5 items sont crees dans la meme transaction DB (pas de rapport orphelin si un item echoue)

### AC-10 : Types partages mis a jour

**Given** le package `@mnm/shared`
**When** il est importe
**Then** les types `DriftReport` et `DriftItem` incluent les champs `companyId`, `createdAt`, `updatedAt`, et les nouveaux types `DriftReportFilters`, `DriftItemFilters` sont disponibles

### AC-11 : Audit event emis a la resolution

**Given** un drift item resolu
**When** la resolution est persistee
**Then** un audit event `drift.item_resolved` est emis via `emitAudit()` avec `actorId`, `targetId` (drift item), `metadata: { decision, severity, driftType }`

---

## data-test-id Reference Table

| Element | data-testid | Description |
|---------|-------------|-------------|
| Schema drift_reports | `drift-s01-schema-drift-reports` | Table drift_reports dans le schema Drizzle |
| Schema drift_items | `drift-s01-schema-drift-items` | Table drift_items dans le schema Drizzle |
| Migration file | `drift-s01-migration-file` | Fichier de migration Drizzle genere |
| Service drift-persistence | `drift-s01-service-drift-persistence` | Fichier service de persistance |
| Service createReport fn | `drift-s01-fn-create-report` | Fonction createReport dans le service |
| Service getReportById fn | `drift-s01-fn-get-report-by-id` | Fonction getReportById |
| Service listReports fn | `drift-s01-fn-list-reports` | Fonction listReports avec filtres |
| Service countReports fn | `drift-s01-fn-count-reports` | Fonction countReports |
| Service getItemById fn | `drift-s01-fn-get-item-by-id` | Fonction getItemById |
| Service resolveItem fn | `drift-s01-fn-resolve-item` | Fonction resolveItem |
| Service listItems fn | `drift-s01-fn-list-items` | Fonction listItems avec filtres |
| Service getScanStatus fn | `drift-s01-fn-get-scan-status` | Fonction getScanStatus derive |
| Service deleteReportsForProject fn | `drift-s01-fn-delete-reports` | Fonction soft delete |
| drift.ts refactor reportCache removed | `drift-s01-refactor-no-report-cache` | Suppression du Map in-memory reportCache |
| drift.ts refactor scanStatusMap removed | `drift-s01-refactor-no-scan-status-map` | Suppression du Map in-memory scanStatusMap |
| drift.ts uses persistence service | `drift-s01-refactor-uses-persistence` | drift.ts appelle drift-persistence au lieu du Map |
| Routes companyId param | `drift-s01-routes-company-id` | CompanyId passe dans toutes les queries |
| Routes pagination support | `drift-s01-routes-pagination` | limit/offset sur les endpoints de listing |
| Route GET items with filters | `drift-s01-route-items-filtered` | Endpoint de listing items avec filtres severity/decision |
| Barrel export schema | `drift-s01-barrel-schema` | Export drift_reports et drift_items dans schema/index.ts |
| Barrel export service | `drift-s01-barrel-service` | Export driftPersistenceService dans services/index.ts |
| Shared types DriftReport enriched | `drift-s01-type-drift-report` | DriftReport avec companyId, createdAt, updatedAt |
| Shared types DriftItem enriched | `drift-s01-type-drift-item` | DriftItem avec reportId, companyId, decidedBy |
| Shared types DriftReportFilters | `drift-s01-type-report-filters` | Nouveau type DriftReportFilters |
| Shared types DriftItemFilters | `drift-s01-type-item-filters` | Nouveau type DriftItemFilters |
| Audit event drift resolved | `drift-s01-audit-drift-resolved` | emitAudit('drift.item_resolved') appele |
| Transaction atomique | `drift-s01-transaction-atomic` | db.transaction() dans createReport |

---

## Fichiers Impactes

### Fichiers a CREER

| Fichier | Description | Lignes estimees |
|---------|-------------|-----------------|
| `packages/db/src/schema/drift_reports.ts` | Schema Drizzle table drift_reports | ~35 |
| `packages/db/src/schema/drift_items.ts` | Schema Drizzle table drift_items | ~45 |
| `server/src/services/drift-persistence.ts` | Service CRUD PostgreSQL pour drift | ~250-300 |

### Fichiers a MODIFIER

| Fichier | Modification |
|---------|-------------|
| `packages/db/src/schema/index.ts` | Ajouter exports drift_reports + drift_items |
| `packages/shared/src/types/drift.ts` | Enrichir DriftReport/DriftItem, ajouter DriftReportFilters/DriftItemFilters |
| `packages/shared/src/types/index.ts` | Re-export nouveaux types drift |
| `packages/shared/src/index.ts` | Re-export si necessaire |
| `server/src/services/drift.ts` | Refactorer pour utiliser drift-persistence au lieu des Map in-memory |
| `server/src/services/index.ts` | Export driftPersistenceService |
| `server/src/routes/drift.ts` | Ajouter companyId, pagination, filtres severity/decision |

### Fichiers NON MODIFIES

| Fichier | Raison |
|---------|--------|
| `server/src/services/drift-analyzer.ts` | Analyse LLM inchangee |
| `server/src/services/drift-instructions.ts` | Chargement instructions inchange |
| `server/src/services/drift-prompts.ts` | Prompts inchanges |

---

## Implementation Guide

### Etape 1 : Schemas Drizzle (drift_reports + drift_items)

Creer les 2 fichiers dans `packages/db/src/schema/`. Suivre le pattern des schemas existants :
- `uuid("id").primaryKey().defaultRandom()`
- `uuid("company_id").notNull().references(() => companies.id)` pour RLS
- Indexes composites pour les patterns de requetes courants
- Utiliser `real()` pour le champ `confidence` (0.0-1.0)
- Utiliser `text()` pour les enums (meme pattern que `audit_events.severity`)
- Ajouter `onDelete: "cascade"` sur `drift_items.reportId` pour cleanup automatique

### Etape 2 : Migration Drizzle

```bash
pnpm db:generate
```

Verifier que la migration generee cree les 2 tables, les 7 index, et la FK cascade.

### Etape 3 : Service drift-persistence.ts

Pattern a suivre : `server/src/services/audit.ts` (meme architecture service DB).

```typescript
// server/src/services/drift-persistence.ts
export function driftPersistenceService(db: Db) {
  return {
    async createReport(input: CreateDriftReportInput): Promise<DriftReport> {
      // Transaction: INSERT drift_reports + INSERT drift_items[]
      return db.transaction(async (tx) => {
        const [report] = await tx.insert(driftReports).values({...}).returning();
        if (input.items.length > 0) {
          await tx.insert(driftItems).values(input.items.map(item => ({
            ...item,
            reportId: report.id,
            companyId: input.companyId,
          })));
        }
        // Update driftCount on report
        await tx.update(driftReports)
          .set({ driftCount: input.items.length })
          .where(eq(driftReports.id, report.id));
        return report;
      });
    },

    async listReports(filters: DriftReportFilters): Promise<{ data: DriftReport[]; total: number }> {
      // Drizzle query with companyId filter + projectId + pagination
      // WHERE deletedAt IS NULL
    },

    async resolveItem(companyId: string, itemId: string, decision: DriftDecision, decidedBy: string, note?: string): Promise<DriftItem | null> {
      // UPDATE drift_items SET decision, decidedAt, decidedBy, remediationNote, updatedAt
      // WHERE id = itemId AND companyId = companyId
      // + emitAudit('drift.item_resolved')
    },

    // ... autres fonctions
  };
}
```

### Etape 4 : Refactoring drift.ts

**Strategie** : garder la meme API publique mais remplacer les Map par des appels DB.

```typescript
// AVANT
const reportCache = new Map<string, DriftReport[]>();
function cacheReport(report: DriftReport): void { ... }

// APRES
// Supprimer reportCache, scanStatusMap
// Injecter db dans les fonctions ou passer via module-level
export async function checkDrift(
  db: Db,  // nouveau parametre
  companyId: string,  // nouveau parametre
  projectId: string,
  sourceDoc: string,
  targetDoc: string,
  customInstructions?: string,
): Promise<DriftReport> {
  // ... analyse LLM inchangee ...
  const svc = driftPersistenceService(db);
  return svc.createReport({
    companyId, projectId, sourceDoc, targetDoc,
    items: drifts,
  });
}
```

**Note** : `scanAbortMap` reste in-memory (Map<string, AbortController>) car c'est un etat de process, pas une donnee persistable.

### Etape 5 : Mise a jour routes drift.ts

- Passer `db` aux fonctions drift refactorees
- Extraire `companyId` depuis `req` (via auth middleware)
- Ajouter `limit`/`offset` query params sur les listings
- Ajouter `severity`/`decision` query params sur les items

### Etape 6 : Types partages

Enrichir les types existants de facon backward-compatible (nouveaux champs optionnels) :

```typescript
export interface DriftReport {
  id: string;
  projectId: string;
  sourceDoc: string;
  targetDoc: string;
  drifts: DriftItem[];
  checkedAt: string;
  // Nouveaux champs (DRIFT-S01)
  companyId?: string;
  driftCount?: number;
  status?: "in_progress" | "completed" | "failed" | "cancelled";
  scanScope?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriftItem {
  // ... champs existants ...
  // Nouveaux champs (DRIFT-S01)
  reportId?: string;
  companyId?: string;
  decidedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriftReportFilters {
  companyId: string;
  projectId?: string;
  status?: string;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

export interface DriftItemFilters {
  companyId: string;
  reportId?: string;
  severity?: DriftSeverity;
  decision?: DriftDecision;
  driftType?: DriftType;
  limit?: number;
  offset?: number;
}
```

---

## Cas de Test pour QA (Playwright E2E -- file-content based)

### T01-T05 : Schema drift_reports

| ID | Test | Verification |
|----|------|-------------|
| T01 | Schema drift_reports existe | Le fichier `packages/db/src/schema/drift_reports.ts` exporte `driftReports` |
| T02 | 12 colonnes dans drift_reports | id, companyId, projectId, sourceDoc, targetDoc, driftCount, scanScope, status, errorMessage, checkedAt, createdAt, updatedAt, deletedAt |
| T03 | FK companyId vers companies | `.references(() => companies.id)` present |
| T04 | FK projectId vers projects | `.references(() => projects.id)` present |
| T05 | 3 index sur drift_reports | company_project, company_checked, project_status |

### T06-T10 : Schema drift_items

| ID | Test | Verification |
|----|------|-------------|
| T06 | Schema drift_items existe | Le fichier `packages/db/src/schema/drift_items.ts` exporte `driftItems` |
| T07 | 16 colonnes dans drift_items | id, companyId, reportId, severity, driftType, confidence, description, recommendation, sourceExcerpt, targetExcerpt, sourceDoc, targetDoc, decision, decidedAt, decidedBy, remediationNote, createdAt, updatedAt |
| T08 | FK reportId avec onDelete cascade | `.references(() => driftReports.id, { onDelete: "cascade" })` |
| T09 | FK companyId vers companies | `.references(() => companies.id)` present |
| T10 | 4 index sur drift_items | report, company_severity, company_decision, company_report_severity |

### T11-T13 : Barrel exports

| ID | Test | Verification |
|----|------|-------------|
| T11 | drift_reports exporte dans schema/index.ts | `export { driftReports }` ou re-export present |
| T12 | drift_items exporte dans schema/index.ts | `export { driftItems }` ou re-export present |
| T13 | driftPersistenceService exporte dans services/index.ts | export present dans barrel |

### T14-T22 : Service drift-persistence.ts

| ID | Test | Verification |
|----|------|-------------|
| T14 | Fichier drift-persistence.ts existe | `server/src/services/drift-persistence.ts` cree |
| T15 | Fonction createReport presente | export ou methode `createReport` avec signature (input) |
| T16 | Fonction getReportById presente | export ou methode `getReportById(companyId, reportId)` |
| T17 | Fonction listReports presente | export ou methode `listReports(filters)` avec DriftReportFilters |
| T18 | Fonction countReports presente | export ou methode `countReports(filters)` |
| T19 | Fonction getItemById presente | export ou methode `getItemById(companyId, itemId)` |
| T20 | Fonction resolveItem presente | export ou methode `resolveItem(companyId, itemId, ...)` |
| T21 | Fonction listItems presente | export ou methode `listItems(filters)` avec DriftItemFilters |
| T22 | Fonction getScanStatus presente | export ou methode `getScanStatus(companyId, projectId)` |

### T23-T28 : Refactoring drift.ts

| ID | Test | Verification |
|----|------|-------------|
| T23 | reportCache supprime | Pas de `new Map<string, DriftReport[]>()` dans drift.ts |
| T24 | scanStatusMap supprime | Pas de `new Map<string, DriftScanStatus>()` dans drift.ts |
| T25 | cacheReport() supprime | Pas de fonction `cacheReport` dans drift.ts |
| T26 | checkDrift accepte db et companyId | Signature contient `db: Db` et `companyId: string` |
| T27 | getDriftResults utilise le service DB | Appel a `listReports` ou equivalent au lieu du Map |
| T28 | resolveDrift utilise le service DB | Appel a `resolveItem` ou equivalent au lieu de la mutation in-memory |

### T29-T34 : Routes drift.ts mise a jour

| ID | Test | Verification |
|----|------|-------------|
| T29 | CompanyId utilise dans toutes les routes | Chaque handler extrait companyId (via req ou project) |
| T30 | Pagination sur GET results | Query params `limit` et `offset` supportes |
| T31 | Filtre severity sur items | Query param `severity` supporte |
| T32 | Filtre decision sur items | Query param `decision` supporte |
| T33 | decidedBy set a la resolution | L'userId de l'acteur est passe a resolveItem |
| T34 | Route resolve retourne le DriftItem mis a jour | PATCH response contient `decidedAt`, `decidedBy` |

### T35-T40 : Types partages

| ID | Test | Verification |
|----|------|-------------|
| T35 | DriftReport enrichi | `companyId` present dans l'interface DriftReport |
| T36 | DriftItem enrichi | `reportId` et `decidedBy` presents dans l'interface DriftItem |
| T37 | DriftReportFilters exporte | Type `DriftReportFilters` exporte depuis @mnm/shared |
| T38 | DriftItemFilters exporte | Type `DriftItemFilters` exporte depuis @mnm/shared |
| T39 | DriftReport.driftCount present | Champ `driftCount` dans DriftReport |
| T40 | DriftReport.status present | Champ `status` avec les 4 valeurs possibles |

### T41-T45 : Audit + Transaction

| ID | Test | Verification |
|----|------|-------------|
| T41 | Transaction dans createReport | `db.transaction` ou `tx.` present dans la fonction createReport |
| T42 | emitAudit appele a la resolution | `emitAudit` ou `audit` present dans la fonction resolveItem |
| T43 | Action audit = drift.item_resolved | String `"drift.item_resolved"` ou `drift.item_resolved` dans le code |
| T44 | Metadata audit contient decision | `decision` dans les metadata de l'audit event |
| T45 | Soft delete avec deletedAt | `deletedAt` utilise dans deleteReportsForProject (pas de DELETE FROM) |

### T46-T48 : Migration

| ID | Test | Verification |
|----|------|-------------|
| T46 | Migration file existe | Au moins un fichier .sql dans packages/db/drizzle/ correspondant |
| T47 | Migration cree drift_reports | SQL contient `CREATE TABLE` ... `drift_reports` |
| T48 | Migration cree drift_items | SQL contient `CREATE TABLE` ... `drift_items` |

---

## Notes Techniques

### Performance

- Les index composites sont optimises pour les patterns de requete attendus :
  - `(companyId, projectId)` -- listing par projet (le plus frequent)
  - `(companyId, checkedAt)` -- listing chronologique
  - `(companyId, severity)` -- filtrage par severite
  - `(reportId)` -- join items par rapport

### Backward Compatibility

- Les nouveaux champs sur `DriftReport` et `DriftItem` sont **optionnels** pour ne pas casser le frontend existant
- Les routes existantes gardent les memes paths et signatures de reponse
- L'ajout de `companyId` et `db` aux fonctions du service drift est un breaking change interne mais pas d'impact sur l'API HTTP

### Migration des Donnees

- Pas de migration de donnees existantes : le cache in-memory est ephemere, il n'y a rien a migrer
- Les anciennes donnees en cache seront simplement perdues (accepte -- elles l'auraient ete au prochain restart de toute facon)

### RLS

- Les 2 nouvelles tables doivent etre sous RLS (TECH-05 couvre 41 tables existantes)
- La migration doit inclure `CREATE POLICY` si le pattern TECH-05 ne couvre pas automatiquement les nouvelles tables
- Alternative : TECH-05 a probablement un middleware qui set `app.current_company_id` -- verifier que les nouvelles tables ont des RLS policies

### Pattern Service

- Suivre le pattern factory function : `driftPersistenceService(db: Db)` retourne un objet avec les methodes
- Utiliser `eq()`, `and()`, `desc()`, `sql` de drizzle-orm pour les queries
- Ne PAS utiliser de raw SQL sauf pour les features non supportees par Drizzle

---

## Definition of Done

- [ ] 2 schemas Drizzle crees (drift_reports, drift_items)
- [ ] Migration generee et executable sans erreur
- [ ] Service drift-persistence.ts avec 9 fonctions CRUD
- [ ] drift.ts refactore : plus de Map in-memory pour les donnees
- [ ] Routes drift.ts avec companyId + pagination + filtres
- [ ] Types partages enrichis dans @mnm/shared
- [ ] Barrel exports mis a jour (schema + services)
- [ ] Audit event emis a la resolution d'un drift item
- [ ] Transaction atomique pour la creation rapport + items
- [ ] 48 tests E2E Playwright passent (file-content based)
- [ ] `pnpm typecheck` passe sans erreur
- [ ] Pas de regression sur les tests existants
