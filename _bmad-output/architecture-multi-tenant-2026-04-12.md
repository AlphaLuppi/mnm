---
stepsCompleted: [drivers, pattern, routes, isolation, data, deployment, sprints]
inputDocuments: [CLAUDE.md, docs/ARCHITECTURE.md, product-brief-v3]
workflowType: architecture
project_name: mnm-multi-tenant
user_name: Tom
date: 2026-04-12
---

# Architecture — MnM Multi-Tenant

> MnM passe de single-tenant (1 instance = 1 company) à multi-tenant distribué (1 backend hébergé → N companies). Le serveur devient un API/data/orchestration layer pur. Le compute agent est côté client (MCP, Desktop Tauri, UI Web locale).

## 1. Drivers Architecturaux

| # | Driver | Impact | Priorité |
|---|--------|--------|----------|
| D1 | **Isolation tenant** — chaque company ne voit JAMAIS les données d'une autre | RLS déjà en place (41 tables). Routes et middleware chain doivent être 100% explicites sur companyId | CRITIQUE |
| D2 | **Auth multi-client** — Web, Desktop, MCP, Agent JWT | BetterAuth sessions + OAuth 2.1 PKCE + Agent keys. Chaque token encode la company | CRITIQUE |
| D3 | **Normalisation API** — ~213 routes backend sans prefix `/companies/:companyId` | Middleware chain cassé, tagScope bypass possible, rewrite fragile | HIGH |
| D4 | **Scalabilité horizontale** — 1 backend → N companies × M users | Rate limiting par tenant, connection pooling, Redis namespacing | MEDIUM |
| D5 | **Clients distribués** — plus de "single company" côté frontend | Sélecteur de company, routing frontend, API client scopé | HIGH |
| D6 | **Docker sandbox déprioritisé** — compute côté client local | Sandbox utile pour non-tech, mais pas le chemin principal. LLM server-side = SDK direct | LOW |

---

## 2. Pattern Architectural

### Avant (Single-Tenant)

```
┌──────────────┐     ┌─────────────────────────────────┐
│   UI Web     │────▶│  MnM Server (1 company)         │
│ (localhost)  │     │  ├─ Express API                  │
└──────────────┘     │  ├─ PostgreSQL (RLS)             │
                     │  ├─ Redis                        │
                     │  ├─ Docker Sandbox per User      │
                     │  └─ Auto-inject companyId        │
                     └─────────────────────────────────┘
```

### Après (Multi-Tenant Distribué)

```
┌──────────────┐
│  Desktop     │──┐
│  (Tauri)     │  │
└──────────────┘  │   ┌────────────────────────────────────────┐
┌──────────────┐  │   │  MnM Server (hébergé)                  │
│  UI Web      │──┼──▶│  ├─ Express API                        │
│  (locale)    │  │   │  │   └─ TOUTES routes /companies/:cid/ │
└──────────────┘  │   │  ├─ PostgreSQL (RLS multi-tenant)       │
┌──────────────┐  │   │  ├─ Redis (namespaced par company)      │
│  MCP Client  │──┘   │  ├─ BetterAuth + OAuth 2.1             │
│  (Claude     │      │  ├─ WebSocket (tag-scoped per tenant)   │
│   Code, etc) │      │  └─ Rate limiting per tenant            │
└──────────────┘      └────────────────────────────────────────┘
```

**Pattern** : Monolithe modulaire multi-tenant avec shared database + RLS.

**Rationale** :
- La DB est DÉJÀ multi-tenant (company_id sur toutes les tables, RLS sur 41).
- Pas besoin de schema-per-tenant ou DB-per-tenant — le volume par company est faible (supervision, pas data lake).
- Le monolithe est adapté à l'équipe (3 personnes) et à la complexité (71 services, pas de microservices).

---

## 3. Normalisation des Routes API

### 3.1 Principe

**TOUTE route accédant à des données company-scoped DOIT avoir le prefix `/companies/:companyId/`.**

Le middleware "Simplified API" (URL rewrite) est **supprimé**. Plus de magie, plus d'auto-injection.

### 3.2 Inventaire de Migration

**Backend : 213 routes à migrer sur 34 fichiers.**

| Fichier | Routes OK | Routes à migrer | Effort |
|---------|-----------|-----------------|--------|
| agents.ts | 14 | 23 | XL |
| issues.ts | 7 | 15 | L |
| access.ts | 6 | 10 | M |
| workspace-context.ts | 0 | 9 | M |
| approvals.ts | 2 | 7 | M |
| drift.ts | 3 | 7 | M |
| config-layers.ts | ~8 | ~12 | L |
| workflows.ts | 6 | 4 | S |
| stages.ts | 0 | 3 | S |
| projects.ts | 3 | 5 | M |
| activity.ts | 2 | 3 | S |
| goals.ts | 2 | 3 | S |
| secrets.ts | 3 | 3 | S |
| costs.ts | 5 | 1 | XS |
| onboarding.ts | 5 | 1 | XS |
| Autres (20 fichiers) | ~64 | ~106 | L |

**Frontend : ~60 appels API à migrer sur ~12 fichiers.**

| Fichier | Pattern actuel | Migration |
|---------|---------------|-----------|
| agents.ts | `agentPath()` + query param `?companyId=` | Path prefix |
| issues.ts | `/issues/:id` sans company | Path prefix |
| approvals.ts | `/approvals/:id` sans company | Path prefix |
| config-layers.ts | `/config-layers/:id` sans company | Path prefix |
| workflows.ts | `/workflow-templates/:id`, `/workflows/:id`, `/stages/:id` | Path prefix |
| heartbeats.ts | `/heartbeat-runs/:runId/` | Path prefix |
| activity.ts | `/issues/:id/activity` | Path prefix |
| goals.ts | `/goals/:id` | Path prefix |
| secrets.ts | `/secrets/:id` | Path prefix |
| drift.ts | `/projects/:id/drift` + query param | Path prefix |
| projects.ts | `projectPath()` + query param | Path prefix |
| workspaceContext.ts | Query param optionnel | Path prefix |

### 3.3 Pattern de Migration (Backend)

**Avant** :
```typescript
// agents.ts
router.get("/agents/:id", requirePermission(db, PERMISSIONS.AGENTS_READ), async (req, res) => {
  const agent = await svc.getById(req.params.id);
  assertCompanyAccess(req, agent.companyId);
  // ...
});
```

**Après** :
```typescript
// agents.ts
router.get("/companies/:companyId/agents/:id", requirePermission(db, PERMISSIONS.AGENTS_READ), async (req, res) => {
  const companyId = req.params.companyId;
  assertCompanyAccess(req, companyId);
  const tagScope = requireTagScope(req); // Maintenant garanti par le middleware
  const agent = await svc.getById(req.params.id, companyId); // Double-check companyId match
  // ...
});
```

**Règle** : le service reçoit TOUJOURS `companyId` en paramètre et le vérifie en DB (ne jamais faire confiance au path seul, le RLS est le dernier filet).

### 3.4 Pattern de Migration (Frontend)

**Avant** :
```typescript
// api/issues.ts
get: (id: string) => api.get<Issue>(`/issues/${id}`),
```

**Après** :
```typescript
// api/issues.ts
get: (companyId: string, id: string) => api.get<Issue>(`/companies/${companyId}/issues/${id}`),
```

**Alternative (API client factory)** — optionnel mais recommandé pour réduire la duplication :

```typescript
// api/client.ts
export function companyApi(companyId: string) {
  const prefix = `/companies/${companyId}`;
  return {
    get: <T>(path: string, opts?: RequestOptions) => api.get<T>(`${prefix}${path}`, opts),
    post: <T>(path: string, body?: unknown) => api.post<T>(`${prefix}${path}`, body),
    patch: <T>(path: string, body?: unknown) => api.patch<T>(`${prefix}${path}`, body),
    delete: <T>(path: string) => api.delete<T>(`${prefix}${path}`),
  };
}

// Usage dans les composants :
const cApi = companyApi(selectedCompanyId);
const agent = await cApi.get<Agent>(`/agents/${id}`);
```

### 3.5 Routes Exclues (pas de company scope)

Ces routes restent SANS prefix :
- `/health` — santé du serveur
- `/api/auth/*` — authentification globale
- `/api/companies` (GET/POST) — lister/créer des companies (admin)
- `/api/llms/*` — configuration LLM statique
- `/oauth/*` — flux OAuth (MCP)
- `/sso/discover/:companyId/*` — SSO discovery (companyId déjà dans le path, pattern spécial)

### 3.6 Suppression du Rewrite Middleware

```typescript
// SUPPRIMER ce bloc dans app.ts :
api.use((req, _res, next) => {
  const companyId = req.params.companyId;
  // ... URL rewrite logic
  next();
});
```

Le `tenantContextMiddleware` reste, mais ne fait plus d'injection dans `req.params`. Il se contente de :
1. Résoudre le companyId depuis `req.params.companyId` (déjà dans le path)
2. Setter le RLS PostgreSQL `app.current_company_id`

---

## 4. Isolation Tenant & Sécurité

### 4.1 Couches de Sécurité (Defense in Depth)

```
Layer 1: AUTH         — Qui es-tu ? (BetterAuth session / OAuth token / Agent JWT)
Layer 2: COMPANY      — A quelle company ? (companyId dans le path, vérifié contre l'actor)
Layer 3: PERMISSION   — As-tu le droit ? (requirePermission middleware, 91 permissions)
Layer 4: TAG SCOPE    — Que peux-tu VOIR ? (tagScopeMiddleware, tags du user)
Layer 5: RLS          — Filet de sécurité DB (PostgreSQL RLS, fail-closed)
```

### 4.2 Middleware Chain (Ordre)

```
app.use(actorMiddleware)           // Résout l'actor (board/agent/none)
app.use(tenantContextMiddleware)   // Résout companyId → set RLS context
app.use("/api", api)
  ├─ api.use(rateLimiter)          // Rate limit global
  ├─ api.use(boardMutationGuard)   // CSRF protection
  ├─ api.use("/companies/:companyId", assertCompanyMembership)  // NOUVEAU : vérifie que l'actor appartient à cette company
  ├─ api.use("/companies/:companyId", tagScopeMiddleware)       // Résout tagScope (APRÈS route matching)
  └─ api.use(routes...)
```

**Nouveau middleware `assertCompanyMembership`** :
```typescript
// Vérifie que l'actor a le droit d'accéder à cette company
function assertCompanyMembership(req, res, next) {
  const companyId = req.params.companyId;
  if (!companyId) return next();

  if (req.actor.type === "board") {
    if (req.actor.source === "local_implicit") return next(); // Dev mode
    if (!req.actor.companyIds?.includes(companyId)) {
      throw forbidden("Not a member of this company");
    }
  } else if (req.actor.type === "agent") {
    if (req.actor.companyId !== companyId) {
      throw forbidden("Agent does not belong to this company");
    }
  }
  next();
}
```

### 4.3 Auth par Type de Client

| Client | Auth Method | Company Resolution |
|--------|------------|-------------------|
| UI Web (navigateur) | BetterAuth session cookie | `actor.companyIds` → user choisit → dans le path |
| Desktop Tauri | BetterAuth session cookie (même flow) | Idem |
| MCP Client | OAuth 2.1 PKCE token | Token encode `company_id` → vérifié contre le path |
| Agent (heartbeat) | Agent JWT / API key | `actor.companyId` du token → vérifié contre le path |

### 4.4 Rate Limiting par Tenant

```typescript
// Remplacer le rate limiter global par un per-tenant
const tenantRateLimiter = createRateLimiter({
  keyGenerator: (req) => {
    const companyId = req.params.companyId || "global";
    const actorId = req.actor?.userId || req.ip;
    return `${companyId}:${actorId}`;
  },
  windowMs: 60_000,
  max: 500, // Par user par company
});
```

### 4.5 WebSocket Tag-Scope Security

Le WebSocket (`/api/companies/:companyId/events/ws`) a déjà le companyId dans le path. Il faut :
1. Vérifier `companyMembership` au handshake
2. Le `visibility` filtering (déjà designé dans dashboard-v2-architecture) s'applique

---

## 5. Data Model Multi-Tenant

### 5.1 Schéma Existant (Déjà Multi-Tenant)

La DB est **déjà prête** :
- `company_id` sur toutes les tables d'entité
- RLS activé sur 41 tables avec `app.current_company_id`
- FK cascade vers `companies.id`

### 5.2 Changements Nécessaires

**Migration : `company_memberships` enrichie**

La table `company_memberships` existe déjà. On s'assure qu'elle est le point de vérité pour "qui a accès à quelle company" :

```sql
-- Déjà existant, vérifié
CREATE TABLE company_memberships (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  principal_type TEXT NOT NULL, -- 'user' | 'agent'
  principal_id UUID NOT NULL,
  status TEXT DEFAULT 'active', -- 'active' | 'suspended' | 'invited'
  role_id UUID REFERENCES roles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Nouveau : `company_settings` séparé (optionnel)**

Si des settings company-specific sont nécessaires (quotas, features flags, plan tier) :

```sql
CREATE TABLE company_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id),
  plan_tier TEXT DEFAULT 'free', -- 'free' | 'pro' | 'enterprise'
  max_agents INTEGER DEFAULT 5,
  max_users INTEGER DEFAULT 10,
  features JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 Redis Namespacing

```
Avant : cache:agents:list → données de la seule company
Après : company:{companyId}:cache:agents:list → par tenant
```

Le `singleTenantCompanyId` cache dans `tenant-context.ts` est **supprimé**. Plus de cache single-tenant.

---

## 6. Frontend Multi-Company

### 6.1 Sélecteur de Company

Au login, l'utilisateur peut appartenir à N companies. Flow :

```
Login → /api/auth/get-session → { user, companyIds: [...] }
  ├─ 1 company  → Auto-select, redirect vers dashboard
  └─ N companies → Afficher sélecteur, stocker selectedCompanyId
```

Le `selectedCompanyId` est stocké dans :
- `localStorage` (persistance entre sessions)
- React context `CompanyProvider` (disponible partout)
- Tous les appels API incluent le companyId dans le path

### 6.2 Routing Frontend

```
Avant : /agents, /issues, /chat
Après : /c/:companyId/agents, /c/:companyId/issues, /c/:companyId/chat
```

Alternative plus simple (recommandée pour la V1) :
- Garder les mêmes routes UI (`/agents`, `/issues`, etc.)
- Le `selectedCompanyId` vient du context, pas du URL
- L'URL frontend ne change PAS — seuls les appels API incluent le companyId

**Rationale** : mettre le companyId dans l'URL frontend est du nice-to-have. Le critical path c'est que les appels API soient scopés. On peut ajouter le routing URL plus tard.

### 6.3 API Client Factory

```typescript
// ui/src/api/client.ts
const BASE = "/api";

// Client scopé par company — TOUS les appels passent par ici
export function companyApi(companyId: string) {
  const prefix = `${BASE}/companies/${companyId}`;
  return {
    get: <T>(path: string, opts?: RequestOptions) =>
      request<T>(`${prefix}${path}`, { method: "GET", ...opts }),
    post: <T>(path: string, body?: unknown) =>
      request<T>(`${prefix}${path}`, { method: "POST", body: JSON.stringify(body) }),
    patch: <T>(path: string, body?: unknown) =>
      request<T>(`${prefix}${path}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: <T>(path: string) =>
      request<T>(`${prefix}${path}`, { method: "DELETE" }),
  };
}

// Hook React
export function useCompanyApi() {
  const { selectedCompanyId } = useCompanyContext();
  if (!selectedCompanyId) throw new Error("No company selected");
  return useMemo(() => companyApi(selectedCompanyId), [selectedCompanyId]);
}
```

---

## 7. MCP Multi-Tenant

### 7.1 État Actuel

Le MCP server (68 tools, 10 resources) utilise déjà OAuth 2.1 PKCE. Le token contient l'identité de l'utilisateur.

### 7.2 Changement Nécessaire

Le token MCP doit encoder le `companyId` cible. Options :

**Option A (recommandée)** : Le `companyId` est dans le scope OAuth.
```
Authorization: Bearer <token avec company_id dans les claims>
```

**Option B** : Le client MCP passe le `companyId` dans chaque appel tool.
```json
{ "tool": "list_agents", "input": { "companyId": "abc-123" } }
```

**Option A est préférable** car :
- Le server vérifie le membership une seule fois au token exchange
- Pas besoin de modifier tous les tool schemas
- Cohérent avec le pattern "companyId dans le path"

### 7.3 MCP Tool Internal Routing

Les MCP tools appellent les services internes. Ils doivent passer le `companyId` du token à chaque appel service :

```typescript
// Avant (service cherche la company tout seul)
const agents = await agentService.list();

// Après (companyId explicite)
const agents = await agentService.list(session.companyId);
```

---

## 8. Déploiement

### 8.1 Architecture Cible

```
┌─────────────────────────────────────────────┐
│  Serveur Hébergé (VPS / Cloud)              │
│                                             │
│  ┌─────────────┐  ┌─────────────��────────┐  │
│  │  nginx/      │  │  MnM Server          │  │
│  │  caddy       │──│  (Express + WS)      │  │
│  │  (TLS, LB)   │  │  Port 3100           │  │
│  └─────────────┘  └──��───────┬───────────┘  │
│                              │               │
│          ┌───────────────────┼──────────┐   │
│          │                   │          │   │
│  ┌───────▼──────┐  ┌────────▼─��─┐  ┌───▼──┐│
│  │ PostgreSQL 17│  │  Redis 7   │  │Docker││
│  │ (RLS, shared)│  │ (namespaced│  │(opt) ││
│  └──────────────┘  └────────────┘  └──────┘│
└─────────────────────────────────────────────┘
         ▲          ▲          ▲
         │          │          ��
    ┌────┴───┐ ┌────┴───┐ ┌───┴────┐
    │Desktop │ │UI Web  │ │ MCP    │
    │(Tauri) │ │(locale)│ │Client  │
    └────────┘ └────────┘ └────────┘
```

### 8.2 Environnements

| Env | Mode | Company | Usage |
|-----|------|---------|-------|
| `bun run dev` | `local_trusted` | Auto-single | Dev local, pas de multi-tenant |
| `bun run local` | `local_trusted` | Auto-single | Dev local + Docker infra |
| Staging | `authenticated` | Multi | Test multi-tenant |
| Production | `authenticated` | Multi | Hébergé, N companies |

### 8.3 Docker Sandbox (Déprioritisé)

Pour les users non-tech qui n'ont pas Claude Code en local :
- Le serveur PEUT provisionner un Docker sandbox
- Mais le chemin principal est : user local → MCP/Desktop → backend API
- Si LLM server-side nécessaire : SDK Anthropic/OpenAI direct, pas Docker sandboxé

---

## 9. Plan de Migration (Sprints)

### Sprint 1 — Foundation (3-5j)

**Objectif** : Middleware chain propre + première vague de routes critiques.

| # | Tâche | Effort | Fichiers |
|---|-------|--------|----------|
| 1.1 | Créer middleware `assertCompanyMembership` | S | `server/src/middleware/company-access.ts` |
| 1.2 | Déplacer `tagScopeMiddleware` dans le router `api` (FAIT) | XS | `server/src/app.ts` |
| 1.3 | Supprimer le URL rewrite middleware | S | `server/src/app.ts` |
| 1.4 | Simplifier `tenantContextMiddleware` (plus d'injection params) | S | `server/src/middleware/tenant-context.ts` |
| 1.5 | Créer `companyApi()` factory côté frontend | S | `ui/src/api/client.ts` |
| 1.6 | Créer hook `useCompanyApi()` | XS | `ui/src/hooks/useCompanyApi.ts` |
| 1.7 | Migrer `agents.ts` routes (23 routes) | L | `server/src/routes/agents.ts` + `ui/src/api/agents.ts` |
| 1.8 | Migrer `issues.ts` routes (15 routes) | L | `server/src/routes/issues.ts` + `ui/src/api/issues.ts` |

### Sprint 2 — Core Features (3-5j)

| # | Tâche | Effort | Fichiers |
|---|-------|--------|----------|
| 2.1 | Migrer `approvals.ts` (7 routes) | M | Backend + frontend |
| 2.2 | Migrer `workflows.ts` + `stages.ts` (7 routes) | M | Backend + frontend |
| 2.3 | Migrer `config-layers.ts` (~12 routes) | L | Backend + frontend |
| 2.4 | Migrer `projects.ts` + `workspace-context.ts` (14 routes) | M | Backend + frontend |
| 2.5 | Migrer `drift.ts` (7 routes) | M | Backend + frontend |
| 2.6 | Migrer `heartbeats.ts` (5 routes frontend) | S | Frontend only (backend déjà OK?) |

### Sprint 3 — Remaining + Multi-Company (3-5j)

| # | Tâche | Effort | Fichiers |
|---|-------|--------|----------|
| 3.1 | Migrer `access.ts` (10 routes) | M | Backend + frontend |
| 3.2 | Migrer `goals.ts`, `secrets.ts`, `costs.ts`, `activity.ts` | M | Backend + frontend |
| 3.3 | Migrer remaining fichiers (20+) | L | Backend batch |
| 3.4 | Sélecteur de company frontend (multi-company flow) | M | `ui/src/components/CompanySelector.tsx` |
| 3.5 | Enrichir `get-session` pour retourner `companyIds` + noms | S | `server/src/app.ts` |
| 3.6 | Rate limiting per tenant | M | `server/src/middleware/rate-limiter.ts` |

### Sprint 4 — Polish & Security (2-3j)

| # | Tâche | Effort | Fichiers |
|---|-------|--------|----------|
| 4.1 | MCP token avec companyId | M | `server/src/mcp/` |
| 4.2 | MCP tools : passer companyId aux services | L | `server/src/mcp/tools/` |
| 4.3 | Supprimer `singleTenantCompanyId` cache | XS | `tenant-context.ts` |
| 4.4 | Redis namespacing par company | M | Services utilisant Redis |
| 4.5 | E2E tests multi-tenant | L | `e2e/` |
| 4.6 | Mettre à jour `CLAUDE.md` — supprimer "Single-tenant" | XS | `CLAUDE.md` |
| 4.7 | Mettre à jour `docs/ARCHITECTURE.md` | M | `docs/ARCHITECTURE.md` |

---

## 10. Trade-offs

| Décision | On gagne | On perd |
|----------|----------|---------|
| Shared DB + RLS (vs DB-per-tenant) | Simplicité opérationnelle, pas de DB provisioning | Isolation moins forte (RLS bypass = fuite), backup global |
| Supprimer URL rewrite (vs le garder) | Middleware chain fiable, routes explicites | Breaking change API pour les clients existants |
| companyId dans le path (vs header/query) | Standard REST, middleware chain marche, cacheable | URLs plus longues, migration de ~213 routes |
| Frontend sans companyId dans l'URL (V1) | Migration plus simple, pas de changement de routing | Pas de deep-link vers une company spécifique |
| Docker sandbox déprioritisé | Simplifie le serveur, réduit les coûts | Users non-tech doivent installer Claude Code en local |

---

## 11. Risques & Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Régression pendant la migration des 213 routes | HIGH | Migration par batch avec E2E tests entre chaque sprint |
| RLS bypass si companyId mal propagé | CRITICAL | `assertCompanyMembership` middleware + RLS = double filet |
| Breaking change pour les clients MCP existants | MEDIUM | Période de transition : garder les anciennes routes en parallèle 2 sprints |
| Performance dégradée avec N companies sur 1 DB | LOW | Index déjà en place sur company_id, monitoring query perf |

---

## 12. Checklist de Validation

- [ ] TOUTES les routes company-scoped ont `/companies/:companyId`
- [ ] Le URL rewrite middleware est supprimé
- [ ] `assertCompanyMembership` middleware est en place
- [ ] `tagScopeMiddleware` est dans le router `api` (pas app level)
- [ ] Frontend utilise `companyApi()` factory
- [ ] MCP tokens encodent le companyId
- [ ] Rate limiting est per-tenant
- [ ] Redis keys sont namespaced par company
- [ ] `singleTenantCompanyId` cache est supprimé
- [ ] E2E tests couvrent le multi-tenant
- [ ] `CLAUDE.md` et `docs/ARCHITECTURE.md` mis à jour
- [ ] Aucune route n'utilise l'auto-injection de companyId
