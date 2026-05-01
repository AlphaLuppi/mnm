# Middleware chain multi-tenant

MnM est multi-tenant : 1 backend sert N companies, isolation par défense en profondeur. Toute route API qui touche à des données scopées par company doit passer par cette chaîne.

## Ordre obligatoire

```
app.use(actorMiddleware)                    # niveau app
  ↓
app.use("/api", api)
  ├─ rateLimiter                            # per-tenant, key = companyId:actorId
  ├─ boardMutationGuard                     # CSRF protection
  ├─ api.use("/companies/:companyId", ...)
  │     ├─ assertCompanyMembership          # actor appartient à la company ?
  │     ├─ tenantContextMiddleware          # set RLS PostgreSQL (app.current_company_id)
  │     ├─ tagScopeMiddleware               # résout les tags visibles
  │     └─ route handlers
  └─ requirePermission(...)                 # à appliquer sur chaque handler
```

## 5 couches de sécurité

```
Layer 1: AUTH         → Qui es-tu ? (BetterAuth session / OAuth token / Agent JWT)
Layer 2: COMPANY      → À quelle company ? (companyId dans le path, vérifié contre l'actor)
Layer 3: PERMISSION   → As-tu le droit ? (requirePermission, 91 permissions en DB)
Layer 4: TAG SCOPE    → Que peux-tu VOIR ? (tags du user, fail-closed)
Layer 5: RLS          → Filet de sécurité DB (PostgreSQL RLS sur 41 tables, fail-closed)
```

## Règles strictes

- **Toutes les routes scopées company DOIVENT avoir le préfixe `/companies/:companyId/`** explicite. Pas d'auto-injection. Pas d'URL rewrite. Le préfixe est dans le path.
- **`assertCompanyMembership`, `tenantContextMiddleware`, `tagScopeMiddleware`** sont montés sur `api.use("/companies/:companyId", ...)` — pas au niveau app — pour qu'Express parse le param `companyId` AVANT.
- **`assertCompanyMembership`** valide :
  - `actor.companyIds.includes(req.params.companyId)` pour les board users
  - `actor.companyId === req.params.companyId` pour les agents
  - UUID format
  - Fail-closed pour les actor types inconnus
- **`tenantContextMiddleware`** set `app.current_company_id` PostgreSQL — c'est ça qui active la RLS. Ne PAS injecter dans `req.params`.
- **Rate limiting per-tenant** : key = `{companyId}:{actorId}`, pas global.

## Auth par type de client

| Client | Auth | Company resolution |
|---|---|---|
| UI Web (navigateur) | BetterAuth session cookie | `actor.companyIds` → user choisit → dans le path |
| Desktop Tauri | BetterAuth session cookie | Idem |
| MCP Client | OAuth 2.1 PKCE token | Token encode `company_id` |
| Agent (heartbeat) | Agent JWT / API key | `actor.companyId` du token |

## Erreurs courantes

- ❌ Monter un middleware company au niveau app (`app.use(tagScopeMiddleware)`) → `req.params.companyId` non parsé.
- ❌ Oublier le préfixe `/companies/:companyId/` sur une nouvelle route → contournement de l'isolation.
- ❌ Injecter `companyId` dans le body au lieu du path → cache hit Express, security review failure.
- ❌ Désactiver RLS sur une nouvelle table → fuite de données entre companies si un middleware bug.

## Code

`server/src/middlewares/{actor,assertCompanyMembership,tenantContext,tagScope,rateLimiter}.ts`.

## Liens

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — vue d'ensemble multi-tenant
- [`./rbac-tags.md`](./rbac-tags.md) — rôles, permissions, tags
- [`../decision-log.md`](../decision-log.md) — décisions architecturales
