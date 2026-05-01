# Decision Log — Décisions structurantes encore actives

Ce document recense les **décisions architecturales et produit qui shape encore le code aujourd'hui**. Synthétisé à partir de ~30 brainstorms internes (fév→avr 2026), conservés dans le repo privé [`AlphaLuppi/mnm-documentation`](https://github.com/AlphaLuppi/mnm-documentation).

Pour le **comment** technique, voir [`ARCHITECTURE.md`](ARCHITECTURE.md).
Pour le **pourquoi** produit, voir [`product/vision.md`](product/vision.md).

---

## 1. Architecture & data model

### 1.1 Multi-tenant defense-in-depth (5 couches)

**Décision :** une seule instance backend sert N companies, isolation par défense en profondeur : Auth → Company membership → Permission → Tag scope → RLS PostgreSQL.

**Pourquoi vivant :** les 71 services backend reposent dessus, toutes les routes scopées `/companies/:companyId/`, RLS sur 41 tables. C'est la fondation invariante de la plateforme.

**Code :** `server/src/middlewares/`, `server/src/db/migrations/` (RLS), `ARCHITECTURE.md` §Multi-Tenant.

### 1.2 Hybrid Roles + Tags (vs hiérarchie pure)

**Décision :** rôles encodent les **permissions stables** (admin, lead, member, viewer). Tags encodent l'**organisation volatile** (teams, produits, skills, scopes). Séparation explicite : permissions figées en DB, organisation fluide avec `archive_at`.

**Pourquoi vivant :** permet des équipes matricielles (un Lead IA cross-product = 1 rôle + N tags). Tables `roles`, `principal_tags` en prod. Score 8/8 sur le test enterprise vs 5/8 pour Roles+Teams pur. CAO et Governed Workflows reposent dessus.

**Code :** `server/src/services/rbac.ts`, `server/src/middlewares/tagScope.ts`.

### 1.3 RBAC dynamique 100% en DB (zero hardcoded)

**Décision :** rôles, permissions et associations sont en DB (`roles`, `permissions`, `role_permissions`). Aucune constante `BUSINESS_ROLES`, `PERMISSION_KEYS` hardcodée dans le code.

**Pourquoi vivant :** une nouvelle permission se crée en SQL sans refacto code. 91 permissions granulaires actuellement. Onboarding company configure rôles & permissions à la volée.

**Code :** `server/src/middlewares/requirePermission.ts`, `server/src/services/onboarding.ts`.

### 1.4 Compute côté client (MCP, Desktop, CLI locale)

**Décision :** l'exécution agent se fait sur la machine de l'utilisateur (Claude Code, Cursor, MCP, Desktop Tauri). Le serveur est un API/data/orchestration layer pur. Les Docker sandboxes restent **optionnels** pour les utilisateurs non-tech.

**Pourquoi vivant :** c'est le positionnement MnM (« Kubernetes de l'IA coding », n'efface pas Claude Code). Toutes les intégrations MCP en dépendent. Mode `local_trusted` ↔ `authenticated` reposent dessus.

**Code :** `packages/mcp-server/`, `apps/desktop/`, `cli/`, heartbeat injection-only.

### 1.5 Zero polling — SSE/WebSocket exclusivement

**Décision :** aucun `setInterval` ni `refetchInterval`. Tous les updates temps réel passent par SSE/WebSocket via `/events/ws`.

**Pourquoi vivant :** règle critique listée dans `CLAUDE.md`. Validation badges, AI Assistant streaming, runs, traces : tout en SSE. Justifié par benchmark `realtime-workflows` (SSE plus scalable que WebSocket pour broadcasts massifs).

**Code :** `server/src/routes/events.ts`, `ui/src/lib/sse.ts`, hooks `useLiveEvents`.

---

## 2. Trace & observabilité

### 2.1 Pipeline Bronze → Silver → Gold (LLM hiérarchique)

**Décision :** trois niveaux de traces, Gold = vue par défaut (phases scorées, annotations, verdicts) auto-générée à la complétion. Silver = détail groupé. Bronze = JSON debug brut. Le prompt Gold compose **global → workflow → agent → issue** hiérarchiquement.

**Pourquoi vivant :** cœur de la transparence MnM (3e pilier). Enrichissement `claude -p --model haiku` sur chaque trace. UI timeline 3 niveaux. Décision arrêtée après comparaison avec Langfuse-style observability suite (rejetée comme trop lourde).

**Code :** `server/src/services/traces/`, `server/src/heartbeat/onLog.ts` (middleware sur adapters, pas dedans).

### 2.2 Traces personnalisées par lentille utilisateur

**Décision :** chaque utilisateur définit en langage naturel ce qu'il veut suivre dans les traces (« je veux comprendre les hallucinations », « je veux suivre les coûts »). Le LLM analyse à travers cette lentille. Deux utilisateurs sur le même agent → deux traces différentes.

**Pourquoi vivant :** différencie MnM des outils tracing classiques. Driver de la roadmap traces v2.

---

## 3. Config & deployment

### 3.1 Config Layers avec priority merge (vs JSONB monolithique)

**Décision :** la config agent est une stack de couches avec priorité explicite : Company enforced (999) > Base (500) > Additional (0–498). Mergeable, versionée, détection de conflits.

**Pourquoi vivant :** migration 0054 auto-crée la base layer par agent. Advisory locks PostgreSQL (`pg_advisory_xact_lock`) sérialisent attachements concurrents. Utilisée par CAO, Workflows, UI layers, Skills, MCP Servers, Hooks, Settings, Credentials.

**Code :** `server/src/services/configLayers.ts`, migration `0054_*.sql`.

### 3.2 Deux modes de déploiement (`local_trusted` ↔ `authenticated`)

**Décision :** `local_trusted` (dev, zéro auth, single-company auto-créée) et `authenticated` (prod, BetterAuth + OAuth 2.1, multi-company). Mode unique par déploiement.

**Pourquoi vivant :** simplifie l'onboarding dev (`bun run dev` zero config) sans compromettre la prod. Driver du middleware actor.

---

## 4. Orchestration & workflows

### 4.1 Governed Workflows — git-first, gates explicites

**Décision :** workflows-as-code versionnés en git (dossier `workflow.json` + `agents/` + `gates/`). Studio Monaco multi-fichiers + JSON schema + autocomplete. AI Assistant SSE Claude Sonnet propose des modifs en cards Appliquer/Rejeter. 4 gates canoniques shippées (`artifact-exists`, `artifacts-bundle`, `step-succeeded`, `review-pass`) + DSL custom. Parité REST + MCP (14 endpoints).

**Pourquoi vivant :** feature entreprise phare, déploiement client pilote. Décision arrêtée après comparaison `agent-orchestration-patterns` (Temporal/Prefect/Dagster/n8n) — choix du DAG explicite + gates au lieu d'un orchestrateur Temporal-like.

**Code :** `packages/gate-runner/`, `server/src/routes/workflows/`, `ui/src/pages/WorkflowStudio.tsx`, `plugins/mnm/`, `docs/governed-workflows/`.

### 4.2 CAO (Chief Agent Officer) — watchdog + interactif

**Décision :** agent système auto-créé (`adapter_type="claude_local"`, `metadata.isCAO=true`, role Admin, tous les tags). Mode watchdog : commente les échecs silencieusement. Mode interactif : réagit aux mentions `@cao`.

**Pourquoi vivant :** shipped, mentionnable dans les chats. Génère des commentaires automatiques sur traces. Supervise les workflows sans bloquer.

**Code :** `server/src/services/cao.ts`, auto-création à l'onboarding company.

### 4.3 MCP Server — parité UI ↔ MCP, consentement granulaire

**Décision :** 68 tools + 10 resources sur 14 domaines. Transport HTTP streamable + SSE legacy. OAuth 2.1 PKCE, Dynamic Client Registration, écran de consentement React granulaire (read/write/admin par domaine). Filtrage dynamique par permissions. Rate limiting + semaphore DB (15 concurrent).

**Pourquoi vivant :** n'importe quel client MCP (Claude Code, Cursor, Claude Desktop) pilote MnM. Parité UI ↔ MCP est un design principle.

**Code :** `packages/mcp-server/`, `server/src/routes/mcp/`.

---

## 5. Continuum d'autonomie

### 5.1 6 niveaux KPI-driven (Manual → Autonomous)

**Décision :** dial à 6 crans, pas un switch. La progression est pilotée par les KPI scoring. Le niveau Autonomous est verrouillé par défaut et se déverrouille **dimension par dimension** (coverage, conventions, sécurité, perf…).

**Pourquoi vivant :** driver de la roadmap Quality Profiles + Agent Review Panel + Improvement Cockpit. C'est le mécanisme central des 3 piliers (Confiance + Contrôle + Transparence).

---

## 6. Recherches qui justifient l'architecture

| Sujet | Conclusion appliquée | Pertinent pour |
|---|---|---|
| **Agent orchestration patterns** (Temporal, Prefect, Dagster, n8n) | DAG explicite + gates au lieu d'orchestrateur Temporal-like | Governed Workflows |
| **LLM workflow control** (function calling, structured output, LangGraph, CrewAI) | Structured output + XState pour contrôle fin | Workflow internals |
| **Real-time** (WebSocket vs SSE) | SSE = scalable broadcast, WebSocket = bidir state | `/events/ws` |
| **GitNexus** code intelligence | Indexation auto à clone + MCP exposure | Agent context, code-intelligence skill |
| **Clash** conflict detection | Détection conflits worktrees temps réel | Multi-agent safety (à venir) |

Détails complets de chaque benchmark dans le repo privé [`mnm-documentation/research/`](https://github.com/AlphaLuppi/cnm-documentation).

---

## Mise à jour

Si tu prends une décision qui shape durablement le code (architecture, sécurité, perf, design), ajoute une entrée ici avec : titre, décision en 1 phrase, pourquoi c'est vivant, fichiers concernés. Pas de prose, pas de PR description-style — juste la matière compressée.
