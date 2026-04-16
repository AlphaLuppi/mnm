# Brainstorm — Use case EnterpriseCustomer : Refonte <external-stakeholder>

**Date :** 2026-04-17
**Contexte :** Premier vrai lancement de MnM chez EnterpriseCustomer sur un projet concret de refonte frontend.

## Contexte du projet

- **Client :** EnterpriseCustomer (santé, réglementaire fort)
- **Projet :** Refonte complète frontend d'<external-stakeholder>
- **Legacy :** App web hybride internal-backend + Angular (l'Angular étant un fork de l'app mobile hybrid-mobile-stack). "L'horreur."
- **Scope backend :** Évolutions internal-backend ponctuelles, pas de refonte.
- **Contraintes métier :** <redacted-acronym>, mutuelles, facturation santé, règlementaire lourd avec beaucoup d'edge cases.
- **Objectif CEO :** "Usine à refonte" — le dev dit le matin "refait toute la création de patient", le soir la feature est refondue proprement, cross-platform, testée E2E, documentée.

## Équipe (4 personnes)

| Rôle | Profil | Plug MnM |
|------|--------|----------|
| **Archi Angular** | Refonte from scratch, sait dev back internal-backend, utilise IA au quotidien. A poussé plugin `team-dev-frontend` (plusieurs skills) | Crée workflows + agents, supervise |
| **Dev Backend** | Java/internal-backend, sait faire du front, a poussé plugin `team-dev-backend` | Exécute workflows dev |
| **PM** | Valide fonctionnel + workflows UX | Valide via inbox MnM |
| **QA** | Connaît le réglementaire mieux que personne, sait les edge cases santé | PO fonctionnel, valide via inbox MnM |

## Workflow "sans agent" déjà imaginé

1. Prendre une feature (page par page)
2. Extraire MAXIMUM de règles fonctionnelles, ACs, edge cases métier du legacy
3. Extraire modèles backend, endpoints, identifier `/v2` nécessaires
4. Faire valider le giga-PRD par PM + QA (ils imputent ce qu'ils ont en tête)
5. Lancer refonte à partir des specs + ui-kit + maquettes
6. Sans dette, qualité max, E2E qui couvrent tous les ACs

## Design du workflow "avec agents MnM"

### Phase 1 — Archéologie (auto)
- **Step `discover-legacy`** (agent `archeologue-legacy`)
  - Inputs : `feature_name`, `repos: [legacy-java, legacy-ng]`
  - Output : `{ endpoints[], models[], routes_struts[], components_ng[], call_graph }`
  - Gate exit : `has-complete-endpoint-map` (builtin, vérifie output non vide)

- **Step `extract-business-rules`** (agent `business-analyst`)
  - Depends : `discover-legacy`
  - Output : `{ rules[], acs_draft[], edge_cases_candidates[] }`
  - Gate exit : `ba-coverage-check` (agent meta-judge — détecte code paths non couverts)

### Phase 2 — Validation humaine (HITL)
- **Step `enrich-prd-pm`** (human via inbox)
  - Assignee : `role:pm`
  - Timeout : 24h
  - Gate exit : `pm-signoff` (agent `prd-completeness-judge` — vérifie PM a enrichi workflows UX)

- **Step `enrich-prd-qa`** (human via inbox)
  - Depends : `enrich-prd-pm` (séquentiel)
  - Assignee : `role:qa`
  - Timeout : 24h
  - Gate exit : `qa-signoff` (agent `reglementary-coverage-judge` — "as-tu couvert <redacted-acronym>, mutuelle, facturation ?")

- **Step `consolidate-prd`** (agent `prd-consolidator`)
  - Output : `prd_final_json`
  - Gate exit : `prd-human-signoff` (human, assignees: PM+QA)

### Phase 3 — Design UI
- **Step `ui-spec`** (agent `ux-specifier`)
  - Context : `ui_kit_ref`, `mockups_dir`
  - Output : `{ components_tree, screens[] }`
  - Gate exit : `ui-kit-compliance` (script `scripts/validate-ui-kit.ts`)

### Phase 4 — Backend evolution (conditionnel)
- **Step `backend-v2-needed`** (agent `backend-analyzer`)
  - `when: "context.kg.endpoints_need_evolution == true"`
  - Output : `{ v2_endpoints, migration_plan }`

- **Step `dev-backend-v2`** (agent `dev-backend`, skills `team-dev-backend`)
  - `when: "steps.backend-v2-needed.output.v2_endpoints.length > 0"`
  - Gates exit : `junit-tests-pass` (script), `api-contract-judge` (agent)
  - Output : `pr_backend_url`

### Phase 5 — Dev front
- **Step `dev-front-angular`** (agent `dev-angular-cba`, skills `team-dev-frontend`)
  - Depends : `ui-spec`, `dev-backend-v2`
  - Gates exit :
    - `ng-build` (script)
    - `lint-clean` (script)
    - `no-dette-technique` (agent **adversarial** — cherche failles)
    - `cross-platform-check` (agent `capacitor-compat-judge`)
  - Output : `pr_frontend_url`

### Phase 6 — Tests E2E
- **Step `generate-e2e-tests`** (agent `qa-automaton`)
  - Depends : `dev-front-angular`, `consolidate-prd`
  - Gates exit :
    - `all-acs-covered` (agent `ac-coverage-judge` — chaque AC a ≥ 1 test)
    - `tests-run-green` (script `npm run e2e`)
  - Output : `pr_tests_url`

### Phase 7 — Docs
- **Step `update-docs`** (agent `tech-writer`)
  - Gate exit : `doc-links-valid` (script)

### Phase 8 — Final review
- **Step `final-review`** (human)
  - Assignees : `[role:pm, role:qa, role:lead-dev]`
  - Timeout : 72h
  - Gate exit : `unanimous-approval` (builtin — approvals ≥ 3 AND rejections == 0)

### Phase 9 — Merge
- **Step `merge-all`** (script)

## Ce qui MANQUE dans MnM pour construire ce workflow

### Bloqueurs P0 (rien n'existe)
1. **Moteur workflows gouvernés** — DAG engine + gates + state machine. Routines existent (cron) mais pas de DAG.
2. **MCP primitives workflows** — `getWorkflow`, `getSteps`, `launchStep`, `signalGate`, `getRunState`, `waitForGate`.
3. **Schema YAML + parser/validator** — Format de déclaration workflow.
4. **Infra GitProvider** — Cloner/pull/push repos workflow. Interface + impl GitLab minimum (Tom parle de GitLab chez EnterpriseCustomer ? ou GitHub ?).
5. **Gate I/O contract runtime** — Exécuter un gate (builtin, script, agent, webhook) et collecter `{pass, report, ...}`.
6. **Agent adversarial pattern** — Gate qui cherche activement à casser le step. Nouveau concept de prompt.
7. **Human step avec inbox + timeout + resume** — json-render existe, mais le step human qui bloque le DAG en attente d'inbox avec timeout → pas encore.
8. **Workflow run persistence + resume** — Si MnM redémarre, les runs doivent reprendre. XState + DB snapshot.

### Bloqueurs P1 (existe partiellement)
9. **Plugin skills invocation** — Agent `dev-angular-cba` utilise plugin `team-dev-frontend`. MnM doit pouvoir invoquer un agent Claude Code avec skills préchargées. (Via `claude -p` + `--skills` ?)
10. **Multi-repo context loading** — L'archéologue lit legacy-java + legacy-ng + newapp. Besoin d'un orchestrateur de contexte multi-repo. GitNexus peut aider mais à coupler.
11. **Cross-agent data passing** — Output d'un step → input du suivant. Besoin d'un store typé par run.
12. **Agent role registry** — Déclarer `archeologue`, `business-analyst`, etc. comme adapter_type avec prompt + tools. Aujourd'hui MnM a des agents mais faut formaliser le catalogue.
13. **Workflow progress UI (Langfuse-style)** — Visualisation live du DAG avec status par step/gate. Dashboard existe mais pas cette vue.
14. **Cost tracking par workflow run** — Existe partiellement (observability), à remonter par run.
15. **PR creation automation** — Agent crée PR via GitHub/GitLab API.

### Manques côté client EnterpriseCustomer
16. **Sandbox d'exécution** — Les devs vont exécuter ça sur leur machine ? Sur un pod ? Hybride (archéo serveur, dev local) ?
17. **UI-kit + mockups storage** — Comment l'agent UX accède-t-il aux maquettes (Figma ? dir S3 ?) ?
18. **Plugins EnterpriseCustomer packaging** — `team-dev-frontend` et `team-dev-backend` sont des plugins Claude Code. Doivent être versionnés, distribués à l'agent qui tourne pour MnM.

## Questions à trancher avec Tom

1. **Où tournent les agents ?** Local (machine du dev) ? Serveur MnM ? Pod per-user ? Mixte selon step ?
2. **Plugins Claude Code dans workflows** — Comment on invoque un agent avec un plugin skills précis ? Via `claude -p --plugin team-dev-frontend` ?
3. **GitHub ou GitLab chez EnterpriseCustomer ?** Impacte le GitProvider à prioriser.
4. **Autonomy level par step** — L'archéologue peut être full-auto, le dev plutôt supervisé. Comment on configure ça ?
5. **Maquettes/UI-kit** — Figma API ? Fichiers plats ? Comment l'agent UX les consomme ?
6. **Scope workflow** — On part sur un workflow monolithique `refonte-feature` ou on le décompose (un workflow `archéologie`, un workflow `dev`, un workflow `qa`) qui se composent via `uses:` ?

## Décisions de Tom (Round 1)

### Architecture d'exécution — HYBRIDE
- **Backend MnM (serveur cloud)** : héberge agents internes (CAO, Sensei, workflows KG-nightly-synthesis, etc.) qui appellent l'API Anthropic directement.
- **Workflows de dev** : tournent sur les **postes des devs** via Claude Code local + MCP MnM. Le dev lance `claude`, Claude Code discover le workflow via MCP MnM, exécute les steps local, signale les gates au serveur MnM.
- **Implication** : MnM serveur = **control plane** (catalogue workflows, state machine, gates, inbox, observability). Exécution = **local**.

### Agents = Config-as-Code (git)
- Aujourd'hui : plugin Claude Code invocable via `/team-dev-frontend:dev-story`.
- **Demain** : agent MnM avec skills + hooks + MCP configurés DANS MnM.
- **NOUVEAU PRINCIPE** : **chaque agent a son propre repo git**. Configs agent = markdown + yml dans git, pas juste en DB.
- **Pourquoi** : si MnM meurt, les entreprises gardent la MAJORITÉ de leurs setups dans un format simple (folders/markdown/yml). **Résilience = format portable**.
- **Conséquence** : étendre le principe "1 repo git par workflow" aux agents : `agents/<agent-name>/` avec `agent.yml`, `prompts/`, `skills/`, `hooks/`.

### Git provider
- **GitLab self-hosted** chez EnterpriseCustomer. Priorité GitLab dans l'interface GitProvider.

### Autonomie
- **Full autonomie** par défaut pour tous les agents.
- **Feedback loop humain** : la review humaine = commentaires sur le workflow run (comme une issue MnM). Un commentaire négatif → **relance du step ou du workflow** avec le feedback injecté dans le contexte.
- Pas de step semi-autonome classique : c'est **autonome + boucle de feedback**.

### Autonomy level par step
- Pas défini par step dans le YAML workflow. **Config via les layers** (cf. principe existant MnM : config layers par tag/agent/company).

### Figma
- Accès via **MCP Figma officiel**. Agent UX call MCP Figma pour lire maquettes + ui-kit.

### Structure workflow
- Un **gros workflow top-level** `refonte-feature` qui compose des **sous-workflows** :
  - `extract-prd` (archéologie + business rules + enrich PM/QA)
  - `dev-backend` (analyse /v2 + dev internal-backend + tests)
  - `dev-frontend` (UI spec + dev Angular + cross-platform)
  - `qa-e2e` (génération tests + run)
  - `docs` (tech writer)
- Chacun a ses propres steps/gates, composables via `uses:`.

### Gates
- **Pas de typologie fermée à 4 types**. Un gate peut être N'IMPORTE QUOI. Seul le contrat I/O compte : `{ pass, report, ... }`.
- Builtin/script/agent/webhook sont des **exemples**, pas une taxonomie.

### Sequential / Parallel (NOUVEAU)
- Les workflows et steps doivent pouvoir exprimer **séquentiel OU parallélisme**.
- Exemples à supporter :
  - Séquentiel strict : `A → B → C`
  - Parallèle : `A || B || C` (tous démarrent en même temps)
  - Mixte : `A → (B || C) → D` (A puis B+C en parallèle puis D)
  - Fan-out : `A → [B1, B2, B3]` (N instances en parallèle selon data)
- À traduire dans le YAML : `depends_on` + un marqueur `parallel: true` ou syntaxe par groupe `parallel: [...]`.

### Visibilité workflows live/historique
- Les runs doivent être visibles :
  - Dans l'**inbox** (quand un step humain attend)
  - Dans une vue **"workflows en live"** (DAG actuel de tous les runs en cours)
  - Dans un **historique** (tous les runs passés, filtrables)

## Questions Tom (à clarifier)

- **DAG** = Directed Acyclic Graph (graphe orienté sans cycle). Les steps sont des nœuds, les dépendances des arêtes. Le moteur calcule l'ordre. Parallélisme = steps sans dépendance entre eux.
- **Adversarial gate** = gate qui cherche activement des failles dans l'output. Ex: `no-dette-technique` = agent qui fait exprès de trouver du code pourri dans le PR. Pattern "red team" automatique.
- **Workflow resume** = quand MnM redémarre (crash, deploy), les runs en cours reprennent où ils étaient (snapshot persistant de l'état XState). Steps déjà complétés ne re-tournent pas.

## Nouveaux axes Round 2

### A. Architecture hybride exécution (IMPORTANT — bloqueur)
- Serveur MnM = control plane, exécution = local dev
- **Questions** :
  - Quand Claude Code local lance un step qui est un agent (ex: `dev-angular-cba`), cet agent tourne en local aussi ? Ou c'est un sous-process Claude Code qui ré-invoque `claude -p --plugin team-dev-frontend` ?
  - Les gates : tournent local ou serveur ?
    - Gate builtin (check sur output) → serveur (pas besoin de local)
    - Gate script → local (c'est du code qui tourne près du dépôt)
    - Gate agent → soit soit
    - Gate webhook → serveur
  - Comment l'archéologue (qui doit lire le legacy repo cloné local) fait pour faire remonter son output au serveur MnM ?
  - MCP primitive : `submitStepOutput(runId, stepId, output, artifacts)` ?

### B. Agents comme repos git
- **Format proposé** :
  ```
  agents/
    dev-angular-cba/
      agent.yml          # metadata, adapter_type, skills refs
      prompts/
        system.md
        user-templates/
      skills/
        scaffold-component.md
        refactor-service.md
      hooks/
        pre-commit.sh
        post-step.ts
      mcp-config.yml
  ```
- Cohérence avec `workflows/` : même pattern, 1 repo par agent.
- **Sync DB ↔ git** : quand agent édité en UI, auto-commit/push ? Quand git push, auto-reload MnM ?
- **Registry** : `agent_registry` table pointe vers repo git + version (SemVer).

### C. Feedback loop HITL
- **Pattern** : Review humaine = commentaires sur un run.
- UX : vue du run avec timeline, commentaire sur un step précis → "relance avec ce feedback".
- Injection dans le contexte : le feedback devient un input du re-run du step (`context.feedback_history`).
- **Question** : Le feedback peut-il cibler un sous-workflow précis et pas tout le top ?
- **Question** : Quel budget pour les re-runs ? (un dev pourrait boucler à l'infini)

### D. Syntaxe séquentiel/parallèle YAML
- Proposition minimale :
  ```yaml
  steps:
    - id: A
    - id: B
      depends_on: [A]
    - id: C
      depends_on: [A]   # B et C parallèles après A
    - id: D
      depends_on: [B, C]  # D attend B ET C
  ```
- Fan-out explicite :
  ```yaml
  - id: batch-pages
    fanout:
      items: "${steps.discover-legacy.output.pages}"
      as: page
      template:
        type: agent
        agent: page-refactor
        input: { page: "${item}" }
      concurrency: 3   # max 3 en parallèle
  ```

### E. Résilience "MnM meurt"
- Principe Tom : **tout au format portable**.
- Ce qui doit être exportable en folders/markdown/yml :
  - Workflows (déjà le cas : 1 repo git par workflow)
  - Agents (nouveau : 1 repo git par agent)
  - Skills (markdown)
  - Hooks (scripts versionnés)
  - Prompts (markdown)
- Ce qui reste en DB (non portable) :
  - Runs (historique)
  - Inbox (notifications)
  - Traces
  - Access logs
  - Nightly synthesis snapshots
- **Export de secours** : commande `mnm export <company>` qui dump tout ce qui est portable dans un tar.gz ? À creuser.

## Décisions Round 2

### A — Gates : tous serveur
- Un gate = **code serveur déterministe**.
- Si un gate a besoin d'un LLM non-déterministe : le code du gate invoque le **SDK Anthropic Agent** pour lancer un agent dans le gate (serveur-side, pas via Claude Code local).
- Donc la "typologie" précédente (builtin/script/agent/webhook) disparaît → il y a juste **"code de gate"** qui peut être :
  - Synchrone déterministe (`return output.length > 0`)
  - Async déterministe (appeler un script externe, webhook, etc.)
  - Async non-déterministe (appeler SDK Anthropic → agent judge)
- L'auteur du gate code ce qu'il veut, contrat I/O `{ pass, report, ... }` respecté.

### B — Agents + config layers en git : NIGHTLY sync, pas live
- **Principe** : les configs (agents, config layers) sont en **DB pour la source de vérité live**, mais **sync nightly en git** pour la portabilité.
- **Routine nightly** : `governance-sync` qui :
  1. Clone/pull le repo `<company>-mnm-config` (ou un groupe de repos)
  2. Diff DB state vs dernière version git
  3. Commit + push les modifs du jour avec message `chore(sync): nightly config snapshot <date>` + auteurs
  4. Tag optionnel (version du jour)
- **Feature d'export manuel** : bouton "Download full config" → tar.gz instant (utile avant un gros changement ou à la demande).
- **Agents referencent les config layers par nom/version, PAS par copie**. Le repo agent contient :
  ```yaml
  # agent.yml
  name: dev-angular-cba
  adapter_type: claude_local
  config_layers:
    - name: base-stack           # ref vers repo config-layer, pas copié
      version: "^1.0"
    - name: angular-stack
      version: "^2.3"
  ```
- **Question ouverte** : versioning existant des agents dans MnM ? À vérifier. Sinon introduire SemVer sur `agent.version` en DB, aligné avec les tags git.

### D — Syntaxe séquentiel/parallèle : approuvé, à finaliser

```yaml
steps:
  # Séquentiel simple
  - id: discover-legacy
    type: agent
    agent: archeologue
  - id: extract-rules
    type: agent
    agent: business-analyst
    depends_on: [discover-legacy]

  # Parallélisme automatique (même depends_on = auto-parallèle)
  - id: ui-spec
    depends_on: [extract-rules]
    type: agent
    agent: ux-specifier
  - id: backend-v2-analyze
    depends_on: [extract-rules]
    type: agent
    agent: backend-analyzer
    # ui-spec et backend-v2-analyze tournent en parallèle

  # Synchronisation (AND sur plusieurs parents)
  - id: dev-front
    depends_on: [ui-spec, backend-v2-analyze]
    type: agent
    agent: dev-angular-cba

  # Fan-out explicite (N instances en parallèle sur un array)
  - id: refactor-pages
    depends_on: [dev-front]
    fanout:
      items: "${steps.extract-rules.output.pages}"
      as: page
      concurrency: 3
      template:
        type: agent
        agent: page-refactor
        input: { page: "${item}" }

  # Groupe parallèle nommé (sucre syntaxique)
  - id: final-parallel
    depends_on: [refactor-pages]
    parallel:
      - id: e2e-tests
        type: agent
        agent: qa-automaton
      - id: docs-update
        type: agent
        agent: tech-writer
      - id: lint-full
        type: script
        script: npm run lint:full
```

- **Règles** :
  - `depends_on: [X, Y]` = AND (attend X ET Y)
  - Même `depends_on` sur 2 steps → auto-parallèle
  - `fanout` = 1 step logique, N instances runtime
  - `parallel:` bloc = sucre pour groupe de N steps avec même `depends_on` que le bloc
  - Timeout/budget s'appliquent par instance dans fanout, en total sur le bloc parallel

### E — Export
- Rejoint B : export manuel via bouton UI + sync nightly automatique en git.

## Options pour C — Feedback loop HITL

### Axe 1 : Modèle de feedback
- **C1.a** — Feedback = **commentaire simple sur le step**. Relance immédiate du step avec `feedback` injecté dans le contexte d'input. Pas d'issue créée.
- **C1.b** — Feedback = **issue MnM liée au run**. Flow : commente → crée issue → assigné (dev ? agent ?) → discussion → quand résolue, le step se relance auto.
- **C1.c** — Hybride : commenter propose 2 actions "Relance avec ce feedback" OU "Créer une issue".

### Axe 2 : Budget re-runs
- **C2.a** — `max_retries: N` par step (défaut 3), définit dans le YAML workflow.
- **C2.b** — Budget global du workflow qui décroit à chaque re-run.
- **C2.c** — Pas de limite, c'est à l'humain d'arrêter (risque de boucle infinie).
- **C2.d** — CAO détecte la boucle (N re-runs avec même feedback récurrent) et intervient.

### Axe 3 : Ciblage
- **C3.a** — Commentaire sur un **step précis** → relance ce step uniquement, les dépendants attendent.
- **C3.b** — Commentaire sur un **sous-workflow** → relance le sous-workflow depuis son début.
- **C3.c** — Commentaire sur un **step précis** → relance ce step + invalide les dépendants déjà complétés (cascade).
- **C3.d** — Choix explicite par l'humain au moment du commentaire (granularity picker).

### Proposition par défaut
- **C1.c + C2.a + C2.d + C3.d** : hybride commentaire/issue, `max_retries: 3` par défaut, CAO monitore les boucles, humain choisit granularité cascade.

## Prochains rounds

- Round 3 : trancher options C (feedback loop) + spec MCP primitives architecture hybride
- Round 4 : spec format repo agent + config layer + routine nightly sync
- Round 5 : roadmap POC minimal EnterpriseCustomer (1 feature pilote <external-stakeholder>, scope réduit)
