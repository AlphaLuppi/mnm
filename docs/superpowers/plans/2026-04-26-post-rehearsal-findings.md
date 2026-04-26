# Post-rehearsal findings — `feature-dev` A→Z run

**Date** : 2026-04-26 (rehearsal soir, 22h00 → 22h30 UTC)
**Run ID** : `1db1a588-8ec8-44fd-85a4-bd9c33e631cf`
**Workflow** : `feature-dev` @ `feature-dev/v1.0.2` (git_sha `ebe23aa`)
**Ticket** : [ISSUE-NN] Ajouter un formatPrice avec devise dynamique
**Résultat** : 4/4 steps succeeded — run complete.

| Step | Durée | Subagent | Artifact gates |
|------|-------|----------|----------------|
| tech-design | 3m50 | senior-dev | design-exists ✅ + approval-granted ✅ |
| dev | 18m43 | dev | mr-opened ✅ |
| review | 4m40 | review-watcher | mr-approved ✅ |
| merge-tag | 1m31 | release-mgr | changelog-exists ✅ |

MR mergée : https://lab.enterprise.example/example-org/mnm-demo-app/-/merge_requests/1
Tag créé : `v0.1.0` sur merge commit `412b79c483fa2cc606950324a0fb8429a280f9af`.

---

## 5 findings

### [F1] Mismatch `subagent_type` — bug serveur, FIXÉ

**Symptôme** : `launch_governed_step` retourne `subagent_type: "mnm--senior-dev"`. Claude Code refuse le dispatch : `Agent type 'mnm--senior-dev' not found. Available agents: ..., senior-dev, ...`.

**Cause** : le `.md` matérialisé sous `~/.claude/agents/mnm--senior-dev.md` contient le YAML frontmatter brut récupéré depuis GitLab (`agents/<name>/agent.md`) avec `name: senior-dev` (sans préfixe). Claude Code charge l'agent par le `name` du frontmatter, pas par le filename. Donc le serveur dit `mnm--senior-dev`, Claude Code expose `senior-dev` → contrat cassé.

**Fix** : `loadCanonicalAgent` et `setupWorkspace` réécrivent désormais la ligne `name:` du frontmatter pour qu'elle matche le nom préfixé `mnm--<name>`. La sha est calculée sur le contenu réécrit (le ShaCache continue de stocker le blob brut). Voir commit dédié.

**Impact** : aligne la dispatch côté Claude Code avec la convention de namespacing `mnm--*` (anti-collision). Le harness n'a rien à changer côté local, le contenu écrit a juste son frontmatter mis à jour à la prochaine round-trip d'AGENTS_STALE.

### [F2] Protocol `current_agents` sha — comportement valide, à documenter

**Symptôme** : la première call `launch_governed_step` avec `current_agents={}` (ou avec une mauvaise sha) retourne systématiquement `AGENTS_STALE` avec la sha attendue. C'est le mécanisme de self-correction.

**Erreur d'usage initiale** : j'avais passé `lastSyncedSha` (un workflow tag sha global venant de `last-session.json`) comme sha par-agent. Pas du tout le bon scope : la sha est sha256(contenu .md de l'agent), unique par agent et par version.

**Fix** : pas de fix code. Le protocol est sain. À documenter dans le harness côté plugin :
1. Premier dispatch : passer `current_agents: {}`.
2. Sur AGENTS_STALE, écrire `stale_agents[].content` à `target_path`, calculer sha256(content), retry avec la nouvelle sha.
3. Persister la sha-par-agent dans `last-session.json` pour les calls suivants.

Le `lastSyncedSha` du fichier `last-session.json` est un sha de l'environnement complet (sync workflow), à ne PAS confondre avec la sha-par-agent.

### [F3] Template substitution `{{steps.X.artifact.Y}}` non résolue — bug serveur, FIXÉ

**Symptôme** : `launch_governed_step` retourne `prompt_context: { "design_md": "{{steps.tech-design.artifact.design_md}}" }` — placeholder littéral, jamais interpolé. Idem pour `mr_iid: "{{steps.dev.artifact.mr_iid}}"` aux steps suivants.

**Cause** : `launchStep` appelle `buildPreviousArtifacts(run)` qui retourne `{stepId: undefined}` pour TOUS les steps (commentaire MVP : "Async reads inside a sync helper aren't possible"). `interpolatePromptContext` ne trouve pas `steps.tech-design.artifact.design_md` → renvoie le template littéral.

À l'inverse, `completeStep` (gate exit) utilise `await fetchSucceededArtifacts(db, runId)` qui produit le bon shape `{stepId: {artifact: {...}}}`.

**Fix** : remplacé les 2 appels à `buildPreviousArtifacts(run)` dans `launchStep` (entry gate + prompt interpolation) par `await fetchSucceededArtifacts(db, runId)`. Helper sync mort supprimé. Voir commit dédié.

**Impact** : les templates `{{steps.<id>.artifact.<key>}}` et `{{variables.<name>}}` sont désormais résolus à toutes les frontières (entry gate, prompt context, exit gate). Compense les workarounds de l'orchestrateur.

### [F4] SSH password popup ghost — pas reproduit, à investiguer post-démo

**Symptôme** : pendant l'exécution du subagent dev (~7m30), un dialog "Git for Windows — git@lab.enterprise.example's password" est apparu et est resté ouvert. Aucun process git/ssh actif n'est trouvé après coup. Le clone, push et MR ont tous réussi en HTTPS comme attendu.

**Hypothèses** :
- Le subagent a tenté `git push` ou `git fetch` avec une URL SSH par défaut (config locale `url.<git@...>.insteadOf`?), prompt apparaît, le subagent a basculé en HTTPS et continué — le dialog est resté en ghost UI.
- Ou : un git credential helper Windows tente SSH avant HTTPS dans certaines conditions.
- Ou : un sub-process spawné par un outil annexe (vitest-isolated, `git diff-tree`?) a tenté SSH.

**Mitigation immédiate** : Cancel le dialog n'a aucun impact (pas de process bloquant). Pas bloquant pour la démo lundi.

**À faire post-démo** : reproduire en ciblant l'étape exacte (clone? push? CRLF check?), ajouter un `GIT_TERMINAL_PROMPT=0` dans l'env du subagent dev pour fail-fast au lieu de prompter.

### [F5] Gate `mr-approved` vs `approved: true` GitLab — design correct, à valoriser dans le pitch

**Observation** : sur un projet GitLab sans rule d'approbation (`approvals_required: 0`, `rules: []`), l'API retourne `approved: true` même avec `approved_by: []`. C'est une "auto-mergeabilité" structurelle (rien ne bloque), pas une approbation humaine.

Le subagent review-watcher a refusé de fabriquer `approvals_count: 1` à partir de `approved: true` malgré la pression du contexte ("Tom a déjà approuvé"). Il a bloqué tant que `approved_by[]` était vide. Tom a dû effectivement cliquer le bouton Approve pour débloquer.

**À call out pendant le pitch** :
> "Le projet n'a aucune règle d'approbation côté GitLab — l'API dit 'approved: true' par défaut. Mais regardez : le harness exige une vraie signature humaine dans `approved_by[]`. C'est ça la gouvernance — on ne fait pas confiance à GitLab pour décider qu'une MR est review, on exige un humain dans la boucle."

**Pas de fix code.** L'agent review-watcher a appliqué ses hard rules correctement, le gate fonctionne comme prévu.

---

## Mesures concrètes appliquées

| # | Action | Statut |
|---|--------|--------|
| F1 | Réécriture YAML `name: mnm--<x>` côté serveur (loadCanonicalAgent + setupWorkspace) | ✅ commit |
| F2 | Doc protocol sha-par-agent dans ce fichier | ✅ |
| F3 | Async `fetchSucceededArtifacts` dans launchStep entry gate + prompt interpolation, suppression du helper sync mort | ✅ commit |
| F4 | À reproduire post-démo + `GIT_TERMINAL_PROMPT=0` dans env subagent | 🔵 différé |
| F5 | Talking point pitch | 🔵 demo |

## Non-régressions à vérifier

- [ ] Les 4 agents matérialisés ont bien `name: mnm--<x>` après next AGENTS_STALE round-trip.
- [ ] `subagent_type=mnm--senior-dev` dispatchable côté Claude Code après `/reload-plugins`.
- [ ] Un nouveau run `feature-dev` retourne `prompt_context.design_md = "design.md"` (résolu, pas littéral) au step `dev`.
- [ ] Les tests `governedWorkflowService — loadCanonicalAgent` continuent de passer (cf. `server/src/services/__tests__/governed-workflows.test.ts:1359`).
- [ ] Les e2e `t6-bootstrap-and-launch` et `feature-dev-techdesign` tournent vert en CI Linux.
