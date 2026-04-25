# Workflow démo EnterpriseCustomer — `feature-dev`

*Spec — 2026-04-25 — Tom × Claude*

## 1. Contexte et intention

Démo MnM devant l'audience plénière EnterpriseCustomer (CEO, CTO, PM/PO, lead tech, lead dev, dev,
infra). Format : 5-10 minutes, en live, sur une seule histoire.

L'angle n'est pas une démo de fonctionnalités. C'est un manifeste : **MnM permet de
prendre ce que les équipes font déjà, et de le rendre gouverné, déterministe, et
diffusable à tout EnterpriseCustomer via les settings Anthropic Console — sans construire ni
maintenir une UI custom**. La thèse "MCP-first, no UI" doit être visible dans la
démo elle-même, pas seulement énoncée.

## 2. Audience et lectures

| Persona | Ce qu'il doit retenir |
|---|---|
| CEO / CTO | Un ticket Jira → un tag de release en 5 min en live, narratif lisible. |
| PM / PO | Le process est gouverné de bout en bout, plus de "n'importe qui fait n'importe quoi". |
| Lead tech | Étape 1 (validation conception tech) : rien n'avance sans son OK explicite. |
| Lead dev | Étape 3 (review MR) : approbation humaine déterministe via GitLab. |
| Dev / infra | Gates en TS lisibles, pas de LLM-trust, audit trail complet. |
| Tous | Conclusion : 1 fichier YAML + 2 gates, diffusable à tout EnterpriseCustomer, zéro UI à maintenir. |

## 3. Hors-scope

- Implémentation d'une primitive native `kind: "approval"` dans le runtime
  (estimation 2-3 jours, post-démo, à scheduler séparément).
- Inbox UI MnM pour les approbations en attente.
- MCP tool `approve_governed_step`.
- Notifications live event sur les approbations.
- Webhooks GitLab (on s'appuie sur du polling MCP côté agent `review-watcher`).

Ces points sont reportés dans un follow-up explicite — la démo s'en passe.

## 4. Architecture du workflow

### 4.1 Steps

Quatre étapes, deux humains explicites.

```
Step 1 — tech-design        agent: senior-dev      humain à la fin (approval prompt)
   ↓
Step 2 — dev                agent: dev             100% agent
   ↓
Step 3 — review             agent: review-watcher  humain externe (GitLab MR approval)
   ↓
Step 4 — merge-tag          agent: release-mgr     100% agent
```

### 4.2 Gestion de l'humain dans la boucle

Le runtime n'a pas aujourd'hui de notion native "wait-for-human". La spec retient
deux patterns, qui se combinent :

**Pattern A — approbation forcée par prompt (utilisé en step 1)**

Le step 1 a `agent: senior-dev` (un agent Claude Code interactif). Son prompt
l'oblige à :

1. Produire `design.md`.
2. Afficher un bloc d'approbation à l'utilisateur, formulé tel quel :

   ```
   🛑 GATE D'APPROBATION — CONCEPTION TECHNIQUE

   Voici la conception proposée pour {ticket_id} :
   [contenu de design.md]

   Ton approbation explicite est requise avant l'implémentation.
   Réponds par : APPROUVÉ ou REJETÉ + raisons.
   ```

3. Attendre la réponse de l'utilisateur dans le terminal.
4. Produire un artifact dont la racine contient :

   ```json
   {
     "design_md": "<path>",
     "approval": {
       "granted": true,
       "by": "<user>",
       "message": "<réponse complète de l'utilisateur>",
       "ts": "<ISO 8601>"
     }
   }
   ```

La gate `approval-granted.gate.ts` (nouvelle, custom) vérifie que
`artifact.approval.granted === true` et que les champs sont bien renseignés. Sans
réponse humaine, l'agent ne peut pas produire l'artifact, donc la gate échoue.

**Pattern B — approbation via GitLab MR (utilisé en step 3)**

Le step 2 ouvre une MR GitLab. Le step 3 a `agent: review-watcher` (Claude Code
interactif) qui affiche l'URL de la MR, invite les reviewers humains à
l'approuver dans GitLab, et **interroge lui-même l'API GitLab via le MCP**
`mcp__plugin_gitlab_gitlab__*` pour récupérer le nombre d'approvals. Quand le
compte est suffisant, l'agent produit l'artifact :

```json
{
  "gitlab_project":  "example-org/mnm-demo-app",
  "mr_iid":          42,
  "mr_url":          "https://lab.enterprise.example/.../merge_requests/42",
  "approvals_count": 2,
  "approvers":       ["alice", "bob"],
  "checked_at":      "2026-04-25T14:32:00Z"
}
```

La gate `mr-approved.gate.ts` (nouvelle, custom) lit `ctx.artifact.approvals_count`
et le compare à `config.min_approvals`. **La gate elle-même n'a aucun accès
réseau** : les gates s'exécutent dans isolated-vm côté serveur MnM, sans fs ni
network. C'est l'agent qui fait l'appel MCP, c'est la gate qui vérifie le résultat.
Audit-friendly : l'artifact horodaté est conservé dans la trace du run, donc on
peut toujours vérifier *a posteriori* que les approvals déclarés correspondent à
l'état réel de GitLab.

### 4.3 Spec workflow.json

```json
{
  "apiVersion": "mnm/v1",
  "kind": "GovernedWorkflow",
  "name": "feature-dev",
  "description": "Démo EnterpriseCustomer — De Jira à la prod, gouverné. 4 steps, 2 humains explicites.",
  "variables": {
    "ticket_id":      { "type": "string", "required": true },
    "gitlab_project": { "type": "string", "required": true }
  },
  "steps": [
    {
      "id": "tech-design",
      "deps": [],
      "agent": "senior-dev",
      "prompt_context": {
        "ticket_id": "{{variables.ticket_id}}"
      },
      "required_tools": ["mcp__plugin_atlassian_atlassian__*"],
      "gates": {
        "exit": [
          { "id": "design-exists",   "source": "./gates/artifact-exists.gate.ts",
            "config": { "field": "design_md" } },
          { "id": "approval-granted", "source": "./gates/approval-granted.gate.ts" }
        ]
      }
    },
    {
      "id": "dev",
      "deps": ["tech-design"],
      "agent": "dev",
      "prompt_context": {
        "ticket_id":      "{{variables.ticket_id}}",
        "gitlab_project": "{{variables.gitlab_project}}",
        "design_md":      "{{steps.tech-design.artifact.design_md}}"
      },
      "required_tools": [
        "mcp__plugin_gitlab_gitlab__*"
      ],
      "gates": {
        "exit": [
          { "id": "mr-opened", "source": "./gates/mr-opened.gate.ts" }
        ]
      }
    },
    {
      "id": "review",
      "deps": ["dev"],
      "agent": "review-watcher",
      "prompt_context": {
        "gitlab_project": "{{variables.gitlab_project}}",
        "mr_iid":         "{{steps.dev.artifact.mr_iid}}"
      },
      "required_tools": ["mcp__plugin_gitlab_gitlab__*"],
      "gates": {
        "exit": [
          { "id": "mr-approved", "source": "./gates/mr-approved.gate.ts",
            "config": { "min_approvals": 2 } }
        ]
      }
    },
    {
      "id": "merge-tag",
      "deps": ["review"],
      "agent": "release-mgr",
      "prompt_context": {
        "gitlab_project": "{{variables.gitlab_project}}",
        "mr_iid":         "{{steps.dev.artifact.mr_iid}}"
      },
      "required_tools": ["mcp__plugin_gitlab_gitlab__*"],
      "gates": {
        "exit": [
          { "id": "changelog-exists", "source": "./gates/artifact-exists.gate.ts",
            "config": { "field": "changelog_md" } }
        ]
      }
    }
  ]
}
```

## 5. Gates

### 5.1 `approval-granted.gate.ts` (nouvelle, custom)

Vérifie que l'artifact du step contient un objet `approval` valide.

**Schéma attendu dans `ctx.artifact`** :

```ts
{
  approval: {
    granted: boolean;
    by:      string;            // identifiant utilisateur
    message: string;            // réponse complète, non vide
    ts:      string;            // ISO 8601
  }
}
```

**Comportement** :

| Condition | Résultat |
|---|---|
| `approval` absent ou non-objet | `pass: false`, `error_code: "APPROVAL_MISSING"` |
| `granted !== true` | `pass: false`, `error_code: "APPROVAL_REJECTED"`, `report` cite `message` |
| `by` ou `message` vide ou non-string | `pass: false`, `error_code: "APPROVAL_INCOMPLETE"` |
| `ts` non-ISO | `pass: false`, `error_code: "APPROVAL_INVALID_TS"` |
| Tout OK | `pass: true`, `report: "approved by ${by} at ${ts}"` |

Pas de config requise.

### 5.2 `mr-approved.gate.ts` (nouvelle, custom)

Vérifie qu'une MR GitLab a obtenu un nombre minimum d'approvals, en lisant
l'artifact produit par l'agent `review-watcher`. **Pas d'appel réseau** : les
gates tournent en isolated-vm sans network. C'est l'agent qui interroge l'API
GitLab via MCP ; la gate vérifie la valeur produite.

**Config** :

```ts
{
  min_approvals: number;        // requis, >= 1
}
```

**Schéma attendu dans `ctx.artifact`** (l'agent `review-watcher` doit le produire) :

```ts
{
  gitlab_project:  string;        // ex: "example-org/mnm-demo-app"
  mr_iid:          number;        // numéro de la MR
  mr_url:          string;        // URL absolue de la MR
  approvals_count: number;        // récupéré via MCP GitLab
  approvers:       string[];      // usernames, optionnel mais recommandé
  checked_at:      string;        // ISO 8601, horodatage de l'appel MCP
}
```

**Comportement** :

| Condition | Résultat |
|---|---|
| `config.min_approvals` non-numérique ou `< 1` | `pass: false`, `error_code: "GATE_INVALID_CONFIG"` |
| `artifact.approvals_count` non-numérique ou absent | `pass: false`, `error_code: "MR_STATUS_MISSING"` |
| `artifact.mr_iid` ou `mr_url` absent | `pass: false`, `error_code: "MR_REF_MISSING"` |
| `artifact.checked_at` absent ou non-ISO | `pass: false`, `error_code: "STALE_CHECK"` |
| `approvals_count < min_approvals` | `pass: false`, `error_code: "APPROVALS_INSUFFICIENT"`, hints contient `mr_url` |
| `approvals_count >= min_approvals` | `pass: true`, `report: "MR !${mr_iid} approved by ${approvals_count}/${min_approvals} reviewers"` |

L'agent `review-watcher` est responsable d'utiliser le bon tool MCP GitLab pour
récupérer les approvals. Le plan d'implémentation identifiera le tool exact (ex:
`mcp__plugin_gitlab_gitlab__list_merge_request_approvals` ou équivalent).

### 5.3 Gates canonical réutilisées

- `artifact-exists.gate.ts` (canonical existante) — vérifie qu'un champ donné de
  l'artifact est non-vide. Utilisée pour `design.md`, `mr_iid`, `changelog.md`.
- `step-succeeded.gate.ts` (canonical existante) — vérifie que le step a réussi
  côté agent (exit code, etc.). Utilisée pour `tests-pass` au step `dev`.

## 6. Agents

Quatre agents Claude Code à définir comme fichiers Markdown dans
`agents/<name>.md` du repo workflows. Chacun a un prompt système court et ciblé.

### 6.1 `senior-dev`

**Mission** : lire un ticket Jira, produire une conception technique, demander
l'approbation explicite de l'utilisateur.

**Outils** : `mcp__plugin_atlassian_atlassian__*`, écriture de fichiers.

**Sortie attendue** : artifact JSON `{ design_md, approval: { granted, by, message, ts } }`.

**Contrainte forte du prompt** : afficher le bloc d'approbation tel quel (le texte
exact figure en §4.2 pattern A) et n'invoquer la production de l'artifact qu'après
réception d'une réponse utilisateur.

### 6.2 `dev`

**Mission** : implémenter la feature décrite dans `design.md`, écrire les tests,
ouvrir une MR.

**Outils** : `mcp__plugin_gitlab_gitlab__*`, exécution de tests.

**Sortie attendue** : artifact JSON `{ mr_iid, mr_url, branch_name, tests_passed: true }`.

**Contrainte** : TDD — les tests doivent exister et passer avant que l'agent
ouvre la MR.

### 6.3 `review-watcher`

**Mission** : afficher l'URL de la MR à l'utilisateur, attendre l'approbation
humaine via GitLab, ne rien produire de plus que la confirmation.

**Outils** : `mcp__plugin_gitlab_gitlab__*` (lecture des approvals).

**Sortie attendue** : artifact JSON `{ gitlab_project, mr_iid }` (passe-plat depuis
le step précédent, pour permettre à la gate `mr-approved` de relire les refs).

**Contrainte** : ne PAS approuver la MR lui-même. L'agent ne fait que **regarder**.

### 6.4 `release-mgr`

**Mission** : merger la MR approuvée, taguer la release, générer le changelog.

**Outils** : `mcp__plugin_gitlab_gitlab__*`.

**Sortie attendue** : artifact JSON `{ tag, changelog_md, merge_commit_sha }`.

## 7. Données de démo

Tous les artefacts sont à créer dans **lab.enterprise.example/tom.andrieu/** (perso Tom).

| Ressource | Cible |
|---|---|
| Repo workflows | `lab.enterprise.example/example-org/mnm-demo-workflows` — héberge `workflow.json`, `gates/`, `agents/` |
| Repo "feature" | `lab.enterprise.example/example-org/mnm-demo-app` — petit projet TS où la feature se développe |
| Ticket Jira | `AY-DEMO-1` (ou ID réel selon disponibilité) — titre, description, AC |
| Reviewers de la MR | 2 comptes lab.enterprise.example (un sera Tom, un sera un compte secondaire ou un collègue préparé) |

Le repo `mnm-demo-app` doit avoir un test runner fonctionnel (ex: `bun test`
ou `npm test`) pour que la gate `step-succeeded` puisse passer après le step
`dev`.

## 8. Déroulé démo (script de présentation)

| Tps | Écran | Actions / Voix off |
|---|---|---|
| 0:00–1:00 | Studio MnM, `workflow.json` | "Voici notre process feature EnterpriseCustomer, codifié dans un fichier YAML. 4 steps. Imposé." |
| 1:00–1:45 | Studio, tab gates | "Deux gates : `approval-granted` et `mr-approved`. Du TypeScript lisible, pas du prompt." |
| 1:45–3:15 | Claude Code, `launch_governed_workflow(...)` | Step 1 démarre. `senior-dev` lit le ticket, écrit `design.md`, affiche le bloc d'approbation. Tom tape `APPROUVÉ — OK pour implémentation`. Gate verte. |
| 3:15–5:00 | Claude Code + onglet GitLab | Step 2 : agent code, écrit les tests, ouvre la MR. Le diff GitLab apparaît. |
| 5:00–6:30 | GitLab + Claude Code | Step 3 : MnM affiche "MR !X en attente de 2 approvals". Tom approuve depuis un autre onglet GitLab. Gate verte automatique. |
| 6:30–7:30 | Claude Code | Step 4 : merge, tag, changelog. Run terminé. |
| 7:30–9:00 | Dashboard MnM (audit / trace) | Trail complet : qui a approuvé quoi, quand, sha de chaque step. |
| 9:00–10:00 | Slide finale | "Ce que vous avez vu : 1 fichier YAML, 2 gates TS, 4 agents. Diffusable à tout EnterpriseCustomer via les settings Anthropic Console. Zéro UI custom à maintenir." |

## 9. Composants à livrer

1. **Repo `mnm-demo-workflows`** :
   - `workflow.json`
   - `gates/approval-granted.gate.ts` + tests
   - `gates/mr-approved.gate.ts` + tests
   - `gates/artifact-exists.gate.ts` + `gates/step-succeeded.gate.ts` (copies depuis `packages/gate-runner/canonical/` ou symlinks selon contrainte du runner)
   - `agents/senior-dev.md`
   - `agents/dev.md`
   - `agents/review-watcher.md`
   - `agents/release-mgr.md`
   - `README.md` (pitch en 10 lignes pour les nouveaux)

2. **Repo `mnm-demo-app`** :
   - Petit projet TS (bun + vitest) avec une fonctionnalité minimale et un test
     existant qui passe.
   - `.gitlab-ci.yml` minimal (optionnel, si on a le temps).
   - 2 reviewers configurés sur la branche par défaut.

3. **Ticket Jira `AY-DEMO-1`** : créé manuellement, AC simples ("ajouter une
   fonction `formatPrice(amount: number): string` qui formate en EUR").

4. **Script de répétition** : checklist pre-démo (login GitLab des 2 comptes,
   ticket Jira ouvert, MnM démarré, run précédent purgé).

## 10. Risques de la démo et mitigations

| Risque | Mitigation |
|---|---|
| MCP GitLab tombe en plein live | Run de répétition la veille. Backup : screencast des steps 2-4 prêt à diffuser. |
| L'agent `dev` produit un code qui ne compile pas | Le ticket `AY-DEMO-1` est volontairement trivial (`formatPrice`). Test de répétition obligatoire. |
| L'agent `senior-dev` zappe le bloc d'approbation | Le prompt l'impose textuellement, ET la gate `approval-granted` échoue sans l'artifact `approval`, ce qui est aussi une démo possible ("regardez, sans approbation humaine, le workflow s'arrête"). |
| L'audience ne comprend pas la conclusion "diffusable via Anthropic Console" | Slide finale explicite + une phrase de Tom : "vous installerez ce plugin demain matin sans rien faire". |
| Latence MCP atlassian côté EnterpriseCustomer | Pré-charger un cache si possible, sinon afficher manuellement le ticket pendant que MnM tourne. |

## 11. Suite après la démo

À scheduler séparément si la démo passe :

- **Primitive native `kind: "approval"` dans MnM** — 2-3 jours focus full,
  inclut runtime pause/resume, endpoint `POST /approve`, MCP tool
  `approve_governed_step`, UI Inbox dans le dashboard, audit + live event.
- **Diffusion à EnterpriseCustomer via Anthropic Console** — packaging du plugin MnM avec ce
  workflow comme exemple template.
- **Vrai workflow EnterpriseCustomer AY** — adaptation de `feature-dev` aux conventions
  EnterpriseCustomer réelles (branches `feat/AY-XXXX`, conventional commits, projet GitLab AY,
  Jira AY).
