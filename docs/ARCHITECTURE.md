# Architecture de MnM

Ce document decrit la stack technique et les decisions architecturales cles de MnM. Pour la vision produit et les features, voir le [README](../README.md). Pour le get started dev, voir [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## Stack technique

```
React 18 + TypeScript (shadcn/ui + Tailwind)
  ↓
Express.js API (routes, auth middleware, rate limiting)
  ↓
71 Services backend (RBAC, orchestrateur, containers, audit, chat, drift, A2A, config layers)
  ↓
PostgreSQL 17 (51 tables, RLS sur 41) + Redis 7 (cache, pub/sub) + WebSocket (live events, chat)
  ↓
Agent Runtime (adapters, Docker containers, credential proxy, heartbeat)
```

**Monorepo Bun workspaces** avec 13 packages typechecked.

---

## Decisions architecturales cles

| Decision | Justification |
|---|---|
| **Zero polling** | Tous les updates temps reel via SSE/WebSocket. Jamais de `setInterval` ou `refetchInterval`. |
| **Multi-tenant** | 1 backend sert N companies. Shared DB + RLS PostgreSQL (fail-closed). Toutes les routes ont `/companies/:companyId/` explicite. |
| **RBAC dynamique** | Roles et permissions en DB, jamais de constantes hardcodees. |
| **Tags > Teams** | Les tags sont additifs et flexibles. Score 8/8 sur le test CBA vs 5/8 pour Roles+Teams. |
| **Config Layers > JSONB** | Config structuree, mergeable, versionee, avec detection de conflits. |
| **Trace Gold par defaut** | L'utilisateur voit la synthese intelligente, pas le bruit brut. |
| **Compute cote client** | L'execution agent se fait sur la machine de l'utilisateur (MCP, Desktop, CLI locale). Le serveur est un API/data/orchestration layer. |

---

## Multi-Tenant & Middleware Chain

MnM supporte deux modes de deploiement :
- **`local_trusted`** : Dev local, zero auth, single company auto-creee. `bun run dev` ou `bun run local`.
- **`authenticated`** : Production, BetterAuth sessions + OAuth 2.1, multi-company. Docker Compose ou serveur heberge.

### Middleware chain (ordre)

```
app.use(actorMiddleware)           → Resout l'actor (board/agent/none)
app.use("/api", api)
  ├─ rateLimiter                   → Rate limit per-tenant (key = companyId:actorId)
  ├─ boardMutationGuard            → CSRF protection
  ├─ assertCompanyMembership       → Verifie que l'actor appartient a la company du path (UUID validated, fail-closed)
  ├─ tenantContextMiddleware       → Set RLS PostgreSQL (app.current_company_id) depuis req.params.companyId
  ├─ tagScopeMiddleware            → Resout tagScope (monte sur /companies/:companyId)
  └─ route handlers
```

> Note : les 3 middlewares company (assertCompanyMembership, tenantContextMiddleware, tagScopeMiddleware) sont montes sur `api.use("/companies/:companyId", ...)` pour qu'Express parse le param AVANT l'execution. Le URL rewrite middleware a ete supprime — toutes les routes ont un prefix explicite.

### Couches de securite (defense in depth)

```
Layer 1: AUTH         → Qui es-tu ? (BetterAuth session / OAuth token / Agent JWT)
Layer 2: COMPANY      → A quelle company ? (companyId dans le path, verifie contre l'actor)
Layer 3: PERMISSION   → As-tu le droit ? (requirePermission, 91 permissions)
Layer 4: TAG SCOPE    → Que peux-tu VOIR ? (tagScopeMiddleware, tags du user)
Layer 5: RLS          → Filet de securite DB (PostgreSQL RLS, fail-closed)
```

### Auth par type de client

| Client | Auth | Company Resolution |
|--------|------|-------------------|
| UI Web (navigateur) | BetterAuth session cookie | `actor.companyIds` → user choisit → dans le path |
| Desktop Tauri | BetterAuth session cookie | Idem |
| MCP Client | OAuth 2.1 PKCE token | Token encode `company_id` |
| Agent (heartbeat) | Agent JWT / API key | `actor.companyId` du token |

---

## Pipeline de Traces

- **Gold** = vue par DEFAUT (phases scorees, annotations, verdicts)
- **Silver** = detail groupe
- **Bronze** = JSON brut (debug)
- Gold est AUTO-GENERE a la completion du trace, pas un clic manuel.
- Le prompt Gold est HIERARCHIQUE : global → workflow → agent → issue context.
- Les traces sont un MIDDLEWARE au-dessus des adapters (`heartbeat.ts:onLog`), PAS dans les adapters.
- Enrichissement LLM : `claude -p --model haiku`.

---

## Config Layers

- `adapterConfig` JSONB remplace par des couches de config structurees. Toute la config agent vit dans les layers.
- **Priority merge** : Company enforced (999) > Base layer (500) > Additional (0-498).
- Base layer auto-creee par agent (migration 0054). Dual-path heartbeat pour migration zero-downtime.
- Advisory locks (`pg_advisory_xact_lock`) serialisent les attachements concurrents.
- **Tag-based visibility** : private (createur uniquement), team (tags partages), public (tous), company (tous).
- Types d'items : MCP Servers, Skills, Hooks, Settings, Credentials — chacun avec editeur dedie.
- OAuth2 PKCE pour credentials MCP (chiffrement AES-256-GCM).

---

## CAO (Chief Agent Officer)

- `adapter_type="claude_local"`, `metadata.isCAO=true`, auto-cree, a tous les tags, role Admin.
- Tourne dans le sandbox de l'admin.
- En mode watchdog, auto-commente les echecs.
- Interactif via les mentions `@cao`.

---

## Sandbox architecture (optionnel)

Le compute agent se fait principalement cote client (MCP, Desktop, CLI locale). Les Docker sandboxes restent disponibles pour les utilisateurs non-tech qui n'ont pas Claude Code en local.

- Container Docker persistant par utilisateur (optionnel).
- Si LLM server-side necessaire : SDK Anthropic/OpenAI direct, pas Docker sandboxe par user.
- `docker exec` avec rewrite automatique localhost → host.docker.internal.
- `runChildProcess` supporte l'option `dockerContainerId`.

---

## MCP Server

MnM expose un serveur MCP (Model Context Protocol) complet :

- **68 tools** + **10 resources** sur 14 domaines (agents, issues, projects, chat, folders, artifacts, config-layers, workflows, traces, sandbox, users, admin, a2a, documents)
- **Transport** : Streamable HTTP (recommande) + SSE legacy
- **Auth** : OAuth 2.1 avec PKCE, Dynamic Client Registration, ecran de consentement React granulaire par domaine (read/write/admin)
- **Filtrage dynamique** : les tools sont filtres par les permissions reelles de l'utilisateur/agent dans le token
- **Rate limiting** + semaphore DB (15 concurrent) + event loop monitoring
- **OAuth store** en PostgreSQL (migration 0063) — survit aux restarts

Voir [CONTRIBUTING.md](../CONTRIBUTING.md#mcp-server-pour-les-devs) pour le get started client.

---

## Agent permissions

- Les agents heritent des permissions de leur createur (`createdByUserId`).
- TOUTES les routes company-scoped ont le prefixe `/companies/:companyId/`. Pas de rewrite automatique.
- Agent JWT hardenees : TTL court, jti, fail-fast, `aud` claim validation.

---

## API

- TOUTES les routes accedant a des donnees company-scoped ont le prefixe `/companies/:companyId/`.
- Le `companyId` est explicite dans chaque appel API — cote frontend via `companyApi(companyId)` factory, cote MCP via le token OAuth.
- Routes sans company scope : `/health`, `/api/auth/*`, `/api/companies` (CRUD global), `/oauth/*`, `/sso/discover/*`.

---

## `_bmad/`

Framework BMAD (templates de workflows agents). **NE PAS MODIFIER** — c'est un framework externe.
