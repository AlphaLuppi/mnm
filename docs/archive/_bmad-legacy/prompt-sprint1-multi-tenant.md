# Prompt Sprint 1 — Multi-Tenant Route Normalization

Copier-coller ce prompt apres /clear pour lancer le Sprint 1.

---

## Prompt

```
Je suis sur la branche `refactor/multi-tenant-routes`. On fait le Sprint 1 de la refacto multi-tenant.

Contexte : lire `_bmad-output/architecture-multi-tenant-2026-04-12.md` pour l'architecture complete. Le shift est documente dans CLAUDE.md et docs/ARCHITECTURE.md (deja commite).

Le tagScopeMiddleware a deja ete deplace dans le router `api` (fait). Maintenant on attaque le reste du Sprint 1 :

### Taches Sprint 1

1. **Creer le middleware `assertCompanyMembership`** (`server/src/middleware/company-access.ts`)
   - Verifie que l'actor appartient a la company du path
   - Board users : check `actor.companyIds?.includes(companyId)`
   - Agent actors : check `actor.companyId === companyId`
   - `local_implicit` : bypass (dev mode)
   - Monter sur `api.use("/companies/:companyId", assertCompanyMembership)` AVANT tagScopeMiddleware dans app.ts

2. **Supprimer le URL rewrite middleware** dans app.ts (le bloc `api.use((req, _res, next) => { ... URL rewrite ... })`)

3. **Simplifier `tenantContextMiddleware`** — ne plus injecter dans `req.params.companyId`, juste setter le RLS context PostgreSQL. Supprimer le `singleTenantCompanyId` cache.

4. **Creer `companyApi()` factory** cote frontend (`ui/src/api/client.ts`)
   - Fonction `companyApi(companyId: string)` qui retourne un client avec le prefix `/companies/${companyId}`
   - Hook `useCompanyApi()` qui lit le companyId depuis le context

5. **Migrer `agents.ts`** — les 23 routes backend sans prefix + le frontend `ui/src/api/agents.ts`
   - Chaque route `/agents/:id/*` devient `/companies/:companyId/agents/:id/*`
   - Le frontend utilise `companyApi()` au lieu de `agentPath()` avec query param

6. **Migrer `issues.ts`** — les 15 routes backend sans prefix + le frontend `ui/src/api/issues.ts`
   - Chaque route `/issues/:id/*` devient `/companies/:companyId/issues/:id/*`
   - Idem pour `/labels/:id` et `/attachments/:id`

Apres chaque fichier migre : `bun run typecheck` + `bun run test:e2e` pour verifier zero regression.

Commit atomique + push apres chaque tache completee.
```
