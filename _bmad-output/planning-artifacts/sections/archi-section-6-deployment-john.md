# Section 6 — Architecture de Déploiement, Performance & Migration

> **Auteur** : John (PM) | **Date** : 2026-03-14 | **Version** : 1.0
> **Sources** : PRD B2B v1.0 (sections 2, 7, 8), UX Design B2B v1.0 (section 13), Dockerfile existant, docker-compose.yml existant

---

## Table des Matières

1. [Modes de Déploiement](#1-modes-de-déploiement)
2. [Infrastructure par Environnement](#2-infrastructure-par-environnement)
3. [Performance & Scalabilité](#3-performance--scalabilité)
4. [Stratégie de Migration Mono-user → Multi-tenant](#4-stratégie-de-migration-mono-user--multi-tenant)

---

## 1. Modes de Déploiement

MnM supporte trois modes de déploiement alignés sur les quatre tiers de licence (Open Source, Team, Enterprise, On-Premise). Chaque mode répond à des exigences différentes en termes de coût, contrôle des données, et scalabilité.

### 1.1 Mode Self-Hosted (Open Source + Team)

**Cible** : Développeurs solo, petites équipes (<50 utilisateurs), communauté open source.

**Principe** : Docker Compose sur un serveur unique. L'utilisateur contrôle l'intégralité de son infrastructure. Zéro dépendance cloud propriétaire.

**Composants** :

```
┌─────────────────────────────────────────────────────┐
│                   SERVEUR UNIQUE                     │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ PostgreSQL│  │  MnM Server  │  │   MnM UI      │  │
│  │  17-alpine│  │  (Express +  │  │  (Vite build  │  │
│  │           │  │   Node.js)   │  │   statique)   │  │
│  │  Port 5432│  │  Port 3100   │  │  servi par    │  │
│  │           │  │  WebSocket   │  │  SERVE_UI=true│  │
│  └──────────┘  └──────────────┘  └───────────────┘  │
│                                                      │
│  ┌──────────────┐  ┌────────────────────────────┐   │
│  │ Volumes       │  │ Optionnel : Redis           │   │
│  │ pgdata:/var/  │  │ (sessions, cache, pub/sub)  │   │
│  │ mnm-data:/mnm │  │ Port 6379                   │   │
│  └──────────────┘  └────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**docker-compose.yml existant** (base du mode self-hosted) :
- Service `db` : PostgreSQL 17-alpine avec healthcheck (`pg_isready`)
- Service `server` : Build depuis Dockerfile multi-stage (deps → build → production)
- Variables d'environnement : `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MNM_DEPLOYMENT_MODE=authenticated`
- Volumes persistants : `pgdata` (données PostgreSQL), `mnm-data` (données MnM)

**Infrastructure requise** :
- CPU : 2 vCPU minimum, 4 recommandé
- RAM : 4 Go minimum, 8 Go recommandé
- Stockage : 20 Go SSD minimum (PostgreSQL + volumes Docker)
- OS : Linux (Ubuntu 22.04+, Debian 12+), macOS, ou Windows avec WSL2
- Docker Engine 24+ et Docker Compose v2+

**Backup strategy** :
- Script `db:backup` existant (`scripts/backup-db.sh`) pour dump PostgreSQL
- Recommandation : cron job quotidien `pg_dump` + rotation 7 jours
- Backup des volumes Docker (`mnm-data`) via snapshot ou rsync
- Documentation fournie pour restauration complète

**Monitoring** :
- Health check PostgreSQL intégré (interval 2s, retries 30)
- Endpoint `/health` sur le serveur MnM (HTTP 200 si connecté à la DB)
- Logs Docker (`docker compose logs -f`) — suffisant pour une petite équipe
- Optionnel : Prometheus node_exporter pour métriques système

**Limites** :
- Single point of failure (pas de HA)
- Scalabilité verticale uniquement
- Pas de CDN intégré
- WebSocket limité à une seule instance (pas besoin de Redis pub/sub)

---

### 1.2 Mode Cloud Managed (Team + Enterprise)

**Cible** : Équipes 5-500+ utilisateurs, SaaS multi-tenant géré par AlphaLuppi.

**Principe** : Kubernetes (K8s) multi-tenant avec auto-scaling, isolation par namespace ou Row-Level Security PostgreSQL, et infrastructure managée.

**Architecture** :

```
                        ┌─────────────────────┐
                        │    CDN (Cloudflare)  │
                        │    Assets statiques  │
                        │    + DDoS protection │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   Load Balancer      │
                        │   (Nginx Ingress     │
                        │    ou Traefik)       │
                        │   SSL Termination    │
                        └──────────┬──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼────────┐ ┌────────▼────────┐  ┌────────▼────────┐
    │  MnM Server (N)  │ │  MnM Server (N) │  │  MnM Server (N) │
    │  Pod replicas    │ │  Pod replicas   │  │  Pod replicas   │
    │  HPA: 2-20 pods  │ │  WebSocket      │  │  Workers async  │
    │  CPU/Memory      │ │  sticky sessions│  │  (audit, notif) │
    └────────┬─────────┘ └────────┬────────┘  └────────┬────────┘
             │                     │                     │
    ┌────────▼─────────────────────▼─────────────────────▼────────┐
    │                        Redis Cluster                         │
    │  Sessions │ Cache queries │ WebSocket pub/sub │ Rate limit   │
    │  (Sentinel ou Redis Cluster, 3 nœuds)                       │
    └────────────────────────────┬─────────────────────────────────┘
                                 │
    ┌────────────────────────────▼─────────────────────────────────┐
    │                     PostgreSQL Managed                        │
    │  (AWS RDS / GCP Cloud SQL / Azure DB)                        │
    │  RLS activé │ Connection pooling (pgBouncer) │ Read replicas │
    │  Backups automatiques │ Point-in-time recovery               │
    └──────────────────────────────────────────────────────────────┘
```

**Composants Kubernetes** :
- **Deployment MnM Server** : HPA (Horizontal Pod Autoscaler), min 2 replicas, max 20
  - Scaling sur CPU >70% et mémoire >80%
  - Requests : 256m CPU, 512Mi RAM | Limits : 1 CPU, 2Gi RAM
- **Service WebSocket** : Sticky sessions via annotation Ingress (`nginx.ingress.kubernetes.io/affinity: cookie`)
  - Alternative enterprise : Redis pub/sub pour broadcasting cross-instances
- **Workers asynchrones** : Deployment séparé pour tâches lourdes (audit trail, notifications, import Jira)
- **Redis** : StatefulSet avec Sentinel (3 nœuds) pour HA
- **Ingress** : Nginx Ingress Controller avec cert-manager (Let's Encrypt) pour SSL automatique
- **Secrets** : Kubernetes Secrets + external-secrets-operator pour HashiCorp Vault ou AWS Secrets Manager

**Infrastructure requise (par tenant cluster)** :
- Kubernetes 1.28+ (EKS, GKE, ou AKS)
- 3 nodes minimum (m5.xlarge ou équivalent : 4 vCPU, 16 Go RAM)
- PostgreSQL managed (db.r6g.xlarge : 4 vCPU, 32 Go RAM, 500 Go SSD)
- Redis managed (cache.r6g.large : 2 vCPU, 13 Go RAM)
- Stockage : 100 Go gp3 EBS par node + volumes PVC pour données persistantes

**Backup strategy** :
- PostgreSQL : Snapshots automatiques quotidiens (rétention 30 jours) + WAL archiving pour PITR
- Redis : RDB snapshots toutes les heures + AOF append-only pour durabilité
- Kubernetes : Velero pour backup/restore des ressources K8s et PVCs
- Rétention : 30 jours rolling pour données actives, 3 ans pour audit trail (REQ-AUDIT-01)

**Monitoring** :
- **Métriques** : Prometheus + Grafana (dashboards préconfiguré pour API latency, WebSocket connections, DB connections, container health)
- **Logs** : Loki ou ELK stack, rétention 90 jours
- **Alerting** : AlertManager avec escalation PagerDuty/Opsgenie
  - P1 : API P99 >500ms, DB connections >80%, pod restarts >3/heure
  - P2 : CPU sustained >85%, mémoire >90%, WebSocket reconnections >100/min
- **Tracing** : OpenTelemetry pour traces distribuées (requête → server → DB → Redis)

**Multi-tenancy** :
- Isolation par Row-Level Security (RLS) PostgreSQL — chaque query filtrée par `company_id`
- Pas d'isolation par namespace K8s (trop coûteux) — RLS + filtrage applicatif suffisent pour Team
- Enterprise : option namespace dédié si le client le demande (surcoût)

---

### 1.3 Mode On-Premise (Enterprise)

**Cible** : Secteurs réglementés (banques, santé, défense, administrations), entreprises avec politique zero data exfiltration.

**Principe** : Déploiement dans l'infrastructure du client. Aucune donnée ne quitte le réseau du client. MnM est livré comme un package Helm ou un ensemble d'images Docker signées.

**Architecture** :

```
┌─────────────────── RÉSEAU CLIENT ───────────────────────┐
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Kubernetes Client (ou Docker Compose)   │   │
│  │                                                    │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │   │
│  │  │ MnM     │ │ MnM     │ │ Redis   │ │ Worker │ │   │
│  │  │ Server  │ │ Server  │ │ (local) │ │ Async  │ │   │
│  │  │ Pod 1   │ │ Pod 2   │ │         │ │        │ │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬───┘ │   │
│  │       └──────┬─────┘          │            │      │   │
│  │              │                │            │      │   │
│  │  ┌───────────▼────────────────▼────────────▼──┐  │   │
│  │  │          PostgreSQL (local ou client DB)     │  │   │
│  │  │          Géré par l'équipe infra client      │  │   │
│  │  └─────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌────────────────────┐  ┌─────────────────────────┐    │
│  │ LLM On-Premise     │  │ Registry privé          │    │
│  │ (Ollama, vLLM,     │  │ (Harbor, Artifactory)   │    │
│  │  Azure OpenAI      │  │ Images Docker signées   │    │
│  │  privé)            │  │                          │    │
│  └────────────────────┘  └─────────────────────────┘    │
│                                                          │
│  AUCUNE connexion sortante vers AlphaLuppi               │
└──────────────────────────────────────────────────────────┘
```

**Livraison** :
- **Helm Chart** versionné : `mnm-enterprise-X.Y.Z.tgz` avec `values.yaml` personnalisable
- **Images Docker signées** (cosign) poussées sur le registry privé du client
- **Guide d'installation** : procédure documentée étape par étape, validée par l'équipe SRE AlphaLuppi
- **Air-gapped support** : toutes les dépendances (images Docker, charts, packages npm) incluses dans un bundle offline

**Composants spécifiques On-Premise** :
- **LLM local** : Support Ollama, vLLM, ou Azure OpenAI privé via l'architecture d'adapters existante (8 adapters dans `packages/adapters/`)
- **Secrets** : HashiCorp Vault on-premise ou le secret manager du client (REQ-RESID-01)
- **Certificats** : TLS géré par l'infrastructure PKI du client
- **Stockage** : NFS ou stockage bloc fourni par le client

**Infrastructure requise (minimum)** :
- 3 nodes K8s (8 vCPU, 32 Go RAM chacun) ou Docker Compose sur un serveur dédié (16 vCPU, 64 Go)
- PostgreSQL 17+ (géré par le client ou déployé via le Helm chart)
- Redis 7+ (inclus dans le Helm chart ou fourni par le client)
- Stockage : 500 Go SSD minimum (DB + volumes + images Docker en cache)
- GPU optionnel pour LLM local (NVIDIA T4 ou mieux)

**Backup strategy** :
- Intégration avec les outils de backup du client (Veeam, Commvault, Velero)
- Scripts de backup/restore fournis et testés dans le guide d'installation
- Le client est responsable de la politique de rétention et de la fréquence
- MnM fournit un endpoint `/admin/export` pour export complet des données (REQ-REG-03 — portabilité)

**Monitoring** :
- Intégration avec la stack d'observabilité du client (Prometheus, Datadog, Splunk, ELK)
- Métriques exposées via endpoint Prometheus `/metrics` (format OpenMetrics)
- Health checks standard : `/health` (liveness), `/ready` (readiness)
- Logs structurés JSON pour intégration directe dans les pipelines de log existants

**Zero data exfiltration** :
- Aucun appel réseau sortant vers AlphaLuppi
- Pas de telemetry, analytics, ou phone-home
- Mises à jour : l'équipe infra du client pull les nouvelles images depuis un registry miroir ou reçoit le bundle offline
- LLM : uniquement des providers accessibles depuis le réseau interne du client

---

### 1.4 Matrice Récapitulative Modes × Tiers

| Caractéristique | Self-Hosted (OSS) | Self-Hosted (Team) | Cloud Managed (Team) | Cloud Managed (Enterprise) | On-Premise (Enterprise) |
|-----------------|-------------------|-------------------|---------------------|---------------------------|------------------------|
| **Infrastructure** | Docker Compose | Docker Compose + Redis | Kubernetes | Kubernetes dédié | K8s client ou Docker |
| **HA** | Non | Non | Oui (2+ pods) | Oui (3+ pods) | Selon client |
| **Auto-scaling** | Non | Non | HPA | HPA + VPA | Selon client |
| **Multi-tenant** | N/A | N/A | RLS | RLS + namespace option | Single-tenant |
| **Backup** | Manuel (script) | Script + cron | Automatique PITR | Automatique PITR + cross-region | Client-managed |
| **Monitoring** | Docker logs | Docker logs + /health | Prometheus/Grafana | Full stack + alerting | Intégration client |
| **SSL** | Manuel (Caddy/nginx) | Manuel | cert-manager auto | cert-manager auto | PKI client |
| **LLM** | Cloud APIs | Cloud APIs | Cloud APIs | Cloud ou private | On-premise obligatoire |
| **Support** | Communauté | Email (48h) | Email (24h) + Slack | SLA 99.9% + CSM dédié | SLA sur-mesure |
| **Prix** | Gratuit | ~50EUR/user/mois | ~50EUR/user/mois | ~200EUR/user/mois | Licence annuelle |

---

## 2. Infrastructure par Environnement

### 2.1 Environnement Dev (Local)

**Objectif** : Permettre à tout développeur de lancer MnM localement en moins de 5 minutes.

**Stack** :

```bash
# Démarrage rapide (docker-compose.quickstart.yml existant)
export BETTER_AUTH_SECRET="dev-secret-change-me"
docker compose -f docker-compose.quickstart.yml up

# Ou mode dev complet avec hot-reload
docker compose up db           # PostgreSQL uniquement
pnpm install                    # Dépendances
pnpm dev                        # Server + UI avec hot-reload
```

**Composants** :
- PostgreSQL 17-alpine (via Docker) — port 5432
- MnM Server (Express + tsx hot-reload) — port 3100
- MnM UI (Vite dev server) — port 5173 (proxy vers 3100)
- Redis : **non requis** en dev (sessions en mémoire, pas de pub/sub nécessaire single-instance)

**Variables d'environnement dev** :
```env
DATABASE_URL=postgres://mnm:mnm@localhost:5432/mnm
PORT=3100
SERVE_UI=false           # Vite dev server séparé
MNM_DEPLOYMENT_MODE=authenticated
MNM_DEPLOYMENT_EXPOSURE=private
BETTER_AUTH_SECRET=dev-secret-do-not-use-in-production
```

**Migrations** :
- `pnpm db:generate` — Génère les migrations Drizzle
- `pnpm db:migrate` — Applique les migrations
- Script `dev-runner.mjs` gère automatiquement les migrations au démarrage en mode dev

### 2.2 Environnement Staging

**Objectif** : Reproduction fidèle de la production pour validation pré-release. Tests E2E automatisés, seed data, et smoke tests.

**Architecture** : Identique à la production mais dimensions réduites.

```
┌─────────────────── STAGING ────────────────────────┐
│                                                      │
│  Kubernetes (même cluster, namespace: mnm-staging)   │
│                                                      │
│  MnM Server: 2 replicas (min)                        │
│  PostgreSQL: Instance managée dédiée (small)         │
│  Redis: Single node (pas de Sentinel)                │
│  Ingress: staging.mnm.dev (accès restreint)          │
│                                                      │
│  Seed data:                                          │
│  - 3 companies (small, medium, enterprise)           │
│  - 50 utilisateurs (tous les rôles RBAC)             │
│  - 10 workflows actifs avec historique de drifts     │
│  - 1000 issues avec audit trail                      │
│                                                      │
│  Tests automatisés:                                  │
│  - Cypress E2E (7 smoke tests UX)                    │
│  - Load test (k6) : 50 users virtuels, 5 min        │
│  - Healthcheck continu (5 min interval)              │
│                                                      │
│  Politique de reset:                                 │
│  - Reset seed data chaque nuit (cron job)            │
│  - Migrations appliquées automatiquement au deploy   │
└──────────────────────────────────────────────────────┘
```

**Différences avec la production** :
- Pas de backups cross-region
- Pas de monitoring PagerDuty (alertes Slack uniquement)
- Données anonymisées (jamais de données client réelles)
- Accès restreint par VPN ou IP whitelist
- Replicas réduits (2 au lieu de 3-20)

**Pipeline de déploiement staging** :
1. PR merged dans `master` → CI build + tests unitaires
2. Images Docker taguées `staging-{sha}`
3. Helm upgrade automatique sur namespace `mnm-staging`
4. Tests E2E Cypress lancés automatiquement
5. Si E2E passent → candidat promotion en production

### 2.3 Environnement Production

**Objectif** : Haute disponibilité, performance, sécurité maximale. SLA 99.5% (MVP) à 99.9% (Enterprise).

**Architecture Cloud Managed** (voir section 1.2 pour le diagramme complet).

**Configuration Kubernetes production** :

```yaml
# Extraits de configuration K8s

# --- Deployment MnM Server ---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mnm-server
  namespace: mnm-production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0    # Zero-downtime deployment
  template:
    spec:
      containers:
      - name: mnm-server
        resources:
          requests:
            cpu: "256m"
            memory: "512Mi"
          limits:
            cpu: "1"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /health
            port: 3100
          initialDelaySeconds: 10
          periodSeconds: 15
        readinessProbe:
          httpGet:
            path: /ready
            port: 3100
          initialDelaySeconds: 5
          periodSeconds: 5

# --- HPA ---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mnm-server-hpa
spec:
  scaleTargetRef:
    name: mnm-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Reverse Proxy & SSL** :
- Nginx Ingress Controller avec annotations pour :
  - SSL termination (cert-manager + Let's Encrypt)
  - WebSocket upgrade (`nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"`)
  - Sticky sessions pour WebSocket (`nginx.ingress.kubernetes.io/affinity: "cookie"`)
  - Rate limiting (`nginx.ingress.kubernetes.io/limit-rps: "50"`)
- HSTS activé, TLS 1.3 uniquement (NFR-SEC-02)

**Health Checks** :
- **Liveness** (`/health`) : vérifie que le process Node.js répond. Si échoue 3 fois → restart pod.
- **Readiness** (`/ready`) : vérifie connexion PostgreSQL + Redis. Si échoue → pod retiré du Service.
- **Startup** : délai initial de 10s pour laisser les connexions DB s'établir.

**Pipeline de déploiement production** :
1. Tag de release `vX.Y.Z` sur `master`
2. CI : build + tests unitaires + tests intégration + build Docker multi-arch
3. Images poussées sur registry (ECR/GCR) avec tag version
4. Helm upgrade avec `--atomic` (rollback automatique si healthcheck échoue)
5. Canary deployment : 10% traffic → monitoring 15 min → 50% → monitoring 15 min → 100%
6. Smoke tests automatisés post-déploiement
7. Notification Slack avec changelog

---

## 3. Performance & Scalabilité

### 3.1 Cibles NFR (extraites du PRD)

| Métrique | MVP | Enterprise | Technique |
|----------|-----|-----------|-----------|
| API P50 | <100ms | <50ms | Indexation PostgreSQL, cache Redis |
| API P99 | <500ms | <200ms | Connection pooling, query optimization |
| WebSocket message | <50ms | <20ms | Redis pub/sub, sticky sessions |
| Démarrage container agent | <10s | <5s | Image pré-chargée, warm pool |
| Requêtes simultanées | 100 | 1000 | HPA, connection pooling |
| Dashboard chargement | <2s | <1s | CDN, code splitting, SSR optionnel |
| Users/instance | 50 | 10 000 | Multi-instance, RLS optimisé |
| Companies/instance | 5 | 500 | Sharding par company_id si nécessaire |
| Agents actifs simultanés | 20 | 500 | Worker pool, queue management |
| WebSocket connexions | 100 | 10 000 | Redis pub/sub, multi-instance |

### 3.2 Caching — Redis

Redis est le composant central de la stratégie de performance. Il couvre quatre usages distincts.

**Usage 1 — Sessions** :
- Sessions Better Auth stockées dans Redis (au lieu de PostgreSQL) en production
- TTL : 24h (configurable par company pour Enterprise)
- Format : `session:{sessionId}` → JSON sérialisé
- Avantage : réduit la charge DB de ~30% (chaque requête API vérifie la session)

**Usage 2 — Cache de requêtes** :
- Queries fréquentes mises en cache : liste des membres d'une company, permissions d'un utilisateur, workflows actifs
- Pattern : Cache-Aside avec invalidation event-driven
- TTL : 5 min pour données semi-statiques (membres, rôles), 30s pour données dynamiques (workflow status)
- Invalidation : via PostgreSQL NOTIFY/LISTEN → serveur invalide le cache quand une mutation se produit
- Format clé : `cache:{companyId}:{resource}:{hash}` pour isolation multi-tenant

**Usage 3 — WebSocket pub/sub** :
- En mode multi-instance, les messages WebSocket doivent atteindre tous les clients connectés, quel que soit le pod
- Redis Pub/Sub pour broadcaster les événements entre instances
- Channels : `ws:{companyId}:broadcast`, `ws:{companyId}:user:{userId}`, `ws:{companyId}:project:{projectId}`
- Latence ajoutée : <2ms par hop Redis

**Usage 4 — Rate limiting** :
- Compteurs Redis avec TTL pour rate limiting distribué
- Granularités (extraites de NFR-SEC-09) :
  - Par IP : login 5/min, API 100/min
  - Par utilisateur : chat 10/min, invitations 20/h
  - Par company : agents actifs selon tier de licence
- Pattern : sliding window counter (`ZADD` + `ZRANGEBYSCORE`)
- Réponse HTTP 429 avec header `Retry-After`

### 3.3 Connection Pooling — pgBouncer

PostgreSQL ne supporte nativement qu'un nombre limité de connexions simultanées (~100-200 par défaut). Avec 20 pods serveur MnM, chacun ouvrant 10 connexions, on atteint rapidement la limite.

**Solution** : pgBouncer en mode `transaction` entre les pods MnM et PostgreSQL.

```
MnM Pod 1 ──┐
MnM Pod 2 ──┤
MnM Pod 3 ──┼──► pgBouncer (pool 200 conn) ──► PostgreSQL (max 250 conn)
  ...       ──┤
MnM Pod 20 ──┘
```

**Configuration** :
- Mode : `transaction` (partage une connexion DB entre requêtes, libère entre transactions)
- Pool size : 200 connexions côté client, 50 connexions côté serveur vers PostgreSQL
- Timeout : `server_idle_timeout = 300` (libère les connexions inactives après 5 min)
- Reserve : 10 connexions réservées pour les opérations admin (migrations, backup)

**Déploiement** :
- En Cloud Managed : Sidecar container dans chaque pod MnM ou service K8s dédié
- En On-Premise : Inclus dans le Helm chart, configurable via `values.yaml`
- En Self-Hosted : Optionnel (non nécessaire pour <50 utilisateurs)

**Impact mesuré** :
- Réduction du nombre de connexions PostgreSQL actives : de N×10 (N pods) à 50 fixe
- Réduction latence connexion : de ~50ms (nouvelle connexion) à <1ms (connexion poolée)
- Capacité accrue : supporte 10 000 requêtes/s avec 50 connexions DB effectives

### 3.4 WebSocket Scaling

Le WebSocket est critique pour l'expérience temps réel de MnM : supervision d'agents en direct, chat, notifications, mises à jour dashboard.

**Problème multi-instance** : Un client WebSocket est connecté à un pod spécifique. Si un événement est émis par un autre pod, le client ne le reçoit pas.

**Solution 1 — Sticky Sessions (MVP)** :
- L'Ingress Controller route toujours un client vers le même pod (cookie `mnm-ws-affinity`)
- Suffisant pour <100 connexions simultanées
- Limitation : si un pod tombe, les clients doivent se reconnecter et perdent l'affinité

**Solution 2 — Redis Pub/Sub (Enterprise)** :
- Chaque pod subscribe aux channels Redis pertinents
- Quand un événement est émis (mutation DB, action agent, message chat), il est publié sur le channel Redis
- Tous les pods reçoivent l'événement et le relaient aux clients WebSocket connectés
- Latence totale : émission → Redis → pod → client < 20ms

**Reconnexion automatique** (déjà spécifié dans le design UX, section 11.6) :
- Backoff exponentiel : 1s → 2s → 4s → 8s → 16s (max)
- Buffer de 30s côté serveur : messages en attente pour clients en reconnexion
- Sync des messages manqués : le client envoie son dernier `eventId`, le serveur renvoie le delta
- Indicateur visuel : vert (connecté), orange (reconnexion), rouge (déconnecté)

**Métriques WebSocket à monitorer** :
- Connexions actives par pod
- Messages/seconde entrants et sortants
- Latence P50 et P99 des messages
- Taux de reconnexion (alarme si >10/min/pod)
- Buffer overflow (alarme si >1000 messages en attente)

### 3.5 CDN pour Assets Statiques

**Objectif** : Réduire le temps de chargement initial du dashboard de <2s (MVP) à <1s (Enterprise).

**Stratégie** :
- Build Vite produit des fichiers avec hash dans le nom (`assets/index-a1b2c3.js`)
- Ces fichiers sont immutables → `Cache-Control: public, max-age=31536000, immutable`
- Servis via CDN (Cloudflare, CloudFront, ou Bunny CDN)
- HTML (`index.html`) : `Cache-Control: no-cache` (toujours vérifier la version)

**Configuration** :
- CDN origin : le service Kubernetes MnM Server (qui sert l'UI via `SERVE_UI=true`)
- Ou mieux : bucket S3/GCS dédié pour les assets statiques, MnM Server ne sert que l'API
- Purge CDN automatique lors du déploiement d'une nouvelle version

**Performance attendue** :
- TTFB assets : <50ms (CDN edge) vs <200ms (origin)
- Bundle principal : ~350 kB gzip (React + shadcn/ui + deps)
- Code splitting : lazy loading par route (chaque page <100 kB gzip)
- Fonts : Inter (variable, ~100 kB) + JetBrains Mono (~80 kB), préchargées

### 3.6 Rate Limiting

**Architecture multi-couche** :

| Couche | Outil | Granularité | Limites |
|--------|-------|-------------|---------|
| Edge (CDN) | Cloudflare WAF | Par IP | 1000 req/min (global) |
| Ingress | Nginx rate limit | Par IP | 200 req/min (API) |
| Application | Redis sliding window | Par user, par company | Voir détails ci-dessous |
| Database | pgBouncer queue | Par connexion | 50 conn max |

**Limites applicatives** (extraites de NFR-SEC-09) :

| Endpoint | Limite | Fenêtre | Scope |
|----------|--------|---------|-------|
| `POST /auth/login` | 5 | 1 min | Par IP |
| `POST /auth/register` | 3 | 1 min | Par IP |
| `POST /invitations` | 20 | 1 h | Par user |
| `POST /chat/messages` | 10 | 1 min | Par user |
| `POST /agents/start` | 5 | 1 min | Par user |
| `GET /api/*` (lecture) | 200 | 1 min | Par user |
| `POST /api/*` (écriture) | 50 | 1 min | Par user |
| WebSocket messages | 30 | 1 min | Par connexion |

**Réponse en cas de dépassement** :
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 32
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710432000
```

---

## 4. Stratégie de Migration Mono-user → Multi-tenant

La migration est structurée en 4 phases séquentielles avec rollback plan à chaque phase. L'objectif est le **zero-downtime** : aucune interruption de service pour les utilisateurs existants.

### 4.1 Principes Directeurs

1. **Additive-first** : on ajoute avant de modifier, on modifie avant de supprimer
2. **Non-breaking** : chaque phase est compatible avec le code de la phase précédente
3. **Testable** : chaque phase peut être validée indépendamment
4. **Réversible** : chaque phase a un rollback documenté et testé
5. **Zero-downtime** : les migrations SQL sont non-bloquantes (pas de `ALTER TABLE ... LOCK`)

### 4.2 Phase 1 — Ajout de Colonnes et Nouvelles Tables (Non-Breaking)

**Objectif** : Préparer le schéma DB pour le multi-tenant sans casser le code existant.

**Actions** :

```sql
-- 1. Ajouter company_id aux tables existantes (nullable dans un premier temps)
ALTER TABLE users ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE projects ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE issues ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE workflows ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE agent_sessions ADD COLUMN company_id UUID REFERENCES companies(id);
-- ... (toutes les 38 tables existantes)

-- 2. Créer les nouvelles tables B2B
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',  -- free, team, enterprise
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'contributor',  -- admin, manager, contributor, viewer
  permissions JSONB DEFAULT '{}',
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id)
);

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'contributor',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  invited_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Index pour performance
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_issues_company ON issues(company_id);
CREATE INDEX idx_company_members_company ON company_members(company_id);
CREATE INDEX idx_company_members_user ON company_members(user_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
```

**Code** : Le code existant continue de fonctionner car `company_id` est nullable. Aucune query existante n'est cassée.

**Rollback Phase 1** :
```sql
-- Supprimer les index ajoutés
DROP INDEX IF EXISTS idx_users_company;
-- ... (tous les index)
-- Supprimer les colonnes ajoutées
ALTER TABLE users DROP COLUMN IF EXISTS company_id;
-- ... (toutes les tables)
-- Supprimer les nouvelles tables
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS company_members;
DROP TABLE IF EXISTS companies;
```

**Validation Phase 1** :
- Tous les tests existants passent (aucune régression)
- Les nouvelles tables existent et sont vides
- Les colonnes `company_id` sont présentes et nullable

---

### 4.3 Phase 2 — Migration des Données Existantes

**Objectif** : Assigner tous les utilisateurs et données existants à une company par défaut ("Legacy Company").

**Actions** :

```sql
-- 1. Créer la company par défaut
INSERT INTO companies (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Legacy Company', 'legacy', 'team');

-- 2. Migrer les utilisateurs existants
INSERT INTO company_members (company_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'admin'
FROM users
WHERE company_id IS NULL;

UPDATE users SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 3. Migrer toutes les données existantes
UPDATE projects SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

UPDATE issues SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

UPDATE workflows SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

UPDATE agent_sessions SET company_id = '00000000-0000-0000-0000-000000000001'
WHERE company_id IS NULL;

-- 4. Rendre company_id NOT NULL (après vérification que tout est migré)
ALTER TABLE users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE projects ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE issues ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE workflows ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE agent_sessions ALTER COLUMN company_id SET NOT NULL;
```

**Script de vérification pré-NOT NULL** :
```sql
-- Vérifier qu'aucune ligne n'a company_id = NULL
SELECT 'users' AS table_name, COUNT(*) AS null_count FROM users WHERE company_id IS NULL
UNION ALL
SELECT 'projects', COUNT(*) FROM projects WHERE company_id IS NULL
UNION ALL
SELECT 'issues', COUNT(*) FROM issues WHERE company_id IS NULL;
-- Résultat attendu : 0 pour toutes les tables
```

**Rollback Phase 2** :
```sql
-- Rendre nullable à nouveau
ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;
-- ... (toutes les tables)
-- Supprimer les company_members créés
DELETE FROM company_members WHERE company_id = '00000000-0000-0000-0000-000000000001';
-- Remettre company_id à NULL
UPDATE users SET company_id = NULL WHERE company_id = '00000000-0000-0000-0000-000000000001';
-- ... (toutes les tables)
-- Supprimer la legacy company
DELETE FROM companies WHERE id = '00000000-0000-0000-0000-000000000001';
```

**Validation Phase 2** :
- Tous les utilisateurs ont un `company_id`
- Tous les utilisateurs sont members de la Legacy Company avec rôle `admin`
- Toutes les données (projects, issues, workflows) ont un `company_id`
- L'application fonctionne normalement (tests E2E passent)

---

### 4.4 Phase 3 — Activation du Row-Level Security (RLS) PostgreSQL

**Objectif** : Isolation tenant au niveau database. Chaque requête ne voit que les données de sa company.

**Actions** :

```sql
-- 1. Activer RLS sur chaque table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
-- ... (toutes les tables avec company_id)

-- 2. Créer les policies
-- Le contexte company_id est passé via SET LOCAL au début de chaque transaction
CREATE POLICY company_isolation ON users
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY company_isolation ON projects
  USING (company_id = current_setting('app.current_company_id')::uuid);

CREATE POLICY company_isolation ON issues
  USING (company_id = current_setting('app.current_company_id')::uuid);

-- ... (toutes les tables)

-- 3. Policy superadmin pour les opérations cross-tenant (admin AlphaLuppi)
CREATE POLICY superadmin_bypass ON users
  USING (current_setting('app.is_superadmin', true)::boolean = true);

-- ... (toutes les tables)
```

**Middleware applicatif** :
```typescript
// Avant chaque requête DB, le middleware injecte le company_id
async function withTenantContext(companyId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_company_id = ${companyId}`);
    return fn();
  });
}
```

**Rollback Phase 3** :
```sql
-- Désactiver RLS (les policies restent mais ne s'appliquent plus)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
-- ... (toutes les tables)
-- Optionnel : supprimer les policies
DROP POLICY IF EXISTS company_isolation ON users;
-- ...
```

**Validation Phase 3** :
- Test : un utilisateur de Company A ne voit PAS les données de Company B
- Test : le superadmin voit les données de toutes les companies
- Test : une requête sans `SET LOCAL` est rejetée (fail-safe)
- Load test : vérifier que RLS n'ajoute pas >5ms de latence par requête
- Tests E2E multi-company : créer 2 companies, vérifier isolation complète

---

### 4.5 Phase 4 — Déploiement Multi-Tenant Complet

**Objectif** : Activer le multi-tenant en production avec onboarding de nouvelles companies.

**Actions** :
1. Déployer le code avec support multi-company (signup company, invitations, sélecteur company)
2. Activer les endpoints API multi-tenant (`POST /companies`, `POST /invitations`, etc.)
3. Configurer le middleware d'isolation tenant sur toutes les routes
4. Activer la feature flag `MULTI_TENANT=true` en production (progressive rollout)
5. Onboarder la première company externe (CBA) en parallèle de la Legacy Company

**Progressive rollout** :
```
Semaine 1 : Legacy Company uniquement (feature flag off)
Semaine 2 : CBA ajouté (feature flag on pour CBA seulement)
Semaine 3 : Monitoring, feedback, corrections
Semaine 4 : Feature flag on pour toutes les nouvelles companies
```

**Rollback Phase 4** :
- Feature flag `MULTI_TENANT=false` → retour au mode mono-company
- Les données des nouvelles companies restent en DB mais ne sont plus accessibles
- La Legacy Company continue de fonctionner normalement
- Aucune perte de données

**Validation Phase 4** :
- CBA onboardé avec 10+ utilisateurs sur 3+ rôles RBAC
- Isolation vérifiée : CBA ne voit pas les données Legacy, et vice versa
- Performance : aucune dégradation mesurable (P99 API <500ms)
- Audit trail : toutes les actions cross-company sont loggées
- Uptime pendant la migration : 100% (zero-downtime confirmé)

---

### 4.6 Chronologie Migration

```
Phase 1 (Colonnes + Tables)     ████░░░░░░░░░░░░░░░░  Semaine 1
Phase 2 (Migration données)     ░░░░████░░░░░░░░░░░░  Semaine 2
Phase 3 (RLS)                   ░░░░░░░░████░░░░░░░░  Semaine 3
Phase 4 (Multi-tenant)          ░░░░░░░░░░░░████████  Semaines 4-5

Chaque ░ = période de stabilisation + tests
Chaque █ = travail actif
```

**Points de décision (go/no-go)** :
- Fin Phase 1 : tous les tests existants passent → go Phase 2
- Fin Phase 2 : 0 lignes avec `company_id` NULL + E2E passent → go Phase 3
- Fin Phase 3 : tests d'isolation passent + latence <5ms overhead → go Phase 4
- Fin Phase 4 : CBA onboardé + 1 semaine sans incident → déclaration multi-tenant stable

---

### 4.7 Zero-Downtime Migration — Techniques

| Technique | Utilisée en | Détail |
|-----------|-------------|--------|
| **ADD COLUMN nullable** | Phase 1 | PostgreSQL ajoute une colonne nullable sans lock (métadonnées seulement) |
| **CREATE INDEX CONCURRENTLY** | Phase 1 | Index créé sans bloquer les écritures |
| **Backfill en batches** | Phase 2 | UPDATE par lots de 1000 lignes avec `LIMIT` pour ne pas saturer |
| **SET NOT NULL via constraint** | Phase 2 | `ADD CONSTRAINT ... NOT NULL NOT VALID` puis `VALIDATE CONSTRAINT` (non-bloquant) |
| **RLS toggle** | Phase 3 | `ENABLE/DISABLE ROW LEVEL SECURITY` est instantané |
| **Feature flag** | Phase 4 | Le code multi-tenant est déployé mais inactif, activé progressivement |
| **Rolling deployment** | Toutes | K8s RollingUpdate avec `maxUnavailable: 0` |

---

## Annexe — Checklist de Déploiement Production

### Pré-déploiement
- [ ] Tests unitaires passent (>80% couverture)
- [ ] Tests intégration passent (routes API, RBAC, isolation)
- [ ] Tests E2E Cypress passent (7 smoke tests)
- [ ] Load test k6 passé (cibles NFR atteintes)
- [ ] Migrations SQL réversibles et testées
- [ ] Images Docker scannées (Trivy) — 0 vulnérabilité critique
- [ ] Secrets rotés depuis le dernier déploiement
- [ ] Changelog rédigé

### Déploiement
- [ ] Backup PostgreSQL pré-déploiement
- [ ] Helm upgrade `--atomic`
- [ ] Canary 10% → monitoring 15 min
- [ ] Canary 50% → monitoring 15 min
- [ ] Rollout 100%
- [ ] Smoke tests post-déploiement automatisés
- [ ] Vérification health checks OK

### Post-déploiement
- [ ] Monitoring Grafana : aucune anomalie latence/erreur
- [ ] Logs : aucune erreur inattendue
- [ ] WebSocket : connexions stables
- [ ] Notification équipe : deploy OK
- [ ] Tag git créé

---

*Section 6 — Architecture de Déploiement, Performance & Migration — ~3500 mots — John (PM)*
*Sources : PRD B2B v1.0, UX Design B2B v1.0, Dockerfile existant, docker-compose.yml existant, package.json*
