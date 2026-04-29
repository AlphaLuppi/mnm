# OBS-S03 — Résumé LLM Actions Agent

> **Epic** : OBS — Observabilité & Audit (Noyau B)
> **Priorité** : P1
> **Effort** : M (3 SP, 2-3j)
> **Assignation** : Tom (backend)
> **Dépendances** : OBS-S01 (DONE), OBS-S02 (DONE)
> **Batch** : 13 — Enterprise

---

## Description

Service `audit-summarizer.ts` qui génère des résumés en langage naturel à partir des audit events techniques. Utilise un appel LLM (Claude Haiku ou équivalent) pour traduire les logs bruts en phrases compréhensibles par un CEO/Manager non-technique. Les résumés sont cachés en mémoire (TTL configurable) pour éviter les appels LLM redondants. Expose une route API pour récupérer les résumés par company, avec filtres temporels.

---

## Acceptance Criteria

### AC1 — Service audit-summarizer existe et exporte summarizeEvents
Given le fichier `server/src/services/audit-summarizer.ts`
When il est importé
Then il exporte la fonction `auditSummarizerService(db)` retournant un objet avec `summarize`, `getSummary`, `listSummaries`, et `invalidateCache`.

### AC2 — Résumé LLM traduit les events techniques en langage naturel
Given une liste d'audit events (ex: agent.created, workflow.transition, access.denied)
When le service `summarize` est appelé
Then il retourne un objet `AuditSummary` contenant un titre (1 phrase), un corps (2-5 phrases), les stats clés, et la période couverte.

### AC3 — Cache mémoire avec TTL configurable
Given un résumé déjà généré pour une company+période
When le même résumé est demandé à nouveau dans la fenêtre TTL (défaut: 5 minutes)
Then le résultat est retourné depuis le cache sans appel LLM.

### AC4 — Invalidation du cache
Given un résumé en cache
When `invalidateCache(companyId)` est appelé
Then toutes les entrées cache de cette company sont supprimées.

### AC5 — Route GET /api/companies/:companyId/audit/summary
Given un utilisateur avec permission `audit:read`
When il requête GET `/api/companies/:companyId/audit/summary?period=24h`
Then il reçoit un `AuditSummary` JSON avec le résumé de la période.

### AC6 — Route GET /api/companies/:companyId/audit/summaries
Given un utilisateur avec permission `audit:read`
When il requête GET `/api/companies/:companyId/audit/summaries`
Then il reçoit une liste des résumés récents avec pagination.

### AC7 — Route POST /api/companies/:companyId/audit/summary/generate
Given un utilisateur avec permission `audit:read`
When il POST force la génération d'un nouveau résumé
Then le cache est invalidé et un nouveau résumé est généré.

### AC8 — Types partagés AuditSummary exportés
Given le fichier `packages/shared/src/types/audit.ts`
When les types sont importés
Then `AuditSummary`, `AuditSummaryPeriod`, `AuditSummaryStats` sont disponibles.

### AC9 — Validators Zod pour les paramètres de résumé
Given les validators dans `packages/shared/src/validators/audit.ts`
When ils sont utilisés
Then `auditSummaryFiltersSchema` et `auditSummaryGenerateSchema` valident les entrées.

### AC10 — Barrel exports dans services/index.ts et shared/index.ts
Given les fichiers barrel
When ils sont importés
Then `auditSummarizerService` est exporté depuis services et les types/validators sont exportés depuis shared.

### AC11 — Graceful degradation sans LLM
Given que le provider LLM n'est pas configuré ou indisponible
When le service tente de générer un résumé
Then il retourne un résumé fallback basé sur les stats brutes (nombre d'events par catégorie, période).

### AC12 — Audit emission pour les résumés générés
Given qu'un résumé LLM est généré avec succès
When le résumé est persisté/retourné
Then un `audit.event_created` avec action `audit.summary_generated` est émis.

---

## data-test-id Mapping

| data-testid | Élément | Fichier |
|-------------|---------|---------|
| `obs-s03-service-file` | Service audit-summarizer.ts | `server/src/services/audit-summarizer.ts` |
| `obs-s03-summarize-fn` | Fonction summarize | `server/src/services/audit-summarizer.ts` |
| `obs-s03-get-summary-fn` | Fonction getSummary | `server/src/services/audit-summarizer.ts` |
| `obs-s03-list-summaries-fn` | Fonction listSummaries | `server/src/services/audit-summarizer.ts` |
| `obs-s03-invalidate-cache-fn` | Fonction invalidateCache | `server/src/services/audit-summarizer.ts` |
| `obs-s03-cache-map` | Cache Map interne | `server/src/services/audit-summarizer.ts` |
| `obs-s03-cache-ttl` | Constante CACHE_TTL_MS | `server/src/services/audit-summarizer.ts` |
| `obs-s03-llm-call` | Appel LLM provider | `server/src/services/audit-summarizer.ts` |
| `obs-s03-fallback-summary` | Résumé fallback stats-based | `server/src/services/audit-summarizer.ts` |
| `obs-s03-summary-route` | Route GET /audit/summary | `server/src/routes/audit.ts` |
| `obs-s03-summaries-route` | Route GET /audit/summaries | `server/src/routes/audit.ts` |
| `obs-s03-generate-route` | Route POST /audit/summary/generate | `server/src/routes/audit.ts` |
| `obs-s03-types` | Types AuditSummary | `packages/shared/src/types/audit.ts` |
| `obs-s03-validators` | Validators schemas | `packages/shared/src/validators/audit.ts` |
| `obs-s03-barrel-service` | Export in services/index.ts | `server/src/services/index.ts` |
| `obs-s03-barrel-shared` | Export in shared/index.ts | `packages/shared/src/index.ts` |
| `obs-s03-barrel-types` | Export in types/index.ts | `packages/shared/src/types/index.ts` |
| `obs-s03-barrel-validators` | Export in validators/index.ts | `packages/shared/src/validators/index.ts` |

---

## Test Cases (QA Agent)

### Groupe 1 — File existence & barrel exports (T01-T08)
- **T01**: Service file `audit-summarizer.ts` exists and exports `auditSummarizerService`
- **T02**: Service exports `summarize`, `getSummary`, `listSummaries`, `invalidateCache` functions
- **T03**: Types file contains `AuditSummary`, `AuditSummaryPeriod`, `AuditSummaryStats`
- **T04**: Validators file contains `auditSummaryFiltersSchema`, `auditSummaryGenerateSchema`
- **T05**: `services/index.ts` barrel exports `auditSummarizerService`
- **T06**: `shared/index.ts` barrel exports summary types
- **T07**: `types/index.ts` barrel exports summary types
- **T08**: `validators/index.ts` barrel exports summary validators

### Groupe 2 — Service summarize function (T09-T16)
- **T09**: `summarize` function accepts `companyId`, `period`, `options` parameters
- **T10**: `summarize` function queries audit events from DB using `auditService.list`
- **T11**: `summarize` builds a prompt with event statistics grouped by action category
- **T12**: `summarize` calls LLM provider and parses response
- **T13**: `summarize` returns `AuditSummary` with title, body, stats, period, generatedAt
- **T14**: `summarize` stores result in cache with TTL key
- **T15**: `summarize` emits `audit.summary_generated` via `emitAudit`
- **T16**: `summarize` gracefully degrades to fallback when LLM unavailable

### Groupe 3 — Cache behavior (T17-T22)
- **T17**: Cache key is derived from `companyId + period` combination
- **T18**: Cache hit returns stored result without LLM call
- **T19**: Cache respects TTL (expired entries trigger new LLM call)
- **T20**: `CACHE_TTL_MS` constant is exported and defaults to 300_000 (5 min)
- **T21**: `invalidateCache` removes all entries for a given companyId
- **T22**: Cache size is bounded (max entries eviction)

### Groupe 4 — Fallback summary (T23-T26)
- **T23**: Fallback summary uses event counts grouped by action prefix (domain)
- **T24**: Fallback summary includes period start/end dates
- **T25**: Fallback summary title follows pattern "Activity summary for [period]"
- **T26**: Fallback summary body lists top action categories with counts

### Groupe 5 — Routes (T27-T34)
- **T27**: Route GET `/companies/:companyId/audit/summary` exists in audit routes
- **T28**: Route GET `/companies/:companyId/audit/summaries` exists in audit routes
- **T29**: Route POST `/companies/:companyId/audit/summary/generate` exists in audit routes
- **T30**: Summary route validates `period` query parameter via Zod
- **T31**: Summaries route supports `limit` and `offset` pagination
- **T32**: Generate route calls `invalidateCache` then `summarize`
- **T33**: All 3 routes require `audit:read` permission
- **T34**: Routes are registered BEFORE the `:id` catch-all route in audit.ts

### Groupe 6 — Types and validators (T35-T40)
- **T35**: `AuditSummary` type has fields: id, companyId, title, body, stats, period, generatedAt, source
- **T36**: `AuditSummaryPeriod` is union type `"1h" | "6h" | "12h" | "24h" | "7d" | "30d"`
- **T37**: `AuditSummaryStats` has fields: totalEvents, topActions, eventsByDomain, eventsBySeverity
- **T38**: `auditSummaryFiltersSchema` validates period, limit, offset
- **T39**: `auditSummaryGenerateSchema` validates period (required), forceRefresh (optional)
- **T40**: Validators use `.strict()` mode

### Groupe 7 — Integration patterns (T41-T45)
- **T41**: Service uses `auditService(db).list` to fetch events (not raw DB queries)
- **T42**: Service uses `emitAudit` helper for audit trail
- **T43**: Routes use `assertCompanyAccess` for company authorization
- **T44**: Routes use `requirePermission(db, "audit:read")` middleware
- **T45**: Summary `source` field distinguishes "llm" vs "fallback"

---

## Deliverables

| # | Fichier | Action | Description |
|---|---------|--------|-------------|
| 1 | `server/src/services/audit-summarizer.ts` | CREATE | Service LLM résumé + cache |
| 2 | `packages/shared/src/types/audit.ts` | MODIFY | Ajouter AuditSummary types |
| 3 | `packages/shared/src/validators/audit.ts` | MODIFY | Ajouter summary validators |
| 4 | `server/src/routes/audit.ts` | MODIFY | Ajouter 3 routes summary |
| 5 | `server/src/services/index.ts` | MODIFY | Barrel export |
| 6 | `packages/shared/src/types/index.ts` | MODIFY | Barrel export |
| 7 | `packages/shared/src/validators/index.ts` | MODIFY | Barrel export |
| 8 | `packages/shared/src/index.ts` | MODIFY | Barrel export |

---

## Notes d'implémentation

- Le service NE dépend PAS d'un provider LLM spécifique — il utilise une interface abstraite (`generateSummaryText`) qui peut être injectée ou mockée
- Le fallback stat-based est la stratégie par défaut si aucun LLM n'est configuré
- Les résumés sont en mémoire (Map), pas persistés en DB — volume faible, pas de migration nécessaire
- Le cache est borné à 100 entrées max avec éviction FIFO
- Les routes summary sont ajoutées AVANT la route `:id` dans audit.ts pour éviter le conflit de matching Express
