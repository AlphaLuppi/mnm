# OBS-S01 : Table audit_events -- Service d'audit immutable + Routes API

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | OBS-S01 |
| **Titre** | Table audit_events -- Service d'audit immutable + Routes API |
| **Epic** | Epic OBS -- Observabilite & Audit (Noyau B) |
| **Sprint** | Sprint 3 (Batch 6) |
| **Effort** | M (5 SP, 3-4j) |
| **Priorite** | P0 -- Prerequis audit trail enterprise |
| **Assignation** | Tom (backend) |
| **Bloque par** | TECH-05 (RLS PostgreSQL 41 tables -- DONE), TECH-06 (10 nouvelles tables -- DONE) |
| **Debloque** | OBS-S02 (Service audit emission systematique), OBS-S04 (UI AuditLog), A2A-S03 (Audit A2A), DASH-S01 (API dashboards) |
| **ADR** | ADR-007 (Observabilite), ADR-001 (Multi-tenant RLS) |
| **Type** | Backend-only (service + routes API + migration SQL, pas de composant UI) |
| **FRs couverts** | REQ-OBS-02 (Audit log complet P0), REQ-OBS-05 (Export CSV/JSON P1), REQ-OBS-06 (Retention + immutable P1) |

---

## Description

### Contexte -- Pourquoi cette story est necessaire

MnM possede actuellement un systeme d'activite basique (`activity_log` + `logActivity()`) qui enregistre les actions dans une table standard. Ce systeme a plusieurs limitations critiques pour le B2B enterprise :

1. **Mutabilite** -- les enregistrements `activity_log` peuvent etre modifies ou supprimes, ce qui est inacceptable pour un audit trail enterprise
2. **Pas de hash chain** -- aucune garantie d'integrite cryptographique des evenements
3. **Pas de partitionnement** -- la table grandira sans controle sur 3+ ans de retention
4. **Pas d'export** -- aucune API pour exporter l'audit log en CSV ou JSON
5. **Pas de filtrage avance** -- l'API `activity_log` ne supporte que 3 filtres basiques (agentId, entityType, entityId)
6. **Pas de protection UPDATE/DELETE** -- un admin DB pourrait alterer les preuves

La table `audit_events` a ete creee par TECH-06 avec le schema Drizzle, et TECH-05 a mis la table sous RLS. Mais il n'existe ni service backend, ni routes API, ni migration SQL pour les protections d'immutabilite (TRIGGER deny UPDATE/DELETE), ni service de hash chain.

### Ce que cette story construit

1. **Migration SQL** pour les protections d'immutabilite :
   - TRIGGER `audit_events_deny_update` -- refuse tout UPDATE
   - TRIGGER `audit_events_deny_delete` -- refuse tout DELETE
   - Commentaire SQL sur la table pour documenter la politique de retention (3 ans)

2. **Service `audit.ts`** -- service centralise d'ecriture et lecture d'audit events :
   - `emit(input)` -- ecrire un audit event immutable avec hash chain optionnel
   - `list(filters)` -- lister les audit events avec 12 filtres (companyId, actorId, actorType, action, targetType, targetId, severity, dateFrom, dateTo, search, limit, offset)
   - `getById(companyId, id)` -- recuperer un audit event par ID
   - `count(filters)` -- compter les audit events selon filtres
   - `exportCsv(filters)` -- generer un export CSV streame
   - `exportJson(filters)` -- generer un export JSON streame
   - `verifyChain(companyId, from, to)` -- verifier l'integrite du hash chain sur une plage de dates

3. **Routes API** dans `server/src/routes/audit.ts` :
   - `GET /api/companies/:companyId/audit` -- lister avec 12 filtres + pagination
   - `GET /api/companies/:companyId/audit/:id` -- detail d'un evenement
   - `GET /api/companies/:companyId/audit/count` -- compter les evenements
   - `GET /api/companies/:companyId/audit/export/csv` -- export CSV (streame)
   - `GET /api/companies/:companyId/audit/export/json` -- export JSON (streame)
   - `GET /api/companies/:companyId/audit/verify` -- verifier l'integrite du hash chain

4. **Zod validators** dans `packages/shared/src/validators/audit.ts` :
   - `auditEventFiltersSchema` -- validation query params pour les filtres
   - `auditExportFiltersSchema` -- validation query params pour les exports
   - `auditVerifySchema` -- validation query params pour la verification

5. **Types partages** dans `packages/shared/src/types/audit.ts` :
   - `AuditEventInput` -- type d'entree pour `emit()`
   - `AuditEvent` -- type de sortie (row DB)
   - `AuditAction` -- enum des actions auditables
   - `AuditActorType` -- enum des types d'acteur
   - `AuditTargetType` -- enum des types de cible
   - `AuditSeverity` -- enum des niveaux de severite

6. **Integration** barrel exports :
   - `server/src/services/index.ts` -- export `auditService`
   - `server/src/routes/index.ts` -- export `auditRoutes`
   - `packages/shared/src/validators/index.ts` -- export schemas audit
   - `packages/shared/src/index.ts` -- export types audit

### Ce que cette story ne fait PAS (scope)

- Pas d'emission systematique dans les 22 routes (OBS-S02)
- Pas d'UI AuditLog.tsx (OBS-S04)
- Pas de resume LLM (OBS-S03)
- Pas de partitionnement par mois (optimisation future -- la table fonctionne avec des index temporels pour le MVP)
- Pas de roles PostgreSQL separes (`mnm_app` vs `mnm_audit_admin`) -- simplification MVP, les TRIGGERs suffisent
- Pas de dashboards agreges (DASH-S01)

---

## Etat Actuel du Code (Analyse)

### Schema existant (TECH-06 -- DONE)

Le fichier `packages/db/src/schema/audit_events.ts` existe deja :

```typescript
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    severity: text("severity").notNull().default("info"),
    prevHash: text("prev_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyCreatedIdx: index("audit_events_company_created_idx").on(table.companyId, table.createdAt),
    companyActorIdx: index("audit_events_company_actor_idx").on(table.companyId, table.actorId, table.actorType),
    companyActionIdx: index("audit_events_company_action_idx").on(table.companyId, table.action),
    companyTargetIdx: index("audit_events_company_target_idx").on(table.companyId, table.targetType, table.targetId),
    companySeverityIdx: index("audit_events_company_severity_idx").on(table.companyId, table.severity, table.createdAt),
  }),
);
```

**Observations cles** :
- 5 index B-tree optimises pour les patterns de requetes courants
- `prevHash` present pour le hash chain SHA-256
- `metadata` JSONB pour les donnees contextuelles variables
- `severity` avec default `"info"` -- valeurs : `info`, `warning`, `error`, `critical`
- Table deja sous RLS (TECH-05) -- isolation multi-tenant garantie
- Exporte dans `packages/db/src/schema/index.ts` ligne 45

### Systeme existant (activity_log)

Le fichier `server/src/services/activity-log.ts` fournit `logActivity()` -- pattern de reference :
- Prend un `LogActivityInput` avec companyId, actorType, actorId, action, entityType, entityId
- Sanitize les details via `sanitizeRecord()` (redaction des secrets/JWT)
- Publie un `publishLiveEvent()` apres l'insertion
- Le service `audit.ts` suivra le meme pattern mais avec des garanties supplementaires

### Permissions existantes

Les permission keys sont deja definies (RBAC-S02 -- DONE) :
- `audit:read` -- permission pour lire les audit events
- `audit:export` -- permission pour exporter les audit events

### Fichiers existants impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `server/src/services/index.ts` | Barrel exports services | MODIFIE : ajout export `auditService` |
| `server/src/routes/index.ts` | Router registration | MODIFIE : ajout export `auditRoutes` |
| `packages/shared/src/validators/index.ts` | Barrel exports validators | MODIFIE : ajout export schemas audit |
| `packages/shared/src/index.ts` | Barrel exports types | MODIFIE : ajout export types audit |

### Fichiers a creer

| Fichier | Role |
|---------|------|
| `server/src/services/audit.ts` | Service audit events (emit, list, export, verify) |
| `server/src/routes/audit.ts` | Routes API Express pour audit |
| `packages/shared/src/validators/audit.ts` | Schemas Zod validation |
| `packages/shared/src/types/audit.ts` | Types partages audit |
| `packages/db/drizzle/XXXX_audit_events_immutability.sql` | Migration SQL triggers |

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `packages/db/src/schema/audit_events.ts` | Schema Drizzle (deja cree TECH-06) |
| `server/src/services/activity-log.ts` | `logActivity()` -- reference pattern emission |
| `server/src/services/activity.ts` | `activityService()` -- reference pattern service list/filter |
| `server/src/routes/activity.ts` | `activityRoutes()` -- reference pattern routes |
| `server/src/middleware/require-permission.ts` | `requirePermission()` middleware |
| `server/src/routes/authz.ts` | `assertCompanyAccess()`, `getActorInfo()` |
| `server/src/redaction.ts` | `sanitizeRecord()` -- redaction secrets |
| `packages/shared/src/constants.ts` | `PERMISSION_KEYS` -- `audit:read`, `audit:export` |

### Conventions du codebase (a respecter)

1. **Service pattern** : `auditService(db)` retourne un objet de fonctions -- pas de classes
2. **Error handling** : `throw notFound("message")`, `throw forbidden("message")`
3. **Drizzle queries** : `db.select().from().where(and(...))` avec `drizzle-orm` operators
4. **Route pattern** : `export function auditRoutes(db: Db) { const router = Router(); ... }`
5. **Permission check** : `requirePermission(db, "audit:read")` pour la lecture, `requirePermission(db, "audit:export")` pour l'export
6. **Company access** : `assertCompanyAccess(req, companyId)` pour chaque route
7. **Sanitization** : `sanitizeRecord()` pour rediger les secrets dans metadata
8. **Live events** : `publishLiveEvent()` apres l'insertion d'un audit event

---

## Acceptance Criteria

### AC-1 : Immutabilite -- TRIGGER deny UPDATE

**Given** un audit event existant dans la table `audit_events`
**When** une requete SQL `UPDATE audit_events SET ...` est executee
**Then** le TRIGGER refuse l'operation avec l'erreur `"audit_events: UPDATE is denied — immutable audit trail"`
**And** l'enregistrement reste inchange

### AC-2 : Immutabilite -- TRIGGER deny DELETE

**Given** un audit event existant dans la table `audit_events`
**When** une requete SQL `DELETE FROM audit_events WHERE ...` est executee
**Then** le TRIGGER refuse l'operation avec l'erreur `"audit_events: DELETE is denied — immutable audit trail"`
**And** l'enregistrement n'est pas supprime

### AC-3 : Emission d'un audit event

**Given** le service `auditService`
**When** `emit()` est appele avec `{ companyId, actorId, actorType, action, targetType, targetId, metadata, ipAddress, severity }`
**Then** un enregistrement est insere dans `audit_events` avec tous les champs
**And** le champ `prevHash` contient le SHA-256 du dernier event de la meme company (ou `null` si premier event)
**And** les secrets dans `metadata` sont sanitizes via `sanitizeRecord()`
**And** un `publishLiveEvent()` de type `"audit.event_created"` est emis

### AC-4 : Listing avec 12 filtres + pagination

**Given** 100 audit events pour une company
**When** `GET /api/companies/:companyId/audit?actorType=user&severity=warning&limit=20&offset=0` est appele
**Then** la reponse contient max 20 events filtres par actorType=user ET severity=warning
**And** la reponse inclut `{ data: [...], total: N, limit: 20, offset: 0 }` pour la pagination
**And** les resultats sont ordonnes par `createdAt` descendant

### AC-5 : Les 12 filtres supportes

**Given** l'API `GET /api/companies/:companyId/audit`
**When** les query params sont utilises
**Then** les filtres suivants sont supportes :
- `actorId` -- filtre exact sur l'acteur
- `actorType` -- filtre exact (`user`, `agent`, `system`)
- `action` -- filtre exact sur l'action (ex: `members.invite`, `access.denied`)
- `targetType` -- filtre exact sur le type de cible (ex: `agent`, `project`, `workflow`)
- `targetId` -- filtre exact sur l'ID de la cible
- `severity` -- filtre exact (`info`, `warning`, `error`, `critical`)
- `dateFrom` -- filtre `>=` sur `createdAt` (ISO 8601)
- `dateTo` -- filtre `<=` sur `createdAt` (ISO 8601)
- `search` -- recherche textuelle dans `action`, `targetType`, `targetId` (ILIKE)
- `limit` -- nombre max de resultats (default 50, max 200)
- `offset` -- pagination offset (default 0)
- `sortOrder` -- `asc` ou `desc` (default `desc`)

### AC-6 : Detail d'un audit event

**Given** un audit event existant avec ID `event-123`
**When** `GET /api/companies/:companyId/audit/event-123` est appele
**Then** la reponse contient l'event complet avec tous les champs
**And** si l'event n'existe pas, la reponse est `404 Not Found`

### AC-7 : Count des audit events

**Given** 50 audit events de severity `warning` pour une company
**When** `GET /api/companies/:companyId/audit/count?severity=warning` est appele
**Then** la reponse contient `{ count: 50 }` (memes filtres que AC-5 sauf limit/offset/sortOrder)

### AC-8 : Export CSV

**Given** des audit events dans la company
**When** `GET /api/companies/:companyId/audit/export/csv?dateFrom=...&dateTo=...` est appele par un user avec `audit:export`
**Then** la reponse est un fichier CSV avec header `Content-Type: text/csv`
**And** le header `Content-Disposition: attachment; filename="audit-export-{companyId}-{date}.csv"` est present
**And** les colonnes sont : `id,createdAt,actorId,actorType,action,targetType,targetId,severity,ipAddress,metadata`
**And** le CSV est streame (pas charge en memoire)

### AC-9 : Export JSON

**Given** des audit events dans la company
**When** `GET /api/companies/:companyId/audit/export/json?dateFrom=...&dateTo=...` est appele par un user avec `audit:export`
**Then** la reponse est un fichier JSON avec header `Content-Type: application/json`
**And** le header `Content-Disposition: attachment; filename="audit-export-{companyId}-{date}.json"` est present
**And** le JSON est streame (pas charge en memoire)

### AC-10 : Verification hash chain

**Given** une sequence d'audit events avec hash chain
**When** `GET /api/companies/:companyId/audit/verify?dateFrom=...&dateTo=...` est appele
**Then** la reponse contient `{ valid: true, eventsChecked: N, firstEventId: "...", lastEventId: "..." }`
**And** si un event a ete corrompu, `{ valid: false, brokenAt: "event-id", eventsChecked: N }`

### AC-11 : Permission enforcement -- audit:read

**Given** un user sans la permission `audit:read`
**When** il tente `GET /api/companies/:companyId/audit`
**Then** la reponse est `403 Forbidden` avec `{ "error": "Missing permission: audit:read" }`

### AC-12 : Permission enforcement -- audit:export

**Given** un user avec `audit:read` mais sans `audit:export`
**When** il tente `GET /api/companies/:companyId/audit/export/csv`
**Then** la reponse est `403 Forbidden` avec `{ "error": "Missing permission: audit:export" }`

### AC-13 : Company access enforcement

**Given** un user de Company A
**When** il tente d'acceder aux audit events de Company B
**Then** la reponse est `403 Forbidden` (RLS + assertCompanyAccess)

### AC-14 : Validation query params

**Given** des query params invalides (ex: `severity=MEGA`, `limit=9999`, `dateFrom=not-a-date`)
**When** la requete est envoyee
**Then** la reponse est `400 Bad Request` avec les details de validation Zod

### AC-15 : Hash chain SHA-256

**Given** le premier audit event d'une company
**When** `emit()` est appele
**Then** `prevHash` est `null` (premier de la chaine)

**Given** un audit event precedent existe pour la company
**When** `emit()` est appele
**Then** `prevHash` contient `SHA-256(JSON.stringify({ id, action, targetType, targetId, createdAt }))` du dernier event

---

## Specifications Techniques

### Migration SQL : `packages/db/drizzle/XXXX_audit_events_immutability.sql`

```sql
-- audit_events immutability triggers
-- Deny UPDATE on audit_events
CREATE OR REPLACE FUNCTION audit_events_deny_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events: UPDATE is denied — immutable audit trail';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_deny_update_trigger
BEFORE UPDATE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION audit_events_deny_update();

-- Deny DELETE on audit_events
CREATE OR REPLACE FUNCTION audit_events_deny_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events: DELETE is denied — immutable audit trail';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_deny_delete_trigger
BEFORE DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION audit_events_deny_delete();

-- Document retention policy
COMMENT ON TABLE audit_events IS 'Immutable audit trail. Retention: 3 years minimum. UPDATE and DELETE denied by triggers.';
```

**Note** : Cette migration est un fichier SQL custom execute via `pnpm db:migrate`. Le numero de migration (XXXX) sera le prochain numero sequentiel dans `packages/db/drizzle/`.

### Types partages : `packages/shared/src/types/audit.ts`

```typescript
export const AUDIT_ACTOR_TYPES = ["user", "agent", "system"] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_SEVERITY_LEVELS = ["info", "warning", "error", "critical"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITY_LEVELS)[number];

export const AUDIT_TARGET_TYPES = [
  "agent", "project", "workflow", "issue", "company",
  "member", "permission", "invite", "container", "secret",
  "stage", "approval", "chat_channel", "sso_config",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

// Non-exhaustive list — actions are extensible strings.
// OBS-S02 will define the full catalog when integrating into 22 route files.
export const AUDIT_ACTIONS = [
  // Member management
  "members.invite", "members.remove", "members.role_changed", "members.status_changed",
  // Access
  "access.denied", "access.scope_denied", "access.login", "access.logout",
  // Company config
  "company.config_change", "company.created",
  // Agent lifecycle
  "agent.created", "agent.launched", "agent.stopped", "agent.deleted",
  // Workflow
  "workflow.created", "workflow.transition", "workflow.transition_denied",
  // Project
  "project.member_added", "project.member_removed", "project.member_role_changed",
  // Container
  "container.created", "container.stopped", "container.killed",
  // Security
  "security.path_traversal", "security.credential_access", "security.rate_limited",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number] | string; // extensible

export interface AuditEventInput {
  companyId: string;
  actorId: string;
  actorType: AuditActorType;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: AuditSeverity;
}

export interface AuditEvent {
  id: string;
  companyId: string;
  actorId: string;
  actorType: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  severity: string;
  prevHash: string | null;
  createdAt: Date;
}

export interface AuditListResult {
  data: AuditEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditVerifyResult {
  valid: boolean;
  eventsChecked: number;
  firstEventId: string | null;
  lastEventId: string | null;
  brokenAt?: string;
}
```

### Validators : `packages/shared/src/validators/audit.ts`

```typescript
import { z } from "zod";
import { AUDIT_ACTOR_TYPES, AUDIT_SEVERITY_LEVELS } from "../types/audit.js";

export const auditEventFiltersSchema = z.object({
  actorId: z.string().optional(),
  actorType: z.enum(AUDIT_ACTOR_TYPES).optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  severity: z.enum(AUDIT_SEVERITY_LEVELS).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();

export const auditExportFiltersSchema = z.object({
  actorId: z.string().optional(),
  actorType: z.enum(AUDIT_ACTOR_TYPES).optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  severity: z.enum(AUDIT_SEVERITY_LEVELS).optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(200).optional(),
}).strict();

export const auditVerifySchema = z.object({
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
}).strict();
```

### Service : `server/src/services/audit.ts`

```typescript
import { and, eq, gte, lte, desc, asc, sql, ilike, or, count as drizzleCount } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Db } from "@mnm/db";
import { auditEvents } from "@mnm/db";
import type { AuditEventInput, AuditListResult, AuditVerifyResult } from "@mnm/shared";
import { publishLiveEvent } from "./live-events.js";
import { sanitizeRecord } from "../redaction.js";
import { notFound } from "../errors.js";

interface AuditFilters {
  companyId: string;
  actorId?: string;
  actorType?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
}

function buildConditions(filters: AuditFilters) {
  const conditions = [eq(auditEvents.companyId, filters.companyId)];
  if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId));
  if (filters.actorType) conditions.push(eq(auditEvents.actorType, filters.actorType));
  if (filters.action) conditions.push(eq(auditEvents.action, filters.action));
  if (filters.targetType) conditions.push(eq(auditEvents.targetType, filters.targetType));
  if (filters.targetId) conditions.push(eq(auditEvents.targetId, filters.targetId));
  if (filters.severity) conditions.push(eq(auditEvents.severity, filters.severity));
  if (filters.dateFrom) conditions.push(gte(auditEvents.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(auditEvents.createdAt, new Date(filters.dateTo)));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(auditEvents.action, pattern),
        ilike(auditEvents.targetType, pattern),
        ilike(auditEvents.targetId, pattern),
      )!,
    );
  }
  return conditions;
}

function computeHash(event: { id: string; action: string; targetType: string; targetId: string; createdAt: Date }): string {
  const payload = JSON.stringify({
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    createdAt: event.createdAt.toISOString(),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function auditService(db: Db) {
  return {
    emit: async (input: AuditEventInput) => {
      const sanitizedMetadata = input.metadata ? sanitizeRecord(input.metadata) : null;

      // Get the last event's hash for this company (chain)
      const lastEvent = await db
        .select({ id: auditEvents.id, action: auditEvents.action, targetType: auditEvents.targetType, targetId: auditEvents.targetId, createdAt: auditEvents.createdAt })
        .from(auditEvents)
        .where(eq(auditEvents.companyId, input.companyId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      const prevHash = lastEvent ? computeHash(lastEvent) : null;

      const [row] = await db.insert(auditEvents).values({
        companyId: input.companyId,
        actorId: input.actorId,
        actorType: input.actorType,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: sanitizedMetadata,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        severity: input.severity ?? "info",
        prevHash,
      }).returning();

      publishLiveEvent({
        companyId: input.companyId,
        type: "audit.event_created",
        payload: {
          id: row!.id,
          actorType: row!.actorType,
          actorId: row!.actorId,
          action: row!.action,
          targetType: row!.targetType,
          targetId: row!.targetId,
          severity: row!.severity,
        },
      });

      return row!;
    },

    list: async (filters: AuditFilters): Promise<AuditListResult> => {
      const conditions = buildConditions(filters);
      const limit = filters.limit ?? 50;
      const offset = filters.offset ?? 0;
      const order = filters.sortOrder === "asc" ? asc(auditEvents.createdAt) : desc(auditEvents.createdAt);

      const [data, totalResult] = await Promise.all([
        db.select().from(auditEvents).where(and(...conditions)).orderBy(order).limit(limit).offset(offset),
        db.select({ count: drizzleCount() }).from(auditEvents).where(and(...conditions)),
      ]);

      return {
        data,
        total: Number(totalResult[0]?.count ?? 0),
        limit,
        offset,
      };
    },

    getById: async (companyId: string, id: string) => {
      const row = await db
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.companyId, companyId), eq(auditEvents.id, id)))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Audit event not found");
      return row;
    },

    count: async (filters: AuditFilters): Promise<number> => {
      const conditions = buildConditions(filters);
      const result = await db.select({ count: drizzleCount() }).from(auditEvents).where(and(...conditions));
      return Number(result[0]?.count ?? 0);
    },

    exportCsv: async function* (filters: AuditFilters) { /* stream CSV rows */ },

    exportJson: async function* (filters: AuditFilters) { /* stream JSON rows */ },

    verifyChain: async (companyId: string, dateFrom?: string, dateTo?: string): Promise<AuditVerifyResult> => {
      /* verify SHA-256 chain integrity */
    },
  };
}
```

#### Implementation `emit`

1. Sanitize metadata via `sanitizeRecord()` si non-null
2. Query le dernier event de la company : `ORDER BY createdAt DESC LIMIT 1`
3. Calculer `prevHash = SHA-256(JSON.stringify({ id, action, targetType, targetId, createdAt }))` du dernier event
4. Si premier event : `prevHash = null`
5. `db.insert(auditEvents).values({...}).returning()`
6. Publier `publishLiveEvent({ type: "audit.event_created", ... })`
7. Retourner le row cree

#### Implementation `list`

1. Construire les conditions Drizzle via `buildConditions()`
2. Executer en parallele la query data (avec limit/offset/order) et la query count
3. Retourner `{ data, total, limit, offset }`

#### Implementation `exportCsv`

1. Construire les conditions sans limit/offset
2. Ecrire le header CSV : `id,createdAt,actorId,actorType,action,targetType,targetId,severity,ipAddress,metadata`
3. Streamer les rows par batch de 500 avec `yield` pour chaque batch
4. Escape CSV des valeurs (guillemets, virgules, retours a la ligne)

#### Implementation `exportJson`

1. Construire les conditions sans limit/offset
2. Ecrire `[` au debut
3. Streamer les rows par batch de 500 avec `yield` pour chaque batch
4. Separer par virgules, ecrire `]` a la fin

#### Implementation `verifyChain`

1. Query tous les events de la company entre dateFrom et dateTo, ordonnee par `createdAt ASC`
2. Pour chaque event (sauf le premier) : recalculer le hash de l'event precedent et comparer avec `prevHash`
3. Si discrepance : retourner `{ valid: false, brokenAt: event.id, eventsChecked: i }`
4. Si tout est coherent : retourner `{ valid: true, eventsChecked: N, firstEventId, lastEventId }`

### Routes : `server/src/routes/audit.ts`

```typescript
import { Router } from "express";
import type { Db } from "@mnm/db";
import { requirePermission } from "../middleware/require-permission.js";
import { auditService } from "../services/audit.js";
import { assertCompanyAccess } from "./authz.js";
import { auditEventFiltersSchema, auditExportFiltersSchema, auditVerifySchema } from "@mnm/shared";

export function auditRoutes(db: Db) {
  const router = Router();
  const svc = auditService(db);

  // GET /api/companies/:companyId/audit — list with 12 filters + pagination
  router.get(
    "/companies/:companyId/audit",
    requirePermission(db, "audit:read"),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const filters = auditEventFiltersSchema.parse(req.query);
      const result = await svc.list({ companyId: req.params.companyId, ...filters });
      res.json(result);
    },
  );

  // GET /api/companies/:companyId/audit/count — count events
  router.get(
    "/companies/:companyId/audit/count",
    requirePermission(db, "audit:read"),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const filters = auditExportFiltersSchema.parse(req.query);
      const count = await svc.count({ companyId: req.params.companyId, ...filters });
      res.json({ count });
    },
  );

  // GET /api/companies/:companyId/audit/export/csv — export CSV (streamed)
  router.get(
    "/companies/:companyId/audit/export/csv",
    requirePermission(db, "audit:export"),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const filters = auditExportFiltersSchema.parse(req.query);
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-export-${req.params.companyId}-${date}.csv"`);
      for await (const chunk of svc.exportCsv({ companyId: req.params.companyId, ...filters })) {
        res.write(chunk);
      }
      res.end();
    },
  );

  // GET /api/companies/:companyId/audit/export/json — export JSON (streamed)
  router.get(
    "/companies/:companyId/audit/export/json",
    requirePermission(db, "audit:export"),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const filters = auditExportFiltersSchema.parse(req.query);
      const date = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="audit-export-${req.params.companyId}-${date}.json"`);
      for await (const chunk of svc.exportJson({ companyId: req.params.companyId, ...filters })) {
        res.write(chunk);
      }
      res.end();
    },
  );

  // GET /api/companies/:companyId/audit/verify — verify hash chain integrity
  router.get(
    "/companies/:companyId/audit/verify",
    requirePermission(db, "audit:read"),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const params = auditVerifySchema.parse(req.query);
      const result = await svc.verifyChain(req.params.companyId, params.dateFrom, params.dateTo);
      res.json(result);
    },
  );

  // GET /api/companies/:companyId/audit/:id — single event detail
  router.get(
    "/companies/:companyId/audit/:id",
    requirePermission(db, "audit:read"),
    async (req, res) => {
      assertCompanyAccess(req, req.params.companyId);
      const event = await svc.getById(req.params.companyId, req.params.id);
      res.json(event);
    },
  );

  return router;
}
```

**Note sur l'ordre des routes** : `/audit/count`, `/audit/export/csv`, `/audit/export/json`, `/audit/verify` sont declares AVANT `/audit/:id` pour eviter que Express interprete "count", "export", "verify" comme un `:id`.

---

## data-test-id Mapping

### Convention

Tous les `data-testid` suivent le format `obs-s01-[element]`.
Cette story est backend-only. Les data-testid sont destines aux tests E2E Playwright qui verifient les fichiers source, les reponses API et la structure du code.

### data-testid pour fichiers et structure

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-service-file` | `server/src/services/audit.ts` | Fichier | Service audit events |
| `obs-s01-routes-file` | `server/src/routes/audit.ts` | Fichier | Routes API audit |
| `obs-s01-types-file` | `packages/shared/src/types/audit.ts` | Fichier | Types partages audit |
| `obs-s01-validator-file` | `packages/shared/src/validators/audit.ts` | Fichier | Schemas Zod audit |
| `obs-s01-migration-file` | `packages/db/drizzle/XXXX_audit_events_immutability.sql` | Fichier | Migration triggers |
| `obs-s01-service-export` | Export dans `server/src/services/index.ts` | Code | `export { auditService }` |
| `obs-s01-routes-export` | Export dans `server/src/routes/index.ts` | Code | `export { auditRoutes }` |
| `obs-s01-validator-export` | Export dans `packages/shared/src/validators/index.ts` | Code | Export schemas audit |
| `obs-s01-types-export` | Export dans `packages/shared/src/index.ts` | Code | Export types audit |

### data-testid pour service functions

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-emit-fn` | `emit()` function | Service | Ecrire un audit event immutable |
| `obs-s01-list-fn` | `list()` function | Service | Lister avec filtres + pagination |
| `obs-s01-get-by-id-fn` | `getById()` function | Service | Recuperer un event par ID |
| `obs-s01-count-fn` | `count()` function | Service | Compter les events selon filtres |
| `obs-s01-export-csv-fn` | `exportCsv()` function | Service | Export CSV streame |
| `obs-s01-export-json-fn` | `exportJson()` function | Service | Export JSON streame |
| `obs-s01-verify-chain-fn` | `verifyChain()` function | Service | Verifier integrite hash chain |
| `obs-s01-compute-hash-fn` | `computeHash()` function | Util | Calculer SHA-256 d'un event |
| `obs-s01-build-conditions-fn` | `buildConditions()` function | Util | Construire conditions Drizzle |
| `obs-s01-sanitize-metadata` | `sanitizeRecord()` call in emit | Code | Redaction des secrets |
| `obs-s01-publish-live-event` | `publishLiveEvent()` call in emit | Code | Notification temps reel |

### data-testid pour API endpoints

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-list-endpoint` | `GET /companies/:companyId/audit` | API | Lister events + pagination |
| `obs-s01-detail-endpoint` | `GET /companies/:companyId/audit/:id` | API | Detail d'un event |
| `obs-s01-count-endpoint` | `GET /companies/:companyId/audit/count` | API | Compter les events |
| `obs-s01-export-csv-endpoint` | `GET /companies/:companyId/audit/export/csv` | API | Export CSV |
| `obs-s01-export-json-endpoint` | `GET /companies/:companyId/audit/export/json` | API | Export JSON |
| `obs-s01-verify-endpoint` | `GET /companies/:companyId/audit/verify` | API | Verification hash chain |

### data-testid pour permissions et securite

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-permission-audit-read` | `requirePermission(db, "audit:read")` | Middleware | Protection lecture |
| `obs-s01-permission-audit-export` | `requirePermission(db, "audit:export")` | Middleware | Protection export |
| `obs-s01-company-access-check` | `assertCompanyAccess(req, companyId)` | Middleware | Isolation company |
| `obs-s01-forbidden-read` | `403 Forbidden` response (audit:read) | Error | Permission lecture manquante |
| `obs-s01-forbidden-export` | `403 Forbidden` response (audit:export) | Error | Permission export manquante |
| `obs-s01-not-found-event` | `404 Not Found` response | Error | Event inexistant |
| `obs-s01-validation-error` | `400 Bad Request` response | Error | Query params invalides |

### data-testid pour immutabilite

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-trigger-deny-update` | `audit_events_deny_update_trigger` | SQL | TRIGGER refuse UPDATE |
| `obs-s01-trigger-deny-delete` | `audit_events_deny_delete_trigger` | SQL | TRIGGER refuse DELETE |
| `obs-s01-trigger-update-fn` | `audit_events_deny_update()` | SQL | Fonction PL/pgSQL UPDATE |
| `obs-s01-trigger-delete-fn` | `audit_events_deny_delete()` | SQL | Fonction PL/pgSQL DELETE |
| `obs-s01-table-comment` | `COMMENT ON TABLE audit_events` | SQL | Documentation retention |

### data-testid pour types et constantes

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-actor-types` | `AUDIT_ACTOR_TYPES` | Constant | `["user", "agent", "system"]` |
| `obs-s01-severity-levels` | `AUDIT_SEVERITY_LEVELS` | Constant | `["info", "warning", "error", "critical"]` |
| `obs-s01-target-types` | `AUDIT_TARGET_TYPES` | Constant | Liste des types de cible |
| `obs-s01-audit-actions` | `AUDIT_ACTIONS` | Constant | Liste des actions auditables |
| `obs-s01-event-input-type` | `AuditEventInput` interface | Type | Type d'entree emit() |
| `obs-s01-event-type` | `AuditEvent` interface | Type | Type de sortie (row DB) |
| `obs-s01-list-result-type` | `AuditListResult` interface | Type | Type reponse list() |
| `obs-s01-verify-result-type` | `AuditVerifyResult` interface | Type | Type reponse verify() |

### data-testid pour validators

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-filters-schema` | `auditEventFiltersSchema` | Zod | Validation filtres list |
| `obs-s01-export-filters-schema` | `auditExportFiltersSchema` | Zod | Validation filtres export |
| `obs-s01-verify-schema` | `auditVerifySchema` | Zod | Validation params verify |
| `obs-s01-filters-limit-default` | `limit` default 50 | Validator | Default pagination |
| `obs-s01-filters-limit-max` | `limit` max 200 | Validator | Max pagination |
| `obs-s01-filters-offset-default` | `offset` default 0 | Validator | Default offset |
| `obs-s01-filters-sort-default` | `sortOrder` default "desc" | Validator | Default tri |

### data-testid pour hash chain

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-hash-sha256` | SHA-256 algorithm | Code | Algorithme de hashage |
| `obs-s01-hash-first-event-null` | `prevHash = null` for first event | Logic | Premier event sans hash |
| `obs-s01-hash-chain-link` | `prevHash = SHA-256(previous)` | Logic | Chaingage des events |
| `obs-s01-verify-valid-result` | `{ valid: true, eventsChecked }` | Response | Verification OK |
| `obs-s01-verify-broken-result` | `{ valid: false, brokenAt }` | Response | Chaine corrompue |

### data-testid pour reponse API list

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s01-list-response-shape` | `{ data, total, limit, offset }` | Response | Shape reponse pagination |
| `obs-s01-count-response-shape` | `{ count }` | Response | Shape reponse count |
| `obs-s01-csv-content-type` | `Content-Type: text/csv` | Header | Type CSV |
| `obs-s01-json-content-type` | `Content-Type: application/json` | Header | Type JSON |
| `obs-s01-csv-disposition` | `Content-Disposition: attachment` | Header | Nom fichier CSV |
| `obs-s01-json-disposition` | `Content-Disposition: attachment` | Header | Nom fichier JSON |

---

## Test Cases pour Agent QA

### Groupe 1 : Verification fichiers (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T01 | Service file existe | `server/src/services/audit.ts` existe et exporte `auditService` |
| T02 | Routes file existe | `server/src/routes/audit.ts` existe et exporte `auditRoutes` |
| T03 | Types file existe | `packages/shared/src/types/audit.ts` existe et exporte les types |
| T04 | Validator file existe | `packages/shared/src/validators/audit.ts` existe et exporte les schemas |
| T05 | Migration file existe | Un fichier `*audit_events_immutability*` existe dans `packages/db/drizzle/` |
| T06 | Service barrel export | `server/src/services/index.ts` contient `auditService` |
| T07 | Routes barrel export | `server/src/routes/index.ts` contient `auditRoutes` |
| T08 | Validator barrel export | `packages/shared/src/validators/index.ts` contient les exports audit |
| T09 | Types barrel export | `packages/shared/src/index.ts` contient les exports types audit |

### Groupe 2 : Service functions (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T10 | emit function | Service contient `emit` qui insere dans `auditEvents` |
| T11 | list function | Service contient `list` avec pagination (limit, offset, total) |
| T12 | getById function | Service contient `getById` qui retourne un event ou `notFound` |
| T13 | count function | Service contient `count` qui retourne un nombre |
| T14 | exportCsv function | Service contient `exportCsv` comme generateur asynchrone |
| T15 | exportJson function | Service contient `exportJson` comme generateur asynchrone |
| T16 | verifyChain function | Service contient `verifyChain` qui retourne `AuditVerifyResult` |
| T17 | computeHash function | Service contient `computeHash` utilisant `createHash("sha256")` |
| T18 | buildConditions function | Service contient `buildConditions` pour construire les filtres Drizzle |
| T19 | Sanitization | `emit` appelle `sanitizeRecord()` sur metadata |
| T20 | Live event | `emit` appelle `publishLiveEvent()` avec type `"audit.event_created"` |
| T21 | Hash chain first | `emit` met `prevHash = null` si pas d'event precedent |
| T22 | Hash chain link | `emit` calcule `prevHash` depuis le dernier event de la company |

### Groupe 3 : Routes (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T23 | GET list route | Route `GET /companies/:companyId/audit` existe |
| T24 | GET detail route | Route `GET /companies/:companyId/audit/:id` existe |
| T25 | GET count route | Route `GET /companies/:companyId/audit/count` existe |
| T26 | GET export CSV route | Route `GET /companies/:companyId/audit/export/csv` existe |
| T27 | GET export JSON route | Route `GET /companies/:companyId/audit/export/json` existe |
| T28 | GET verify route | Route `GET /companies/:companyId/audit/verify` existe |
| T29 | Route order | `/audit/count`, `/audit/export/*`, `/audit/verify` declares AVANT `/audit/:id` |
| T30 | Company access check | Toutes les routes appellent `assertCompanyAccess()` |

### Groupe 4 : Permission enforcement (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T31 | List permission | `GET /audit` utilise `requirePermission(db, "audit:read")` |
| T32 | Detail permission | `GET /audit/:id` utilise `requirePermission(db, "audit:read")` |
| T33 | Count permission | `GET /audit/count` utilise `requirePermission(db, "audit:read")` |
| T34 | Export CSV permission | `GET /audit/export/csv` utilise `requirePermission(db, "audit:export")` |
| T35 | Export JSON permission | `GET /audit/export/json` utilise `requirePermission(db, "audit:export")` |
| T36 | Verify permission | `GET /audit/verify` utilise `requirePermission(db, "audit:read")` |

### Groupe 5 : Types et constantes (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T37 | AUDIT_ACTOR_TYPES | Contient `["user", "agent", "system"]` |
| T38 | AUDIT_SEVERITY_LEVELS | Contient `["info", "warning", "error", "critical"]` |
| T39 | AUDIT_TARGET_TYPES | Contient au moins `agent`, `project`, `workflow`, `company` |
| T40 | AUDIT_ACTIONS | Contient au moins `members.invite`, `access.denied`, `agent.created` |
| T41 | AuditEventInput interface | Contient `companyId`, `actorId`, `actorType`, `action`, `targetType`, `targetId` |
| T42 | AuditEvent interface | Contient tous les champs du schema + `prevHash` |
| T43 | AuditListResult interface | Contient `data`, `total`, `limit`, `offset` |
| T44 | AuditVerifyResult interface | Contient `valid`, `eventsChecked`, `firstEventId`, `lastEventId` |

### Groupe 6 : Validators (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T45 | auditEventFiltersSchema | Schema Zod avec 12 champs : actorId, actorType, action, targetType, targetId, severity, dateFrom, dateTo, search, limit, offset, sortOrder |
| T46 | auditExportFiltersSchema | Schema Zod avec 9 champs (sans limit, offset, sortOrder) |
| T47 | auditVerifySchema | Schema Zod avec 2 champs : dateFrom, dateTo |
| T48 | Limit default | `limit` default 50 |
| T49 | Limit max | `limit` max 200 |
| T50 | Offset default | `offset` default 0 |
| T51 | SortOrder default | `sortOrder` default "desc" |
| T52 | Strict mode | Tous les schemas utilisent `.strict()` |
| T53 | DateTime validation | `dateFrom` et `dateTo` utilisent `z.string().datetime()` |

### Groupe 7 : Migration SQL / Immutabilite (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T54 | Deny UPDATE trigger | Migration contient `CREATE TRIGGER audit_events_deny_update_trigger` |
| T55 | Deny DELETE trigger | Migration contient `CREATE TRIGGER audit_events_deny_delete_trigger` |
| T56 | Deny UPDATE function | Migration contient `CREATE OR REPLACE FUNCTION audit_events_deny_update()` |
| T57 | Deny DELETE function | Migration contient `CREATE OR REPLACE FUNCTION audit_events_deny_delete()` |
| T58 | UPDATE error message | Fonction contient `audit_events: UPDATE is denied` |
| T59 | DELETE error message | Fonction contient `audit_events: DELETE is denied` |
| T60 | BEFORE trigger | Les deux triggers sont `BEFORE UPDATE` et `BEFORE DELETE` |
| T61 | FOR EACH ROW | Les deux triggers sont `FOR EACH ROW` |
| T62 | Table comment | Migration contient `COMMENT ON TABLE audit_events` |
| T63 | Retention mention | Le commentaire mentionne "3 years" ou "retention" |

### Groupe 8 : Hash chain (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T64 | SHA-256 import | Service importe `createHash` depuis `node:crypto` |
| T65 | Hash computation | `computeHash` utilise `createHash("sha256")` |
| T66 | Hash payload | Hash calcule sur `{ id, action, targetType, targetId, createdAt }` |
| T67 | JSON.stringify | Hash utilise `JSON.stringify()` avant le digest |
| T68 | Hex output | Hash retourne en format `hex` |

### Groupe 9 : Export streams (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T69 | CSV Content-Type | Route CSV set `Content-Type: text/csv` |
| T70 | JSON Content-Type | Route JSON set `Content-Type: application/json` |
| T71 | CSV Content-Disposition | Route CSV set `Content-Disposition: attachment; filename="audit-export-..."` |
| T72 | JSON Content-Disposition | Route JSON set `Content-Disposition: attachment; filename="audit-export-..."` |
| T73 | CSV async generator | `exportCsv` est une `async function*` ou retourne un async iterable |
| T74 | JSON async generator | `exportJson` est une `async function*` ou retourne un async iterable |
| T75 | CSV header | Le CSV contient une ligne header avec les colonnes |

### Groupe 10 : Integration patterns (file-content based)

| # | Test | Verification |
|---|------|-------------|
| T76 | Service uses Drizzle | Queries utilisent `db.select()`, `db.insert()` |
| T77 | notFound import | Service importe `notFound` depuis `../errors.js` |
| T78 | sanitizeRecord import | Service importe `sanitizeRecord` depuis `../redaction.js` |
| T79 | publishLiveEvent import | Service importe `publishLiveEvent` depuis `./live-events.js` |
| T80 | auditEvents import | Service importe `auditEvents` depuis `@mnm/db` |

---

## Notes Techniques

### Concurrence sur le hash chain

L'implementation actuelle du hash chain est non-transactionnelle -- si deux `emit()` sont appeles en meme temps pour la meme company, ils pourraient obtenir le meme "dernier event" et produire le meme `prevHash`. Ceci est acceptable pour le MVP car :

1. Les audit events sont typiquement emis sequentiellement dans le contexte d'une requete HTTP
2. Le hash chain est une garantie supplementaire (P2 selon l'ADR-007), pas la garantie primaire d'immutabilite (les TRIGGERs sont la garantie primaire)
3. Une version future pourrait utiliser un `SELECT ... FOR UPDATE` ou un advisory lock pour garantir la serialisation

### Pas de partitionnement pour le MVP

Le PRD mentionne le partitionnement par mois (`PARTITION BY RANGE(createdAt)`). Ceci est reporte car :

1. Drizzle ORM ne supporte pas nativement les tables partitionnees PostgreSQL
2. Les index B-tree existants suffisent pour les volumes MVP (<100K events)
3. Le partitionnement sera implemente en migration SQL separee quand le volume le justifie

### Pas de roles PostgreSQL separes

L'ADR-007 mentionne des roles separes (`mnm_app` ne peut pas DELETE, seul `mnm_audit_admin` le peut). Les TRIGGERs offrent une protection equivalente pour le MVP -- meme un superuser PostgreSQL ne peut pas contourner un BEFORE trigger sans le desactiver explicitement.

### Export streaming

Les exports CSV/JSON sont streames pour supporter les gros volumes sans charger tout en memoire. Le pattern `async function*` (generateur asynchrone) permet de yielder les chunks progressivement. Les routes utilisent `for await...of` pour lire et `res.write()` pour envoyer au client. Pas de limite de taille sur les exports -- les filtres dateFrom/dateTo permettent de controler le volume.

### Relation avec activity_log

La table `audit_events` et la table `activity_log` coexistent :
- `activity_log` : evenements operationnels (heartbeats, agent lifecycle, issue activity) -- mutable, pas de hash chain, pas d'immutabilite
- `audit_events` : trail d'audit enterprise (qui a fait quoi, quand, ou) -- immutable, hash chain, export, 3 ans retention

A terme (OBS-S02), les routes qui emettent des `logActivity()` emettront aussi des `auditService.emit()` pour les actions qui necessitent un audit trail. Les deux systemes sont complementaires.

### Permission keys

- `audit:read` -- requis pour `GET /audit`, `GET /audit/:id`, `GET /audit/count`, `GET /audit/verify`
- `audit:export` -- requis pour `GET /audit/export/csv` et `GET /audit/export/json`
- Ces keys existent deja dans `PERMISSION_KEYS` (ajoutees par RBAC-S02)
- Le preset `admin` a toutes les permissions, le preset `viewer` a `audit:read` mais pas `audit:export`

---

## Definition of Done

- [ ] `server/src/services/audit.ts` cree avec 7 fonctions (emit, list, getById, count, exportCsv, exportJson, verifyChain)
- [ ] `server/src/routes/audit.ts` cree avec 6 routes GET
- [ ] `packages/shared/src/types/audit.ts` cree avec types, constantes et interfaces
- [ ] `packages/shared/src/validators/audit.ts` cree avec 3 schemas Zod `.strict()`
- [ ] Migration SQL cree avec 2 triggers (deny UPDATE, deny DELETE) + table comment
- [ ] Exports ajoutes dans `server/src/services/index.ts`, `server/src/routes/index.ts`, `packages/shared/src/validators/index.ts`, `packages/shared/src/index.ts`
- [ ] Routes enregistrees dans le router principal
- [ ] `requirePermission(db, "audit:read")` sur routes lecture/count/verify
- [ ] `requirePermission(db, "audit:export")` sur routes export CSV/JSON
- [ ] `assertCompanyAccess()` sur toutes les routes
- [ ] Hash chain SHA-256 avec `prevHash` sur chaque event
- [ ] `sanitizeRecord()` sur metadata dans `emit()`
- [ ] `publishLiveEvent()` dans `emit()` avec type `"audit.event_created"`
- [ ] Generateurs asynchrones pour export CSV et JSON (streaming)
- [ ] Gestion des erreurs : 404 event inexistant, 403 permission, 400 validation
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
- [ ] Tests E2E Playwright (agent QA) passent
