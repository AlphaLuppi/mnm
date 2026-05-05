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

**Code (T2 + P4 livré 2026-05-02 → 2026-05-03) :** `packages/workflow-hooks/` (runner + 4 canonical hooks + resolver), `server/src/services/workflow-hooks.ts` (CRUD + executeHook + resolveHooksForStep wired aux 4 phases launch/complete), routes REST + 6 MCP tools, page UI `/hooks`, migration `0081_workflow_hooks.sql` (5 schemas Drizzle + RLS double-policy + perms seedées). Doc utilisateur : [`docs/governed-workflows/hooks.md`](governed-workflows/hooks.md). API `helpers.credential` **supprimée** (avait été initialement spec'd, retirée pour fermer le risque "credentials en clair côté isolate"). Plan : [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md`](superpowers/plans/2026-05-01-enterprise-pilot-foundation.md).

### 4.4.1 Workflow step assignments — inbox feed user-driven (T3 livré 2026-05-03)

**Décision :** étendre le DSL d'un step avec un bloc `assignment: { tags?, principals?, roles? }`. Au launchWorkflow / launchStep, le resolver expand les 3 champs en principals concrets (intersection tags, expansion rôles dynamiques, principals explicites), snapshote les rows `governed_step_assignments` avec un `reason` audit (`tag-intersection` / `role-expansion` / `explicit` / `delta-launchStep`), et émet `step.assignment.created` (visibility actor-only) pour invalider l'Inbox SSE — zero polling.

**Pourquoi vivant :** la délégation par tags découple le `workflow.json` de la composition de l'équipe (un nouveau membre tagué `produit` voit immédiatement les steps "produit" dans son Inbox sans toucher un seul workflow). C'est la même logique que la 3-tier visibility §1.6, appliquée à l'assignment.

**Code :** migration `0082_workflow_step_assignments.sql`, `server/src/services/governed-workflows-assignments.ts`, REST `GET /inbox/pending-workflow-steps` + MCP `list_my_pending_work` (snake_case parité), Inbox UI section + sidebar badge `pendingWorkflowSteps`. Doc utilisateur : [`docs/governed-workflows/assignments.md`](governed-workflows/assignments.md).

### 4.4.2 Composite workflows — `type: composite` + `uses:` (T5 livré 2026-05-03)

**Décision :** un step peut être `type: "composite"` avec `uses: "workflows/<name>@<ref>"` au lieu d'un agent. Au runtime, le runner expand le step en un sub-run lifté à part entière (`parent_step_execution_id` + `composite_run_id` + `root_run_id` propagé). L'artifact terminal du sub-run est copié dans l'artifact du step composite parent à completeStep ; le DAG parent continue normalement.

**Garde-fous :** cycle detection statique (DFS) au launchRun + re-vérif au launchCompositeStep, depth max 32, fan-out cap 1000 step_executions par `root_run_id`. Échecs avec error_codes dédiés (`WORKFLOW_COMPOSITE_CYCLE`, `WORKFLOW_COMPOSITE_DEPTH_EXCEEDED`, `WORKFLOW_COMPOSITE_FANOUT_EXCEEDED`, `WORKFLOW_COMPOSITE_USES_NOT_FOUND`).

**Pourquoi vivant :** factorisation de sous-workflows réutilisables (release-engineering, qa-fullstack, security-scan) sans dupliquer leurs DAGs. Versionné via `@<ref>` immutable (tag) — pattern d'import package transposé au DAG.

**Code :** migration `0083_composite_workflows.sql` (3 colonnes + index partial root_run), `server/src/services/governed-workflows-composite.ts`, REST `GET /governed-workflows/runs/:runId/steps`, UI badge "composite" + RunArtifactsTree lazy-load via `getRunStepsById`. SSE events `step.composite.launched` / `step.composite.completed`. Doc utilisateur : [`docs/governed-workflows/composite.md`](governed-workflows/composite.md).

### 4.4.3 Artifact viewer + permalinks (T4 livré 2026-05-03)

**Décision :** trois composants dédiés à la review humaine des outputs governed runs : `OutputRow` (extracted shared), `RunArtifactsTree` (recursive tree avec lazy-load des sub-runs composite), `ArtifactViewer` (mime-aware wrapper — markdown via MarkdownBody, code via Monaco lazy read-only, plain text via <pre>, external_url via card, git_folder via file list). La page run-detail bascule en layout 2-col review quand l'URL contient `?step=<name>` (set par les cards Inbox `pending_workflow_step`). Permalinks stables `/workflows/<name>/runs/<runId>/artifacts/<step>/<output>` avec encoding URI complet.

**Pourquoi vivant :** un step "human-in-the-loop" assigné dans l'Inbox doit ouvrir directement l'artifact en mode review, pas un dashboard générique. Les permalinks rendent partageables les outputs (debug, post-mortem, doc).

**Code :** `ui/src/components/run-detail/OutputRow.tsx`, `RunArtifactsTree.tsx`, `ArtifactViewer.tsx`, `ui/src/pages/governed-workflows/RunDetail.tsx` (review mode). 22 tests unit. Frontend rule §6 lazy-load Monaco respectée.

### 4.6 Connectors Platform — hub OAuth user-level (Sprint 1+2 livré 2026-05-02)

**Décision :** transformer MnM en hub d'identité OAuth user-level. Les hooks, agents Claude Code via MCP et background jobs (Nightly Synthesis) consultent les tokens user pour agir au nom de l'utilisateur — invariant traçabilité humaine §1.7.

**Architecture :**
- 4 tables MnM-owned chiffrées AES-256-GCM (`oauth_connectors`, `connector_tokens`, `user_api_keys`, `oauth_connectors_audit`) — séparées de `account` BetterAuth qui stocke les tokens en clair (réservé aux flows de login natifs GitLab/Microsoft).
- `connectorService.getUserToken(userId, providerSlug, companyId)` central — C2 cross-tenant guard obligatoire, B1 advisory lock + re-read inside lock pour le refresh OAuth concurrent, MED-B1 nullification du refresh_token sur 401 provider, HOST-ONLY (jamais sortir le token côté isolate).
- Callback dispatcher générique `/api/connectors/callback` — state JWT HS256 (BETTER_AUTH_SECRET, 10min TTL), H1 redirect_after whitelist (`/foo` accepté, `//evil` rejeté, origin strict `MNM_PUBLIC_URL` pour absolute). HIGH-A1 cross-tenant guard via `assertUserInCompany` AVANT upsert. HIGH-A3 `db.transaction()` + `set_config(..., is_local=true)` pour pin la connexion.
- 10 templates pré-définis (Jira, GitHub, GitLab, Microsoft, Google, Slack, ClickUp, Linear, Notion, OpenAI) — admin pick template → wizard 2 étapes → DB write.
- 5 MCP tools (`list_connectors`, `get_connector_status`, `connect_user_to_connector`, `wait_for_connection`, `set_user_api_key`) + REST parity (10 endpoints admin + user self-service).
- SSE event `user.connector_status_changed` (visibility actor-only) pour invalidation client-side sans polling.

**Pourquoi vivant :** préalable obligatoire pour [`enterprise-pilot-foundation`](superpowers/plans/2026-05-01-enterprise-pilot-foundation.md) (les hooks Jira+ClickUp en dépendent). Architecture qui paye dès le 3e provider — hardcoder N providers = N×2j de dette.

**Divergence crypto à connaître** : `secret-crypto.ts` (extrait de `credential.ts` pour le partage) chiffre des **string brutes** (tokens OAuth, API keys). `credential.ts` chiffre des **`Record<string, unknown>` JSON** (credentials structurées avec multi-fields). Les deux utilisent AES-256-GCM avec la même clé `MNM_SECRETS_KEY`. Acceptable parce que les semantics sont propres à chaque chemin (un token est string, une credential est typed structure). Le pattern partagé (helper `secret-crypto.ts`) garantit la cohérence du primitif crypto.

**Code :** `server/src/services/connectors.ts`, `server/src/services/secret-crypto.ts`, `server/src/services/connector-templates.ts`, `server/src/routes/connectors.ts` + `connectors-callback.ts`, `server/src/mcp/tools/connectors.tool.ts`, `server/src/auth/dynamic-providers.ts`, `ui/src/pages/Connectors.tsx` + `SettingsAccounts.tsx`. Migration `0079_connectors_platform.sql`.

### 4.7 GitHub Provider — connector unifié OAuth + App optionnelle per-company (2026-05-04)

**Décision :** MnM supporte GitHub comme provider git first-class via UN SEUL template `github` unifié (D6). La GitHub App est une **option de configuration** sur le connector existant, pas un template séparé. L'App est créée per-company (D1) — chaque company crée sa propre App, paste `App ID` + private key chiffrée AES-256-GCM via `secret-crypto.ts`, et l'attache au connector `github` déjà en place (1 App max par connector). github.com only en V0 (D2 — pas de GitHub Enterprise Server). Le résolveur côté serveur dispatche automatiquement entre **mode App** (si une installation matche le `repoOwner` du target) et **mode user-OAuth** (sinon), avec fallback `connectorRequired("github")` 412 en strict mode si rien n'est connecté. Pour TOUT commit (App ou OAuth), `author = committer = user humain` qui a triggered le workflow (D7) — jamais "MnM-AppName[bot]" dans aucun champ. Conséquence assumée : commits "Unverified" dans l'UI GitHub (badge gris) parce que la signature GPG côté serveur est un open follow-up.

**Pourquoi vivant :** GitHub était jusqu'au 2026-05-04 un **template OAuth uniquement** sans implémentation `GitProvider` — toute la couche git-protocol (clone / commit / tag / PR review) était hardcodée GitLab. Le chantier `feat/github-provider` ouvre 4 capacités enterprise critiques : (a) repos privées dans private orgs SAML SSO via GitHub App per-company (impossible proprement en OAuth user — friction × N users), (b) parité fonctionnelle complète avec GitLab pour Governed Workflows runtime + CC plugin importer + Workflow Studio + hooks `helpers.http("github", …)` + CAO/Watchdog/Nightly, (c) coexistence GitLab + GitHub par company sans migration forcée (D4), (d) abstraction `CodeReviewState` agnostique introduite en Phase 2 (rename `getMergeRequestApprovals` → `getCodeReviewState`) qui prépare l'ajout futur de Bitbucket / Gitea / Azure DevOps. Décision arrêtée par Tom le 2026-05-04, validée Phases 1 → 6 shipped sur la branche `feat/github-provider` (commits `d385939` → `85921de`). Plan : [`2026-05-04-github-provider.md`](superpowers/plans/2026-05-04-github-provider.md). Doc admin : [`docs/governed-workflows/connectors.md §9`](governed-workflows/connectors.md).

**Conséquences code :**
- Tables `github_apps` (App credentials chiffrées per-company, FK vers `oauth_connectors`) + `github_app_installations` (orgs/users où l'App est installée) — RLS RESTRICTIVE FORCE sur `company_id`, hérite du fix RLS PERMISSIVE baseline §7.1.
- `GitHubProvider` (`packages/git-provider/src/github-provider.ts`) implémente le contrat `GitProvider` complet via `@octokit/rest`. **Toutes les écritures passent par le low-level Git Data API** (`git.createBlob` + `git.createTree` + `git.createCommit` + `git.updateRef`) pour pouvoir injecter `author` ET `committer` = user humain (D7). Le high-level `repos.createOrUpdateFileContents` est interdit car il force `committer = App[bot]`.
- Service `commit-identity.ts` (`server/src/services/commit-identity.ts`) résout `{name, email}` depuis le profil GitHub OAuth du user (cache 24h), fallback sur le profil MnM. Utilisé par les deux modes (App + OAuth) pour symétrie.
- Résolveur `createResolveGitProvider` (`server/src/mcp/build-mcp-services.ts`) dispatch unifié : kind=github lit le connector + table `github_apps` + matching installation pour décider mode `app-installation` vs `user-oauth`. `connectorRequired("github", "GitHub")` sinon en strict mode.
- Hook helpers : `providerCatalog.github = { baseUrl: "https://api.github.com" }` câblé pour `helpers.http("github", "/user")` etc.
- UI : 1 seul tile GitHub dans `/admin/connectors` (D6), wizard adaptatif `GitHubConnectorWizard.tsx` (OAuth obligatoire → banner App optionnelle → deep-link création + paste credentials + install), Sheet détail `GitHubConnectorSheet.tsx` avec sections OAuth + App, deep-links vers github.com pour reconfigurer/désinstaller. SSE event `connector.github_app_installation_added` invalide la query React (zero polling).
- E2E : `e2e/tests/github-flow.spec.ts` + `github-oauth-only.spec.ts` (file-content tests verrouillent surface area, browser scenario `test.skip` placeholder pour follow-up quand la mock GitHub fixture sera dispo).

**Code :** `packages/git-provider/src/github-provider.ts`, `server/src/services/github-app.ts`, `server/src/services/commit-identity.ts`, `server/src/routes/github-app.ts`, `server/src/routes/connectors-callback.ts` (callback `/connectors/github/app-install/callback`), `server/src/mcp/build-mcp-services.ts` (résolveur + providerCatalog), `server/src/services/cc-plugin-import/source-provider-factory.ts` (kind=github accepté), `ui/src/components/connectors/GitHubConnectorWizard.tsx` + `GitHubConnectorSheet.tsx`, `ui/src/pages/Connectors.tsx` (single tile dispatch), migration `0080_github_apps.sql`.

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

## 7. Sécurité & defense in depth

### 7.1 RLS pattern — PERMISSIVE baseline + RESTRICTIVE tenant filter (2026-05-02)

**Décision :** chaque table tenant-scoped DOIT avoir DEUX policies : (1) `tenant_baseline_permissive AS PERMISSIVE FOR ALL USING (true)` qui débloque le default-deny postgres ; (2) `tenant_isolation AS RESTRICTIVE FOR ALL USING (company_id = current_setting('app.current_company_id', true)::uuid)` qui filtre par tenant.

**Pourquoi vivant :** PostgreSQL exige au moins UNE policy PERMISSIVE pour qu'une row soit visible — un setup RESTRICTIVE-only est en default-deny. Le pattern dominant historique (depuis `0030_rls_policies.sql`) ne créait QUE le RESTRICTIVE, ce qui était masqué en runtime parce que l'app user (`mnm`/`postgres`) est SUPERUSER + BYPASSRLS — RLS n'était jamais appliquée. L'isolation multi-tenant était portée à 100% par les filtres applicatifs Drizzle (`eq(table.companyId, …)`), pas par la "fail-closed last line of defense" documentée.

**Découvert :** Sprint 1 Connectors Phase 4, test `server/src/__tests__/connector-tokens.rls.e2e.test.ts` (commit `b43413e89`).

**Fix :** migration `0080_rls_permissive_baseline.sql` ajoute la PERMISSIVE baseline sur 77 tables (73 héritées 0030–0076 + 4 du 0079 connectors).

**Followup pendant** : migrer le user app vers un rôle dédié non-BYPASSRLS. Tant que l'app reste SUPERUSER, RLS reste un filet décoratif. Runbook séparé (touche connection strings, dev embedded pg, migration runner).

**9 tables exclues** (a2a_messages, compaction_snapshots, traces, trace_observations, trace_lenses, trace_lens_results, gold_prompts, user_pods, artifact_deployments) ont déjà une policy PERMISSIVE qui filtre directement par `company_id` — y ajouter `USING (true)` ferait `(company_id=X) OR (true) = true`, régression de sécurité. À normaliser dans une migration ultérieure.

**Fichiers concernés :** `packages/db/src/migrations/0030_rls_policies.sql` (origin), `0080_rls_permissive_baseline.sql` (fix), `0080_rls_permissive_baseline.test.ts` (regex), `server/src/__tests__/connector-tokens.rls.e2e.test.ts` (runtime), `.claude/rules/database.md` (template à jour), `docs/conventions/middleware-chain.md` (couche 5 RLS).

---

## Mise à jour

Si tu prends une décision qui shape durablement le code (architecture, sécurité, perf, design), ajoute une entrée ici avec : titre, décision en 1 phrase, pourquoi c'est vivant, fichiers concernés. Pas de prose, pas de PR description-style — juste la matière compressée.
