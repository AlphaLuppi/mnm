---
name: backend
description: Patterns backend MnM (Express + Drizzle + multi-tenant). Auto-loaded quand tu édites du code serveur.
paths:
  - "server/**/*.ts"
---

# Backend MnM — Patterns à suivre

Code serveur Express + Drizzle, multi-tenant, défense en profondeur (auth → company → permission → tag → RLS).
Pour la chaîne complète, voir [`docs/conventions/middleware-chain.md`](../../docs/conventions/middleware-chain.md) et [`docs/conventions/rbac-tags.md`](../../docs/conventions/rbac-tags.md).

## Nouvelle route scopée company

**Toute route qui touche des données d'une company DOIT** :
1. Avoir le préfixe `/companies/:companyId/` explicite dans le path (pas d'auto-injection, pas d'URL rewrite).
2. Appeler `requirePermission(db, PERMISSIONS.X)` (ou `assertCompanyPermission` si `companyId` n'est pas dans `req.params`).
3. Lire `req.params.companyId`, jamais le réinjecter dans le body.

```ts
// server/src/routes/foo.ts
import { Router } from "express";
import type { Db } from "@mnm/db";
import { PERMISSIONS } from "@mnm/shared";
import { requirePermission } from "../middleware/require-permission.js";
import { fooService } from "../services/foo.js";

export function fooRoutes(db: Db) {
  const router = Router();
  const svc = fooService(db);

  router.get("/companies/:companyId/foo", requirePermission(db, PERMISSIONS.FOO_READ), async (req, res) => {
    const companyId = req.params.companyId as string;
    let result = await svc.list(companyId);
    // tag isolation : filtrer si tagScope présent et bypass=false
    if (req.tagScope && !req.tagScope.bypassTagFilter) {
      result = result.filter((row) => /* intersection avec req.tagScope.tagIds */);
    }
    res.json(result);
  });

  return router;
}
```

Ensuite, mount dans `server/src/app.ts` via `api.use(fooRoutes(db))` (pas besoin de re-préfixer — le préfixe est dans les paths du router).

## Filtrage tag-based

- Pour les listes, utiliser `tagFilterService(db)` ou comparer `req.tagScope.tagIds` à la table `principal_tags` de la ressource.
- Si `req.tagScope.bypassTagFilter === true` : skip le filtre (admins instance + `local_implicit`).
- Les agents (`req.actor.type === "agent"`) n'ont pas de `tagScope` — gérer séparément.

## Service (pattern)

Un service vit dans `server/src/services/<nom>.ts`, exporte une factory `nomService(db)` qui retourne les méthodes.

```ts
// server/src/services/foo.ts
import { eq, and } from "drizzle-orm";
import type { Db } from "@mnm/db";
import { foos } from "@mnm/db";
import { notFound, conflict } from "../errors.js";

export function fooService(db: Db) {
  return {
    async list(companyId: string) {
      return db.select().from(foos).where(eq(foos.companyId, companyId));
    },
    async getById(id: string, companyId: string) {
      const [row] = await db.select().from(foos)
        .where(and(eq(foos.id, id), eq(foos.companyId, companyId)));
      if (!row) throw notFound("Foo not found");
      return row;
    },
  };
}
```

**Erreurs** : toujours via `server/src/errors.ts` (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`, `unprocessable`). Ne JAMAIS faire `res.status(404).send(...)` au milieu d'un service — `throw notFound(...)` et laisse `errorHandler` gérer.

**Filtrage company** : même avec RLS active, ajoute `eq(foos.companyId, companyId)` dans les `where` — ceinture + bretelles.

## Émettre un live event (SSE)

Pour pousser un événement temps-réel vers les clients connectés à `/events/ws` :

```ts
import { publishLiveEvent } from "./live-events.js";

publishLiveEvent({
  companyId,
  type: "foo.created",                    // LiveEventType — voir @mnm/shared
  payload: { id, name },
  visibility: { scope: "company-wide" },  // ou "tag-restricted" / "private"
});
```

Le type doit être ajouté à `LiveEventType` dans `@mnm/shared`. Le filtrage de visibilité par tag/user est appliqué dans `realtime/event-visibility.ts`, pas ici.

## Ajouter une nouvelle permission

**Pas de constante hardcodée, pas de `BUSINESS_ROLES`/`PERMISSION_KEYS`.** Une permission = un INSERT SQL :

1. Ajouter la migration dans `packages/db/src/migrations/<NNNN>_<nom>.sql` :
   ```sql
   INSERT INTO permissions (slug, label, category) VALUES
     ('foo:write', 'Foo — créer/modifier', 'foo')
   ON CONFLICT (slug) DO NOTHING;
   ```
2. Ajouter le slug dans le type `PermissionSlug` de `@mnm/shared` (et la constante `PERMISSIONS.FOO_WRITE` si utilisée comme alias).
3. Attacher la permission aux rôles désirés via `INSERT INTO role_permissions (...)` ou via le seeder onboarding.
4. Utiliser `requirePermission(db, PERMISSIONS.FOO_WRITE)` côté route.

Voir `docs/conventions/rbac-tags.md` pour la sémantique.

## Routes NON-scopées (rares)

Réservées à `/health`, `/auth`, OAuth, MCP discovery — toute route qui n'a pas de notion de company. Ces routes sont mountées **avant** `api.use("/companies/:companyId", ...)` dans `app.ts` pour ne pas hériter de la chain. Elles ne doivent jamais lire `req.params.companyId` ni accéder à des tables tenant-scoped.

## Anti-patterns à bannir

- Monter `assertCompanyMembership` / `tenantContextMiddleware` / `tagScopeMiddleware` au **niveau app** (`app.use(...)`) — ils doivent être sur `api.use("/companies/:companyId", ...)` pour qu'Express parse `:companyId` avant.
- Lire `companyId` depuis `req.body` au lieu du path — cache hit Express, security review failure.
- Hardcoder un rôle ou une permission en TypeScript (`const BUSINESS_ROLES = [...]`) — tout est en DB.
- Skip de `requirePermission` parce que "c'est juste une lecture" — toujours appliquer la permission, même en GET.
- Polling côté backend pour rafraîchir l'UI — utiliser `publishLiveEvent` + SSE.
- Désactiver la RLS sur une nouvelle table tenant — fuite cross-company garantie si un middleware bug.
- `res.status(403).json(...)` au milieu d'un service — `throw forbidden(...)` et laisse l'errorHandler.
- Ajouter `companyId` dans `req.params` manuellement depuis un middleware (`req.params.companyId = ...`) — le path doit l'avoir explicite.

## Liens

- [`docs/conventions/middleware-chain.md`](../../docs/conventions/middleware-chain.md) — ordre + 5 couches de sécurité
- [`docs/conventions/rbac-tags.md`](../../docs/conventions/rbac-tags.md) — roles, permissions, tags, héritage agent
- [`docs/conventions/no-polling.md`](../../docs/conventions/no-polling.md) — règle SSE
- `server/src/middleware/index.ts` — exports des middlewares
- `server/src/errors.ts` — helpers d'erreur HTTP
- `server/src/services/live-events.ts` — bus SSE
