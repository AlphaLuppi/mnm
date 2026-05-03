# Composite Workflows — guide utilisateur

Un workflow **composite** est un workflow qui appelle un *autre* workflow comme sous-routine. Au runtime, le step `type: "composite"` est expandu en un **sub-run** complet, lifté à part entière, et son artifact terminal est consommé comme l'artifact du step parent.

Permet de composer des workflows réutilisables (ex. `release-engineering`, `qa-fullstack`, `security-scan`) sans dupliquer leurs DAGs dans chaque workflow business.

> Ce doc cible les utilisateurs (admin company, auteurs de workflow). L'implémentation runtime (cycle detection, fan-out cap, lazy load UI) est dans [`server/src/services/governed-workflows-composite.ts`](../../server/src/services/governed-workflows-composite.ts).

---

## Déclarer un step composite

Le DSL `workflow.json` accepte deux types de steps :

- `type: "agent"` (default) — exécuté par un agent (humain, Claude Code, runner local).
- `type: "composite"` — référence un autre workflow via `uses:`.

```json
{
  "name": "feature-dev",
  "version": "1.0.0",
  "steps": [
    {
      "id": "design",
      "type": "agent",
      "agent": "mnm--architect"
    },
    {
      "id": "build",
      "type": "composite",
      "depends_on": ["design"],
      "uses": "workflows/release-engineering@v2",
      "params": {
        "design_artifact_path": "outputs/architecture.md",
        "target_env": "staging"
      }
    },
    {
      "id": "deploy",
      "type": "agent",
      "agent": "mnm--deployer",
      "depends_on": ["build"]
    }
  ]
}
```

### Le champ `uses`

Format strict : `workflows/<name>@<ref>`.

- `<name>` : nom du workflow appelé (existe dans le repo `<company>/workflows`)
- `<ref>` : git ref. `HEAD` (latest master), un tag (`v2`, `v2.1.3`), ou un sha. Recommandé : un **tag immutable** pour la stabilité — `HEAD` peut introduire un drift inattendu si le sub-workflow est modifié pendant qu'un parent run est en cours.

### Le champ `params`

Map free-form passée au sub-run en tant que `inputs.params` du premier step. Le sub-workflow peut lire ces paramètres pour conditionner son comportement. Doit être JSON-sérialisable (pas de fonction, pas de référence circulaire).

---

## Au runtime — comment ça expand

Quand le runner atteint un step `type: "composite"` :

1. **Cycle detection** (déjà fait au launchRun via DFS statique sur le graphe `uses` — un cycle est rejeté avant d'expand). Re-vérifié au `launchCompositeStep` pour couvrir les cas runtime-introduced (cas marginal mais blindé).
2. **Depth check** : profondeur max **32** levels. Au-delà, fail avec `COMPOSITE_DEPTH_EXCEEDED`. Garde-fou contre la récursion infinie.
3. **Fan-out cap** : maximum **1000** `step_executions` par `root_run_id` (la racine de la chaîne de composites). Au-delà, fail avec `COMPOSITE_FANOUT_EXCEEDED`. Garde-fou contre une explosion combinatoire.
4. **Création du sub-run** : INSERT dans `governed_workflow_runs` avec `parent_step_execution_id` qui pointe sur le step composite parent, et `composite_run_id` sur le run parent lui-même. `root_run_id` propagé depuis la racine.
5. **Live event** `step.composite.launched` (visibility héritée du run parent) — la UI invalide la query runDetail et descend automatiquement dans le sub-run.
6. Le sub-run s'exécute **comme n'importe quel autre run** (gates, hooks, agents). Aucun pattern spécial.
7. Au terme du sub-run (terminal succeeded), le **completeStep** parent est triggered automatiquement. L'artifact final du sub-run (du dernier step terminal) est **copié** dans l'artifact du step composite parent (`outputs[]` mergés, `data{}` mergé). Live event `step.composite.completed`.
8. Le DAG parent continue normalement vers les steps suivants (`depends_on: ["build"]` → `deploy`).

Si le sub-run **fail** (n'importe quel step → `failed` ou `errored`), le step composite parent passe en `failed` avec `error_code: "SUBRUN_FAILED"`. Le run parent applique son own retry policy (s'il en a une).

---

## Cycle detection

Le DFS statique vérifie que la chaîne `uses` ne contient pas de cycle. Exemple détecté :

```
feature-dev   uses workflows/build@v1
build@v1      uses workflows/qa@v1
qa@v1         uses workflows/feature-dev@v1   ← CYCLE
```

Rejeté à `launchRun` avec `COMPOSITE_CYCLE_DETECTED` et un report listant la chaîne. Pas de tentative — le run ne démarre pas.

---

## Fan-out cap (1000 step_executions par root)

Cas mitigé : un workflow A appelle B, qui appelle C dans une boucle (via plusieurs steps composite à l'intérieur de B). La chaîne peut explorer un arbre exponentiel.

Le compteur `governed_step_executions WHERE root_run_id = <root>` est checké à chaque `launchCompositeStep`. Au 1001e step, le sub-run fail avec `COMPOSITE_FANOUT_EXCEEDED` sans tenter de l'INSERT.

C'est un garde-fou de sécurité (DOS prevention), pas une métrique business. Si tu hits la limite légitimement, c'est probablement que tu devrais **plat** ton workflow plutôt que d'imbriquer.

---

## Propagation des artifacts au parent

Le step composite parent ne tourne pas un agent — il **consomme** l'artifact du sub-run. Précisément :

- Le sub-run a un step terminal (le dernier dans le DAG, sans dépendant). Son artifact est lu via `fetchSucceededArtifacts(subRunId)`.
- Le runner copie `outputs[]` et `data{}` dans l'artifact du step composite parent (déjà committé sur le run-branch parent).
- Les `previous_artifacts` des steps **suivants** dans le run parent voient cet artifact comme s'il avait été produit par le step composite directement. Pas de cascade descendante par défaut — un step parent ne voit que l'artifact terminal du sub-run, pas l'arborescence complète.

Pour récupérer un artifact intermédiaire du sub-run depuis un step parent suivant, il faut explicitement le mettre en `outputs[]` du step terminal du sub-workflow (le sub-workflow l'expose en surface).

---

## UI — drill-down dans le run detail

La page `/workflows/<name>/runs/<runId>` affiche le DAG du run parent. Un step `type: "composite"` est rendu avec :

- Un **badge "composite"** sur la step card
- Un lien `compositeRunId` qui navigue vers le sub-run detail

Le composant `RunArtifactsTree` (artifact viewer T4) **lazy-load** les children d'un step composite via `governedWorkflowsApi.getRunStepsById(compositeRunId)` au moment du clic. La fetch est SSE-invalidated quand le sub-run émet `step.completed`.

Profondeur d'imbrication illimitée dans l'UI (tant que le runtime accepte ; cap depth = 32). L'arbre se développe au fur et à mesure que tu cliques.

---

## Pattern : workflow réutilisable + workflow business

L'usage canonical : factoriser un sub-workflow technique réutilisable et l'appeler depuis plusieurs workflows business.

```
workflows/
├── release-engineering/    ← générique : build → tests → publish
├── feature-dev/            ← business : design → uses release-engineering → deploy
├── hotfix-prod/            ← business : assess → uses release-engineering → notify
└── security-audit/         ← business : scan → uses release-engineering → report
```

L'équipe release-engineering maintient `release-engineering` (versionné via tags `v1`, `v2`). Les workflows business pinent un tag pour la stabilité, et upgrade volontairement.

C'est l'équivalent **DAG** d'un import de package : un sub-workflow est un module réutilisable, pas une copie-collée d'arbre.

---

## Limites connues / out of scope

- **Pas de retry partiel d'un sub-run.** Si un sub-run fail au step 5 sur 7, retry **tout le sub-run** depuis le début (relance via UI). Le retry granulaire requerrait un état partagé root, hors scope V1.
- **Pas de cancel cascade.** Cancel un run parent ne cancel pas les sub-runs en cours (ils continuent indépendamment). Le cancel cascade est tracké dans le V1 backlog.
- **Pas de variables shared inter-runs.** Un sub-run ne voit que ses `params` à launch ; il n'a pas accès au state du run parent (pas de variable globale, pas de message bus). C'est volontaire — l'isolation simplifie le debugging.
- **Pas d'output streaming au parent.** Le parent ne consomme l'artifact qu'au terme du sub-run (pas de streaming intermédiaire). Pour suivre la progression, le user navigue explicitement dans le sub-run.

---

## Liens utiles

- Architecture & resolver : [`server/src/services/governed-workflows-composite.ts`](../../server/src/services/governed-workflows-composite.ts)
- Migration schema : [`packages/db/src/migrations/0083_composite_workflows.sql`](../../packages/db/src/migrations/0083_composite_workflows.sql)
- Artifact viewer (qui lazy-load les sub-runs) : voir le code de `RunArtifactsTree` dans `ui/src/components/run-detail/`
- Plan de livraison T5 : [`docs/superpowers/plans/2026-05-01-enterprise-pilot-foundation.md`](../superpowers/plans/2026-05-01-enterprise-pilot-foundation.md)
