# Spec — Persistance des handoff artifacts entre steps de governed workflow

**Date** : 2026-04-27
**Statut** : Design acté, prêt pour plan d'implémentation
**Origine brainstorm** : [`2026-04-27-artifact-persistence-brainstorm.md`](./2026-04-27-artifact-persistence-brainstorm.md)

---

## 1. Vision

> "L'objectif grande finale c'est que CHAQUE étape puisse faire un /clear entre les étapes, et que ce qui prime ce soit le handoff entre les étapes. De sorte à ce que n'importe qui n'importe quand puisse reprendre la suite d'un workflow tant qu'il a les handoff précédent."
> — the maintainer, 2026-04-26

Aujourd'hui les artifacts produits par un step (design.md, changelog.md, etc.) ne survivent pas au filesystem local de la machine qui exécute le step. Si l'utilisateur fait `/clear`, change de machine, ou un collègue prend le relais → le step suivant ne peut pas continuer.

Le design ci-dessous résout ce problème en commitant les handoffs dans le repo Git du workflow, avec un protocole de transformation côté serveur, et un mode "clone shallow" côté harness pour que le reprenant ait les fichiers en filesystem local prêts à l'emploi.

---

## 2. Décisions actées

| # | Décision | Justification courte |
|---|----------|----------------------|
| 1 | **Schema artifact 2c** : `outputs[]` (livrables résolvables) + `data{}` (signal d'état key/value) | Sépare clairement les deux mondes, UI lisible, gates lisibles |
| 2 | **Transformation côté serveur** : le harness envoie `content` inline dans `outputs[]`, le serveur commit puis remplace par `git_sha` avant persist DB | Atomicity, un seul tool MCP, server-side knows where to commit |
| 3 | **Repo destination** : `/artifacts/runs/<run_id>/<step_id>/` dans le repo workflow (split repo prévu plus tard) | Aligned avec `/agents` et `/workflows` existants |
| 4 | **Branche éphémère** : `mnm-runs/<run_id>` pendant le run | Isolation, pas de pollution master pendant l'exécution |
| 5 | **Mode D1** (clone shallow) : le serveur envoie des refs au harness qui fait `git fetch --depth 1` de la branche, expose les fichiers dans `.mnm/handoffs/` | Tokens minimes, agent travaille avec Read/Edit natifs, expérience filesystem cohérente |
| 6 | **Resume R2** : `resume_governed_workflow_run` retourne `history[]` (steps précédents avec outputs+data+completed_by+completed_at) + `current_step` (identique à launch_step) | Données structurées, le client formate comme il veut |
| 7 | **Merge M1 + tout-merge** : à la fin du run (succeeded, failed, cancelled), `git merge --no-ff` dans master, puis delete de la branche | Master = registre permanent honnête de tous les runs |
| 8 | **Pas de tags Git par step** | `git_sha` dans `outputs[]` est aussi stable qu'un tag, évite l'explosion de tags |
| 9 | **Eager Phase 1** : le content des handoffs est inline dans le prompt du step suivant. Lazy = futur. Helper `fetchHandoff` côté gates dispo dès Phase 1 | YAGNI, on bascule lazy quand un cas réel le justifie |
| 10 | **Orchestrateur clone, pas le subagent** : c'est l'orchestrateur top-level (Claude Code principal) qui clone la branche dans `.mnm/handoffs/`. Si le step est exécuté en subagent (configurable dans `workflow.json` per-step), le subagent voit les fichiers déjà en place | Une seule logique de clone, propagation transparente au subagent |
| 11 | **Coexistence repo workflow vs repo cible** : artifacts texte produits par le workflow → repo workflow ; code applicatif modifié → repo cible référencé via `kind: external_url` | Pas de duplication du code applicatif, audit complet via les deux repos |
| 12 | **Identité Git du commit handoff = OAuth user qui complete le step** (avec fallback PAT compagnie en mode dégradé) | Aligned avec PAT-removal post-démo, audit "the contributor a committé" naturel |

---

## 3. Architecture

### 3.1 Schema artifact (envoyé par le harness à `complete_governed_step`)

```jsonc
{
  "outputs": [
    {
      "name": "design",
      "kind": "file",
      "filename": "design.md",
      "content": "# Conception FEAT-001\n\n## Contexte\n..."
    },
    {
      "name": "proto",
      "kind": "folder",
      "files": {
        "index.html": "<!doctype html>...",
        "app.js": "...",
        "styles.css": "..."
      }
    },
    {
      "name": "mr",
      "kind": "external_url",
      "url": "https://gitlab.example.com/your-username/mnm-demo-app/-/merge_requests/1"
    },
    {
      "name": "figma_mockup",
      "kind": "external_url",
      "url": "https://figma.com/file/abc/screen-1"
    }
  ],
  "data": {
    "mr_iid": 42,
    "approvals_count": 2,
    "ticket": "FEAT-001",
    "summary": "Ajout de l'export PDF dans la vue planning"
  }
}
```

### 3.2 Schema artifact (persisté en DB après transformation serveur)

```jsonc
{
  "outputs": [
    {
      "name": "design",
      "kind": "git_file",
      "path": "artifacts/runs/abc123/tech-design/design.md",
      "git_sha": "ab12c3d4e5f6...",
      "branch": "mnm-runs/abc123",
      "bytes": 2479
    },
    {
      "name": "proto",
      "kind": "git_folder",
      "path": "artifacts/runs/abc123/dev/proto/",
      "git_sha": "f9e8d7c6b5a4...",
      "branch": "mnm-runs/abc123",
      "files": ["index.html", "app.js", "styles.css"]
    },
    {
      "name": "mr",
      "kind": "external_url",
      "url": "https://gitlab.example.com/.../-/merge_requests/1"
    },
    {
      "name": "figma_mockup",
      "kind": "external_url",
      "url": "https://figma.com/file/abc/screen-1"
    }
  ],
  "data": {
    "mr_iid": 42,
    "approvals_count": 2,
    "ticket": "FEAT-001",
    "summary": "Ajout de l'export PDF dans la vue planning"
  }
}
```

### 3.3 Discriminants `kind`

| `kind` (entrée) | `kind` (persisté) | Sémantique |
|-----------------|-------------------|------------|
| `file` | `git_file` | Fichier texte unique. `content` inline → Git commit |
| `folder` | `git_folder` | Dossier de fichiers texte. `files{filename: content}` → Git commit multi-files |
| `external_url` | `external_url` | URL externe (MR, Figma, ClickUp, etc.). Pas de transformation, juste validation `https://` |

Phase 2 ajoutera : `blob` (binaire >1MB via storage S3), `git_ref` (référence vers un commit dans un autre repo), `inline_text` (contenu court non-fichier qui n'a pas vocation à être committé).

---

## 4. Flow d'exécution

### 4.1 Démarrage de step (`launch_governed_step`)

1. Le serveur récupère l'état du run et identifie le step à lancer
2. Pour chaque step prédécesseur ayant des outputs `git_file` ou `git_folder`, le serveur prépare le bloc `handoffs[]` :
   ```jsonc
   "handoffs": [
     {
       "name": "design",
       "kind": "git_file",
       "git_sha": "ab12c3d4...",
       "path": "artifacts/runs/abc123/tech-design/design.md",
       "branch": "mnm-runs/abc123",
       "destination": ".mnm/handoffs/design.md"
     },
     {
       "name": "mr",
       "kind": "external_url",
       "url": "https://gitlab.example.com/.../merge_requests/1"
     }
   ]
   ```
3. Le serveur retourne le payload complet (agent, prompt interpolé, handoffs, dispatch_mode)
4. L'orchestrateur (Claude Code top-level) :
   - `git fetch --depth 1 origin mnm-runs/<run_id>` du repo workflow (config locale dans `.mnm/repo/`)
   - Pour chaque `git_file`/`git_folder` : `git show <sha>:<path>` ou `git checkout <sha> -- <path>`, copie dans `.mnm/handoffs/<name>`
   - Les `external_url` sont transmises au prompt, l'agent les ouvre via tools si besoin
5. L'orchestrateur lance le step :
   - Si `dispatch_mode = "subagent"` (déclaré dans `workflow.json`) → `Agent({subagent_type: "mnm--<step>"})` avec le prompt + le filesystem `.mnm/handoffs/` peuplé
   - Si `dispatch_mode = "inline"` → l'orchestrateur exécute lui-même les actions du step

### 4.2 Complétion de step (`complete_governed_step`)

1. L'agent (ou l'orchestrateur en mode inline) appelle `complete_governed_step({run_id, step_id, artifact})` avec le schema entrée (4.1 hors handoffs)
2. Le serveur, dans une transaction Postgres :
   - Pour chaque `outputs[i]` avec `kind: file|folder` :
     - Construit le payload pour `gitProvider.commitMultipleFiles({branch: "mnm-runs/<run_id>", actions: [...{path, content}], message: "step <step_id>: handoff <name>", authorIdentity: <oauth_user>})`
     - Récupère le `git_sha` retourné
     - Réécrit `outputs[i]` en `kind: git_file|git_folder` avec `git_sha + path + branch`
   - Persist `governed_step_executions.artifacts_json = <transformed>`
   - Évalue les exit gates avec `ctx.artifact = <transformed>` (les gates voient déjà la forme persistée + un helper `ctx.helpers.fetchHandoff(git_sha, path)` qui résout le content via ShaCache + `gitProvider.fetchBlob`)
   - Si toutes les gates passent : marque le step `succeeded`, déclenche le suivant (ou complete le run si dernier)
   - Si une gate échoue : marque le step `failed`, persist `gate_results` (en dehors du rollback path, cf. fix F7)
3. Idempotence : si l'artifact entrant contient déjà des `kind: git_file` (au lieu de `kind: file`), le serveur skippe le commit Git (resume après crash partiel)

### 4.3 Fin de run

À la transition `running → completed|failed|cancelled` :

1. Le serveur fait un commit final sur `mnm-runs/<run_id>` avec un fichier `_run.json` qui résume l'état (status, durée, steps states, gates summary)
2. Le serveur exécute `git merge --no-ff mnm-runs/<run_id>` dans `master` du repo workflow, message structuré :
   ```
   Run <run_id>: <workflow_name> (<ticket>) — <status>

   Steps: tech-design ✓, review ✓, dev ✓, release-mgr ✓
   Started: 2026-04-27T08:00:00Z
   Completed: 2026-04-27T11:30:00Z
   Triggered by: alice@example.com
   ```
3. Le serveur supprime la branche `mnm-runs/<run_id>` (push delete)
4. Si une étape du merge échoue (race condition extrêmement improbable car répertoires disjoints) : la branche est conservée, alerte loggée, opération retentée par un job de réconciliation

### 4.4 Resume (`resume_governed_workflow_run`)

```jsonc
// MCP call: resume_governed_workflow_run({ run_id })

// Returns:
{
  "run_id": "abc123",
  "workflow_name": "feature-dev",
  "workflow_git_tag": "feature-dev/v1.0.3",
  "status": "running",
  "ticket": "FEAT-001",
  "history": [
    {
      "step_id": "tech-design",
      "state": "succeeded",
      "outputs": [/* schema 3.2 */],
      "data": {/* ... */},
      "started_at": "...",
      "completed_at": "...",
      "completed_by": "alice@example.com",
      "gate_results_summary": {"passed": 2, "failed": 0}
    }
    // ... autres steps précédents
  ],
  "current_step": {
    "step_id": "dev",
    "state": "pending",
    "agent": {/* agent definition résolue depuis git_tag */},
    "prompt": "...",  // interpolé avec les contents des handoffs eager
    "handoffs": [/* schema 4.1 step 2 */],
    "dispatch_mode": "subagent"
  }
}
```

Le client (Claude Code, UI, autre IDE) compose le message de reprise comme il veut. Phase 1 retourne strictement R2 ; un opt-in `?include_resumption_hint=true` pourra ajouter un bloc texte pré-formaté plus tard.

---

## 5. UI — Affichage des outputs dans `GovernedWorkflowRunDetail`

Aujourd'hui (`ui/src/pages/GovernedWorkflowRunDetail.tsx`) le tab "Output" montre `JSON.stringify(artifactsJson)` brut. Avec le nouveau schema :

- **Section "Livrables"** (parcourt `outputs[]`) :
  - `git_file` → ligne avec icône fichier, nom, taille, lien cliquable vers GitLab à l'URL `<repo>/-/blob/<git_sha>/<path>` + bouton "Voir le contenu" qui charge inline le content via `gitProvider.fetchBlob`
  - `git_folder` → liste collapsible des fichiers, chacun cliquable
  - `external_url` → ligne avec icône lien externe + URL cliquable + favicon si dispo
- **Section "Données"** (table key/value de `data{}`) — tableau simple, valeurs courtes
- **Tab "Gates"** inchangé

Pas de Phase 1 sur le diff entre runs : la version simple "voir le contenu d'un livrable" suffit pour le pilote. Le diff pourra venir plus tard si besoin.

---

## 6. Identité Git du commit handoff (P3)

Le serveur résout l'identité de commit dans cet ordre :

1. **OAuth user** qui a appelé `complete_governed_step` (token dispo dans `req.actor` / RLS context). `gitProvider` GitLab utilise ce token pour pousser, le commit apparaît avec l'email/nom de l'utilisateur dans `git log`
2. **Service account compagnie** si configuré explicitement (`mnm-bot@example.com` avec PAT dédié)
3. **PAT compagnie** (status quo, mode dégradé) — utilisé par `local_trusted` mode et par les flows automatiques sans user identifiable

Ce phasing est aligned avec la suppression progressive du PAT (memory `project_pat-fallback-removal.md`) : Phase 1 ajoute le code path OAuth user, Phase 2 supprime le fallback PAT après que tous les flows aient migré.

---

## 7. Pièges et points d'attention

### 7.1 Hérités du brainstorm (toujours valides)

1. **Encryption-at-rest sensitive content** — design.md peut contenir des informations internes. GitLab self-hosted your organization derrière VPN couvre le pilote. Pour SaaS futur : git-crypt ou storage layer chiffré.
2. **Race conditions** — `pg_advisory_xact_lock` côté serveur sur `complete_governed_step` (déjà en place, cf. `governed-workflows.ts:974`).
3. **Gate runner et binaires** — couvert Phase 2 quand le `kind: blob` arrivera. Phase 1 = textes uniquement.

### 7.2 Nouveaux

4. **Dispatch mode déclaratif** (P1 résolu par décision #10) — `workflow.json` doit gagner un champ `dispatch_mode: "subagent" | "inline"` par step. Default `subagent` pour préserver l'isolation. Migration : tous les steps existants restent en subagent.
5. **Taille du repo workflow au fil du temps** — 100 runs/an × 5 steps × 50KB d'artifacts = 25MB/an. Tenable pour 5 ans, mais à monitorer. Si dépassement : split repo ARTIFACTS séparé (point décision #3 prévu pour ça).
6. **Cas "workflow modifie son propre repo workflow"** — improbable (le workflow modifie le target repo, pas son propre repo de définition), mais à interdire explicitement côté validation pour éviter les boucles d'audit récursives.
7. **OAuth user expiry pendant un run long** — un run qui dure 8h peut avoir son token OAuth expiré au moment du commit. Le serveur doit attempter un refresh ; si échec, fallback sur PAT compagnie avec un warning loggé "user X token expired during run Y, fallback to PAT".
8. **`.mnm/handoffs/` pollution dans le workspace user** — il faut documenter dans le prompt orchestrateur de gitignore ce dossier dans le target repo s'il y est exposé. Idéalement le clone se fait dans un répertoire séparé (ex: `~/.mnm/cache/runs/<run_id>/handoffs/`) symlinké si nécessaire.

---

## 8. Hors scope Phase 1 (Phase 2+)

- `kind: blob` pour binaires >1MB via storage S3/MinIO
- Lazy resolution avec seuil configurable (`inline_handoffs: auto`)
- Diff entre runs dans l'UI
- Search dans les artifacts ("trouve-moi tous les design.md qui mentionnent X")
- Replay d'un run terminé (re-run à partir d'un step donné)
- Chiffrement at-rest des artifacts sensibles
- Suppression du fallback PAT compagnie (cleanup post-démo)
- Repo ARTIFACTS séparé du repo workflow (anticipé par décision #3)

---

## 9. Plan d'implémentation (haut niveau, le détail viendra avec writing-plans)

| # | Sous-tâche | Effort estimé |
|---|------------|---------------|
| **I1** | Étendre le schema d'entrée `complete_governed_step` (validation Zod) pour accepter `outputs[]` polymorphe + `data{}` | 0.5j |
| **I2** | Implémenter `commitHandoffArtifacts()` côté serveur dans `governed-workflows.ts` : extract content, commit, rewrite outputs en `git_*`. Idempotent | 1j |
| **I3** | Étendre `gitProvider` pour le commit avec `authorIdentity` (OAuth user/PAT/service account selon résolution) | 0.5j |
| **I4** | Étendre `launch_governed_step` pour produire `handoffs[]` à partir des outputs `git_*` des steps précédents | 0.5j |
| **I5** | Implémenter le clone shallow + populate `.mnm/handoffs/` côté harness (orchestrateur prompt + helper script) | 1j |
| **I6** | Helper `ctx.helpers.fetchHandoff(git_sha, path)` côté gates (`governed-workflows-helpers.ts`) | 0.5j |
| **I7** | MCP tool `resume_governed_workflow_run({run_id})` avec retour R2 | 0.5j |
| **I8** | Logique fin-de-run : commit `_run.json`, merge `--no-ff` master, delete branche | 1j |
| **I9** | UI `GovernedWorkflowRunDetail.tsx` : section Livrables + Données distinctes, liens Git cliquables | 1j |
| **I10** | Migration de `feature-dev` workflow.json + agents canoniques pour produire le nouveau schema | 0.5j |
| **I11** | Tests E2E : run complet avec artifacts texte + folder + URL externe + resume après /clear simulé | 1j |
| **I12** | Documentation utilisateur (README workflow, exemple) | 0.5j |

**Total estimé** : ~8.5j de dev. Dépendances : I2 dépend de I1 et I3 ; I4 dépend de I2 ; I5 dépend de I4 ; I8 dépend de I2.

---

## 10. Critères d'acceptation Phase 1

Le système est jugé livrable Phase 1 quand :

1. Un run de `feature-dev` peut produire `design.md` au step `tech-design`, le commit dans `mnm-runs/<run_id>` du repo workflow, et le step `dev` retrouve ce fichier dans `.mnm/handoffs/design.md` via clone shallow
2. Un utilisateur peut faire `/clear` après le step `tech-design`, appeler `resume_governed_workflow_run({run_id})` et reprendre le step `dev` à partir d'un Claude Code fresh, en ayant exactement le même contexte
3. Le run completed produit un merge `--no-ff` propre dans master du repo workflow, la branche `mnm-runs/<run_id>` est supprimée, l'historique du run est consultable via `git log master --first-parent -- artifacts/runs/<run_id>/`
4. Les commits handoff portent l'identité OAuth de l'utilisateur qui a complété le step (vérifiable via `git log --pretty=full`)
5. L'UI `GovernedWorkflowRunDetail` affiche les `outputs[]` avec liens cliquables vers GitLab et content viewable
6. Les gates exit existantes continuent de fonctionner sans modification (helper `fetchHandoff` dispo si besoin)

---

## 11. Open questions pendant l'implémentation

- **Path du clone côté harness** : `.mnm/handoffs/` (workspace courant) ou `~/.mnm/cache/runs/<id>/handoffs/` (séparé) ? À trancher au moment de I5 selon les retours UX.
- **Format du commit message handoff** — proposer un schéma standard à I2 mais pas crucial pour Phase 1.
- **Rate limit GitLab API** — un run avec beaucoup de fichiers peut générer beaucoup de calls. Vérifier les limites et batch si besoin.
