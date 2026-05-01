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

### 1.7 Traçabilité humaine universelle

**Décision :** TOUT ce qui se passe dans MnM (création, modification, exécution) est attribué à un utilisateur humain identifié. Aucune action anonyme, aucun « service account » impersonnel :
- Un workflow run est déclenché par un user (`run.initiated_by_principal_id`).
- Un step exécuté par un agent : l'agent a un `createdByUserId` qui est un humain — c'est cette identité qui porte les permissions et l'audit.
- Un hook s'exécute avec l'auth (credentials externes, OAuth tokens user-level) du user qui a déclenché le run, pas un credential service partagé.
- Le CAO et le watchdog « agissent » sous l'identité de l'admin instance qui les a setup. Pas d'identité fantôme.
- Les commits git (Governed Workflows) sont signés avec l'identité BetterAuth réelle de l'user (pas `bot@mnm.local`).

**Pourquoi vivant :** différenciateur enterprise vs n8n/Zapier (qui tournent avec des service accounts opaques). Permet l'audit complet « qui a déclenché quoi » exigé en compliance (SOC 2, GDPR). Force l'archi à exiger un user identifiable avant toute action automatisée. Pattern OAuth GitLab user-level déjà appliqué pour les commits Workflow Studio (cf. `oauth-setup.md`) — à étendre à tout connecteur externe (Jira, ClickUp, Slack, …) via le même pattern Config Layer + OAuth tokens user.

**Conséquences code :**
- Chaque table d'action a une colonne `actor_principal_id` non-null (ou `actor_user_id` + `actor_agent_id` avec `createdByUserId` chained).
- Les hooks/integrations externes lookup les credentials via `account` (BetterAuth OAuth tokens) du user actor, pas un credential layer générique partagé.
- Si un user n'a pas connecté un connecteur (ex: Jira), le hook qui en dépend fail explicitement : « connect your Jira account first ».

**Code :** `server/src/services/governed-workflows.ts` (resolveAuthor), `server/src/auth/better-auth.ts` (account table OAuth), `server/src/middleware/auth.ts` (actor middleware), `docs/governed-workflows/oauth-setup.md` (pattern de référence).

### 1.6 Modèle 3-tier visibility/assignment/sharing (universel)

**Décision :** TOUTE feature MnM avec une notion de partage, visibilité ou assignation suit un modèle 3-tier strict. Pas d'exception, pas d'autre modèle :

1. **Private** — seul le créateur (ou l'assigné direct) voit/utilise.
2. **Public (= partagé)** avec deux modes : (2a) partagé à des **tags** (intersection non-vide), ou (2b) partagé à des **utilisateurs spécifiques** (principalIds explicites).
3. **Company/Organisation enforced** — imposé par la company à TOUT le monde (priorité max, ne se contourne pas, sert pour audit/sécurité/policy).

**Pourquoi vivant :** déjà appliqué aux Config Layers (private/team/public/company) et aux sandboxes (tag-routed). Sans formalisation cross-feature, chaque module ré-invente son propre modèle de share et l'UI explose en N pickers différents. Cette décision rend obligatoire un `<VisibilityPicker>` partagé, un helper service unique pour calculer l'access, et le même schema d'API (`visibility` + jointures `_tags`/`_principals`) sur toutes les nouvelles features. Bloque aussi le « 4e tier » imaginaire que chaque dev essaie d'inventer (« visible aux managers »…).

**Code :** Config Layers (`server/src/services/configLayers.ts`) = référence canonique. Convention détaillée : [`docs/conventions/visibility-tiers.md`](conventions/visibility-tiers.md).

**S'applique à :** Workflow Hooks, assignation steps/workflows, Skills, MCP servers, Credentials, Settings, et toute future entité partageable.

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

### 4.5 LLM provider-agnostic

**Décision :** MnM utilise des LLMs à plusieurs endroits (traces enrichment Bronze→Gold, Workflow AI Assistant, hooks). V0 = Anthropic (Claude) uniquement, mais l'architecture est conçue pour multi-provider :
- Helpers abstraits (`helpers.llm({prompt, model})`, `traceEnrichmentService.enrich()`, etc.) qui ne hardcodent pas Anthropic.
- Configuration provider via Config Layer (`instance_settings.llm_providers[]`) avec slot pour OpenAI / Azure OpenAI / AWS Bedrock / custom endpoint.
- Mapping `model: "haiku"` → résolution selon le provider configuré ("claude-haiku" ou "gpt-4o-mini" ou "azure-gpt-4o-mini" ou autre).

**Pourquoi vivant :** les clients enterprise ont des contraintes de provider (Azure obligatoire pour la conformité Microsoft, Bedrock pour l'AWS shop, hébergement souverain pour les banques européennes). Hardcoder Anthropic rend MnM invendable à 60% du marché enterprise européen.

**Code :** à venir — pattern à appliquer dès qu'un nouveau use case LLM est ajouté. Aujourd'hui `server/src/services/traces/enrichment.ts` et hooks `helpers.llm` sont les points de référence à étendre.

### 4.4 Workflow Hooks — code en git, sandbox isolated-vm avec helpers host-side

**Décision :** les hooks (side-effects HTTP/LLM avant/après step ou run) sont du code TypeScript user-written stocké en git **à côté des gates** (`<workflow>/hooks/*.hook.ts`). Exécution dans `isolated-vm` (pas de `fs`/`net`/`require`). Tout I/O passe par `ctx.helpers.*` qui sont des bridges vers le process host. **Aucun helper n'expose un credential en clair à l'isolate** : `helpers.http({provider, path, ...})` et `helpers.llm({prompt, model})` injectent l'authentification côté host depuis le Config Layer chiffré, sans jamais retourner la valeur. Validation SSRF stricte sur `base_url` providers (DNS resolve + IP deny-list, re-vérifiée au runtime). Audit row pattern outbox (INSERT pre-call, UPDATE post-call). Détails techniques : [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md` § Détails techniques sécurité hooks](superpowers/plans/2026-05-01-enterprise-pilot-foundation.md).

**Exception au compute côté client (§1.4) :** les hooks tournent server-side et non client-side parce que (a) credentials chiffrés en DB inaccessibles côté client, (b) audit log fail-closed obligatoire, (c) tier 3 enforced doit être non-bypassable même si le client triche. Cette exception est explicite et bornée : c'est le **seul** code user-written qui tourne sur le serveur MnM.

3 niveaux de résolution, parallèle exact aux gates :
- **Canonical** : `packages/workflow-hooks/canonical/` shippés MnM (référence `"canonical:<name>"`).
- **Shared** : repo gitlab `<company>/workflows/_shared/hooks/` (référence `"shared:<name>"`).
- **Local** : `<workflow-repo>/hooks/` (référence `"local:<name>"`).

Métadonnées en DB (`workflow_hooks_config`) : credential layer id, visibility tier (3-tier §1.6), enabled toggle, `enforced` flag (tier 3 = s'exécute sur tous les workflows company même non listés). Audit log dans `workflow_hook_executions`.

**Pourquoi vivant :** permet à n'importe quel self-hoster d'écrire ses hooks sans toucher au code MnM, tout en gardant la sandbox SaaS-safe. Cohérence avec les gates : même runner, mêmes helpers étendus, même resolution. Le tier 3 (enforced) est l'inflexion enterprise : DSI/sécurité impose un audit hook que personne ne peut désactiver, même les auteurs de workflow.

**Code (à venir) :** `packages/workflow-hooks/`, `<workflow-repo>/hooks/`, `server/src/services/workflow-hooks.ts`. Spec : [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md`](superpowers/plans/2026-05-01-enterprise-pilot-foundation.md).

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
