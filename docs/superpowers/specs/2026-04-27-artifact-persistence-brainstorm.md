# Brainstorm — Persistance des handoff artifacts entre steps

**Date** : 2026-04-27
**Origine** : Tom — "L'objectif grande finale c'est que CHAQUE étape puisse faire un /clear entre les étapes, et que ce qui prime ce soit le handoff entre les étapes. De sorte à ce que n'importe qui n'importe quand puisse reprendre la suite d'un workflow tant qu'il a les handoff précédent."
**Question** : où vivent les fichiers (.md, builds, logs) produits par un step et consommés par le suivant ?

---

## 1. État des lieux factuel

### Comment ça marche aujourd'hui

Quand un subagent (`senior-dev`, `dev`, `release-mgr`) tourne via `Agent({subagent_type: ...})`, il :
1. Écrit ses fichiers de travail sur le filesystem local de la machine qui exécute Claude Code (`C:\Users\tom\IdeaProjects\.../design.md`).
2. Renvoie un artifact JSON qui *référence* ces fichiers par leur nom (`{"design_md": "design.md", "files": {"design.md": {"bytes": 2479}}}`).
3. L'orchestrateur appelle `complete_governed_step(run_id, step_id, artifact)`. Le serveur persiste l'artifact JSON dans `governed_step_executions.artifacts_json` (jsonb, server/src/services/governed-workflows.ts:1024).
4. Le step suivant reçoit ce JSON via `interpolatePromptContext` (`{{steps.tech-design.artifact.design_md}}` → `"design.md"`).

**Conséquence** : seul le *nom du fichier* survit côté serveur. Le contenu vit sur le disque de la machine qui a exécuté le step. Si :
- L'utilisateur fait `/clear` entre deux steps (Tom le veut)
- Un autre user reprend le workflow (autre machine)
- Le run est repris après reboot
→ **le fichier est introuvable**, le step suivant ne peut pas continuer.

### Briques déjà disponibles

Le repo contient TROIS systèmes de stockage déjà en prod, qu'on peut potentiellement réutiliser :

1. **Tables `artifacts` + `artifact_versions`** (`packages/db/src/schema/artifacts.ts`)
   - `artifacts` : metadata (title, type, source_channel_id, source_message_id, created_by_user/agent, metadata jsonb)
   - `artifact_versions` : `content text` versionné avec `version_number`, `change_summary`
   - Conçu pour les artifacts produits via chat (sourceChannelId NOT NULL implicite par usage), MCP tools `create_artifact` / `get_artifact` / `list_artifacts` exposés.
   - **Texte uniquement** (colonne `content text`).

2. **Service `storage`** (`server/src/storage/service.ts`)
   - Object storage (S3-style) bas niveau. `buildObjectKey` = `<companyId>/<namespace>/<year>/<month>/<day>/<uuid>-<filename>`.
   - Hash sha256 content-addressable, multi-provider (S3, MinIO, FS local — `StorageProvider` interface).
   - Utilisé pour les médias chat + export traces. Supporte les binaires.

3. **`gitProvider`** (`packages/git-provider/`)
   - `commitFile()`, `commitMultipleFiles()`, `createTag()`, `fetchBlob()`.
   - Tous les workflows ont déjà un repo Git source (`tom.andrieu/mnm-demo`). Le PAT compagnie permet d'écrire dedans.
   - C'est aussi le principe philosophique : *"si MnM meurt, les .md survivent"* (cf. memory `project_mnm-philosophy.md`).

---

## 2. Options envisagées

### Option A — Inline le contenu dans `artifactsJson`

```json
{
  "files": {
    "design.md": {"bytes": 2479, "content": "# Conception\n\n..."}
  }
}
```

| Aspect | Détail |
|--------|--------|
| Migration | Aucune, juste une convention |
| Pros | Zéro infra, le handoff est literally self-contained dans la DB |
| Cons | JSONB query devient lente >100KB, pas de versioning, pas de dédup, binaire impossible (texte JSON only) |
| Aligned Git-first | ❌ |
| Complexité | S |
| Use case | Petits handoffs ≤ 50KB, en attendant mieux |

### Option B — Réutiliser `artifacts` + `artifact_versions` (DB blob)

```json
{
  "design_md": {"kind": "mnm_artifact", "artifact_id": "uuid", "version": 1}
}
```

| Aspect | Détail |
|--------|--------|
| Migration | Mineure : ajouter `source_workflow_run_id` (nullable) à `artifacts`, ou fourrer dans `metadata` |
| Pros | Tables existantes, versioning natif (`change_summary` raconte l'histoire), MCP API dispo (`get_artifact`), RLS multi-tenant déjà OK |
| Cons | `artifacts` est conçu chat-centric (sourceChannelId attendu en pratique), pas Git-first, pas portable hors MnM, texte uniquement |
| Aligned Git-first | ❌ |
| Complexité | S/M |
| Use case | Pragmatique pour shipper vite si Git-commit est trop lent à mettre en place |

### Option C — Commit dans le repo Git du workflow ⭐

```json
{
  "design_md": {"kind": "git", "git_sha": "ab12c3d", "path": "runs/<run_id>/tech-design/design.md"}
}
```

Sur `complete_governed_step`, le serveur :
1. Extrait `files[].content` de l'artifact (le harness inline-le).
2. Appelle `gitProvider.commitMultipleFiles({branch: "mnm-runs", actions: [...]})` sur le repo du workflow (`tom.andrieu/mnm-demo`) à un chemin `runs/<run_id>/<step_id>/<filename>`.
3. Remplace le `content` par le `git_sha` retourné dans l'artifact persisté.
4. Tag optionnel `run/<run_id>/<step_id>` pour les snapshots de handoff stables.

Le step suivant reçoit l'artifact résolu, et `interpolatePromptContext` peut être étendu pour fournir un helper `ctx.helpers.fetchHandoff(git_sha, path) → string` (gateway via `gitProvider.fetchBlob` + ShaCache).

| Aspect | Détail |
|--------|--------|
| Migration | Aucune (utilise l'infra Git en place) |
| Pros | **100% Git-first**, audit trail = `git log`, portable (clone le repo et tout est là), cohérent avec workflow.json + agent.md déjà en Git, "if MnM dies the .md survive" littéral |
| Cons | Git inadapté aux binaires gros (>1MB), commit pour chaque step (~1-2s par step), pollue le repo workflow avec le bruit des runs, perms : PAT compagnie doit avoir write access |
| Aligned Git-first | ✅✅✅ |
| Complexité | M |
| Use case | Texte (.md, .json, .txt, .yaml, .ts) sub-MB — **80% des cas** dans le workflow gouverné typique |

### Option D — Object storage externe (S3/MinIO via `storage` service)

```json
{
  "build_log": {"kind": "blob", "object_key": "f262468b/.../design.md", "sha256": "abc..."}
}
```

| Aspect | Détail |
|--------|--------|
| Migration | Nouvelle table `workflow_artifacts (run_id, step_id, filename, object_key, sha256)` — ou exploiter `storage_objects` si elle existe |
| Pros | Scale to TB, cheap, content-addressable natif, déjà utilisé par export-traces |
| Cons | Hors Git → pas d'audit `git log`, demande déploiement S3/MinIO en compose ou externe, GC à gérer |
| Aligned Git-first | ❌ |
| Complexité | M |
| Use case | Binaires (logs >10MB, screenshots, builds) où Git serait douloureux |

### Option E — Hybride : Git pour texte, blob pour binaire (Phase 2)

Heuristique côté serveur :
- `bytes < 100KB && ext ∈ {.md, .json, .txt, .yaml, .ts, .js, .py}` → Git (option C)
- Sinon → blob storage (option D)

Référence dans artifact JSON contient toujours `kind` + soit `git_sha` soit `object_key`.

| Aspect | Détail |
|--------|--------|
| Pros | Best of both worlds, gros bénéfice de l'audit Git pour ce qui compte, scale OK pour le reste |
| Cons | Dual-path à maintenir, GC dans deux stores, code plus dense |
| Complexité | L |
| Use case | Vision finale propre |

---

## 3. Recommandation

**Phase 1 (cette semaine, post-démo lundi) : Option C — Git commit pour les handoffs texte.**

Pourquoi :
1. **Aligné avec la philosophie MnM** que Tom répète depuis le début : "if MnM dies the .md survive". Tout le monde peut cloner le repo et reprendre n'importe quel step en `git checkout <sha>`.
2. **Réutilise l'infra existante** : `gitProvider.commitMultipleFiles()` est déjà testé et instrumenté, le PAT compagnie a les bonnes perms (cf. memory `project_pat-fallback-removal.md` pour le post-démo cleanup).
3. **Pas de migration DB, pas de nouvel infra à déployer** — tout passe par les rails Git déjà en prod.
4. **Couvre 80% du besoin** : un workflow gouverné typique produit du `.md` (designs, changelogs), du `.json` (manifests), du `.yaml` (configs). Tous < 100KB.
5. **Naturellement portable** : un dev pose `git clone tom.andrieu/mnm-demo && git checkout run/<run_id>/dev` → il a TOUT le contexte du step `dev` localement, prêt à reprendre le step `review` même hors-MnM.

### Plan d'implémentation Phase 1

**P1** (1 jour) — Protocol artifact étendu : convention que `artifact.files[].content` est inline (string). Le harness le populate, le serveur le consomme.

**P2** (1 jour) — `commitHandoffArtifacts()` helper côté serveur (`server/src/services/governed-workflows.ts`) :
- Extrait `artifact.files[].content`
- Appelle `gitProvider.commitMultipleFiles({branch: "mnm-runs/<run_id>", actions: [...{path, content}]})` sur le repo du workflow
- Crée tag `run/<run_id>/<step_id>` sur le commit pour stable handoff snapshot
- Réécrit l'artifact en `{"design_md": {"kind": "git", "git_sha": "...", "path": "..."}}` AVANT persist
- Idempotent : si `git_sha` existe déjà sur l'artifact entrant, skip commit (resume support)

**P3** (½ jour) — `interpolatePromptContext` : quand une valeur ressemble à `{kind: "git", git_sha, path}`, optionnellement résoudre côté serveur (lazy fetch + ShaCache) et inliner le content dans le prompt pour le step suivant.

**P4** (½ jour) — Helper gate `ctx.helpers.fetchHandoff(git_sha, path)` pour les gates qui veulent valider le contenu d'un fichier (ex: gate "design.md contient une section ## Tests").

**P5** (½ jour) — Option `mcp__plugin_mnm_mnm__resume_governed_workflow_run({run_id, step_id})` qui retourne le handoff complet (artifacts résolus + prompt_context substitué) pour qu'un user fresh puisse reprendre le step.

### Phase 2 (post-pilote CBA, quand le besoin émerge) : Option E hybride

Quand on commencera à voir des artifacts > 1MB (logs de build, screenshots de review-watcher, binaires de release-mgr), router sur le `storage` service. Pas avant — YAGNI.

---

## 4. Pièges identifiés à creuser

1. **Branch strategy Git** : un seul long-lived `mnm-runs` ou un branch par run ? Recommandation : `mnm-runs/<run_id>` éphémère, jamais merged. Permet GC propre via `git branch -D mnm-runs/<old_run_id>` après expiration.

2. **GC des runs cancelled / orphelins** : ajouter un job `cleanup-stale-run-branches` qui supprime les branches `mnm-runs/<run_id>` où le run est `failed` ou `cancelled` depuis > 30j.

3. **Encryption-at-rest sensitive content** : design.md peut contenir du contenu sensible (architecture interne). GitLab self-hosted CBA = derrière VPN = OK pour le pilote. Pour SaaS futur, considérer git-crypt ou storage layer chiffré.

4. **Permissions PAT** : le PAT compagnie doit avoir `write_repository`. Tom a déjà flag dans memory `project_pat-fallback-removal.md` que le PAT doit dégager post-démo au profit de l'OAuth user — quand ça arrivera, il faudra que l'identité OAuth user soit utilisée pour committer (ce qui est PLUS audit-friendly de toute façon : "Tom Andrieu a committé le handoff" vs "le PAT compagnie a committé").

5. **Race conditions** : deux orchestrateurs concurrents qui ferment le même step → advisory lock côté serveur (déjà en place pour `complete_governed_step` via `pg_advisory_xact_lock`, cf. governed-workflows.ts:974).

6. **Handoff inline vs lazy** : Phase 1 simple = serveur résout le content au launch_step suivant et l'inline dans le prompt. Coût : pour un design.md 2 KB c'est négligeable, pour un 50 KB on commence à payer en tokens. Mitigation : flag par-step `inline_handoffs: true|false`. Default `true` jusqu'à ce que ça pose problème.

7. **Idempotence resume** : un user qui hit `resume_governed_workflow_run` sur un run abandonné depuis 1h doit avoir EXACTEMENT le même état que celui qui était en train de tourner. Le commit Git fournit ça naturellement (sha immuable). Pour l'artifact JSON DB, l'advisory lock + UPDATE atomique l'assure aussi.

8. **Gate runner et binaires** : aujourd'hui les gates lisent `ctx.artifact.files[X].content`. Si Phase 2 introduit le hybrid, les gates qui veulent valider un binaire devront passer par un nouveau helper. À designer après l'observation des cas d'usage réels.

---

## 5. TL;DR pour Tom

- **MnM doit héberger les handoffs** — ton intuition est correcte, sinon `/clear` entre steps casse le contrat de continuité.
- **Stratégie Phase 1** : commit dans le repo Git du workflow (option C). Aligned avec la philosophie "MnM = harness Git-first", zéro nouvelle infra, audit gratuit, portable. ~3 jours à shipper post-démo.
- **Stratégie Phase 2** : si/quand les artifacts deviennent gros (binaires, logs), router en hybride Git+blob (option E). À faire en réaction aux besoins réels du pilote, pas en pré-empt.
- **Anti-pattern à fuir** : nouvelle table `workflow_artifacts` + S3 dès Phase 1. Ça reproduit l'effet "MnM = base de données" alors que MnM = harness sur Git.

> Si MnM meurt après Phase 1, tu fais `git clone tom.andrieu/mnm-demo` et tous tes handoffs sont là, datés, signés, parcourables avec les outils Git natifs. C'est exactement le contrat que tu cherches.
