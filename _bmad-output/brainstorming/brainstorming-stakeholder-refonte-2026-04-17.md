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

## Décisions Round 3

### C2 — Budget re-runs : pas de limite + feedback obligatoire + CAO watchdog
- Pas de limite sur les re-runs manuels du dev.
- **Règle** : tout re-run DOIT être accompagné d'un commentaire/feedback (pas de "relance silencieuse").
- **Mécanisme** : le commentaire sur l'issue qui re-déclenche le run est le feedback obligatoire.
- **CAO watchdog** : monitore les runs qui bouclent. Si pattern "dev relance toute la journée sans converger" détecté → CAO alerte le Sensei → Sensei aide le dev ("ton workflow est mal fait", "tes skills sont pas assez ciblés", etc.).
- Pas de `max_retries` dans le YAML (au moins pour le MVP).

### C1 — Matérialisation des runs : Issue MnM = conteneur top-level
**Proposition retenue** : un workflow lancé crée une **issue MnM** qui sert de tracker unifié.

```
Issue MnM "Refait la créa d'ordo" (status: in_progress)
├── Workflow Run #1 (refonte-feature) → status: running
│   ├── Step: discover-legacy (completed)
│   ├── Step: extract-rules (completed)
│   ├── Sub-workflow Run #2 (extract-prd)
│   │   ├── Step: enrich-prd-pm (waiting_human)
│   │   └── Step: enrich-prd-qa (pending)
│   ├── Sub-workflow Run #3 (dev-frontend)
│   │   └── ...
│   └── ...
├── Commentaires (thread conversationnel)
│   ├── CAO: "step extract-rules terminé, voici le résumé..."
│   ├── PM: "manque la gestion des mutuelles dans le PRD" ← relance
│   ├── CAO: "relance du sub-workflow extract-prd avec ce feedback"
│   └── ...
└── Artifacts liés (PRs, docs, tests)
```

**Propriétés** :
- **1 issue = 1 besoin utilisateur** ("refait la créa d'ordo"). Durée de vie = jusqu'à convergence finale.
- **N workflow runs par issue** : re-run = nouveau run lié à la même issue (historique préservé).
- **Sous-workflow runs** = nestés, chaque sous-workflow run pointe vers son parent step + parent run.
- **Commentaires** = sur l'issue (unique fil, pas threadé par step pour le MVP).
- **Entrées commentaires** :
  - Via **UI MnM** (PM/QA depuis inbox ou page issue)
  - Via **MCP MnM** depuis Claude Code (dev qui commente sans changer de contexte)
  - Backend : même endpoint `POST /companies/:companyId/issues/:id/comments`
- **Assignees** : humains requis par les steps (PM, QA) + CAO (watchdog auto-assigné).
- **Mentions** : `@pm`, `@qa`, `@cao`, `@sensei` via les commentaires déclenchent actions.

### C3 — Ciblage re-run : cascade par défaut
**Clarification du sens de "ciblage"** : quand un humain commente pour déclencher un re-run, **quel scope** est re-tourné ?

**Exemple concret** :
```
Workflow: A → B → C → D → E (tous ont fini sauf E)
PM commente: "le PRD (output de B) a oublié la gestion des mutuelles"
```

**Options** :
- Relance B seul → mais C, D (basés sur l'ancien PRD) restent invalides. Nonsense.
- **Relance B + invalide C, D** → cascade logique (proposition par défaut).
- Relance tout depuis A → inutile, A est bon.

**Règle proposée** : **cascade automatique par défaut**.
- Commentaire sur step X → X re-run + tous les descendants (dépendants directs et transitifs) ré-invalidés et re-lancés dans l'ordre du DAG.
- UI peut proposer override ("relance juste X sans cascade") pour cas où le dev sait que les downstream sont immunes au changement.
- Sur un sous-workflow : commentaire sur le sous-workflow entier → re-run complet du sous-workflow.

## Questions ouvertes pour Round 4

- **Granularité commentaires** : un seul fil par issue, OU possibilité d'attacher un commentaire à un step précis (pour que l'UI scroll/highlight) ?
- **Mentions + MCP** : `@cao` dans un commentaire déclenche un appel auto au CAO qui poste une réponse ?
- **Re-run cascade UX** : quand dev commente → on lui montre avant l'exécution "voici ce qui va être re-run : B, C, D. OK ?" ?
- **Archéologue = déjà un agent MnM** ou on crée les agents dédiés au fur et à mesure ?
- **Sous-issue vs nested run** : besoin réel de "sous-issue" dédiée pour un sous-workflow ou le nested run suffit ?

## Décisions finales Round 3

### Ciblage cascade
- **Défaut = cascade (Option B)**.
- **Override possible par le gate** : un gate peut déclarer "mon re-run ne cascade pas sur les downstream" (ex: gate de vérif non-bloquant qui n'invalide pas les dépendants).
- → Le gate a donc un champ optionnel `cascade_on_rerun: boolean | "auto"` (par défaut auto = cascade).

### Commentaires
- **Un seul fil conversationnel** par issue.
- Au moment du post, l'UI présente un **sélecteur de ciblage** :
  - Toute l'issue
  - Un step précis
  - Un workflow/sous-workflow
  - Un agent
  - etc.
- Le commentaire est enregistré avec une ref `target: { type, id }`.
- Un commentaire sans cible = pure conversation (pas de re-run).

### Re-run cascade UX
- Quand un commentaire déclenche un re-run, **preview explicite** :
  - "Ce commentaire va re-lancer : **step extract-rules** + cascade sur [step-1, step-2, step-3]. OK ?"
- Confirmation requise avant exécution.
- Liste complète des steps affectés (calcul auto via DAG).

### Sous-issues
- **Utiliser la notion de sous-issue MnM existante**.
- Un sous-workflow run → crée une **sous-issue** enfant de l'issue principale.
- Avantages : nesting natif UI MnM, assignees distincts possibles, statut indépendant.
- Convention : l'issue principale = le goal, les sous-issues = les sous-workflows ou steps majeurs.

## Round 4 — MCP primitives architecture hybride

### Principe
- **Serveur MnM** = control plane : catalogue workflows, state machine, gates, issues, commentaires, nightly sync.
- **Claude Code local** (chez le dev) = exécution : lance les agents/steps local, reporte au serveur.
- **Communication** : Claude Code ↔ MCP MnM (exposé par le serveur).
- **Discovery-first** : Claude Code interroge avant d'agir.

### Bloc 1 — Discovery (read-only)

```
listWorkflows(filters?)
  → compact list des workflows disponibles pour cette company
    [{ name, version, description, triggers, tags }]

getWorkflow(name, version?)
  → spec complète d'un workflow (steps, gates, YAML parsé, compact)

listIssues(filters?)
  → issues en cours / historiques
    [{ id, title, status, currentRun, waitingOn }]

getIssue(issueId)
  → détail issue : workflow run tree, steps status, commentaires récents

getIssueContext(issueId)
  → contexte accumulé (outputs des steps précédents, artifacts, feedback)

getRunState(runId)
  → état du DAG : { running, completed, failed, waiting } par step

getNextStep(issueId)
  → prochain step à exécuter (basé sur DAG + ce qui est complété)
    "discovery-first" : Claude Code demande "quoi faire maintenant"
```

### Bloc 2 — Execution (write)

```
createIssueFromWorkflow(workflowName, inputs, context?)
  → lance un workflow, crée l'issue top-level, retourne { issueId, runId }

launchStep(runId, stepId, agentContext?)
  → signale au serveur "je vais exécuter ce step"
    serveur: crée le step_execution, active le gate entry

submitStepOutput(runId, stepId, output, artifacts?)
  → Claude Code remonte l'output une fois le step local terminé
    serveur: enregistre, lance les gates exit, calcule le next step

reportStepProgress(runId, stepId, progress)
  → optionnel, pour UI live (% avancement, sous-actions en cours)

failStep(runId, stepId, error, recoverable?)
  → signale échec explicite, serveur décide (retry, escalade, stop)

addComment(issueId, body, target?, mentions?)
  → poster un commentaire, optionnellement ciblé (déclenche re-run si target)

requestHumanInput(runId, stepId, prompt, assignees)
  → un step local a besoin d'un humain, bloque localement
    serveur: crée inbox entry, notifie
```

### Bloc 3 — Events / waiting

```
waitForGate(runId, stepId, timeoutMs?)
  → Claude Code attend que le gate exit passe (ou fail)
    serveur: long-poll ou WebSocket

subscribeToIssue(issueId)
  → stream d'events (comments, step status changes, feedback)
    serveur: SSE/WS

waitForHumanApproval(stepId, timeoutMs?)
  → attend résolution du step humain
```

### Ce qui reste SERVEUR-only (pas MCP)

- **Exécution des gates** : toujours serveur. Le gate lit le step_output de DB, décide.
- **Orchestration DAG** : serveur calcule l'ordre, parallélisme, cascade re-run.
- **Nightly sync git** : routine serveur.
- **CAO watchdog** : agent serveur qui monitore les issues en boucle.
- **Appels SDK Anthropic pour gates LLM** : serveur appelle l'API directement.

### Flow type (exemple "dev lance /refonte-feature")

```
1. Dev dans Claude Code :
   /refonte-feature "refait la créa d'ordo"

2. Claude Code → MCP MnM :
   createIssueFromWorkflow("refonte-feature", { feature: "créa d'ordo" })
   ← { issueId: "iss_123", runId: "run_456" }

3. Claude Code → MCP MnM :
   getNextStep("iss_123")
   ← { stepId: "discover-legacy", agent: "archeologue",
       context: { repos: [...], mockups: [...] } }

4. Claude Code lance l'agent archeologue LOCAL :
   claude -p --agent archeologue --context ...

5. Agent archeologue termine, Claude Code :
   submitStepOutput("run_456", "discover-legacy", { endpoints, models, ... })

6. MnM serveur exécute le gate exit :
   → gate passe, DAG avance, next step calculé

7. Claude Code → MCP MnM :
   getNextStep("iss_123")
   ← { stepId: "extract-rules", ... }

8. ... boucle jusqu'à :
   ← { stepId: "enrich-prd-pm", type: "human_wait",
       message: "PM doit enrichir le PRD" }

9. Claude Code :
   waitForHumanApproval("enrich-prd-pm", 86400000)
   ← bloqué jusqu'à ce que PM commente/approve dans l'UI MnM

10. PM dans UI MnM commente → serveur débloque → Claude Code reprend
```

### Décisions finales Round 4

#### Primitives OK
- La liste est validée. Ajustements possibles au fur et à mesure.

#### Transport
- **WebSocket** pour `waitForGate`, `subscribeToIssue`, `waitForHumanApproval`.
- MnM a déjà le système `live-events` (`/events/ws`), réutiliser.

#### Contexte ET directive d'exécution (CLÉ)
- **MnM pré-compose** un contexte indicatif.
- **Claude Code reconstitue** depuis les primitives (Claude Code a accès à Read, Grep, etc.).
- **MAIS MnM pilote aussi le COMMENT** : chaque step peut imposer :
  - Un **état de contexte** requis (session fresh, contexte vide, etc.)
  - Un **mode d'exécution** (main agent, sub-agent, nouvelle session)
  - Des **restrictions d'outils** (allowed/denied tools)
  - Des **skills/plugins obligatoires** (ex: `team-dev-frontend` doit être loaded)
  - Des **hooks** à vérifier/installer

#### Execution Directive (NOUVEAU concept)

Chaque step retourné par `getNextStep` a un bloc `execution` :

```yaml
execution:
  mode: fresh_session | sub_agent | current_session
  required_context_state: empty | any | specific_tools_loaded
  allowed_tools: [Read, Grep, WebFetch]
  denied_tools: [Bash, Write]
  required_skills: [team-dev-frontend:extract-rules]
  required_plugins: [team-dev-frontend]
  hooks:
    pre_step: [validate-context.sh]
    post_step: [report-back.sh]
```

#### Exemples concrets

**Exemple 1 — `extract-rules` doit être neutre**
- `discover-legacy` a chargé 50k tokens de code legacy dans la session.
- `extract-rules` doit analyser à froid, sans biais.
- Directive : `mode: fresh_session` + `required_context_state: empty`.
- Claude Code reçoit "next step", voit directive, doit lancer en sub-agent ou nouvelle session.
- Un **hook `UserPromptSubmit`** côté Claude Code vérifie avant d'exécuter : "la session est-elle vide ?" Si non, bloque et propose "ouvre une nouvelle session ou spawn un sub-agent".

**Exemple 2 — `dev-front-angular` en sub-agent spécialisé**
- Directive : `mode: sub_agent`, `required_plugins: [team-dev-frontend]`, `allowed_tools: [Read, Write, Edit, Bash]`.
- Claude Code spawn un sub-agent via son outil Agent avec les params.

**Exemple 3 — `extract-rules` avec outils restreints**
- Directive : `allowed_tools: [Read, Grep, WebFetch]`, `denied_tools: [Bash, Write, Edit]`.
- Claude Code applique les restrictions (via permissions ou hooks de blocage).

### Leviers Claude Code exploitables par MnM

1. **Hooks** (PreToolUse, PostToolUse, UserPromptSubmit, SessionStart, etc.) — MnM peut installer/activer via settings ou via commande MCP dynamique.
2. **Sub-agents** via Agent tool — MnM impose un type de sub-agent pour isolation contexte.
3. **Skills/plugins** — MnM requiert un plugin précis loaded.
4. **Permission mode** (plan / acceptEdits / bypass) — MnM peut suggérer un mode.
5. **Allowed/denied tools** — restriction fine-grain.
6. **Worktrees** — MnM peut demander l'exécution dans un worktree isolé.

### Gate d'entry sur contexte d'exécution

Nouveau type de gate :
- Pas sur l'output d'un step (comme gate d'exit)
- Sur l'**état de la session Claude Code** avant de lancer le step
- Exemples :
  - `context-must-be-empty` : vérifie via hook que la session n'a pas déjà exécuté de tools
  - `plugin-must-be-loaded` : vérifie que `team-dev-frontend` est disponible
  - `worktree-required` : vérifie qu'on est dans un worktree git
- Implémentation : hook `UserPromptSubmit` ou `PreToolUse` qui appelle MCP MnM pour valider, bloque si invalide.

### Authentification MCP
- Tokens par dev (chaque dev a sa clé MCP MnM).
- Token lié à un actor (dev identifié). `assertCompanyMembership` s'applique.
- Possibilité d'impersonation admin (Sensei peut voir toutes les issues).

### Périmètre connaissance Claude Code
- **Confirmé** : Claude Code voit seulement "next step + execution directive".
- Le DAG complet reste serveur. Simplicité pour l'agent local.
- Dev peut demander à voir le DAG via UI MnM si curieux.

### Décisions finales Round 4 (complément)

#### Hooks : installés côté dev via plugins company-wide
- **PAS de distribution dynamique** des hooks par MnM.
- Les hooks vivent dans des **plugins Claude Code pré-installés company-wide** (ex: plugin `team-dev-workflows` installé sur tous les postes EnterpriseCustomer).
- MnM **vérifie** la présence des hooks mais ne les installe pas.
- Rationale : isolation, sécurité, versionning géré par le mécanisme plugin Claude Code standard.

#### Violation de directive = infraction loggée + CAO
- Claude Code exécute malgré directive non respectée (ex: pas de `fresh_session`).
- `submitStepOutput` → MnM détecte infraction → refuse OU accepte avec warning.
- Infraction loggée dans access_logs.
- CAO alerté, peut réagir (commentaire, alerte au lead, escalade).

#### Distribution des agents (NOUVEAU — Round 5)

**Concept** : un agent MnM = **artifact versionné** téléchargeable.

Un agent bundle contient :
- `agent.yml` (metadata, adapter_type, version)
- `prompts/system.md` + prompts templates
- Skills refs (ou inline)
- Hooks refs (ou inline)
- Config layers référencés (par nom/version, résolus à l'exécution)
- MCP config
- Git credentials refs (pas les secrets, juste les refs — résolus local avec creds dev)

**Protocole** :
1. MnM dit à Claude Code : "exécute step X avec agent `dev-angular-cba@2.3.1`".
2. Claude Code vérifie cache local : ai-je `dev-angular-cba@2.3.1` ?
   - **Oui** → utilise direct.
   - **Non** → télécharge depuis MnM : `GET /companies/:companyId/agents/dev-angular-cba/2.3.1/bundle`.
3. Claude Code unpack dans cache local, exécute.

**Cache local Claude Code** :
- `~/.claude-code-cache/mnm/<company>/agents/<name>/<version>/`
- TTL : probablement infini (bundles immuables par version), invalidé uniquement si MnM annonce nouvelle version.

**Versioning** :
- SemVer sur les agents.
- Bundle immuable par version (publié une fois, figé).
- MnM calcule l'agent référencé par le workflow (ex: workflow demande `^2.3` → MnM résout à `2.3.1`).

**Source de vérité** :
- Runtime live : DB MnM (versions, configs layers actives, skills).
- Portable / résilience : git (nightly sync).
- Distribution au runtime : bundles servis par MnM (compilés depuis DB).

### Primitives MCP additionnelles pour agents

```
resolveAgent(name, versionConstraint)
  → { name, version, bundleUrl, checksum }
    MnM résout la contrainte (^2.3 → 2.3.1)

downloadAgentBundle(name, version)
  → binary bundle (tar.gz ou zip)

listInstalledAgents()
  → liste des agents en cache local (Claude Code interne, utilitaire)

checkAgentIntegrity(name, version, checksum)
  → valide que le bundle local n'est pas corrompu
```

## Questions Round 5

### Distribution agents
- **Format bundle** : tar.gz ? zip ? JSON unique avec fichiers embeds ? Préférence ?
- **Secrets** : git credentials, API keys → gérés par Claude Code local (via OS keychain ou config dev) et agent fait refs. MnM ne voit jamais les secrets. Confirmé ?
- **Bundle signé** ? (integrity + source auth)

### Format repo agent
- Proposition :
  ```
  agents/dev-angular-cba/              ← 1 repo git
    agent.yml                          ← metadata, version, refs
    prompts/
      system.md
      user-templates/
        extract-rules.md
    skills/                            ← inline OU refs externes
      scaffold-component.md
    hooks/
      ref: plugin:team-dev-workflows    ← hooks vivent dans le plugin
    config-layers:
      - ref: base-stack@^1.0
      - ref: angular-stack@^2.3
    mcp:
      servers:
        - figma-mcp
        - gitlab-mcp
  ```
- OK avec cette structure ?

### Nightly sync git
- Routine `governance-sync` tourne à 03:00 UTC/company
- Pour chaque agent modifié en DB dans la journée :
  - Génère markdown + yml à jour
  - Diff avec repo git
  - Commit + push avec message `chore(sync): agent <name> updated by <actor> at <ts>`
- Pour chaque config layer modifié → idem
- Rollback : restore depuis git tag en cas de problème DB

## Décisions finales Round 5

### Bundle agent = simple archive
- Format : **tar.gz** (simple, supporté partout, léger).
- Pas de signature cryptographique pour le MVP. **SHA256 checksum** suffit pour intégrité.
- Signature PGP/sigstore à considérer si on ouvre la distribution cross-company plus tard.

### Credentials / auth — côté dev, MnM vérifie via hook
- MnM a déjà un système de credentials (pour ses propres creds internes).
- Pour les credentials côté poste dev (git SSH keys, MCP tokens, API keys) : **gérés localement par le dev**, MnM ne les voit jamais.
- **Détection** : au début d'un step, MnM peut demander à Claude Code (via hook ou commande) de vérifier :
  - "MCP figma configuré ?" → hook liste les MCP actifs
  - "MCP gitlab configuré ?" → idem
  - Credentials git SSH pour gitlab-cba ? → test connexion
- Si check fail → MnM poste un commentaire sur l'issue : "Configure MCP figma sur ton poste avant de lancer ce step".
- **Primitive proposée** : `verifyLocalSetup(stepId)` → Claude Code exécute un check via hook, retourne status.

### Structure agent FINAL simplifiée
- Un agent ne duplique PAS ce que ses config layers contiennent.
- **Agent = refs vers config layers + metadata**.
- Les config layers contiennent skills, hooks, MCP config, prompts.
- Si les config layers sont aussi versionnés sur GitLab → on verra après (pas bloqueur MVP).

```yaml
# agents/dev-angular-cba/agent.yml
name: dev-angular-cba
version: 2.3.1
adapter_type: claude_local
description: "Dev front Angular spécialisé EnterpriseCustomer <external-stakeholder>"

config_layers:
  - ref: base-stack@^1.0
  - ref: angular-stack@^2.3
  - ref: prompts-dev-frontend@^1.2

# Optionnel : overrides locaux si besoin ponctuel
overrides: {}
```

### Nightly sync git — validé

```
03:00 UTC quotidien :
Routine governance-sync (pour chaque company)
  For each agent modified today:
    → compile agent config depuis DB (avec config layers résolus)
    → diff avec git repo <company>-mnm-config/agents/<name>/
    → si diff → commit + push avec message "chore(sync): agent X updated by Y at Z"
  For each config_layer modified today:
    → idem dans git repo <company>-mnm-config/config-layers/
  For each workflow run terminé today:
    → rien en git, juste archivage DB (runs = pas portables)
```

## Recap complet du design EnterpriseCustomer

### Architecture d'exécution
- **Serveur MnM** = control plane (DB, MCP server, gates, nightly sync, CAO).
- **Poste dev** = exécution (Claude Code + plugins company-wide + cache agents).
- **Communication** : MCP MnM (WebSocket pour events long-running).

### Lancement type d'un workflow
1. Dev : `/refonte-feature "créa d'ordo"` dans Claude Code.
2. Claude Code → MCP : `createIssueFromWorkflow(...)` → issue + run.
3. Loop : `getNextStep(issueId)` → step + execution directive + agent ref.
4. Claude Code vérifie cache agent, télécharge si absent, applique execution directive.
5. Hook vérifie contexte (session fresh, MCPs présents, etc.).
6. Exécute agent local, `submitStepOutput`.
7. MnM gate exit → avance DAG → next step.
8. Step humain → `waitForHumanApproval` bloque, PM/QA commente via inbox/UI.
9. Feedback loop : commentaire cible un step → re-run cascade.
10. Convergence → workflow DONE → issue closed.

### Composants MnM à construire (bloqueurs POC)

**Backend**
1. Moteur DAG + gates runtime (XState pour state machine).
2. Schema YAML workflow + parser/validator.
3. Infra GitProvider (GitLab self-hosted).
4. MCP server étendu :
   - Discovery : listWorkflows, getWorkflow, getNextStep, getIssueContext
   - Execution : createIssueFromWorkflow, submitStepOutput, addComment
   - Events (WS) : waitForGate, waitForHumanApproval, subscribeToIssue
   - Agents : resolveAgent, downloadAgentBundle, verifyLocalSetup
5. Agent bundle compiler (DB + config layers → tar.gz).
6. Routine nightly governance-sync.
7. CAO watchdog (monitoring boucles, infractions).

**Frontend MnM**
8. Page "Workflows live" (liste runs en cours).
9. Page "Issue run" (timeline DAG + commentaires + artifacts).
10. Sélecteur ciblage au post de commentaire.
11. Preview cascade avant confirmation re-run.
12. Inbox enrichie : step humain en attente.

**Côté dev / Claude Code**
13. Plugin `team-dev-workflows` (hooks de validation contexte, pre/post step).
14. Plugin `team-dev-frontend` (skills existantes à refactorer en agent MnM).
15. Plugin `team-dev-backend` (idem).

**Agents à créer pour le workflow refonte-feature**
16. `archeologue-legacy` (discover legacy)
17. `business-analyst` (extract rules)
18. `prd-completeness-judge` (gate PM)
19. `reglementary-coverage-judge` (gate QA)
20. `prd-consolidator`
21. `ux-specifier` (avec MCP Figma)
22. `backend-analyzer`
23. `dev-backend` (existe via plugin team-dev-backend)
24. `dev-angular-cba` (existe via plugin team-dev-frontend)
25. `tech-debt-judge` (adversarial)
26. `capacitor-compat-judge`
27. `qa-automaton` (génération E2E)
28. `ac-coverage-judge`
29. `tech-writer`

## Round 6 — Roadmap POC EnterpriseCustomer (à venir)

### Proposition scope réduit POC

**Objectif POC** : valider end-to-end le workflow sur UN scénario minimal avant de scaler.

**Scope** :
- 1 feature pilote : **"Refonte écran patient simple"** (moins complexe que "créa d'ordo")
- Sous-workflows réduits :
  - `extract-prd` uniquement (pas de dev front/back)
  - 3 steps : discover-legacy → extract-rules → enrich-prd-pm
  - 1 gate LLM (prd-completeness-judge)
  - 1 human step (enrich PM)
- Pas de cascade re-run (MVP sans cascade)
- Pas de Nightly Synthesis
- Pas de CAO watchdog
- 1 agent seulement : `archeologue-legacy` + `business-analyst`

**Delivrables POC** :
- Workflow `extract-prd` en YAML dans repo gitlab-cba
- Agents en DB MnM avec 1 config layer par agent
- MCP primitives : createIssueFromWorkflow, getNextStep, submitStepOutput, addComment, waitForHumanApproval, resolveAgent
- UI MnM : page issue + timeline steps + commentaire simple
- Plugin `team-dev-workflows` minimal (hook pre-step check MCP)
- Test end-to-end : dev lance, archéologue scan legacy, BA extrait, PM commente, prd consolidé.

**Ce qui est reporté post-POC** :
- Fan-out / parallélisme multi-steps
- Cascade re-run
- Feedback loop complet
- CAO watchdog
- Nightly sync git
- Workflow adversarial gates
- Sous-workflows composition (`uses:`)

### Questions pour Round 6

- OK avec ce scope POC ? Trop restreint ? Trop ambitieux ?
- Combien de temps on alloue au POC (timeline) ?
- Qui code quoi (Tom + Gab dispos ?) ?
- Priorité : démo fonctionnelle vs robustesse ?

## Prochains rounds

- Round 5 : format repo agent + config layer + routine nightly sync
- Round 6 : roadmap POC minimal EnterpriseCustomer (1 feature pilote <external-stakeholder>)
