# TECH-01 : Migration PostgreSQL Externe — Spécification Détaillée

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Story ID** | TECH-01 |
| **Titre** | Migration PostgreSQL Externe |
| **Epic** | Epic 0 — Infrastructure & Setup |
| **Sprint** | Sprint 0 (prérequis) |
| **Effort** | M (5 SP, 3-4j) |
| **Assignation** | Tom (backend) |
| **Bloqué par** | Aucun |
| **Débloque** | TECH-03, TECH-05, TECH-06, TECH-07, TECH-08, MU-S01, et toutes les epics B2B |
| **ADR** | ADR-001 |
| **Type** | Backend-only (pas de composant UI) |

---

## Description

Le codebase MnM utilise déjà PostgreSQL via Drizzle ORM (`postgres` driver), avec deux modes de fonctionnement :

1. **Mode embedded-postgres** (par défaut) : Quand `DATABASE_URL` n'est pas défini, le serveur démarre une instance PostgreSQL embarquée via le package `embedded-postgres`. Ce mode est pratique pour le développement solo mais ne convient pas au B2B multi-tenant.

2. **Mode external PostgreSQL** : Quand `DATABASE_URL` est défini, le serveur se connecte à un PostgreSQL externe.

**L'objectif de cette story** est de faire de PostgreSQL externe le mode **principal et recommandé** pour le développement, tout en conservant embedded-postgres uniquement pour les tests d'intégration automatisés. Concrètement :

- Créer `docker-compose.dev.yml` dédié au développement (PostgreSQL 17 + volumes)
- Créer `.env.example` avec template `DATABASE_URL` et toutes les variables pertinentes
- Ajouter un script `pnpm db:seed` fonctionnel avec données de dev réalistes
- Enrichir le health check `/health` pour inclure la connectivité DB (latence, version PG)
- S'assurer que les migrations Drizzle fonctionnent de manière fiable en mode externe
- Documenter clairement la transition dans la config et les logs de démarrage

---

## État Actuel du Code (Analyse)

### Fichiers clés

| Fichier | Rôle | Lignes pertinentes |
|---------|------|-------------------|
| `packages/db/src/client.ts` | Création DB, migrations, inspection | L44-47 (`createDb`), L581-639 (`inspectMigrations`), L641-675 (`applyPendingMigrations`), L714-734 (`ensurePostgresDatabase`) |
| `server/src/index.ts` | Startup avec choix embedded vs external | L230-236 (branche external), L237-393 (branche embedded) |
| `server/src/config.ts` | Config loading, `databaseUrl`, `databaseMode` | L41-43 (`databaseMode`, `databaseUrl`), L214 (`databaseUrl` résolu) |
| `server/src/config-file.ts` | Lecture du fichier de config MnM | L1-16 |
| `server/src/routes/health.ts` | Endpoint GET /health | L23-49 (pas de vérification DB connectivity) |
| `docker-compose.yml` | Compose production (PostgreSQL 17) | L1-38 |
| `packages/db/src/seed.ts` | Script seed basique | L1-99 |
| `packages/db/src/migrate.ts` | Script migration CLI | L1-21 |
| `packages/db/drizzle.config.ts` | Config Drizzle Kit | L1-10 |
| `packages/db/src/schema/index.ts` | 38 tables exportées | L1-38 |

### Constats

1. **Le driver PostgreSQL est déjà en place** : Le package `postgres` (postgres.js) est utilisé partout. Il n'y a PAS de SQLite dans le codebase.
2. **Les migrations fonctionnent** : `client.ts` a un système robuste d'inspection, réconciliation et application des migrations (30 fichiers de migration existants).
3. **Le `docker-compose.yml` existe déjà** pour la production mais il n'y a PAS de `docker-compose.dev.yml` dédié au développement.
4. **Pas de `.env.example`** : Aucun fichier template pour les variables d'environnement.
5. **Le seed est basique** : `packages/db/src/seed.ts` crée 1 company, 2 agents, 1 goal, 1 project, 2 issues. Pas d'utilisateurs auth, pas de permissions.
6. **Le health check ne vérifie pas la DB** : `GET /health` retourne `{ status: "ok" }` sans tester la connexion PostgreSQL.

---

## Tâches d'Implémentation

### T1 : Créer `docker-compose.dev.yml`

Créer un fichier Docker Compose dédié au développement local avec PostgreSQL 17.

```yaml
# docker-compose.dev.yml — Développement local MnM
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: mnm
      POSTGRES_PASSWORD: mnm_dev
      POSTGRES_DB: mnm
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mnm -d mnm"]
      interval: 2s
      timeout: 5s
      retries: 30
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata-dev:/var/lib/postgresql/data

volumes:
  pgdata-dev:
```

**Fichier** : `docker-compose.dev.yml` (racine du repo)

**Différences avec `docker-compose.yml` (production)** :
- Pas de service `server` (le dev lance le serveur manuellement via `pnpm dev`)
- Password différent (`mnm_dev` vs `mnm`) pour distinguer les environnements
- Volume nommé distinct (`pgdata-dev`)
- Port configurable via variable `POSTGRES_PORT`

### T2 : Créer `.env.example`

Créer un fichier template documentant toutes les variables d'environnement.

**Fichier** : `.env.example` (racine du repo)

```env
# =============================================================================
# MnM — Environment Variables Template
# =============================================================================
# Copy this file to .env and adjust values for your environment.
# The .env file is loaded by the server at startup.
# =============================================================================

# --- Database -----------------------------------------------------------------
# Required for external PostgreSQL (recommended for development).
# If not set, the server falls back to embedded-postgres.
DATABASE_URL=postgres://mnm:mnm_dev@127.0.0.1:5432/mnm

# --- Server -------------------------------------------------------------------
PORT=3100
HOST=127.0.0.1

# --- Deployment Mode ----------------------------------------------------------
# Options: local_trusted | authenticated
MNM_DEPLOYMENT_MODE=local_trusted

# --- Auth (only for authenticated mode) ---------------------------------------
# BETTER_AUTH_SECRET=your-secret-here
# MNM_PUBLIC_URL=http://localhost:3100
# MNM_AUTH_DISABLE_SIGN_UP=false

# --- Migrations ---------------------------------------------------------------
# Set to "true" to auto-apply pending migrations without prompting
# MNM_MIGRATION_AUTO_APPLY=false

# --- Database Backups ---------------------------------------------------------
# MNM_DB_BACKUP_ENABLED=true
# MNM_DB_BACKUP_INTERVAL_MINUTES=60
# MNM_DB_BACKUP_RETENTION_DAYS=30

# --- Secrets Provider ---------------------------------------------------------
# Options: local_encrypted | env
# MNM_SECRETS_PROVIDER=local_encrypted
# MNM_SECRETS_STRICT_MODE=false

# --- Storage ------------------------------------------------------------------
# Options: local_disk | s3
# MNM_STORAGE_PROVIDER=local_disk
```

### T3 : Enrichir le seed avec des données B2B réalistes

Modifier `packages/db/src/seed.ts` pour inclure :
- 1 utilisateur auth (admin) via `authUsers`
- 1 instance_admin role via `instanceUserRoles`
- 1 company avec `companyMemberships`
- 2-3 agents avec hiérarchie (CEO, CTO, Engineer)
- 1 project avec des issues à différents statuts
- Permissions via `principalPermissionGrants`
- Idempotence : le seed peut être relancé sans erreur (upsert ou check préalable)

**Fichier** : `packages/db/src/seed.ts` (modification)

### T4 : Enrichir le health check avec vérification DB

Modifier `server/src/routes/health.ts` pour ajouter :
- Un `SELECT 1` sur la DB pour vérifier la connectivité
- La version de PostgreSQL (`SHOW server_version`)
- La latence de la requête (en ms)
- Un status `degraded` si la DB ne répond pas

**Fichier** : `server/src/routes/health.ts` (modification)

### T5 : Ajouter scripts npm de commodité

Ajouter dans `package.json` (racine) :
- `pnpm db:dev` — raccourci pour `docker compose -f docker-compose.dev.yml up -d`
- `pnpm db:dev:down` — raccourci pour `docker compose -f docker-compose.dev.yml down`
- `pnpm db:seed` — Existe déjà (`pnpm --filter @mnm/db seed`)

**Fichier** : `package.json` (racine, modification)

### T6 : Ajouter un log de warning si embedded-postgres est utilisé en développement

Modifier `server/src/index.ts` pour ajouter un warning plus visible quand le mode embedded-postgres est utilisé, suggérant le passage à PostgreSQL externe via `docker-compose.dev.yml`.

**Fichier** : `server/src/index.ts` (modification, autour de L282-284)

### T7 : Ajouter `.env` au `.gitignore`

Vérifier que `.env` est dans `.gitignore` (ne pas commiter de secrets).

**Fichier** : `.gitignore` (vérification/modification)

---

## Acceptance Criteria

### AC-1 : Connexion PostgreSQL externe au démarrage
```
Given le serveur MnM avec DATABASE_URL configuré vers PostgreSQL 17 externe
When il démarre
Then il se connecte à PostgreSQL externe
  And le log affiche "Using external PostgreSQL via DATABASE_URL/config"
  And le startup banner affiche le mode "external-postgres"
  And aucun processus embedded-postgres n'est lancé
```

### AC-2 : docker-compose.dev.yml fonctionnel
```
Given un développeur avec Docker installé
When il exécute `docker compose -f docker-compose.dev.yml up -d`
Then un conteneur PostgreSQL 17-alpine démarre
  And le healthcheck passe (pg_isready)
  And le port 5432 est accessible sur localhost
  And le serveur MnM peut se connecter via DATABASE_URL=postgres://mnm:mnm_dev@127.0.0.1:5432/mnm
```

### AC-3 : Migrations exécutées avec données préservées
```
Given les 38 tables existantes dans le schema Drizzle
  And 30 fichiers de migration dans packages/db/src/migrations/
When la commande `pnpm db:migrate` s'exécute sur une DB vide
Then toutes les migrations sont appliquées dans l'ordre
  And les 38 tables sont créées
  And le journal de migration (__drizzle_migrations) est à jour
  And la commande retourne "Migrations complete"
```

### AC-4 : Seed avec données de développement réalistes
```
Given une DB PostgreSQL avec le schema appliqué
When la commande `pnpm db:seed` s'exécute
Then les données de développement sont insérées :
  - 1 utilisateur auth admin
  - 1 instance_admin role
  - 1 company "MnM Demo Co" avec membership
  - 2+ agents avec hiérarchie
  - 1 project avec issues
  And le seed est idempotent (relancer ne cause pas d'erreur)
```

### AC-5 : Health check avec connectivité DB
```
Given le serveur MnM démarré et connecté à PostgreSQL
When un client appelle GET /health
Then la réponse inclut :
  - status: "ok"
  - db.connected: true
  - db.latencyMs: <number>
  - db.version: "17.x" (ou version courante)
```

### AC-6 : Health check en mode dégradé
```
Given le serveur MnM démarré
When la connexion DB est coupée (PostgreSQL arrêté)
  And un client appelle GET /health
Then la réponse inclut :
  - status: "degraded"
  - db.connected: false
  - db.error: <message d'erreur>
  And le HTTP status code est 503
```

### AC-7 : Embedded-postgres uniquement pour tests
```
Given un test d'intégration
When il s'exécute
Then il peut utiliser embedded-postgres pour l'isolation
  And le serveur en mode développement normal utilise PostgreSQL externe
```

### AC-8 : .env.example présent et documenté
```
Given le repository MnM
When un développeur consulte .env.example
Then il trouve un template avec :
  - DATABASE_URL avec valeur par défaut pour docker-compose.dev.yml
  - Toutes les variables d'environnement documentées avec commentaires
  - Les valeurs par défaut pour le développement local
```

### AC-9 : Warning pour embedded-postgres en dev
```
Given le serveur MnM sans DATABASE_URL configuré
When il démarre et utilise embedded-postgres
Then un warning est affiché :
  "⚠ Using embedded PostgreSQL. For B2B development, use external PostgreSQL: docker compose -f docker-compose.dev.yml up -d"
```

---

## data-test-id

**N/A** — Cette story est backend-only. Aucun composant UI n'est ajouté ou modifié.

Les éléments testables sont des endpoints API et des scripts CLI :
- `GET /health` (endpoint existant enrichi)
- `pnpm db:migrate` (script existant)
- `pnpm db:seed` (script existant enrichi)

---

## Notes Techniques d'Implémentation

### Health Check — Détails de l'implémentation

Le fichier `server/src/routes/health.ts` (L23-49) retourne actuellement un JSON simple. L'enrichissement nécessite :

1. Accéder à l'objet `db` (déjà passé en paramètre à `healthRoutes()` — L8)
2. Exécuter `SELECT 1` via `db.execute(sql\`SELECT 1\`)` pour tester la connectivité
3. Exécuter `SHOW server_version` pour la version PG
4. Mesurer la latence avec `performance.now()` ou `Date.now()`
5. Wrapper dans un try/catch pour gérer le cas déconnecté (503)

Le Drizzle ORM expose `sql` depuis `drizzle-orm` (déjà importé L3 dans health.ts).

### Seed — Considérations d'idempotence

Le seed actuel (`packages/db/src/seed.ts`) fait des `INSERT` directs sans vérification. Pour l'idempotence :

1. Utiliser `INSERT ... ON CONFLICT DO NOTHING` via Drizzle (`.onConflictDoNothing()`)
2. Ou vérifier l'existence avec un `SELECT` avant chaque `INSERT`
3. Le `authUsers` a un `id` de type UUID — utiliser un ID fixe pour le seed user (ex: `seed-admin-001`)

### docker-compose.dev.yml — Réseau

Le `docker-compose.dev.yml` n'inclut PAS le service `server` car le développeur lance le serveur manuellement. Le PostgreSQL est exposé sur le host via `ports: ["5432:5432"]`, permettant une connexion directe depuis `pnpm dev`.

### Configuration — Priorité des sources

D'après `server/src/config.ts` L214 :
```typescript
databaseUrl: process.env.DATABASE_URL ?? fileDbUrl
```

L'ordre de priorité est :
1. Variable d'environnement `DATABASE_URL`
2. Fichier de config MnM (`database.connectionString` si `database.mode === "postgres"`)
3. Fallback vers embedded-postgres

Le `.env` est chargé par dotenv dans `config.ts` L26-28 depuis le chemin `resolveMnMEnvPath()`.

### Tests existants

Le fichier `server/src/__tests__/health.test.ts` teste le health check sans DB (`healthRoutes()` appelé sans argument). Ce test doit être enrichi pour couvrir :
- Le cas avec DB connectée (mock ou embedded-postgres)
- Le cas avec DB déconnectée (mock d'erreur)

---

## Edge Cases et Scénarios d'Erreur

### E1 : PostgreSQL non démarré au lancement du serveur
```
Given DATABASE_URL configuré vers un PostgreSQL qui n'est pas démarré
When le serveur MnM démarre
Then une erreur explicite est levée avec un message clair :
  "Cannot connect to PostgreSQL at postgres://...@127.0.0.1:5432/mnm.
   Start PostgreSQL with: docker compose -f docker-compose.dev.yml up -d"
```

### E2 : Base de données inexistante
```
Given DATABASE_URL pointant vers une DB qui n'existe pas encore
When le serveur MnM démarre
Then le mécanisme existant `ensurePostgresDatabase()` (client.ts L714-734) crée la DB
  Or une erreur explicite indique que la DB doit être créée
```
**Note** : `ensurePostgresDatabase` est utilisé uniquement pour embedded-postgres actuellement (index.ts L375). Pour le mode externe, la DB doit exister.

### E3 : Port 5432 déjà utilisé
```
Given le port 5432 déjà occupé par un autre processus
When le développeur lance docker-compose.dev.yml
Then Docker Compose affiche une erreur de port binding
  And le développeur peut utiliser POSTGRES_PORT=5433 pour changer le port
```

### E4 : Migration partielle (crash pendant l'application)
```
Given une migration en cours d'application
When le processus crash au milieu
Then le mécanisme de réconciliation existant (reconcilePendingMigrationHistory, client.ts L467-560)
  détecte les migrations partiellement appliquées
  And les répare automatiquement au prochain démarrage
```

### E5 : Seed sur une DB avec des données existantes
```
Given une DB avec des données de production/test
When pnpm db:seed s'exécute
Then les données existantes ne sont PAS écrasées (idempotence via ON CONFLICT DO NOTHING)
  And les nouvelles données de seed sont ajoutées uniquement si absentes
```

### E6 : Health check pendant les migrations
```
Given le serveur en cours de démarrage avec des migrations en attente
When GET /health est appelé avant la fin des migrations
Then le endpoint n'est pas encore disponible (le serveur n'a pas encore démarré le listener HTTP)
```

### E7 : Connexion DB perdue en cours de fonctionnement
```
Given le serveur MnM en fonctionnement normal
When la connexion PostgreSQL est perdue (réseau, crash PG, etc.)
Then GET /health retourne 503 avec db.connected: false
  And les requêtes API retournent des erreurs 500/503 appropriées
  And quand la connexion est rétablie, le serveur reprend automatiquement (postgres.js gère le reconnect)
```

---

## Dépendances Sortantes (ce que TECH-01 débloque)

| Story | Raison |
|-------|--------|
| TECH-03 | Infrastructure de test — embedded-postgres pour tests d'intégration |
| TECH-05 | RLS PostgreSQL — nécessite une DB externe pour les policies |
| TECH-06 | 10 nouvelles tables — les migrations s'appliquent sur PG externe |
| TECH-07 | Modifications 5 tables — idem |
| TECH-08 | CI/CD — pipeline utilise PG externe pour les tests |
| MU-S01 | API invitations — table `invites` sur PG externe |
| Toutes les epics B2B | Foundation layer pour le multi-tenant |

---

## Critères de Définition of Done

- [ ] `docker-compose.dev.yml` créé et fonctionnel
- [ ] `.env.example` créé avec template complet
- [ ] `GET /health` retourne la connectivité DB, latence et version PG
- [ ] `GET /health` retourne 503 si la DB est déconnectée
- [ ] `pnpm db:seed` enrichi avec données B2B réalistes et idempotent
- [ ] Scripts npm `db:dev` et `db:dev:down` ajoutés
- [ ] Warning visible quand embedded-postgres est utilisé au lieu d'externe
- [ ] `.env` dans `.gitignore`
- [ ] Tests unitaires pour le health check enrichi
- [ ] Documentation inline dans les fichiers modifiés
- [ ] Tous les tests existants passent (`pnpm test:run`)
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
