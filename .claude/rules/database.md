---
name: database
description: Patterns database MnM (Drizzle + PostgreSQL 17 + RLS multi-tenant). Auto-loaded quand tu édites schémas ou migrations.
paths:
  - "**/db/**/*.ts"
  - "**/migrations/**/*.sql"
  - "**/schema/**/*.ts"
  - "**/*.sql"
---

# Database MnM — Patterns à suivre

Stack : PostgreSQL 17 + Drizzle ORM. Schémas TS dans `packages/db/src/schema/*.ts`, migrations SQL dans `packages/db/src/migrations/*.sql` (+ tests `*.test.ts` à côté). Drizzle lit `./dist/schema/*.js` (build d'abord), sort dans `./src/migrations`. **41 tables** sont scopées tenant et protégées par RLS — c'est le filet de sécurité ultime, jamais à désactiver.

## 1. Table scopée company

Toute table contenant des données utilisateur DOIT avoir `company_id` non-null + cascade.

```ts
// packages/db/src/schema/<table>.ts
companyId: uuid("company_id").notNull().references(() => companies.id),
// ... colonnes ...
(table) => ({
  companyXxxIdx: index("<table>_company_xxx_idx").on(table.companyId, table.xxx),
}),
```

Règles :
- Préfixe les index par le nom de table : `agents_company_status_idx`.
- **Tout index sur une table scopée commence par `company_id`** (premier critère de tout query pattern).
- Cascade `ON DELETE CASCADE` sur la FK `companies.id` quand la donnée n'a pas de sens hors company.
- Champs typés JSON : `jsonb("...").$type<MyType>().notNull().default({})`.
- Self-reference : annoter avec `(): AnyPgColumn => agents.id` (cf. `agents.ts:27`).

## 2. RLS policy — fail-closed obligatoire

Toute nouvelle table scopée DOIT être ajoutée à une migration RLS avec **deux policies** (template ci-dessous, calqué sur `0030_rls_policies.sql` + `0080_rls_permissive_baseline.sql`). Sans la PERMISSIVE baseline, PostgreSQL est en default-deny et 0 row n'est jamais visible (RESTRICTIVE seul = aucun unlock).

```sql
ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "<table>" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- 1. PERMISSIVE baseline — débloque la row depuis le default-deny postgres.
CREATE POLICY "tenant_baseline_permissive" ON "<table>" AS PERMISSIVE FOR ALL
  USING (true);
--> statement-breakpoint

-- 2. RESTRICTIVE tenant filter — narrow par tenant via AND.
CREATE POLICY "tenant_isolation" ON "<table>" AS RESTRICTIVE FOR ALL
  USING (company_id = current_setting('app.current_company_id', true)::uuid);
--> statement-breakpoint
```

Pourquoi `PERMISSIVE` + `RESTRICTIVE` + `FORCE` :
- **PERMISSIVE baseline** : sans au moins UNE policy PERMISSIVE, postgres refuse toute row à un user qui respecte RLS. `USING (true)` ne contourne rien — il rend la row éligible avant que le RESTRICTIVE filtre par tenant.
- **RESTRICTIVE** : se cumule avec la PERMISSIVE via AND (jamais OR). C'est la couche qui bloque les autres tenants.
- **FORCE** : applique RLS aux superusers et au owner de la table (sans, RLS reste cosmétique).
- **`current_setting('...', true)`** : le `true` (= `missing_ok`) retourne `NULL` si la variable n'est pas set → comparaison `company_id = NULL` échoue → 0 row visible (fail-closed côté tenant).

Cas spécial `company_id` nullable (ex: ancienne policy `invites`) : ajouter `OR company_id IS NULL` dans le `USING` du RESTRICTIVE — voir 0030 et 0071 pour l'historique.

⚠️ **Limitation runtime — user app BYPASSRLS** : tant que la connexion app utilise un rôle SUPERUSER (`postgres`/`mnm` par défaut en dev), RLS n'est PAS appliquée du tout. La double-policy ci-dessus n'est effective qu'avec un user non-bypass. Un runbook séparé traite la migration vers un rôle dédié.

La variable `app.current_company_id` est posée par `tenantContextMiddleware`. Voir `docs/conventions/middleware-chain.md`.

## 3. Migrations Drizzle — workflow

1. Modifier le schéma TS (`packages/db/src/schema/`).
2. `bun run build` (drizzle lit `./dist/schema/*.js`).
3. `bun run --cwd packages/db generate` pour générer la migration.
4. **Lire le SQL généré et le compléter** (RLS, indexes manuels, advisory locks, data backfill).
5. Écrire un test `.test.ts` à côté qui vérifie le SQL avec regex (cf. `0067_agents_archived_at.test.ts`).
6. `bun run db:migrate` (lance `packages/db/src/migrate.ts`).

Convention SQL :
- **Idempotent toujours** : `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` avant `ADD CONSTRAINT`.
- Séparateur `--> statement-breakpoint` entre statements (Drizzle l'utilise pour scinder).
- **Pas de `pgEnum`** dans cette codebase : `text + CHECK ("state" IN (...))` (cf. `0070_workflow_run_cancellation.sql:23-25`).
- Les data-backfills lourds : bloc `DO $$ ... END $$;` (cf. `0054_migrate_adapter_config.sql`).
- Référencer le spec qui justifie la migration en commentaire d'en-tête.

## 4. Advisory locks — sérialiser concurrent writes

Pour les opérations critiques où deux requêtes simultanées corromperaient l'état (ex: attachement de config layer, lancement de workflow), prendre un advisory lock dans la même transaction :

```ts
await tx.execute(
  sql`SELECT pg_advisory_xact_lock(hashtext(${'mnm:launch:' + workflowDefId}))`,
);
// suite des INSERT/UPDATE dans la même tx
```

Convention de clé : `'mnm:<scope>:' + identifiant` (ex `mnm:launch:<def_id>`, `mnm:agent_config:<agent_id>`). `pg_advisory_xact_lock` (vs `pg_advisory_lock`) libère automatiquement à la fin de la tx — toujours préférer la variante `xact`.

Patterns existants : `governed-workflows.ts:974` (close step), `0054` (config layer base auto-création), spec `2026-04-02-config-layers-design.md:376`.

## 5. Ajouter une permission

Permissions stockées en DB (`permissions` table), pas hardcodées. INSERT en migration :

```sql
INSERT INTO "permissions" ("company_id", "slug", "description", "category", "is_custom")
SELECT c.id, 'agents.archive', 'Archive an agent', 'agents', false
FROM "companies" c
ON CONFLICT ("company_id", "slug") DO NOTHING;
--> statement-breakpoint
```

L'index unique `permissions_company_slug_idx` rend l'INSERT idempotent via `ON CONFLICT`. Voir `docs/conventions/rbac-tags.md` pour le RBAC complet et la liaison `role_permissions`.

## 6. Anti-patterns à refuser

- Table scopée sans `company_id` ou sans RLS policy → blast radius cross-tenant. **Toujours auditer la migration RLS la plus récente avant de merger.**
- Index sans `company_id` en première position sur une table scopée → query planner ne l'utilisera pas dans le hot path multi-tenant.
- `CREATE TABLE` sans `IF NOT EXISTS`, `ADD COLUMN` sans `IF NOT EXISTS` → migration non rejouable, bloque les replays de dev.
- Renommer une colonne via `ALTER COLUMN ... RENAME` sans plan de coexistence → casse les builds N-1 en cours d'exécution. Préférer add-new-column + dual-write + drop-old (cf. `0054`).
- Hardcoder un rôle ou une permission dans le code TS → CLAUDE.md interdit `BUSINESS_ROLES` / `PERMISSION_KEYS`. Tout passe par DB.
- Désactiver `FORCE ROW LEVEL SECURITY` ou utiliser `PERMISSIVE` au lieu de `RESTRICTIVE` → la policy peut être contournée par d'autres policies plus laxistes.
- Oublier `--> statement-breakpoint` entre deux DDL → Drizzle exécute en bloc et le diagnostic d'erreur devient illisible.
- Set `app.current_company_id` depuis le SQL (jamais) → c'est le job de `tenantContextMiddleware`. Si tu en as besoin dans une migration, c'est probablement un bug d'archi.

## Références

- `docs/conventions/middleware-chain.md` — chaîne RLS / `app.current_company_id` côté serveur
- `docs/conventions/rbac-tags.md` — permissions, rôles dynamiques, tag scope
- `docs/decision-log.md` — multi-tenant + RLS, config layers, advisory locks
- Migration de référence RLS : `packages/db/src/migrations/0030_rls_policies.sql`
- Migration récente idiomatique : `packages/db/src/migrations/0070_workflow_run_cancellation.sql`
- Test de migration de référence : `packages/db/src/migrations/0067_agents_archived_at.test.ts`
- Drizzle docs : https://orm.drizzle.team/docs/migrations
