# Governed Workflows — Design Consolidé

**Date :** 2026-04-17
**Participants :** MnM founder, Claude
**Input :** `docs/governed-workflows-scenarios.md`
**Sessions :** 7 sessions de brainstorm + 4 agents de recherche (architecte x2, PM, UX)
**Statut :** Design consolidé, prêt pour la phase de spec technique

---

## 1. Vision en une phrase

**Les Governed Workflows de MnM = un DAG de "units of work" (steps + gates) versionnés sur git, orchestrés par le harness IA du user via des primitives MCP atomiques, gouvernés par un backend déterministe, et améliorés chaque nuit par une Nightly Synthesis qui apprend des exécutions.**

---

## 2. Principes fondamentaux

1. **MnM = control plane, pas orchestrateur.** MnM fournit des primitives atomiques avec erreurs explicites. L'orchestration vit dans le harness (Claude Code + Opus).

2. **Gate et Step = même primitive structurelle.** Distinction fonctionnelle uniquement : step produit, gate valide. Les deux partagent le même contrat I/O (`pass/fail + report + metadata`).

3. **Tout passe par des agents et des workflows MnM.** Plus de workflows "human-only". Les humains approuvent/reviewent via l'inbox MnM ou via MCP matinal, mais tout est orchestré par des agents.

4. **Gates et workflows peuvent être non-déterministes.** Un gate peut être un agent LLM qui juge la qualité d'un artifact produit par un autre agent. Chaînes méta-agent.

5. **Discovery-first pattern.** Le harness appelle `getWorkflow` + `getSteps` + `getWorkflowState` AVANT d'agir. MnM ne dump pas tout en permanence (préserver le contexte du harness).

6. **Contrainte tokens critique.** Les returns MCP doivent rester légers. Pas 100k tokens pour décrire un workflow. Pattern API GitHub : `list` = résumé, `get` = détail.

7. **Workflows forcés à TOUT LE MONDE.** L'autonomie ne réduit pas les gates, elle réduit la friction pour les passer (un expert passe plus facilement).

8. **Création/modification via MnM, pas via git PR direct.** Un Workflow Orchestrator Agent génère le YAML depuis une conversation. Git est le backend, pas l'interface.

9. **Single-tenant pour le MVP.** Marketplace multi-tenant plus tard.

10. **Tout est logué.** Access logs universels = fondement de la gouvernance. Sensei/CAO surveillent via queries.

---

## 3. Modèle technique

### 3.1 Structure d'un workflow

**Un repo git par workflow** dans un groupe `workflows/` :

```
workflows/bugfix/
├── workflow.yaml              # Déclaration (source de vérité)
├── gates/*.gate.ts            # Logique custom TypeScript
├── prompts/*.md               # System prompts par étape
├── tests/*.test.ts            # Tests des gates
├── package.json
└── README.md
```

**Format hybride YAML + TypeScript :**
- YAML pour le "quoi" (steps, deps, budgets, triggers) — lisible par un PM
- TS pour le "comment" (gate logic) — type-safe, testable

### 3.2 Le contrat I/O universel

```typescript
interface GateInput {
  context: GateContext         // tout ce que MnM a rassemblé
  artifact?: any               // ce qui est évalué (optionnel)
  config: Record<string, unknown>  // config ouverte depuis le YAML
}

interface GateOutput {
  pass: boolean                // IMPOSÉ
  report: string               // IMPOSÉ — explication lisible
  error_code?: string          // SI fail — code machine-readable
  hints?: string[]             // SI fail — guidance pour le harness
  score?: number               // optionnel
  evidence?: any[]             // optionnel
  metadata?: Record<string, unknown>  // champ libre
}
```

**Pas de side_effects, pas de launched_steps, pas de notifications.**
Le gate évalue, retourne le verdict, point.

### 3.3 Les 4 types de gates

| Type | Exécution | Quand l'utiliser |
|------|-----------|------------------|
| `builtin` | Code MnM serveur | Checks simples : artifact exists, commit format |
| `script` | TypeScript du repo workflow | Logique custom : validation schema, checks métier |
| `agent` | Sub-run d'un agent MnM | Reviews : archi, sécu, code review |
| `webhook` | POST externe | Intégrations : Jira, Slack, CI externe |

### 3.4 Déclaration YAML

```yaml
apiVersion: mnm/v1
kind: GovernedWorkflow
metadata:
  name: bugfix
  version: "1.2.0"

scope:
  visibility: company           # company | tag | user
  tags: ["dev", "qa"]
  enforced: true

budgets:
  global: { timeout_minutes: 120, max_cost_cents: 5000, max_tokens: 500000 }
  per_step: { timeout_minutes: 30 }

triggers:
  - action: "create_branch"
    match: { branch_pattern: "fix/*" }
  - intent: "corriger un bug"

variables:                       # paramètres runtime (JSONB)
  branch_name: { type: string, required: true }
  priority: { type: enum, values: [low, med, high], default: med }

steps:
  - id: context-gathering
    dependencies: []
    can_skip: false
    auto_start: true
    gates:
      exit:
        - id: context-complete
          type: builtin
          rule: has_artifacts
          config: { required: ["jira_context.json"] }
          blocking: true

  - id: code-review
    dependencies: [implementation]
    type: agent
    agent: agent-code-reviewer    # produit un rapport
    gates:
      exit:
        - id: review-quality-check
          type: agent              # ← gate = autre agent méta
          agent: agent-review-validator
          config:
            prompt: "Is this review thorough?"
            threshold: 7
```

### 3.5 Composition et héritage

**Composition inter-repos** :
```yaml
steps:
  - id: brainstorm
    uses: workflows/brainstorm-feature@v2.1  # référence un autre repo
    with: { max_ideas: 5 }
```

**Héritage** :
```yaml
extends: _templates/standard-review@v1
variables: { security_blocking: false }
prepend_steps: [...]
```

**Héritage complexe sans limite** — un workflow peut extends qui extends qui extends.

### 3.6 Failure modes

```yaml
gates:
  - gate: mnm/test-runner
    on_failure: block                    # Défaut : bloque

  - gate: agent/security-review
    on_failure: block_with_override      # Override tracé
    override_requires: [lead_approval]

  - gate: mnm/lint-check
    on_failure: warn                     # Ne bloque pas

  - gate: agent/perf-benchmark
    on_failure: retry                    # Retry auto
    max_retries: 2
```

### 3.7 Conditions dynamiques

```yaml
gates:
  - gate: agent/security-review
    when: "artifact.files_changed.any(f => f.startsWith('api/'))"

  - gate: agent/deep-security-review
    when: "context.kg.module_risk_score > 7"

  - gate: agent/mentoring-review
    when: "context.actor.metrics.security_pass_rate < 0.6"

  - gate: agent/perf-benchmark
    when: "workflow.budget.remaining_tokens > 50000"
```

---

## 4. Data model (5 tables)

1. **`governed_workflow_definitions`** — cache parsé du YAML, versionné SemVer
2. **`governed_workflow_runs`** — instance d'exécution, snapshot immutable du YAML
3. **`governed_step_executions`** — chaque step (XState), deps, artifacts
4. **`gate_results`** — résultat de chaque gate (audit complet, I/O)
5. **`governed_action_registry`** — mapping action → workflow requis

**+ 2 tables Nightly Synthesis :**
6. **`synthesis_snapshots`** — agrégats (90j retention)
7. **`synthesis_proposals`** — lifecycle complet (retention illimitée)

---

## 5. MCP Primitives (discovery-first)

### Tools atomiques exposés

- `listWorkflows(filters)` — liste des workflows accessibles (résumé)
- `getWorkflow(id)` — définition compacte d'un workflow (~500 tokens)
- `getWorkflowState(runId)` — état courant d'un run (~200 tokens)
- `listSteps(workflowId)` — steps + états
- `getStep(stepId)` — détail d'un step (gates, config)
- `launchWorkflow(id, params)` — démarre un workflow
- `launchStep(stepId, runId?, context)` — invoque un step
- `completeStep(runId, artifacts)` — marque un step terminé
- `approveStep(runId, reason?)` — approuve un step humain

### Format compact pour `getWorkflow`

```json
{
  "workflow_id": "create-app",
  "version": "1.2.0",
  "steps": [
    { "id": "brainstorm", "deps": [], "gates": 1, "avg_duration": "5m" },
    { "id": "deploy-draft", "deps": ["human-validation"], "gates": 2, "avg_duration": "15m" },
    { "id": "deploy-app", "deps": ["infra-review"], "gates": 3 }
  ],
  "triggers": ["intent:deploy app"]
}
```

### Format d'erreur

Pas de matrice over-engineered. Juste `error_code + message riche` :

```json
{
  "isError": true,
  "error_code": "WORKFLOW_DEPENDENCY_UNMET",
  "message": "Cannot launch 'deploy-app': missing 'deploy-draft'. Satisfied: [brainstorm, human-validation]. Call getWorkflow('create-app') for the full DAG, then launchStep('deploy-draft') first."
}
```

Tout l'intelligence dans le message. Le harness lit et se démerde.

---

## 6. Lifecycle et exécution

### Cycle de vie

```
CRÉATION         PUBLICATION       EXÉCUTION         OBSERVATION        ÉVOLUTION
─────────        ───────────       ─────────         ───────────        ─────────
Orchestrator     Scope/tags/perm   Trigger           Métriques          Nightly Synthesis
Agent génère     Git commit        Session créée     Feedback users     Propositions
YAML             (branche draft)   Gates évalués     Cost tracking      d'amélioration
                 Lead approve      Artifacts         Gold verdicts      Auto-apply (opt-in)
                 Merge = actif     accumulés                            + rollback auto
```

**L'exécution est immutable** : chaque run utilise le `definitionSnapshot` du YAML au moment du trigger. Mises à jour du workflow = pas d'effet sur les runs en cours.

### Triggers possibles

1. **Explicite** : intent chat, MCP call
2. **Événement** : Jira, Sentry, webhook externe
3. **Agent** : CAO détecte anomalie → lance workflow
4. **Schedulé** : routines MnM (feature existante, à connecter aux workflows)
5. **Chaîné** : workflow A success → workflow B démarre (héritage, complexité sans limite)

### Budget = contrat de ressources

```yaml
budgets:
  global: { timeout: 4h, max_tokens: 500k, max_cost: $2.50 }
  per_step: { timeout: 30m, max_tokens: 100k }
```

Timeout → tue un workflow en boucle. Pas besoin de dashboard "stuck workflows".
CAO voit les dépassements de budget comme anomalies.

### Pas de skip
**Un workflow stuck reste stuck.** Pas de skip. Les humains doivent relancer les personnes en live, ou le CAO s'en occupe. No shortcut.

---

## 7. Workflow Orchestrator Agent (authoring)

### Principe
L'utilisateur ne touche jamais le YAML. Un agent spécialisé dialogue et génère.

### Time to first workflow < 5 min

```
Lead: "Je veux un workflow pour les PRs : tests + review + lint"

Orchestrator: "Voici votre workflow 'pr-validation' :
  1. Lint check        [Automatique]
  2. Tests             [Seuil 80% coverage]
  3. Code review       [1 approbation]
 C'est actif. Voulez-vous tester sur votre dernière PR ?"
```

### Matrice d'approbation des changements

| Type | Exemple | Approbation |
|------|---------|-------------|
| Cosmétique | Renommer étape | Auto-apply 24h |
| Opérationnel | Ajuster seuil | 1 Lead |
| Structurel | Ajouter/supprimer step | 2 Leads ou Lead + Admin |

### Versioning SemVer automatique, forward-only changelog, rollback sélectif.

---

## 8. Nightly Synthesis

### Architecture (Haiku, ~$0.004 par company par nuit)

3 phases séparées :
1. **Agrégation SQL** (2-5s, pas de LLM) → `synthesis_snapshots`
2. **Détection d'anomalies** (Haiku, ~3-5s) → 11 patterns possibles
3. **Génération de propositions** (Haiku, ~3-5s, si anomalies)

### 11 patterns détectés

- Gate toujours pass (>95%) → suppression suggérée
- Gate fail trop (>40%) → ajuster seuil ou ajouter condition
- HITL rubber-stamp (>97% approve) → passer en auto
- Bottleneck (P95 > 2x moyenne)
- Token waste / overuse
- Temporal spikes (jour/heure)
- Cross-workflow inconsistencies
- Enforcement gap, retry exhaustion, etc.

### 4 catégories de propositions

1. **Alertes** (action immédiate) — "gate sécu fail 78% depuis 3 jours"
2. **Optimisations** — "paralléliser lint+tests = -3min"
3. **Suggestions structurelles** — "ajouter gate migration review"
4. **Nouveaux workflows** — "créer hotfix-express"

### Filtrage anti-bruit

1. Seuils d'échantillon minimum (hardcoded)
2. Confidence threshold (>=60% persisté, >=75% auto-apply)
3. Dédup avec rejets passés (rejet avec raison = jamais re-proposé)

### Auto-apply opt-in par company

Catégories safe uniquement : `hitl_optimization`, `token_budget_adjust`, `timeout_adjust`, `retry_policy_adjust`.
**Structurel (ajout/suppression step) = JAMAIS auto-apply.**

### Rollback automatique

Check à J+1. Si failure rate augmente >20pp → auto-revert + notif.

### Auto-calibration

<50% acceptation → plus conservatrice, >80% → plus proactive.

---

## 9. Exécution cross-persona

### PO dans le chat MnM

- Progress bar sticky en haut (workflow en cours)
- Gates inline dans la conversation (pas de popups)
- Guidance LLM sur les gate failures (pas un mur, une conversation)
- **Zéro YAML, zéro jargon technique**

### Dev dans Claude Code (MCP)

- Discovery-first : `getWorkflow` + `listSteps` avant `launchStep`
- Erreurs structurées avec `error_code` + hints
- Le harness chaîne les tool calls tout seul

### Lead dans le dashboard web

- Liste des workflows actifs (SSE, pas polling)
- Détail pipeline cliquable (timeline événements)
- Demandes d'override (1 clic approuver/refuser)

### Inbox MnM (validations humaines)

- Notifications générées par le backend MnM (déterministe) à chaque `completeStep`
- **Agent/modèle** qui prend les résultats et crée des notifs via **json-render** (système existant)
- Viewers adaptés : git diff viewer, spec viewer, approval viewer
- Double canal : inbox web OU MCP matinal ("quoi de beau à faire ?")

---

## 10. CAO + Sensei + routines

### CAO = méta-juge des gates LLM

Le problème : un LLM-as-judge peut être trop laxiste, trop strict, ou incohérent.

**CAO async, en arrière-plan :**
- Compare les verdicts passés (KG Memory) sur diffs similaires
- Détecte incohérences → alerte lead
- Peut optionnellement revoke un pass suspect
- Stocke le verdict dans le KG pour comparaisons futures

**Stratégie :**
- 100% des verdicts sur modules "high risk" (tag KG)
- ~20% échantillon aléatoire sur le reste
- 100% des overrides

### Sensei (brainstorm dédié à venir)

Expert MnM qui aide l'onboarding + dialogue pédagogique avec les clients.
**Brainstorm séparé** — noté dans `_next-sessions-todo.md`.

### Routines MnM = triggers de workflows

Routines existent déjà (CRON par company).
**À faire :** les connecter au système de workflows pour permettre des workflows "toujours actifs" (monitoring, daily standup, watchdog, nightly synthesis).

---

## 11. Debug / observabilité d'un workflow

**Pas de dashboard "stuck" dédié** (les timeouts gèrent).
**Pas de "skip" pour débloquer** (humains font leur boulot, CAO aide).

### Pour investiguer un workflow

Le dev peut :
1. Via **MCP** : `getWorkflowState(runId)` → voir où on en est, quels logs
2. Via **UI** : aller sur la page du workflow (comme issues/runs d'agents existants)
3. Via **harness** : "mon workflow bugfix est bloqué, pourquoi ?" → Opus fetch les infos via MCP

Les logs sont tous là (gates, artifacts, transitions). Le user voit ou demande au harness.

---

## 12. Gouvernance & sécurité

### Pas de contrainte technique sur la modification des workflows

**Trust + transparency via logs universels.**

### Access logs universels (brainstorm dédié à venir)

Tout doit être logué :
- Invocations MCP (qui, quand, tool, params, résultat)
- Changements de workflows (diff)
- Résultats de gates (déjà dans `gate_results`)
- Overrides (qui, raison)
- Approbations humaines
- Changements de permissions/tags

**Brainstorm séparé** — noté dans `_next-sessions-todo.md`.

### Monitoring par Sensei/CAO

Queries prédéfinies sur les logs :
- "Lead a désactivé plusieurs gates sécu récemment ?"
- "Patterns d'override suspects ?"
- "User produit des artifacts systématiquement rejetés ?"

→ Alerte humaine si anomalie.

---

## 13. Features avancées (pour plus tard)

### A/B testing de workflows

```yaml
experiment: bugfix-with-ai-precheck
  control: bugfix-v3
  variant: bugfix-v4
  split: 50%
  metrics: [time_to_merge, gate_pass_rate, post_merge_incidents]
  duration: 2_weeks
```

**Data-driven process improvement.** Personne ne fait ça aujourd'hui.

### Emergency bypass (hotfix prod)

```yaml
workflow: emergency-hotfix
  triggers: ["hotfix", "prod down", "urgence"]
  steps:
    - fast-commit: { gates: [smoke-tests] }
    - merge: { gates: [1_approval] }
  on_complete:
    - create_workflow: post-hotfix-review  # DETTE AUTOMATIQUE
      deadline: 48h
```

Le hotfix bypass les gates lourds, mais **crée une dette automatique**.

### Gate dry-run (TDD pour les gates)

Tester un gate sur un artifact réel avant de le brancher en prod.
Batch dry-run sur les N derniers diffs pour **calibrer les thresholds**.

---

## 14. Ce qui est LIVRÉ dans ce brainstorm

- [x] Principes fondamentaux (10 règles)
- [x] Contrat I/O Gate (minimal, 4 types)
- [x] Déclaration YAML complète (syntaxe proposée)
- [x] Composition + héritage (sans limite)
- [x] Failure modes (block, override, warn, retry)
- [x] Conditions dynamiques (`when:`)
- [x] Budget = contrat de ressources
- [x] Data model (5 tables + 2 synthesis)
- [x] MCP primitives (discovery-first, format compact)
- [x] Lifecycle complet (création → exécution → évolution)
- [x] Workflow Orchestrator Agent (authoring)
- [x] Nightly Synthesis (3 phases, 11 patterns, 4 catégories)
- [x] Auto-apply + rollback automatique
- [x] CAO = méta-juge des gates LLM
- [x] Exécution cross-persona (PO/Dev/Lead/Inbox)
- [x] Pattern notifs déterministes via json-render + inbox
- [x] Intégration routines MnM → triggers de workflows
- [x] Gate et Step = même primitive structurelle

---

## 15. Ce qui est REPORTÉ à d'autres sessions

Dans `_bmad-output/brainstorming/_next-sessions-todo.md` :

1. **Access logs universels** — auditer l'existant, identifier les trous, designer le schema universel
2. **Sensei** — pédagogie, onboarding, arbre de dialogue, différenciation avec CAO/Nightly Synthesis

---

## 16. Prochaines étapes suggérées

1. **Spec technique complète** — consolider ce design en spec d'implémentation
2. **POC du Workflow Guard MCP** — un seul tool (`create_skill`) avec son workflow pour valider le pattern de bout en bout
3. **Définir le GitProvider** — interface + stub GitLab minimal
4. **Lister les Governed Actions initiales** pour le niveau 2 votre organisation (~10-15)
5. **Prototyper l'Orchestrator Agent** — authoring conversationnel
6. **Brainstorm Access Logs** (session séparée)
7. **Brainstorm Sensei** (session séparée)

---

## Annexe : Outputs des 4 agents de recherche

Les 4 agents (architecte repo/data-model, architecte nightly, PM, UX) ont produit
des rapports détaillés qui ont nourri ce design consolidé. Les rapports complets
restent dans le brainstorm original : `brainstorming-governed-workflows-superpowers-2026-04-16.md`

### Agent Architecte (repo + data model)
Format hybride YAML + TS validé. 5 tables Drizzle schemas complets.
Workflow guard = ~15 lignes dans `wrappedHandler`. Composition inter-repos via `uses:`.

### Agent Architecte (nightly synthesis)
3 phases LLM séparées, Haiku uniquement, ~$0.004/company/nuit.
2 tables supplémentaires, auto-apply avec rollback, intégré aux routines existantes.

### Agent PM
Time to first workflow < 5 min. Matrice d'approbation à 3 niveaux.
4 catégories de propositions Nightly. Auto-calibration sur taux d'acceptation.

### Agent UX
Split-pane Chat + Canvas ReactFlow. 3 modes (chat/visual/yaml).
Gate failure en 3 couches (diagnostic → guidance → escalade). 13 composants UI nouveaux.
