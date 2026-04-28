# Brainstorm: Governed Workflows — Superpowers & Plan

**Date:** 2026-04-16
**Participants:** the maintainer, Claude
**Input:** `docs/governed-workflows-scenarios.md`

---

## Clarifications fondamentales (the maintainer)

### 1. Workflows forcés = universels, pas liés au niveau d'autonomie
Les workflows sont **imposés à TOUT LE MONDE**, quel que soit le niveau d'autonomie.
La différence : un dev expérimenté passera les gates plus facilement (son code passe les reviews, ses tests sont bons), mais il ne les skip pas.
→ L'autonomie ne réduit pas les gates, elle réduit la friction pour les passer.

### 2. Gates = système générique et pluggable
Les gates ne sont PAS limitées à du scoring ou des reviews. Un gate peut être **n'importe quoi** :
- Scoring agent (review panel)
- Critères d'acceptance (ACs)
- Résultats de tests E2E
- Contrat de schéma (API contract, DB schema validation)
- LLM-as-judge
- Review humaine
- Check CI/CD
- Custom (script, webhook, etc.)

→ **Gate = interface générique avec un résultat pass/fail + metadata**

### 3. Workflow composition = hiérarchique
Les workflows doivent pouvoir se composer et s'imbriquer.
Ex: `bugfix` contient `review-gate` qui contient `scoring-contract`.
`skill-creation` contient `test-gate` + `marketplace-proposal`.

### 4. Nightly Synthesis améliore les workflows (versionné git)
Le système de consolidation nocturne doit :
- Lire TOUS les workflows et leur historique d'exécution
- Analyser les feedbacks utilisateurs sur chaque workflow
- Identifier les axes d'amélioration
- **Proposer** les améliorations aux users OU les **appliquer automatiquement** avec changelog
- Les workflows doivent être **versionnés sur git** pour faciliter le suivi/rollback

→ C'est le même concept que le point 5 (Sensei qui crée/ajuste des workflows)

### 5. Format = YAML + fonctions/scripts avec I/O standardisé
Pas que du YAML déclaratif. Les gates peuvent être des **scripts/fonctions** avec des entrées/sorties standardisées.
→ Analogie GitHub Actions : YAML pour l'orchestration, scripts pour la logique custom.

### 6. Création/modification via MnM, pas via git PR
N'importe qui peut créer/modifier un workflow, mais **via MnM** (pas via PR git directement).
Un **workflow orchestrator agent** aide à créer/modifier les workflows.
La visibilité est contrôlée par **tags + permissions** (comme tout dans MnM).
Git est le backend de stockage/versioning, pas l'interface utilisateur.

### 7. Gates custom = à designer (demande un truc "pépite")
the maintainer ne sait pas encore comment les gates custom doivent fonctionner, mais veut quelque chose d'exceptionnel.

### 8. Nightly auto-apply = opt-in par le lead
- Par défaut : approbation humaine (propositions)
- Opt-in par le lead pour certains mini-changements : auto-apply + changelog
- La plupart resteront en mode "proposé"

---

## Analyse : LangChain/LangGraph pour les workflows ?

### Ce que LangGraph fait bien
- Graphes d'exécution avec état (StateGraph)
- Branchement conditionnel entre nœuds
- Human-in-the-loop natif
- Checkpoints / persistence d'état
- Streaming des résultats intermédiaires

### Pourquoi c'est probablement PAS le bon choix pour MnM
1. **Python-only** — MnM est full TypeScript. Introduire Python = complexité stack
2. **Couplage LangChain** — LangGraph est pensé pour des chaînes LLM. Les workflows MnM sont des pipelines de GOVERNANCE, pas des chaînes de prompts
3. **XState existe déjà dans MnM** — `WorkflowEnforcer` utilise déjà XState pour les state machines
4. **Overkill** — LangGraph gère le streaming de tokens, la mémoire conversationnelle, etc. MnM a besoin d'un DAG executor avec des gates typées

### Ce qui est pertinent dans LangGraph (à voler)
- Le concept de **state** qui traverse le graphe (chaque nœud lit/écrit dans un état partagé)
- Le pattern **human-in-the-loop** avec interruption + reprise
- Les **checkpoints** pour reprendre un workflow interrompu
- La **visualisation du graphe** (MnM devrait afficher le workflow visuellement)

### Alternative recommandée : pattern "GitHub Actions pour la gouvernance"
GitHub Actions = YAML orchestration + actions pluggables + marketplace
MnM Workflows = YAML orchestration + gates pluggables + skills marketplace

---

## Modèle technique : Gate = contrat universel

### L'interface Gate (standardisée)

```typescript
interface GateInput {
  context: WorkflowContext     // issue, agent, projet, KG enrichi
  artifact: Artifact           // ce qui est évalué (diff, PR, spec, build...)
  config: Record<string, any>  // params spécifiques à ce gate
}

interface GateOutput {
  pass: boolean
  score?: number               // 0-10, optionnel
  report: string               // explication lisible humain
  evidence: Evidence[]         // preuves (liens, screenshots, logs)
  suggestions?: string[]       // "pour passer, fais X"
}
```

### 4 types d'implémentation de gate

1. **Builtin** — fourni par MnM (test-runner, schema-validator, coverage-check...)
2. **Agent** — un agent MnM review avec son prompt/MCP/skills
3. **Script** — fonction TS/Python, reçoit GateInput stdin, retourne GateOutput stdout
4. **Webhook** — service externe, POST GateInput, attend GateOutput

Les 4 partagent le même contrat I/O → boîte noire interchangeable.

### Un gate peut devenir un skill marketplace
Script custom → fonctionne bien → publié marketplace → branché par d'autres équipes.

---

## Analogie GitHub Actions pour la gouvernance IA

```
GitHub Actions                    MnM Governed Workflows
─────────────                    ──────────────────────
.github/workflows/*.yml          .mnm/workflows/*.yml
Steps avec run: ou uses:         Steps avec gates: (pluggables)
Actions marketplace              Skills/Gates marketplace
Secrets/env                      Context KG + tags
Triggers (push, PR)              Triggers (intent chat, MCP call, event)
Matrix / parallel                Gates parallèles
Artifacts                        Artefacts versionnés
```

Différence fondamentale : GH Actions exécute du CODE. MnM Workflows exécutent des JUGEMENTS.

---

## Workflow Orchestrator Agent

L'utilisateur ne touche jamais le YAML. Un agent spécialisé :
- Génère le YAML depuis une conversation naturelle
- Le versionne sur git
- Notifie les leads avec le diff
- Gère les modifications itératives

---

## Session 2 — Brainstorm approfondi

### Angle 1 : Lifecycle complet d'un workflow

```
CRÉATION          PUBLICATION       EXÉCUTION         OBSERVATION        ÉVOLUTION
─────────         ───────────       ─────────         ───────────        ─────────
the maintainer chat MnM      Tags/permissions  Trigger           Métriques          Nightly Synthesis
  │                 │                 │                 │                  │
  ▼                 │                 ▼                 ▼                  ▼
Orchestrator      Qui voit ?       Session créée     Taux pass/fail    Propositions
Agent génère      Qui utilise ?    Gates évalués     Temps moyen       d'amélioration
le YAML           Company-scoped?  Résultat final    Bottlenecks         │
  │                 │                 │               Feedbacks users     ▼
  ▼                 │                 ▼                                 PR auto ou
Git commit        Scope:           Artefacts                           proposée
(branche)         - private        stockés
  │               - team (tags)      │
  ▼               - company          ▼
Review par        - marketplace    Historique
lead/team                          d'exécution
  │                                (immutable)
  ▼
Merge = actif
```

**L'exécution est immutable.** Un workflow run utilise la version au moment du trigger.
Même si quelqu'un modifie le workflow pendant l'exécution, le run en cours garde sa version.
Comme un CI/CD pipeline.

---

### Angle 2 : Triggers — qu'est-ce qui démarre un workflow ?

```yaml
workflow: bugfix
  triggers:
    # 1. Explicite — l'utilisateur demande
    - type: intent
      patterns: ["corrige", "fix", "bug", "répare"]
      channel: [chat, mcp]

    # 2. Événement — quelque chose se passe
    - type: event
      source: jira
      condition: "issue.type == 'bug' && issue.assignee.in(company.members)"

    # 3. Automatique — un agent décide
    - type: agent
      agent_id: cao
      condition: "anomaly.severity >= 'high'"

    # 4. Schedulé — cron
    - type: schedule
      cron: "0 9 * * MON"

    # 5. Chaîné — un autre workflow finit
    - type: workflow_completed
      workflow: code-review
      condition: "result.pass == true"
```

**Trigger chaîné** = méga-workflows sans imbrication. Un "release" se déclenche quand 3 "feature" sont OK.

---

### Angle 3 : Failure modes — quand un gate fail

```yaml
gates:
  - gate: mnm/test-runner
    on_failure: block                          # Défaut : bloque et explique

  - gate: agent/security-review
    on_failure: block_with_override            # Override avec justification tracée
    override_requires: [lead_approval]

  - gate: mnm/lint-check
    on_failure: warn                           # Warning, ne bloque pas

  - gate: agent/perf-benchmark
    on_failure: retry                          # Retry auto (flaky tests)
    max_retries: 2
    delay: 30s
```

**`block_with_override`** : bypass tracé et auditable.
"teammate-A a overridé security-review sur bugfix/FEAT-001, approuvé par the maintainer, raison: hotfix prod."

**`warn`** : informatif, pas bloquant. "Score maintenabilité 4/10" — dans le rapport, mais on continue.

---

### Angle 4 : State partagé qui traverse le workflow

Concept volé à LangGraph. Chaque workflow a un **contexte enrichi cumulatif** :

```
Step 1: context-gathering
  Input:  { issue: "FEAT-001" }
  Output: { issue, jira: {...}, sentry: {...}, kg: {...} }

Step 2: implementation
  Input:  ← hérite du contexte enrichi
  Output: { ...prev, diff: "...", files_changed: [...] }

Step 3: pre-commit gates
  Input:  ← hérite de TOUT le contexte
  → Le gate security-review VOIT Sentry + KG + diff
  → "Cette zone a eu 3 incidents sécu (KG), et le diff touche la même zone. Score: 3/10."
```

**Superpower** : le gate ne review pas dans le vide. Il a toute l'histoire du workflow.
Le gate sécu sait que ce module est sensible PARCE QUE le step 1 a injecté le contexte KG.
→ C'est la connexion **KG Memory × Workflows**.

---

### Angle 5 : Visualisation UI des workflows

Pipeline view (inspiré GitLab CI mais pour la gouvernance) :

```
┌─────────────────────────────────────────────────────────┐
│  Workflow: bugfix/FEAT-001                    v3 ⚙️      │
│  Lancé par: teammate-A  •  Il y a 2h  •  En cours           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✅ Context Gathering ·········· 12s                    │
│     Jira ✓  Sentry ✓  KG ✓                             │
│                                                         │
│  ✅ Implementation ············· 1h 34m                 │
│     12 files, +340 -28                                  │
│                                                         │
│  🔄 Pre-commit Gates                                   │
│     ├─ ✅ test-runner ·········· 80.2% coverage         │
│     ├─ ✅ schema-contract ······ API v2 compat ✓       │
│     ├─ ❌ security-review ······ Score: 4/10            │
│     │     "SQL injection risk in query builder"         │
│     │     [Voir rapport] [Override ⚠️]                  │
│     └─ ⏳ perf-benchmark ······· En attente             │
│                                                         │
│  ⬚ Merge ······················ Bloqué                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  📊 Contexte : Jira + Sentry (3 stacks) + KG (2 ADRs) │
└─────────────────────────────────────────────────────────┘
```

Chaque step cliquable, chaque gate montre son rapport, contexte enrichi visible.

---

### Angle 6 : Templates et héritage

```yaml
# Template MnM (fourni par défaut)
template: mnm/bugfix-standard
  steps:
    - context-gathering
    - implementation
    - pre-commit:
        gates: [test-runner, lint]
    - merge:
        gates: [human-review]

# Company your organization override
workflow: bugfix
  extends: mnm/bugfix-standard
  overrides:
    pre-commit:
      gates:
        - test-runner          # gardé
        - lint                 # gardé
        - security-review      # AJOUTÉ
        - schema-contract      # AJOUTÉ
    merge:
      gates:
        - human-review         # gardé
        - lead-approval        # AJOUTÉ
```

**Héritage** : la company hérite du template, override ce qu'elle veut.
Si MnM met à jour le template, la company reçoit la mise à jour pour les parties non-overridées.

**Marketplace-ready** : templates "Banking compliance", "Healthcare HIPAA", "Startup fast-move".

---

### Angle 7 : A/B testing de workflows

```yaml
experiment: bugfix-with-ai-precheck
  control: bugfix-v3           # workflow actuel
  variant: bugfix-v4           # avec gate AI pre-check ajouté
  split: 50%
  metrics:
    - time_to_merge
    - gate_pass_rate
    - post_merge_incidents
  duration: 2_weeks
```

Après 2 semaines, Nightly Synthesis analyse :
"v4 augmente le temps de 8 min mais réduit les incidents post-merge de 40%. Recommandation : adopter v4."

**Data-driven process improvement.** Personne ne fait ça aujourd'hui.

---

### Angle 8 : Emergency bypass — hotfix prod

```yaml
workflow: emergency-hotfix
  triggers:
    - type: intent
      patterns: ["hotfix", "prod down", "urgence", "P0"]

  steps:
    - context-gathering:
        gates: []
        auto_enrich: [sentry, logs]

    - implementation:
        gates: []

    - fast-commit:
        gates:
          - gate: mnm/test-runner
            config: { suite: "smoke", timeout: 2m }
          - gate: mnm/security-scan
            on_failure: warn

    - merge:
        gates:
          - gate: human-review
            config: { required_approvals: 1, from_roles: ["lead", "oncall"] }

  # POST-WORKFLOW : dette technique automatique
  on_complete:
    - create_issue:
        title: "Post-mortem + review complète de ${hotfix.ref}"
        workflow: post-hotfix-review
        deadline: 48h
```

**Clé** : le hotfix bypass les gates lourds mais CRÉE UNE DETTE automatiquement.
Un workflow `post-hotfix-review` se déclenche avec deadline 48h.
On ne perd jamais la gouvernance, on la DIFFÈRE.

---

### Angle 9 : Feedback loop utilisateur

```
Workflow terminé → notification :

  "Workflow bugfix/FEAT-001 terminé ✅ (2h 12m)

   Comment s'est passé ce workflow ?
   👍 Fluide    😐 OK    👎 Friction    🚫 Bloquant

   [Commentaire optionnel]"
```

Ces feedbacks alimentent la Nightly Synthesis :
- "23% de 👎 cette semaine sur le gate security-review"
- "Commentaire récurrent : 'security review trop long pour des one-liners'"
- Proposition : "Ajouter condition `if diff.lines < 20 → skip security-review`"

---

### Angle 10 : Workflows × Multi-tenant — cascade de scopes

```
MnM Platform
  └─ Templates globaux (mnm/bugfix-standard, mnm/feature-standard...)
      │
      ▼
  Company your organization
    └─ Workflows company (extends templates)
        │
        ▼
    Team Backend (tag: backend)
      └─ Overrides team (gates supplémentaires, thresholds différents)
          │
          ▼
      Projet Auth-Service (tag: auth)
        └─ Overrides projet (gate sécu renforcé sur ce projet spécifique)
```

**Cascade** : Platform → Company → Team → Projet.
Chaque niveau peut **ajouter ou resserrer**, jamais relâcher (sauf override admin explicite).

---

## Clarifications Session 2 (the maintainer)

### 11. Pas de "workflow bloqué" — timeouts + max tokens + CAO watchdog
Un workflow n'est pas "bloqué" au sens humain. C'est le système qui gère :
- **Timeout par step** et/ou **global** sur le workflow
- **Max tokens par stage** ou global (budget de consommation)
- **Le CAO watchdog** surveille de toute façon tout et verrait un workflow qui tourne en boucle
→ Pas de dashboard "stuck workflows", c'est géré par design.

### 12. Métriques / analytics = validé
Throughput, lead time, bottleneck analysis, gate fail heatmap — à garder.

### 13. Gates parallèles vs séquentiels — à designer
the maintainer ne sait pas encore. À creuser.

### 14. Conditions dynamiques sur les gates — validé
"Run ce gate SEULEMENT SI le diff touche `api/`" — concept validé.

### 15. Lien Scoring Contracts / Gates — à designer
the maintainer ne sait pas encore. À creuser.

### 16. Dry-run workflow = NON. Dry-run gate par gate = OUI
Pas utile de simuler un workflow entier. Par contre, **tester un gate individuellement**
sur un artifact donné = utile pour le dev/debug de gates custom.

### 17. CAO = watchdog des gates LLM
Le CAO ne supervise pas TOUS les workflows — il vérifie spécifiquement que les gates
qui utilisent du **LLM-as-judge** sont respectées (pas de hallucination, pas de pass injustifié).
Le CAO est le **méta-juge** des juges LLM.

---

## Session 3 — Brainstorm approfondi (suite)

### Angle 11 bis : Workflow budget = contrat de ressources

Un workflow n'est pas juste un pipeline de gates — c'est un **contrat de ressources** :

```yaml
workflow: bugfix
  budget:
    timeout: 4h                    # global
    max_tokens: 500k               # budget LLM total
    max_cost: $2.50                # cap financier optionnel

  steps:
    - context-gathering:
        timeout: 2m
        max_tokens: 50k
    - implementation:
        timeout: 3h
        max_tokens: 300k
    - pre-commit:
        timeout: 15m
        max_tokens: 100k
        gates:
          - gate: agent/security-review
            timeout: 5m
            max_tokens: 30k
```

**Pourquoi c'est puissant :**
- Cost governance en + de quality governance
- Agent en boucle → timeout tue → pas besoin de dashboard stuck
- CAO voit les dépassements comme anomalies
- Nightly analyse : "feature-creation dépense 800k tokens, 60% dans llm-judge. Optimiser."
- Multi-tenant : budget global mensuel par company, réparti par team/projet via tags

---

### Angle 17 bis : CAO = méta-juge des gates LLM

Le problème des gates LLM-as-judge : trop laxiste, trop strict, ou incohérent.

```
Gate LLM-as-judge → verdict
         │
         ▼
CAO (async, arrière-plan) :
  1. Lit verdict + diff + contexte
  2. Compare avec verdicts passés (KG Memory) sur diffs similaires
  3. Vérifie cohérence :
     "Ce gate a passé un diff avec SQL raw ?
      Les 3 derniers similaires ont été rejetés. Incohérence."
     → ALERTE lead
     → Optionnel : REVOKE le pass
  4. Stocke le verdict dans le KG pour comparaisons futures
```

**Stratégie de vérification (contrôle qualité industriel) :**
- 100% des verdicts sur modules "high risk" (tag KG)
- ~20% échantillon aléatoire sur le reste
- 100% des overrides (quelqu'un a forcé un pass)

---

### Angle 14 bis : Conditions dynamiques — le contexte décide

```yaml
gates:
  # Condition artifact
  - gate: agent/security-review
    when: "artifact.files_changed.any(f => f.startsWith('api/'))"

  # Condition KG (historique du module)
  - gate: agent/deep-security-review
    when: "context.kg.module_risk_score > 7"

  # Condition métriques acteur (coaching intégré)
  - gate: agent/mentoring-review
    when: "context.actor.metrics.security_pass_rate < 0.6"
    # → Dev qui échoue souvent au gate sécu = review pédagogique

  # Condition budget restant
  - gate: agent/perf-benchmark
    when: "workflow.budget.remaining_tokens > 50000"
    # → Skip si plus de budget. Workflow reste dans l'enveloppe.
```

**Le mentoring-review conditionnel** : pas de l'autonomie différenciée (gates identiques),
mais du **coaching intégré dans le workflow**. Rejoint la clarification de the maintainer :
tout le monde passe les gates, les expérimentés passent plus facilement,
et les conditions s'adaptent pour aider ceux qui en ont besoin.

---

### Angle 15 bis : Scoring Contract = gate composite

Un Scoring Contract (brainstorm 3 piliers) **EST** un gate de type "panel" :

```yaml
- gate: scoring-panel
  contract: "dev-stage-review"
  config:
    dimensions:
      - name: security
        gate: agent/security-reviewer
        weight: 30
        threshold: 7
      - name: maintainability
        gate: agent/code-quality
        weight: 25
        threshold: 6
      - name: test_coverage
        gate: mnm/coverage-check
        weight: 20
        threshold: 80%
    aggregation: weighted_average
    global_threshold: 7
```

- **Gate** = évaluation unique (pass/fail + score)
- **Scoring contract** = gate qui orchestre N sous-gates avec pondération + seuil global
- Même contrat I/O → branchable n'importe où comme n'importe quel gate
- Composable : scoring contract dans scoring contract (hiérarchie)

---

### Angle 16 bis : Gate dry-run = TDD pour les gates

```
the maintainer: "Teste mon gate check-api-backward-compat sur un vrai diff"

MnM: dry_run_gate({
  gate_id: "check-api-backward-compat",
  artifact: { type: "diff", ref: "abc123" },
  context: { project: "auth-service" }
})
→ pass: false, score: 4
  "Breaking change: champ 'userId' renommé sans alias"

the maintainer: "Teste-le sur les 10 derniers diffs du module auth"

MnM: batch_dry_run_gate({
  gate_id: "check-api-backward-compat",
  artifacts: { type: "last_n_diffs", module: "auth", n: 10 }
})
→ 7/10 pass, 3/10 fail, 1 faux positif identifié
→ the maintainer ajuste, re-teste, publie
```

**TDD pour les gates** : tester un gate sur des données réelles avant de le brancher en prod.
Le batch dry-run permet de **calibrer les thresholds**.

---

## Clarifications Session 3 (the maintainer) — GAME CHANGER

### 18. Un repo git PAR workflow, dans un groupe "workflows"
Structure : groupe git `workflows/` → un repo par workflow (`workflows/bugfix`, `workflows/create-app`...).
Format exact (YAML, TS, hybride) = à déterminer → agents lancés.

### 19. Nightly Synthesis = à designer → agents lancés

### 20. Workflows PAS liés aux projets/issues — invocables partout
Les workflows sont comme des **skills/tools** :
- Invocables depuis n'importe où : chat MnM, Claude.ai, MCP, API
- **Chaque étape est AUSSI invocable séparément**
- Chaque étape peut déclarer des **dépendances** à des étapes précédentes
- L'étape vérifie si ses dépendances sont satisfaites ou non
- Scoping : company, user, ou tag (comme les config layers)

→ C'est un DAG de steps invocables indépendamment, avec des contraintes de dépendance.

### 21. Marketplace single-tenant d'abord
Partage de workflows entre companies = pas MVP. D'abord single-tenant, multi-tenant plus tard.

### 22. Modèle de données = YAML source of truth, mapper pour perf
Les workflows sont des YAML versionnés sur git. Un mapper (cache/index) peut être construit
pour charger plus vite, mais le YAML reste la source de vérité. → Agent architecte lancé.

### 23. ★ GAME CHANGER : Le gate vérifie L'ÉTAT DU WORKFLOW, pas juste un artifact ★

Un gate ne vérifie pas juste "est-ce que ce code est bon". Il vérifie **l'état complet du workflow** :
- Les étapes précédentes ont-elles été jouées ?
- Les approbations humaines requises ont-elles été données ?
- Le workflow parent existe-t-il et est-il dans le bon état ?

**ET** le gate est **intelligent** (LLM-powered) :
- Il peut RAISONNER sur les équivalences : "un brainstorm live avec un PO = les 2 premières étapes du workflow"
- Il peut donner du **crédit partiel** : "je coche les 2 premières étapes car le contexte le justifie"
- Il **guide** l'utilisateur vers les étapes manquantes : "il vous manque le deploy-draft, faisons-le ensemble"
- Il **orchestre** la suite : lance l'étape manquante, demande les infos sup, notifie les bons tags

**Exemple concret (PO brainstorm → deploy) :**

```
teammate-B (PO, chat MnM) : "deploy l'app sur MnM"

MnM MCP → lance step "deploy-app" du workflow "create-app"

Gate de "deploy-app" vérifie :
  workflow "create-app" = {
    1. brainstorm         → ✅ (détecté : brainstorm live PO = valide)
    2. validation-humaine → ✅ (détecté : PO a validé dans le chat)
    3. deploy-draft       → ❌ PAS JOUÉ
    4. review-infra       → ❌ PAS JOUÉ (dépend de 3)
    5. deploy-app         → ❌ C'EST CETTE ÉTAPE
  }

Gate response :
  "Votre app a été brainstormée et n'est pas passée par toutes les étapes
   du workflow create-app. J'ai validé les étapes 1-2 (brainstorm PO live).
   
   Il manque le deploy-draft (étape 3) qui structure vos artifacts pour
   la review infra. Faisons-le ensemble avant de leur envoyer."

→ Lance step "deploy-draft"
→ Demande infos supplémentaires au PO si besoin
→ Quand terminé : notifie les membres du tag "infra"
→ Workflow stuck jusqu'à approbation infra
→ Quand infra approuve → step deploy-app se débloque
```

**Ce n'est PAS un simple pipeline linéaire.** C'est un **graphe de dépendances intelligent**
où chaque nœud peut être invoqué indépendamment, et le système raisonne sur ce qui manque.

---

## Agents lancés (recherche parallèle)

- **Architecte** : Points 18 (repo structure) + 22 (data model / YAML mapping)
- **PM** : Points 18 (product workflow authoring) + 19 (nightly synthesis product design)
- **UX** : Points 18 (user experience authoring) + 19 (nightly synthesis user experience)
- **Architecte** : Point 19 (nightly synthesis architecture technique)

---

## Résultats Agents — Synthèse condensée

### Agent Architecte (repo structure + data model)

**Format recommandé : YAML + TypeScript hybride**
- `workflow.yaml` pour la déclaration (steps, deps, budgets, triggers)
- `gates/*.gate.ts` pour la logique custom (TypeScript, type-safe, testable)
- `prompts/*.md` pour les system prompts par étape
- `tests/*.test.ts` pour tester les gates
- Composition inter-repos via `uses: workflows/brainstorm-feature@v2.1`

**Chargement : Git push webhook → Sync Worker → Parse → DB cache → In-memory cache**
- PAS de file watcher (ne scale pas en K8s)
- DB = source de vérité runtime, git = source de vérité absolue
- `definitionSnapshot` immutable dans chaque run (version au moment du trigger)

**5 tables :**
1. `governed_workflow_definitions` — cache parsé du YAML, versionné
2. `governed_workflow_runs` — instance d'exécution (= session), snapshot du YAML
3. `governed_step_executions` — chaque step (XState), deps, artifacts
4. `gate_results` — résultat de chaque gate (audit complet, I/O)
5. `governed_action_registry` — mapping action → workflow requis

**Workflow Guard = ~15 lignes dans wrappedHandler**, même pattern que le permission check.
Injection de `ctx.workflowRun` et `ctx.stepExecution` dans le handler.

**Invocation indépendante de steps :**
- Cherche un run actif pour l'actor+workflow
- Si absent → crée un run "ad-hoc" démarrant au step demandé
- Vérifie les dépendances (explicites ou via artifacts fournis)
- Le GATE décide si un artifact fourni vaut une équivalence, pas le moteur

**Templates : `extends` + `prepend_steps`**, pattern héritage YAML.
Variables interpolables, override de config.

### Agent PM (authoring + nightly synthesis)

**Authoring :**
- Time to first workflow < 5 min, en 3 échanges avec l'Orchestrator Agent
- Templates recommandés par l'agent (pas catalogue à parcourir)
- Diff visuel structuré pour changements (jamais du YAML brut pour non-tech)
- Matrice approbation : cosmétique=auto-apply 24h, opérationnel=1 lead, structurel=2 leads
- Versioning SemVer automatique, forward-only changelog, rollback sélectif

**Nightly Synthesis — 4 catégories d'insights :**
1. Alertes (action immédiate) — "gate sécu fail 78% depuis 3 jours"
2. Optimisations (amélioration continue) — "paralléliser lint+tests = -3min"
3. Suggestions structurelles — "ajouter gate migration review"
4. Propositions de nouveaux workflows — "créer hotfix-express"

**Feedback loop :** rejet avec raison = la Synthesis apprend et ne re-propose pas.
**Auto-calibration :** <50% acceptation → plus conservatrice, >80% → plus proactive.
**Digest adapté par persona :** Lead=diff, PO=impact business, CEO=tableau de bord.

### Agent UX (authoring + nightly + exécution)

**Builder : Split-pane Chat + Canvas**
- Chat Orchestrator Agent à gauche, pipeline visuel ReactFlow à droite
- 3 modes : Chat, Visual (drag-drop), YAML (caché par défaut)
- Validation en temps réel (cycles DAG, gate sans critère → badges rouges)
- Gate config panel avec dry-run intégré (test sur un run passé réel)

**Exécution par persona :**
- PO/chat : progress bar sticky en haut, gates inline dans la conversation, guidance LLM
- Dev/Claude Code : erreurs structurées avec critères échoués, suggestions, commandes
- Lead/dashboard : liste workflows actifs, détail pipeline cliquable, timeline événements

**Gate failure = 3 couches** : Diagnostic → Guidance → Escalade (override)
**Override** : motif obligatoire, pièces jointes, audit trail visible dans compliance + analytics.

**13 composants UI nouveaux :** WorkflowCanvas, StepCard, GateConfigPanel, ProgressPipeline,
ProposalCard, DiffView, OverrideDialog, WorkflowList, GateResultInline,
WorkflowTimelineEvent, HeatmapBar, TrendChart, WorkflowDashboardWidget.

### Agent Architecte Nightly (pipeline d'analyse nocturne)

**Architecture : Routine par company (système routines existant), 3 phases LLM séparées**

**Phase 1 — Agrégation SQL (pas de LLM, ~2-5s)**
ETL léger : requêtes sur les tables existantes (workflow_instances, stage_instances, cost_events,
feedback_votes, traces). Produit un `synthesis_snapshot` (JSONB pré-agrégé).

**Phase 2 — Détection d'anomalies (Haiku, ~3-5s, ~$0.002)**
Prompt structuré avec métriques. Détecte 11 types de patterns :
- Gate always passes (>95% pass, N>=10)
- Gate high failure (>40% fail, N>=5)
- Bottleneck (P95 > 2x moyenne)
- Token waste/overuse
- HITL rubber-stamp (>97% approve, N>=15)
- Temporal spikes, cross-workflow inconsistencies, etc.

**Phase 3 — Génération de propositions (Haiku, ~3-5s, si anomalies)**
Chaque proposition contient : diff structuré (path JSON + old/new value), impact chiffré, risque.
11 catégories : gate_removal, gate_condition_add, threshold_adjust, step_parallelize,
hitl_optimization, token_budget_adjust, etc.

**Filtrage anti-bruit (3 mécanismes) :**
1. Seuils d'échantillon minimum (hardcoded, pas LLM)
2. Confidence threshold (>=60% persisté, >=65% visible, >=75% auto-apply)
3. Dédup avec rejets du snapshot précédent

**Auto-apply : opt-in par company + catégories safe uniquement**
Safe : hitl_optimization, token_budget_adjust, timeout_adjust, retry_policy_adjust.
Structurel (ajout/suppression step) = JAMAIS auto-apply.

**Rollback automatique :** check à J+1, si failure rate augmente >20pp → auto-revert + notif.

**Coût : ~$0.004 par company par nuit.** 100 companies = ~$0.40/nuit. Budget max enforced à $5.

**2 nouvelles tables :** `synthesis_snapshots` (agrégats, 90j retention),
`synthesis_proposals` (lifecycle complet, retention illimitée).

**~10 fichiers à créer :** aggregator, analyzer, applier, regression checker, orchestrator,
types partagés, validateurs Zod, migration SQL.

---

## Session 4 — Le workflow comme graphe de dépendances intelligent

### Le modèle change : pas un pipeline, un contrat de dépendances

Un workflow n'est pas "étape 1 → 2 → 3 → 4 → FIN".
C'est un **ensemble de capabilities avec des contraintes de dépendance** :

```
capability: brainstorm          (requires: nothing)
capability: human-validation    (requires: brainstorm)
capability: deploy-draft        (requires: human-validation)
capability: infra-review        (requires: deploy-draft)
capability: deploy-app          (requires: infra-review)
```

Chaque capability invocable indépendamment. L'ordre d'exécution émerge des dépendances.
Deux exécutions du même workflow peuvent avoir des ordres différents.

→ C'est **déclaratif, pas impératif**. Tu déclares les contraintes. Le système résout.

### Deux types de dépendances

**Hard dependencies (déterministes) :**
```yaml
step: deploy-app
  hard_requires:
    - infra-review: { status: approved }
    - deploy-draft: { status: completed }
```
Vérification mécanique. Pas d'interprétation LLM. Le CAO n'a pas besoin de vérifier.

**Soft dependencies (résolvables par le LLM) :**
```yaml
step: deploy-draft
  soft_requires:
    - intent: "brainstorm or equivalent ideation process"
    - intent: "human stakeholder has validated the concept"
```
Le LLM résout : "le chat avec le PO = brainstorm satisfait".
Le CAO DOIT auditer ces résolutions.

**Conséquences :**
- 100% des soft resolutions loguées avec evidence
- CAO audite un sample des soft resolutions
- Si taux faux positifs > X% → alerte lead, dep convertie en hard

### Steps = Skills avec contraintes

Un step peut invoquer un skill. Le step = définition (deps, gates, budget).
Le skill = exécution (ce qui se passe concrètement).
Skills Marketplace et Workflow System partagent les mêmes primitives.

---

## Clarifications Session 4 (the maintainer)

### Le "Step Resolution Engine" n'existe pas — c'est juste le gate qui décide
Pas besoin d'un composant central de résolution. **Le gate fait son propre check comme il veut** :
- Du déterministe
- Du regex
- Du check de schema de params
- De l'analyse LLM
- N'importe quoi

**C'est la personne qui crée le gate qui décide.**

### Résolution LAZY (au moment de l'invocation)
La résolution se fait **au moment de l'invocation d'un step ou workflow**. Pas en background,
pas de scan préventif du chat. Le gate reçoit tout le contexte nécessaire au moment de
l'invocation et fait son analyse comme il veut.

→ Pas de "persistence cross-context" à gérer. Le contexte est passé au gate au moment T,
point. Si le gate veut checker le chat history, il le fait à ce moment-là.

### Pas de table `dependency_resolutions`
Un gate ça peut être N'IMPORTE quoi. Le système doit juste fournir :
- Un **contrat I/O minimal** (input standardisé, output standardisé)
- Des **paramètres "ouverts"** pour que le gate fasse ce qu'il veut

→ On reste dans le modèle "gate = boîte noire avec un contrat I/O universel".
Pas de table spécifique pour tracer les résolutions de soft deps.
Le gate_result stocke déjà tout ce qu'il faut (input, output, evidence).

---

## Session 5 — Cadrage du contrat I/O Gate (minimal, avec paramètres ouverts)

### Principe directeur (the maintainer)
**MnM doit rester le + simple et le + agnostique possible.**
Ne pas over-engineer. MnM = control plane avec primitives atomiques.
Le harness (Claude Code + Opus 4.7) orchestre grâce à des erreurs explicites.

### PAS de side_effects dans le gate output
Le gate ne lance PAS d'autres steps. Il ne notifie PAS.
Il retourne juste `pass/fail + report + errors explicites`.

**C'est le harness qui orchestre** :
1. Le harness appelle `launchStep(deploy-app)`
2. MCP retourne une erreur explicite : "deploy-draft manquant, voici l'ID du workflow"
3. Le harness appelle `getWorkflowDefinition(create-app)` pour comprendre
4. Le harness voit le DAG des dépendances
5. Le harness appelle `launchStep(deploy-draft)` tout seul
6. Puis re-tente `launchStep(deploy-app)` après

**Prérequis :** des erreurs très explicites + des tool definitions MCP bien écrites.
Avec Claude Code + Opus 4.7 + un MCP bien construit, le harness se démerde.

### Tools MCP atomiques et unitaires
Le MCP MnM expose des primitives simples :
- `launchWorkflow(workflowId, params)` — démarre un workflow
- `launchStep(stepId, workflowId?, params)` — invoque un step (avec ou sans workflow parent)
- `getWorkflowDefinition(id)` — retourne le YAML parsé
- `getWorkflowState(runId)` — retourne l'état courant d'un run
- `listWorkflows(filters)` — liste les workflows accessibles
- `listSteps(workflowId)` — liste les steps d'un workflow

Chaque tool est atomique, retourne des erreurs structurées, ne fait qu'une chose.

### Modèle d'erreur explicite (pour que le harness se démerde)

```json
{
  "isError": true,
  "error_code": "WORKFLOW_DEPENDENCY_UNMET",
  "message": "Cannot launch step 'deploy-app': dependency 'deploy-draft' not satisfied in workflow 'create-app'",
  "details": {
    "workflow_id": "create-app",
    "workflow_run_id": "run_xyz789",
    "step_id": "deploy-app",
    "missing_dependencies": ["deploy-draft"],
    "satisfied_dependencies": ["brainstorm", "human-validation"]
  },
  "hints": [
    "Call getWorkflowDefinition('create-app') to see the dependency graph",
    "Launch deploy-draft first via launchStep('deploy-draft', 'create-app')",
    "After deploy-draft completes, retry launchStep('deploy-app', 'create-app')"
  ]
}
```

Le harness reçoit ça, lit les `hints`, et sait quoi faire.

### Le gate redevient une boîte noire simple

```typescript
interface GateInput {
  context: GateContext           // tout ce que le système a rassemblé
  artifact?: any                 // ce qui est évalué (si applicable)
  config: Record<string, unknown>  // config ouverte du YAML
}

interface GateOutput {
  pass: boolean                  // IMPOSÉ
  report: string                 // IMPOSÉ — explication lisible
  error_code?: string            // SI fail — code machine-readable
  hints?: string[]               // SI fail — guidance pour le harness
  score?: number                 // optionnel
  evidence?: any[]               // optionnel
  metadata?: Record<string, unknown>  // champ libre
}
```

**C'est tout.** Pas de `side_effects`, pas de `launched_steps`, pas de `notifications`.
Le gate évalue, retourne le verdict, et c'est fini.

---

## Clarifications Session 5 (the maintainer)

### Pattern discovery-first — pas d'invocation direct
Le harness ne fait PAS `launchStep` direct. D'abord il découvre :
1. `getWorkflow(id)` → définition du workflow
2. `getSteps(workflowId)` → liste des steps + états
3. Comprend où on en est
4. PUIS `launchStep(...)` avec les bons params + contexte pour que le gate puisse faire effet

→ Le MCP ne donne PAS tout par défaut. Lazy discovery.

### Error schema minimal, pas over-engineered
Pas besoin de matrice de 20 codes avec des fields détaillés.
Un système d'erreur/message **classique** suffit.
**Toute l'intelligence est dans le CONTENU du message** que Claude Code va lire.
Un bon message + un error_code suffisent. Le harness se démerde avec ça.

### Contrainte critique : efficacité tokens
Le schema du `getWorkflowDefinition` doit être léger.
**Pas 100k tokens** juste pour la définition du graph.
→ Représentation compacte, pas un dump YAML complet du YAML+TS.

### Notifications = système backend de MnM, pas le gate
Quand un step réussit, le MCP call `stepSuccess` → MnM backend fait déterministiquement :
- Ping les bonnes personnes (tags, rôles, approbateurs requis)
- Crée une notif via **json-render** (système existant dans MnM)
- Met à jour l'inbox

→ Un **agent/modèle** prend les résultats des workflows/steps et génère les notifs.
→ Les notifs contiennent des **viewers adaptés** (git diff viewer, spec viewer, etc.)
  pour que l'humain puisse reviewer/valider facilement.
→ Connecte directement avec la **Blocks Platform** existante.

### Approbations humaines : MCP OU inbox web
Deux chemins équivalents :
- **MCP matinal** : l'user se connecte le matin, tape "quoi de beau à faire ?",
  Claude Code query MnM, liste les approbations en attente
- **Inbox web MnM** : l'user ouvre MnM dans son browser, voit sa inbox,
  review et approuve directement

Les deux canaux sont sync via l'état workflow dans la DB.

---

## Session 6 — Le scénario PO revisité avec discovery-first

```
teammate-B (chat MnM / Claude Code) : "deploy l'app"

Harness (Opus 4.7) :
  1. Appelle MCP: listWorkflows(intent: "deploy app")
     → Retourne: ["create-app", "deploy-only", ...]
  
  2. Appelle MCP: getWorkflow("create-app")
     → Retourne: structure compacte du workflow avec steps + deps
  
  3. Appelle MCP: getWorkflowState(workflow: "create-app", actor: teammate-B)
     → Retourne: "Aucun run actif. Steps brainstorm et human-validation
                  peuvent être satisfaits implicitement par le contexte chat."
  
  4. Harness analyse : "deploy-app nécessite brainstorm + validation + deploy-draft + review-infra.
     J'ai le brainstorm dans le chat. Je vais d'abord créer un run et lancer deploy-draft."
  
  5. Appelle MCP: launchStep({
       step: "deploy-draft",
       workflow: "create-app",
       context: {
         implicit_satisfied: ["brainstorm", "human-validation"],
         evidence: "chat session messages 1-47",
         app_description: "...(résumé du brainstorm)"
       }
     })
     → Gate de deploy-draft évalue, considère les implicit_satisfied comme valides,
       retourne pass + lance le step (demande des infos)
  
  6. MCP retourne : "Step lancé. Required inputs: infra_config, deploy_target"
  
  7. Harness demande à teammate-B ce qu'il manque, complète.
  
  8. Appelle MCP: completeStep(runId, artifacts: {...})
     → MnM backend détecte fin du step,
       déclenche notification via json-render vers tag "infra",
       état workflow passe à "awaiting infra-review"
  
  9. Harness dit à teammate-B : "Draft envoyé à l'équipe infra pour review."
     (teammate-B n'attend rien, son job est fini)

PENDANT CE TEMPS côté infra :
  teammate-A (infra) ouvre MnM le matin → inbox → voit "Review deploy-draft pour teammate-B"
  → Clic, viewer json-render montre le draft + diff + spec
  → Approuve ou demande modifs
  → Si approuve : backend MnM déclenche automatiquement le next step éligible
     (deploy-app devient possible)

PLUS TARD, teammate-B retourne dans le chat :
  "Comment va mon deploy ?"
  Harness appelle getWorkflowState → "Infra a approuvé. Prêt à deploy."
  Harness : "Infra a approuvé ! Je lance le deploy-app."
  → launchStep("deploy-app", ...) → réussit car toutes les deps sont satisfaites
```

**Points clés de ce modèle :**
- Le harness fait du **discovery-first** avant d'agir
- Le **contexte implicite** est passé explicitement dans les params (pas magique)
- Le **backend MnM** gère les notifs/routing automatiquement via json-render + inbox
- Les **humains sont async** — ils reviewent quand ils peuvent, le workflow est stuck en attendant
- Les **deux canaux (MCP matinal / inbox web)** sont équivalents, sync via la DB

---

## Clarifications Session 6 (the maintainer)

### Gates = points d'entrée / sortie des workflows ET des steps
- **Gate d'entrée** : valide qu'on peut lancer
- **Gate de sortie** : formate, valide que ça s'est bien déroulé, permet de passer à la suite
  (notif validation humaine, ou next step)

→ **Les gens qui créent les workflows créent les gates.** Pas de gate marketplace séparée.

### Gates ET workflows peuvent être NON-DÉTERMINISTES
C'est le point important. Un gate n'est PAS forcément un check mécanique.

**Exemple concret du workflow de dev :**
- Step "code review" → load un agent spécialisé qui fait la review sur plusieurs axes
  (produit des findings, rapports, scores)
- Gate de sortie "review OK, tout est carré" → **un autre agent** qui évalue le rapport
  (ou alternativement une step "validation" juste après, the maintainer pas sûr)

→ **Gate et Step deviennent structurellement la même chose** :
  - Un step produit un artifact
  - Un gate valide un artifact (et peut lui-même être un step/agent)
  - La différence est FONCTIONNELLE, pas structurelle

### Onboarding = the maintainer consulting + Sensei + CAO
Pas besoin de "bootstrap templates automatiques". the maintainer vendra du consulting.
- **Sensei** doit connaître MnM sur le bout des doigts → aide l'onboarding, dialogue avec les clients
- **CAO** supervise
- Le Sensei = meta-assistant expert sur MnM lui-même

### Gouvernance de la gouvernance = access logs + monitoring Sensei/CAO
Pas de système spécial d'approbation pour modifier les workflows sécu.
- **Access logs qui loguent TOUT** (existant ? à consolider ?)
- **Sensei ou CAO peut monitorer** et remonter des anomalies
  (ex: "le lead X a désactivé 3 gates sécu en 2 jours, c'est louche")

→ Trust + full transparency via logs, pas de contrainte technique bloquante.

---

## Session 7 — Gate et Step structurellement identiques

### Le modèle unifié

Un workflow c'est un **DAG de "units of work"**. Chaque unit :
- A un contrat I/O (input, output)
- Peut produire des artifacts
- Peut retourner pass/fail
- Peut être déterministe OU non-déterministe (LLM, agent)

**Distinction fonctionnelle (pas structurelle) :**

| Fonction | Rôle | Exemple |
|----------|------|---------|
| **Step** | Produit des artifacts | "code review" → produit un rapport |
| **Gate** | Valide des artifacts | "review OK ?" → pass/fail sur le rapport |

Mais techniquement, un gate PEUT être un step qui retourne pass/fail.
Et un step PEUT avoir son propre gate d'entrée/sortie.

### Implication : workflows composables à tous les niveaux

```yaml
workflow: dev-feature
  steps:
    - id: implementation
      type: agent
      agent: agent-developer
      exit_gate:
        type: builtin/artifact-exists
        config: { required: ["diff", "tests"] }
    
    - id: code-review
      type: agent
      agent: agent-code-reviewer   # agent non-déterministe
      produces: ["review_report"]
      exit_gate:
        type: agent                 # ← GATE = AGENT
        agent: agent-review-validator
        config:
          prompt: "Is this review thorough? All critical axes covered?"
          threshold: 7
    
    - id: human-approval
      type: human                    # ← step = humain
      requires_role: lead
      artifacts_to_show: ["diff", "review_report"]
```

Tout est uniforme. `type: builtin | agent | human | script | webhook`.

### Les rôles émergents

Quand on regarde ce qui se passe :
- `agent-developer` — produit du code
- `agent-code-reviewer` — produit un rapport d'audit
- `agent-review-validator` — juge si le rapport est sérieux
- `human lead` — décision finale

C'est une **chaîne d'agents avec des rôles de plus en plus méta** :
producteur → auditeur → méta-auditeur → humain.

Et à chaque niveau, un **check/gate** peut décider si on passe au suivant.

### La règle d'or pour designer un workflow

**À chaque transition entre "units of work", il faut un gate.**
Le gate peut être :
- Trivial (artifact existe ? → oui/non)
- Complexe (un autre agent juge la qualité)
- Humain (validation manuelle)

Le workflow = la chaîne de units + les gates entre elles.

---

## L'access logs qui loguent TOUT — concept à creuser

the maintainer a dit "access logs qui logs TOUT" comme point 4. Ça devrait être le **fondement de l'auditabilité** :

### Ce qui doit être logué

1. **Toutes les invocations MCP** — qui, quand, quel tool, quels params, quel résultat
2. **Tous les changements de workflows** — qui a créé/modifié/supprimé un workflow ou un gate, quand, diff
3. **Tous les résultats de gates** — input, output, evidence (déjà dans `gate_results`)
4. **Tous les overrides** — qui a bypass un gate, avec quelle raison
5. **Toutes les approbations humaines** — qui a approuvé quoi, quand
6. **Tous les changements de permissions/tags** — évolution des accès

### Architecture proposée

MnM a déjà un système `audit` (vu dans le code). Il faut vérifier qu'il couvre ces 6 catégories. Sinon, étendre.

Le Sensei et le CAO ont des **queries prédéfinies** sur ces logs :
- "Un lead a-t-il désactivé plusieurs gates sécu récemment ?"
- "Y a-t-il des patterns d'override suspects ?"
- "Un user produit-il des artifacts systématiquement rejetés ?"
- "Un workflow a-t-il été modifié juste avant un incident ?"

Le Sensei/CAO tourne ces queries périodiquement (nightly ? temps réel ?) et alerte si anomalie.

### Connexion avec la Nightly Synthesis

La Nightly Synthesis fait déjà de l'analyse sur ces données. On peut :
- Soit **étendre la Nightly Synthesis** pour inclure les patterns de gouvernance suspects
- Soit **séparer en un "Nightly Audit"** dédié à la sécurité/gouvernance

Mon instinct : les séparer. Nightly Synthesis = amélioration produit.
Nightly Audit = surveillance sécu. Deux missions différentes, deux agents différents.

---




