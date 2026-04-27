# Spec — Import de plugins Claude Code en config layers MnM

**Date** : 2026-04-27
**Auteur** : Tom + Claude
**Cas d'usage validateur** : `https://lab.cbainfo.fr/genia/hub/creation/symfony-upgrade-tests`
**Statut** : à valider par Tom avant écriture du plan d'implémentation.

---

## 1. Contexte

MnM stocke aujourd'hui dans le repo Git per-company deux familles d'objets : `agents/` et `workflows/`. Les **skills** existent comme dossiers statiques du repo `mnm` (`skills/mnm`, `skills/mnm-create-agent`, `skills/para-memory-files`) injectés au runtime via `cursor-local-skill-injection` côté adapter. Ce sont des skills hard-codés au plugin MnM lui-même, pas un kind dynamique.

**Gap** : Le hub interne CBA `https://lab.cbainfo.fr/genia/hub/` contient déjà N plugins Claude Code prêts (skills + agents + parfois MCP/hooks) — `symfony-upgrade-tests`, `php-quality`, etc. MnM n'a aujourd'hui **aucun moyen** :
- d'ingérer un plugin CC,
- de stocker ses skills (notamment ceux qui ont des sous-fichiers `references/*.md`),
- de wirer ces skills à un agent ou un workflow MnM.

Le plus proche actuellement = `config_layer_items` typés, mais ils ne supportent ni les sous-fichiers, ni le format CC, ni l'import depuis un repo distant.

**Modèle visé (Tom)** : un `config_layer` MnM **est** l'équivalent d'un plugin CC. Le format on-disk vit à côté de `agents/` et `workflows/` dans le repo Git per-company. À terme, chaque `config_layer` peut être extrait dans son propre repo distant (modèle hub-style), mais on commence simple : tout dans le repo company.

---

## 2. Décisions actées (brainstorming)

| # | Décision | Pourquoi |
|---|---|---|
| D1 | **Import individuel par URL** (pas de marketplace V1). | UI Alex couvrira la marketplace plus tard. |
| D2 | **Le plugin meurt à l'import.** Output = N agents standalone (`agents/<n>.md`) + 1 config_layer (`config_layers/<plugin>/`) qui contient skills + (futurs MCP/hooks). | Cohérent avec "config_layer = plugin CC". |
| D3 | **Wiring agent ↔ config_layer = frontmatter Git-first.** À l'import, ajouter `config_layers: [<plugin-name>]` au frontmatter de chaque agent extrait. La DB n'est qu'un cache. | Conforme à "If MnM dies, the .md survive". |
| D4 | **V1 démo = skills+agents only.** MCP / hooks / commands → V2. | Le plugin cible n'a ni MCP ni hooks. |
| D5 | **Workflow `symfony-upgrade-tests` écrit à la main** dans `workflows/`, pas auto-généré depuis le skill orchestrateur. Les skills orchestrateurs (`test`) sont **exclus à l'import** via paramètre `exclude_skills`. | Trop magique pour V1, et l'intérêt MnM = ajouter des gates par-dessus. |
| D6 | **Re-import = écraser** (V1 fail-fast sur conflit, sinon delete + import). Idempotence fine V2. | Démo. |
| D7 | **Clone Git = `--depth 1 --branch <ref>` (default `main`).** | Démo, suffisant. |

---

## 3. Repo layout post-import (per-company)

Après `import_cc_plugin(url="…/symfony-upgrade-tests", exclude_skills=["test"])` :

```
agents/
  test-writer.md            ← extrait, frontmatter étendu
  test-reviewer.md          ← idem
workflows/
  symfony-upgrade-tests.workflow.json   ← écrit à la main
  gates/
    symfony-upgrade-tests/
      preflight.gate.ts
      phpstan-level-10.gate.ts
      phpunit-pass.gate.ts
      infection-msi.gate.ts
      reviewer-approves.gate.ts
config_layers/
  symfony-upgrade-tests/
    plugin.json             ← manifest copié sans .claude-plugin/ (traçabilité)
    skills/
      preflight/SKILL.md
      test-conventions/SKILL.md
      symfony-autowire/
        SKILL.md
        references/
          attribute-examples.md
          common-mistakes.md
      phpdoc-throws/SKILL.md
      php-new-without-parentheses/SKILL.md
      php-typed-constants/SKILL.md
```

**Frontmatter agent étendu** (exemple `agents/test-writer.md` après import) :

```yaml
---
name: test-writer
model: sonnet
description: ...
skills: [test-conventions]
config_layers: [symfony-upgrade-tests]   ← AJOUTÉ À L'IMPORT
---
```

**Le skill `test/`** (orchestrateur writer→reviewer du plugin) **n'est pas importé** — l'opérateur l'a passé dans `exclude_skills`. Le workflow MnM le remplace.

---

## 4. Modèle DB

Aucune nouvelle table. Réutilise et étend les tables existantes.

### 4.1 `config_layers` — extensions

Quatre colonnes ajoutées (migration SQL) :

| Colonne | Type | Nullable | Sens |
|---|---|---|---|
| `source_url` | text | oui | URL du repo CC plugin importé (ex: `https://lab.cbainfo.fr/genia/hub/creation/symfony-upgrade-tests`) |
| `source_sha` | text | oui | Commit SHA cloné côté plugin source (pour diff / re-import futur) |
| `source_kind` | text | non, default `"inline"` | `"inline" \| "cc-plugin"` (V2 ouvre `"cc-marketplace"`) |
| `mnm_import_commit_sha` | text | oui | Commit SHA côté repo MnM company qui a matérialisé l'import (debug / audit) |

Pas d'index ajouté V1 — query par `source_url` n'est pas dans le hot path.

### 4.2 `config_layer_items` — usage du `item_type="skill"`

Pas de changement de schéma. On ouvre une nouvelle valeur de `item_type` :

- `item_type = "skill"`
- `name = "<skill-name>"` (ex: `"test-conventions"`)
- `configJson = { "frontmatter": {...parsed YAML frontmatter...}, "primaryFile": "SKILL.md" }`
- `displayName` = `frontmatter.name` (généralement identique au nom du dossier).
- `description` = `frontmatter.description` (utilisé par CC pour le triggering du skill).

V2 ouvre naturellement `"mcp"`, `"hook"`, `"command"` sans nouvelle migration.

### 4.3 `config_layer_files` — contenu des skills

Table existante (`itemId`, `path`, `content`, `contentHash`). Une row par fichier du skill :

| `itemId` | `path` | `content` |
|---|---|---|
| `<skill-test-conventions-id>` | `SKILL.md` | (markdown du SKILL.md) |
| `<skill-symfony-autowire-id>` | `SKILL.md` | … |
| `<skill-symfony-autowire-id>` | `references/attribute-examples.md` | … |
| `<skill-symfony-autowire-id>` | `references/common-mistakes.md` | … |

Les paths sont relatifs au dossier du skill et préservent l'arbo.

### 4.4 Pourquoi pas une table `skills` dédiée

- Réutilise tout le tooling existant : RLS multi-tenant, scope tag-based, priority merge, advisory locks, cache hash, `sourceFetchedAt`.
- `config_layer_files` est déjà conçu pour stocker des contenus rattachés à un item.
- Cohérent avec la sémantique Tom : "config_layer = plugin CC".

---

## 5. Pipeline d'import

### 5.1 API

**REST** : `POST /api/companies/:companyId/governed-workflows/import-plugin`
**MCP** : nouveau tool `import_cc_plugin`

### 5.2 Payload

```json
{
  "repo_url": "https://lab.cbainfo.fr/genia/hub/creation/symfony-upgrade-tests",
  "ref": "main",
  "exclude_skills": ["test"],
  "exclude_agents": []
}
```

`ref` accepte un nom de branche ou de tag (`v1.0.0`). Default `"main"`. `exclude_skills` / `exclude_agents` sont optionnels.

### 5.3 Étapes (ordre strict)

1. **Authz** : vérifier `workflows:create` sur la company (même garde que `create_governed_workflow`).
2. **Clone tmp** : `git clone --depth 1 --branch <ref> <repo_url> /tmp/mnm-import-<uuid>`. Auth via le `git_provider` config layer existant (PAT). Capture le HEAD sha.
3. **Validate plugin** : `.claude-plugin/plugin.json` existe et est parsable. Sinon → `INVALID_CC_PLUGIN`.
4. **Pre-flight conflits DB** :
   - Un `config_layer` du même `name` (= plugin name) existe déjà → `CONFLICT_LAYER_NAME`.
   - Un agent du même name (parmi ceux à importer, après filtrage `exclude_agents`) existe déjà → `CONFLICT_AGENT_NAME`.
5. **Stage en mémoire** :
   - Pour chaque `agents/*.md` (sauf `exclude_agents`) : parse frontmatter (gray-matter), prépare `agents/<n>.md` cible avec `config_layers: [<plugin-name>]` injecté en frontmatter (idempotent : pas de doublon si déjà présent), prépare row DB agent.
   - Pour chaque `skills/<n>/` (sauf `exclude_skills`) : copie l'arbo dans `config_layers/<plugin>/skills/<n>/`, prépare 1 row item + N rows files (path + contentHash sha256).
   - Prépare `config_layers/<plugin>/plugin.json` (manifest copié, sans `.claude-plugin/`).
6. **Commit Git atomique** : 1 seul commit sur `main` qui ajoute tout, message `feat(plugin-import): import <name> v<version>`. Tag léger : `plugin-imports/<name>/v<version>`. Si l'écriture Git échoue → abort, ne touche pas la DB.
7. **DB transaction** : insère `config_layers` (avec `source_url`, `source_sha`, `source_kind="cc-plugin"`, `mnm_import_commit_sha`) + items + files + agents en une transaction Postgres unique.
8. **Cleanup** : `rm -rf /tmp/mnm-import-<uuid>` (best-effort, log si échec).

### 5.4 Réponse 200

```json
{
  "ok": true,
  "configLayerId": "uuid",
  "agents": [
    {"id": "uuid", "name": "test-writer"},
    {"id": "uuid", "name": "test-reviewer"}
  ],
  "skills": [
    {"name": "preflight"},
    {"name": "test-conventions"},
    {"name": "symfony-autowire", "files": 3},
    ...
  ],
  "skippedSkills": ["test"],
  "skippedAgents": [],
  "pluginCommitSha": "abc123…",
  "mnmCommitSha": "def456…",
  "tag": "plugin-imports/symfony-upgrade-tests/v1.0.0"
}
```

### 5.5 Erreurs gérées

| Code | HTTP | Cause |
|---|---|---|
| `INVALID_CC_PLUGIN` | 400 | `.claude-plugin/plugin.json` manquant / illisible |
| `INVALID_AGENT_FRONTMATTER` | 400 | Un `agents/*.md` a un YAML cassé |
| `INVALID_SKILL_FRONTMATTER` | 400 | Un `skills/*/SKILL.md` a un YAML cassé |
| `CONFLICT_LAYER_NAME` | 409 | Un config_layer du même nom existe |
| `CONFLICT_AGENT_NAME` | 409 | Un agent du même nom existe |
| `GIT_AUTH_FAILED` | 502 | Clone refusé par GitLab (PAT invalide / scope insuffisant) |
| `GIT_COMMIT_FAILED` | 502 | Push sur le repo company refusé |

Pas de retry automatique V1.

---

## 6. Runtime materialization

**But** : au launch d'un agent, exposer ses skills (avec leurs `references/`) au sandbox Claude/Cursor sous `<sandbox>/.claude/skills/<skill>/`.

### 6.1 Flow

1. MnM crée le sandbox de run : `~/.mnm/runs/<run-id>/`.
2. Lit le frontmatter de `agents/<name>.md` → liste `config_layers: [...]`.
3. Pour chaque config_layer listé, charge en DB **tous** ses items `skill` + leurs `config_layer_files`.
4. Pour chaque file, écrit le contenu dans `<sandbox>/.claude/skills/<skill-name>/<file.path>` (préserve l'arbo `SKILL.md` + `references/...`).
5. Lance l'adapter (`claude_local` / `cursor_local` / `codex_local` / `opencode_local`) avec `cwd=<sandbox>`. Chaque adapter sait déjà lire `.claude/skills/`.
6. À la fin du run : sandbox **conservé** V1 (debug). Cleanup automatique → V2.

### 6.2 Pourquoi tous les skills (pas seulement ceux listés dans `skills:` du frontmatter)

- Côté CC : `skills:` du frontmatter d'un agent = auto-injection au démarrage.
- Mais les **autres** skills du plugin doivent être discoverable via le tool `Skill()` — c'est la philosophie d'un plugin CC : le bundle est dispo, le LLM pioche.
- Si on filtre côté MnM, on casse le comportement attendu de Claude Code.

### 6.3 Code path V1

Nouveau service côté serveur : `materializeConfigLayerSkills(sandbox: string, layerIds: string[], db: Db): Promise<void>`. Invoqué dans le runner d'agent commun, en amont de chaque adapter spécifique (`claude-local`, `cursor-local`, `codex-local`, `opencode-local`). Aucun changement requis dans les adapters eux-mêmes.

V1 = écriture (pas symlink) parce que les contenus viennent de la DB, pas du repo. Le coût en perf est négligeable (skills pèsent quelques KB).

---

## 7. Workflow `symfony-upgrade-tests` + gates

### 7.1 `workflows/symfony-upgrade-tests.workflow.json`

```json
{
  "apiVersion": "mnm/v1",
  "kind": "GovernedWorkflow",
  "name": "symfony-upgrade-tests",
  "description": "Génère + review PHPUnit tests pour un fichier Symfony donné",
  "variables": {
    "target_file": {
      "type": "string",
      "required": true,
      "description": "Chemin source PHP à tester (ex: src/Service/UserService.php)"
    },
    "project_dir": {
      "type": "string",
      "required": true,
      "description": "Racine du projet Symfony cible (cwd des commandes Docker)"
    }
  },
  "steps": [
    {
      "id": "write-tests",
      "agent": "test-writer",
      "deps": [],
      "prompt_context": {
        "target_file": "{{variables.target_file}}",
        "project_dir": "{{variables.project_dir}}"
      },
      "gates": {
        "entry": [
          { "id": "preflight", "source": "./gates/symfony-upgrade-tests/preflight.gate.ts" }
        ],
        "exit": [
          { "id": "phpstan-level-10", "source": "./gates/symfony-upgrade-tests/phpstan-level-10.gate.ts" },
          { "id": "phpunit-pass",     "source": "./gates/symfony-upgrade-tests/phpunit-pass.gate.ts" },
          { "id": "infection-msi",    "source": "./gates/symfony-upgrade-tests/infection-msi.gate.ts" }
        ]
      }
    },
    {
      "id": "review-tests",
      "agent": "test-reviewer",
      "deps": ["write-tests"],
      "prompt_context": {
        "test_file":   "{{steps.write-tests.artifact.test_file}}",
        "source_file": "{{variables.target_file}}",
        "msi_score":   "{{steps.write-tests.artifact.msi}}",
        "project_dir": "{{variables.project_dir}}"
      },
      "gates": {
        "exit": [
          { "id": "reviewer-approves", "source": "./gates/symfony-upgrade-tests/reviewer-approves.gate.ts" }
        ]
      }
    }
  ]
}
```

### 7.2 Gates — sémantique

Toutes les gates **ré-exec** la vérification côté runner (gate = vérification indépendante, pas confiance dans l'artifact).

| Gate | Step | Position | Logique |
|---|---|---|---|
| `preflight` | `write-tests` | entry | Reproduit le skill `preflight` du plugin : `docker compose ps php`, `phpunit/phpstan/infection --version`, `phpstan.neon` configuré `level: 10`, `infection.json5` présent, dossiers `tests/Unit\|Functionnal\|SmokeTest` existent. Block si manquant avec rapport détaillé. |
| `phpstan-level-10` | `write-tests` | exit | `docker compose exec php vendor/bin/phpstan analyse --level=10 --error-format=json <test_file>` → 0 erreur. Lit `test_file` depuis l'artifact du writer. |
| `phpunit-pass` | `write-tests` | exit | `docker compose exec php vendor/bin/phpunit <test_file>` → exit 0. |
| `infection-msi` | `write-tests` | exit | Parse `infection.json5` pour `minMsi/minCoveredMsi`, exec `vendor/bin/infection --filter=<target_file>`, compare. Block si en-dessous. |
| `reviewer-approves` | `review-tests` | exit | Parse l'artifact reviewer : doit contenir `Verdict : APPROVE`. Sinon block (=`REQUEST_CHANGES` non rebouclé V1). |

### 7.3 Contrat artifact attendu (writer)

Le writer doit retourner au minimum :

```json
{
  "test_file": "tests/Unit/Service/UserServiceTest.php",
  "msi": 87.5
}
```

**Ce contrat dépend du brainstorm artifact en cours** (`docs/superpowers/specs/2026-04-27-artifact-persistence-brainstorm.md`). À finaliser quand cette PR est landée — selon la décision retenue, on stickera ce contrat soit via `prompt_context._mnm_artifact_hint` injecté à V1, soit via un mécanisme natif de schema artifact.

### 7.4 Contraintes runner

- Les gates exécutent du `docker compose` → le serveur MnM doit avoir Docker accessible et `cwd = {{variables.project_dir}}` au moment de l'exécution. V1 démo : MnM dev tourne en local sur la même machine que le projet Symfony cible.
- Pas de loop "REQUEST_CHANGES → re-write" V1 (review block, l'humain corrige et relance).
- Pas de parallélisme (séquentiel obligatoire write→review).

---

## 8. Couplage avec le brainstorm artifact en parallèle

Le contrat artifact du writer (§7.3) reste **non figé** dans ce spec. Quand le spec `2026-04-27-artifact-persistence-brainstorm.md` est tranché :
- Si Option A retenue (inline JSON) → le writer commit son artifact via `complete_governed_step` avec `{test_file, msi}` au top-level.
- Si Option B/C retenue (artifacts table ou Git) → le writer pousse ses fichiers générés (le `*Test.php` lui-même) en plus du JSON de handoff, et les gates lisent les fichiers via le mécanisme retenu.

Action : revoir §7.3 + §7.2 quand l'autre brainstorm conclut.

---

## 9. Hors scope V1

| Sujet | Pourquoi reporté |
|---|---|
| MCP du plugin | `symfony-upgrade-tests` n'en a pas. Item type `"mcp"` ouvert mais pas implémenté. |
| Hooks du plugin | Idem. |
| Commands du plugin | Slash commands CC. Item type `"command"` ouvert. |
| Marketplace (`marketplace.git`) | UI Alex couvrira. |
| Re-import idempotent / merge / diff | V1 = delete + re-import. |
| Partial import (cherry-pick) | V1 = tout sauf `exclude_*`. |
| Cleanup sandbox de run | V1 = on garde pour debug. |
| Validation profonde du contenu skills (linter SKILL.md) | V1 = trust the source. |
| Auto-attach config_layer aux workflows (pas seulement aux agents) | V1 = workflows référencent les agents qui portent eux-mêmes le `config_layers:`. |
| Loop REQUEST_CHANGES → re-write dans le workflow | V1 = block + intervention humaine. |
| Parallélisme write+review | Logique séquentielle imposée. |
| Adapter de gates exécutables ailleurs que sur le serveur MnM | V1 = serveur MnM = même machine que projet cible. |

---

## 10. Plan de test (haut niveau, à détailler dans le plan)

1. **Unit** : parser plugin.json, parser frontmatter agent/skill, conflits détectés, `exclude_*` honorés.
2. **Integration** : import depuis un repo GitLab fixture (mocker l'auth), vérifier rows DB + structure repo company.
3. **E2E** : import réel `symfony-upgrade-tests` sur company de test, lancer le workflow `symfony-upgrade-tests` sur un projet Symfony fixture (Docker compose), gates passent.
4. **Régressions** : Cursor adapter / Claude local adapter continuent de fonctionner avec le nouveau code path materialization (skills MnM core type `mnm`/`mnm-create-agent` toujours disponibles).

---

## 11. Open questions

- Format final du frontmatter `config_layers:` : liste de strings `["symfony-upgrade-tests"]` ou objets `[{name: ..., version: ...}]` ? V1 = strings (plus simple), version trackée séparément en DB.
- Skills MnM core (`mnm`, `mnm-create-agent`, `para-memory-files`) : doivent-ils migrer vers `config_layers/mnm-core/` un jour ? Hors scope V1, mais cohérence à préserver.
- Re-import (V2) : faut-il un endpoint `update_cc_plugin` qui diff les contenus, ou simple `delete_config_layer` + `import_cc_plugin` ?
