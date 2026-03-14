# TECH-02 : Docker Compose Environment — Spécification Détaillée

## Métadonnées

| Champ | Valeur |
|-------|--------|
| **Story ID** | TECH-02 |
| **Titre** | Docker Compose Environment |
| **Epic** | Epic 0 — Infrastructure & Setup |
| **Sprint** | Sprint 0 (prérequis) |
| **Effort** | M (5 SP, 3-4j) |
| **Assignation** | Cofondateur (infra) |
| **Bloqué par** | Aucun |
| **Débloque** | CONT-S01 (ContainerManager Docker), TECH-04 (Redis Setup), tests d'intégration |
| **ADR** | ADR-004 (Containerisation Docker + Credential Proxy) |
| **Type** | Infrastructure-only (pas de composant UI) |

---

## Description

### Objectif

Compléter l'infrastructure Docker Compose de MnM pour couvrir les trois environnements (dev, test, prod) avec tous les services nécessaires (PostgreSQL, Redis), et s'assurer que le Dockerfile existant est optimisé pour l'écosystème B2B.

### Ce qui a changé depuis l'écriture de l'epic

L'epic originale décrit TECH-02 comme "docker-compose.dev.yml (PostgreSQL 16, Redis 7, server, ui), docker-compose.test.yml, Dockerfile server + ui". Depuis :

1. **TECH-01 est terminé** — `docker-compose.dev.yml` existe déjà avec PostgreSQL 17-alpine (pas 16 comme décrit dans l'epic). Il ne contient que le service `db` (pas de server, pas d'ui, pas de Redis).

2. **`docker-compose.yml` (production) existe** — avec PostgreSQL 17-alpine + service `server` (build depuis `Dockerfile`). Pas de Redis.

3. **Le `Dockerfile` existe** — multi-stage build (base → deps → build → production) avec `node:lts-trixie-slim`. Il est fonctionnel mais certains noms d'env vars utilisent encore `PAPERCLIP_*` au lieu de `MNM_*`.

4. **Les scripts npm `db:dev` et `db:dev:down` existent** (créés par TECH-01).

5. **`playwright.config.ts` existe** — configuré pour E2E tests dans `e2e/tests/` avec webServer pour CI.

6. **Redis n'est utilisé nulle part dans le code actuel** — TECH-04 (Redis Setup) est une story séparée dans BATCH 2 qui dépend de TECH-02. Donc TECH-02 doit préparer l'infrastructure Redis (containers), mais le code serveur Redis sera ajouté par TECH-04.

### Scope ajusté

Étant donné l'état actuel du code, TECH-02 doit :

1. **Enrichir `docker-compose.dev.yml`** — Ajouter le service Redis 7 avec health check (PostgreSQL est déjà présent)
2. **Créer `docker-compose.test.yml`** — Environnement de test isolé avec PostgreSQL et Redis dédiés (noms de volume et ports distincts)
3. **Enrichir `docker-compose.yml` (prod)** — Ajouter le service Redis 7 avec health check
4. **Revoir le `Dockerfile`** — Corriger les variables `PAPERCLIP_*` → `MNM_*`, optimiser si nécessaire
5. **Ajouter `REDIS_URL` à `.env.example`** — Documenter la variable pour les développeurs
6. **Ajouter scripts npm** — `pnpm test:e2e:docker` pour lancer les tests avec `docker-compose.test.yml`
7. **Documenter la hiérarchie** — Commentaires dans chaque compose file expliquant son rôle

---

## État Actuel du Code (Analyse)

### Fichiers clés

| Fichier | Rôle | État |
|---------|------|------|
| `docker-compose.yml` | Compose production (PG 17 + server) | Existe, manque Redis |
| `docker-compose.dev.yml` | Compose dev (PG 17 only) | Existe (TECH-01), manque Redis |
| `docker-compose.test.yml` | Compose test isolé | N'existe PAS |
| `Dockerfile` | Multi-stage build server+ui | Existe, variables `PAPERCLIP_*` à corriger |
| `.env.example` | Template des variables d'env | Existe (TECH-01), manque `REDIS_URL` |
| `package.json` | Scripts npm racine | `db:dev`, `db:dev:down`, `test:e2e` existent |
| `playwright.config.ts` | Config Playwright E2E | Existe, webServer pour CI |
| `server/src/config.ts` | Configuration serveur | Pas de Redis config encore |
| `.gitignore` | Ignore `.env`, `.env.*`, garde `.env.example` | OK |

### Constats

1. **Redis n'est pas encore dans le codebase** — Aucune dépendance `ioredis`, `bullmq`, ou `redis` dans les `package.json`. TECH-04 les ajoutera. TECH-02 prépare uniquement l'infrastructure Docker.

2. **Le Dockerfile utilise `PAPERCLIP_*`** — Variables d'env `PAPERCLIP_HOME`, `PAPERCLIP_INSTANCE_ID`, `PAPERCLIP_CONFIG`, `PAPERCLIP_DEPLOYMENT_MODE`, `PAPERCLIP_DEPLOYMENT_EXPOSURE` (ligne 43-47 du Dockerfile). Le code serveur utilise `MNM_*` (voir `config.ts`). Il faut aligner.

3. **Le `docker-compose.yml` prod n'a pas de Redis** — Or l'architecture B2B prévoit Redis pour sessions, cache, WebSocket pub/sub et rate limiting (architecture-b2b.md, section 8.2).

4. **Pas de `docker-compose.test.yml`** — Les tests Playwright utilisent actuellement le serveur de dev. Pour l'isolation, il faut un compose dédié avec DB et Redis de test.

5. **Le compose dev n'a pas de service `server`/`ui`** — C'est intentionnel (le dev lance manuellement `pnpm dev`). On conserve cette approche.

---

## Tâches d'Implémentation

### T1 : Enrichir `docker-compose.dev.yml` avec Redis

Ajouter le service Redis 7-alpine au compose de développement existant.

**Fichier** : `docker-compose.dev.yml` (modification)

```yaml
# docker-compose.dev.yml — Développement local MnM
# Usage : pnpm db:dev (ou docker compose -f docker-compose.dev.yml up -d)
# Fournit PostgreSQL + Redis pour le développement local.
# Le serveur MnM est lancé séparément via "pnpm dev".
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

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 5s
      retries: 30
    ports:
      - "${REDIS_PORT:-6379}:6379"
    volumes:
      - redisdata-dev:/data

volumes:
  pgdata-dev:
  redisdata-dev:
```

### T2 : Créer `docker-compose.test.yml`

Créer un compose dédié aux tests avec des ports et volumes isolés pour éviter toute interférence avec le dev.

**Fichier** : `docker-compose.test.yml` (nouveau)

```yaml
# docker-compose.test.yml — Environnement de test isolé MnM
# Usage : docker compose -f docker-compose.test.yml up -d
# Fournit PostgreSQL + Redis sur des ports isolés (5433, 6380).
# Les données sont éphémères (pas de volumes persistants en production test).
services:
  db-test:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: mnm_test
      POSTGRES_PASSWORD: mnm_test
      POSTGRES_DB: mnm_test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mnm_test -d mnm_test"]
      interval: 2s
      timeout: 5s
      retries: 30
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data

  redis-test:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 5s
      retries: 30
    ports:
      - "6380:6379"
    tmpfs:
      - /data
```

**Choix de design** :
- **Ports distincts** (5433/6380) pour pouvoir coexister avec l'environnement de dev
- **`tmpfs`** au lieu de volumes nommés — les données de test sont éphémères
- **Credentials distinctes** (`mnm_test`) pour isolation
- **Noms de service distincts** (`db-test`, `redis-test`) pour clarté dans `docker ps`

### T3 : Enrichir `docker-compose.yml` (production) avec Redis

Ajouter le service Redis au compose de production, avec dépendance du serveur sur Redis.

**Fichier** : `docker-compose.yml` (modification)

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: mnm
      POSTGRES_PASSWORD: mnm
      POSTGRES_DB: mnm
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U mnm -d mnm"]
      interval: 2s
      timeout: 5s
      retries: 30
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 5s
      retries: 30
    volumes:
      - redisdata:/data

  server:
    build: .
    ports:
      - "3100:3100"
    environment:
      DATABASE_URL: postgres://mnm:mnm@db:5432/mnm
      REDIS_URL: redis://redis:6379
      PORT: "3100"
      SERVE_UI: "true"
      MNM_DEPLOYMENT_MODE: "authenticated"
      MNM_DEPLOYMENT_EXPOSURE: "private"
      MNM_PUBLIC_URL: "${MNM_PUBLIC_URL:-http://localhost:3100}"
      BETTER_AUTH_SECRET: "${BETTER_AUTH_SECRET:?BETTER_AUTH_SECRET must be set}"
    volumes:
      - mnm-data:/mnm
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  pgdata:
  redisdata:
  mnm-data:
```

**Changements** :
- Ajout du service `redis` avec health check
- Ajout de `REDIS_URL` dans les variables d'environnement du serveur
- Le serveur dépend maintenant de `redis` (condition: service_healthy)
- Nouveau volume `redisdata` pour la persistance Redis en production

### T4 : Corriger le Dockerfile (variables PAPERCLIP → MNM)

Le Dockerfile utilise encore des variables `PAPERCLIP_*` héritées du branding précédent. Les aligner sur les noms `MNM_*` utilisés par le code serveur.

**Fichier** : `Dockerfile` (modification)

Lignes à modifier (38-47) :

```dockerfile
# AVANT
ENV NODE_ENV=production \
  HOME=/paperclip \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  PAPERCLIP_HOME=/paperclip \
  PAPERCLIP_INSTANCE_ID=default \
  PAPERCLIP_CONFIG=/paperclip/instances/default/config.json \
  PAPERCLIP_DEPLOYMENT_MODE=authenticated \
  PAPERCLIP_DEPLOYMENT_EXPOSURE=private

VOLUME ["/paperclip"]

# APRÈS
ENV NODE_ENV=production \
  HOME=/mnm \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  MNM_HOME=/mnm \
  MNM_INSTANCE_ID=default \
  MNM_CONFIG=/mnm/instances/default/config.json \
  MNM_DEPLOYMENT_MODE=authenticated \
  MNM_DEPLOYMENT_EXPOSURE=private

VOLUME ["/mnm"]
```

**Attention** : Il faut vérifier que `server/src/config.ts` utilise bien `MNM_HOME`, `MNM_INSTANCE_ID`, etc. Si le code serveur utilise encore `PAPERCLIP_*` en interne (avec un mapping), on peut avoir besoin de garder la compatibilité ou de mettre à jour le code serveur aussi. L'Agent Dev doit vérifier ceci attentivement avant de modifier.

**Décision** : Si le serveur mappe encore `PAPERCLIP_*` → `MNM_*` en interne, ajouter les deux sets de variables dans le Dockerfile avec un commentaire de dépréciation. La migration complète sera faite dans un refactor séparé si nécessaire.

### T5 : Mettre à jour `.env.example`

Ajouter les variables Redis et les variables de test.

**Fichier** : `.env.example` (modification)

Ajouter après la section Database :

```env
# --- Redis -------------------------------------------------------------------
# Redis connection string. Required when running with docker-compose.
# If not set, Redis features (sessions, cache, pub/sub) are disabled.
# REDIS_URL=redis://127.0.0.1:6379

# --- Test environment --------------------------------------------------------
# For running tests with docker-compose.test.yml:
# DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test
# REDIS_URL=redis://127.0.0.1:6380
```

### T6 : Ajouter scripts npm pour les tests Docker

Ajouter des scripts de commodité dans `package.json` (racine) pour gérer l'environnement de test Docker.

**Fichier** : `package.json` (modification)

```json
{
  "scripts": {
    "test:docker:up": "docker compose -f docker-compose.test.yml up -d --wait",
    "test:docker:down": "docker compose -f docker-compose.test.yml down -v",
    "dev:docker:up": "docker compose -f docker-compose.dev.yml up -d --wait",
    "dev:docker:down": "docker compose -f docker-compose.dev.yml down"
  }
}
```

**Notes** :
- `--wait` attend que les health checks passent avant de rendre la main
- `-v` sur `test:docker:down` supprime les volumes tmpfs (nettoyage complet)
- Les scripts `db:dev` et `db:dev:down` existants restent (rétro-compatibilité), les nouveaux `dev:docker:up`/`dev:docker:down` sont des alias plus cohérents avec la convention de nommage

### T7 : Documenter la hiérarchie des fichiers Compose

Ajouter un commentaire en-tête à chaque fichier compose expliquant son rôle et son usage.

Déjà inclus dans T1, T2, T3 ci-dessus (commentaires en-tête). L'Agent Dev s'assurera que chaque fichier commence par un commentaire bloc expliquant :
- Le nom de l'environnement (dev / test / production)
- La commande d'usage
- Les services inclus
- Les différences avec les autres fichiers compose

---

## Acceptance Criteria

### AC-1 : Docker Compose dev avec Redis
```
Given un développeur avec Docker installé
When il exécute `docker compose -f docker-compose.dev.yml up -d`
Then PostgreSQL 17-alpine ET Redis 7-alpine démarrent
  And les health checks passent pour les deux services
  And PostgreSQL est accessible sur localhost:${POSTGRES_PORT:-5432}
  And Redis est accessible sur localhost:${REDIS_PORT:-6379}
  And les volumes `pgdata-dev` et `redisdata-dev` sont créés
```

### AC-2 : Docker Compose test isolé
```
Given un développeur avec Docker installé
  And l'environnement de dev potentiellement actif sur les ports standard
When il exécute `docker compose -f docker-compose.test.yml up -d`
Then PostgreSQL (port 5433) ET Redis (port 6380) démarrent
  And les services utilisent des credentials isolées (mnm_test)
  And les données sont éphémères (tmpfs, pas de volumes persistants)
  And il n'y a PAS de conflit de port avec docker-compose.dev.yml
  And les health checks passent
```

### AC-3 : Docker Compose production avec Redis
```
Given le fichier docker-compose.yml de production
When il est déployé via `docker compose up -d`
Then PostgreSQL, Redis et le serveur MnM démarrent
  And le serveur attend que PostgreSQL ET Redis soient healthy
  And la variable REDIS_URL est passée au serveur (redis://redis:6379)
  And Redis a un volume persistant (redisdata)
```

### AC-4 : Dockerfile avec variables MNM corrigées
```
Given le Dockerfile de production
When l'image est construite (docker build .)
Then les variables d'environnement utilisent le préfixe MNM_*
  And le VOLUME est /mnm (pas /paperclip)
  And le build multi-stage fonctionne sans erreur
  And l'image finale peut démarrer le serveur
```

### AC-5 : .env.example documenté avec Redis
```
Given le fichier .env.example
When un développeur le consulte
Then il trouve REDIS_URL documenté avec la valeur par défaut pour dev
  And il trouve les variables pour l'environnement de test
  And chaque variable a un commentaire explicatif
```

### AC-6 : Scripts npm pour Docker test
```
Given le package.json racine
When un développeur exécute `pnpm test:docker:up`
Then docker-compose.test.yml démarre avec --wait (attend les health checks)
  And `pnpm test:docker:down` arrête et nettoie les volumes
```

### AC-7 : Coexistence dev et test
```
Given l'environnement dev actif (PostgreSQL:5432, Redis:6379)
When le développeur lance aussi l'environnement test
Then les deux environnements coexistent sans conflit
  And test PostgreSQL est sur le port 5433
  And test Redis est sur le port 6380
  And les bases de données sont complètement isolées
```

### AC-8 : Health checks fonctionnels
```
Given les trois fichiers docker-compose (dev, test, prod)
When un service est démarré
Then le health check détecte l'état du service en <10s
  And PostgreSQL utilise pg_isready avec les bons credentials
  And Redis utilise redis-cli ping
  And les services dépendants attendent le healthy status
```

---

## data-test-id

**N/A** — Cette story est infrastructure-only. Aucun composant UI n'est ajouté ou modifié.

Les éléments vérifiables sont des fichiers de configuration Docker et des commandes CLI :
- `docker compose -f docker-compose.dev.yml up -d` (compose dev)
- `docker compose -f docker-compose.test.yml up -d` (compose test)
- `docker compose up -d` (compose prod)
- `docker build .` (Dockerfile)
- `pnpm test:docker:up` / `pnpm test:docker:down` (scripts npm)

---

## Notes Techniques d'Implémentation

### Redis 7-alpine — Configuration minimale

Redis 7-alpine est un choix adapté pour dev/test :
- Image légère (~30MB)
- Health check natif via `redis-cli ping`
- Pas besoin de configuration custom (`redis.conf`) pour le dev
- En production, considérer `maxmemory` et `maxmemory-policy allkeys-lru` via un `redis.conf` monté en volume (à traiter dans TECH-04)

### tmpfs pour les tests

L'utilisation de `tmpfs` dans `docker-compose.test.yml` garantit :
- Des données éphémères (RAM disk)
- Des performances de test optimales (pas d'I/O disque)
- Un nettoyage automatique à l'arrêt du container
- Pas de résidus entre les runs de test

### Dockerfile — Analyse de rétrocompatibilité des variables PAPERCLIP

Le Dockerfile (ligne 38-47) utilise `PAPERCLIP_HOME`, `PAPERCLIP_INSTANCE_ID`, `PAPERCLIP_CONFIG`, `PAPERCLIP_DEPLOYMENT_MODE`, `PAPERCLIP_DEPLOYMENT_EXPOSURE`.

L'agent Dev doit vérifier dans `server/src/config.ts` et `server/src/paths.ts` si ces variables sont lues directement. Rechercher :
- `process.env.PAPERCLIP_*` dans tout le code serveur
- `resolveMnMEnvPath()` et `loadConfig()` pour comprendre le mapping
- Si le code utilise `MNM_*` exclusivement, on peut renommer en toute sécurité
- Si le code lit encore `PAPERCLIP_*`, ajouter les deux sets avec un commentaire de dépréciation

### Playwright + docker-compose.test.yml — Intégration CI

Le `playwright.config.ts` existant a déjà un bloc `webServer` pour CI. L'intégration avec `docker-compose.test.yml` se fera ainsi :

1. CI lance `docker compose -f docker-compose.test.yml up -d --wait`
2. CI exporte `DATABASE_URL=postgres://mnm_test:mnm_test@127.0.0.1:5433/mnm_test`
3. CI exporte `REDIS_URL=redis://127.0.0.1:6380`
4. Playwright démarre le serveur MnM via `webServer.command`
5. Les tests s'exécutent contre la DB/Redis isolées
6. CI lance `docker compose -f docker-compose.test.yml down -v`

### Volumes nommés vs anonymes

| Environnement | Stratégie volumes | Raison |
|---------------|-------------------|--------|
| Dev | Volumes nommés (`pgdata-dev`, `redisdata-dev`) | Persistance entre restarts, données conservées |
| Test | `tmpfs` (pas de volumes) | Éphémère, rapide, pas de résidus |
| Production | Volumes nommés (`pgdata`, `redisdata`, `mnm-data`) | Persistance obligatoire |

### Production Redis — Sécurité

En production, Redis n'expose PAS de port vers le host (pas de `ports:` dans le service Redis de `docker-compose.yml`). Il est accessible uniquement via le réseau Docker interne (`redis://redis:6379`). C'est une mesure de sécurité.

---

## Edge Cases et Scénarios d'Erreur

### E1 : Port Redis déjà utilisé en dev
```
Given le port 6379 déjà occupé par un autre processus (Redis local, etc.)
When le développeur lance docker-compose.dev.yml
Then Docker Compose affiche une erreur de port binding
  And le développeur peut utiliser REDIS_PORT=6380 pour changer le port
  And le .env.example documente cette variable
```

### E2 : Docker non installé
```
Given un développeur sans Docker installé
When il essaie de lancer docker-compose.dev.yml
Then une erreur explicite est affichée ("docker: command not found" ou similaire)
  And le développeur peut toujours utiliser embedded-postgres (fallback)
  And Redis n'est simplement pas disponible (les features Redis sont désactivées jusqu'à TECH-04)
```

### E3 : Coexistence dev + test impossible (ports occupés)
```
Given l'environnement dev actif
  And un processus occupe aussi le port 5433 ou 6380
When le développeur lance docker-compose.test.yml
Then Docker Compose affiche une erreur de port binding sur le port en conflit
  And le développeur doit libérer le port ou modifier docker-compose.test.yml
```

### E4 : tmpfs non disponible (Docker Desktop Windows/Mac)
```
Given Docker Desktop sur Windows ou macOS
When docker-compose.test.yml utilise tmpfs
Then Docker Desktop gère tmpfs via sa VM Linux (transparent)
  And les performances sont légèrement inférieures au Linux natif mais acceptables pour les tests
```

### E5 : Build Dockerfile échoue après renommage variables
```
Given le Dockerfile avec les nouvelles variables MNM_*
When l'image est construite et le serveur démarre
  And le code serveur attend encore PAPERCLIP_* pour certaines fonctions
Then le serveur échoue avec une erreur de config manquante
  And l'Agent Dev doit ajouter la rétrocompatibilité (lire les deux préfixes)
```
**Mitigation** : L'Agent Dev DOIT vérifier toutes les occurrences de `PAPERCLIP_*` dans le code serveur AVANT de modifier le Dockerfile. Si le code lit `PAPERCLIP_*`, soit mettre à jour le code, soit garder les deux sets de variables.

### E6 : Redis health check échoue au démarrage
```
Given Redis 7-alpine qui démarre
When le health check s'exécute avant que Redis soit prêt
Then Docker attend les retries (30 x 2s = 60s max)
  And si Redis ne démarre pas après 60s, le container est marqué unhealthy
  And les services dépendants (serveur en prod) ne démarrent pas
```

### E7 : Volume dev corrompu
```
Given un volume pgdata-dev ou redisdata-dev corrompu
When docker-compose.dev.yml démarre
Then PostgreSQL ou Redis échouent au démarrage
  And le développeur peut résoudre avec :
    docker compose -f docker-compose.dev.yml down -v
    docker compose -f docker-compose.dev.yml up -d
  And les données de dev sont perdues (réinitialisation via pnpm db:migrate + pnpm db:seed)
```

---

## Dépendances Sortantes (ce que TECH-02 débloque)

| Story | Raison |
|-------|--------|
| TECH-04 | Redis Setup — nécessite le service Redis dans docker-compose.dev.yml |
| CONT-S01 | ContainerManager Docker — nécessite l'infrastructure Docker et le Dockerfile validé |
| TECH-03 | Infrastructure de test — peut utiliser docker-compose.test.yml pour les tests d'intégration |
| TECH-08 | CI/CD pipeline — utilise docker-compose.test.yml dans la CI |
| CONT-S05 | Tables container — dépendance indirecte via CONT-S01 |

---

## Fichiers Impactés (Résumé)

| Fichier | Action | Tâche |
|---------|--------|-------|
| `docker-compose.dev.yml` | Modifier | T1 — Ajouter Redis |
| `docker-compose.test.yml` | Créer | T2 — Compose test isolé |
| `docker-compose.yml` | Modifier | T3 — Ajouter Redis prod |
| `Dockerfile` | Modifier | T4 — Variables PAPERCLIP → MNM |
| `.env.example` | Modifier | T5 — Ajouter REDIS_URL |
| `package.json` | Modifier | T6 — Scripts Docker test |

---

## Critères de Définition of Done

- [ ] `docker-compose.dev.yml` contient PostgreSQL 17 + Redis 7 avec health checks
- [ ] `docker-compose.test.yml` créé avec ports isolés (5433/6380) et tmpfs
- [ ] `docker-compose.yml` (prod) contient Redis 7 avec health check et sans port exposé
- [ ] `Dockerfile` utilise les variables `MNM_*` (ou les deux préfixes avec dépréciation)
- [ ] `.env.example` documente `REDIS_URL` et les variables de test
- [ ] Scripts npm `test:docker:up` et `test:docker:down` ajoutés
- [ ] Les trois environnements dev/test/prod peuvent coexister sans conflit de port
- [ ] Health checks fonctionnels pour tous les services (PG + Redis)
- [ ] Les commentaires en-tête de chaque compose file documentent l'usage
- [ ] `docker compose -f docker-compose.dev.yml up -d` fonctionne
- [ ] `docker compose -f docker-compose.test.yml up -d` fonctionne
- [ ] `docker build .` fonctionne avec le Dockerfile corrigé
- [ ] Tous les tests existants passent (`pnpm test:run`)
- [ ] TypeScript compile sans erreur (`pnpm typecheck`)
