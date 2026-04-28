# Brainstorm Implémentation Governed Workflows — Session 2 (2026-04-20)

**Statut** : En cours — design par sections, Section 2 (data model) à valider.
**Participants** : MnM founder, Claude
**Contexte d'entrée** :
- Design consolidé : `_bmad-output/governed-workflows-consolidated-2026-04-17.md`
- Récap de la Session 1 abandonnée : `_bmad-output/brainstorming/implementation-governed-workflows-session-2026-04-20.md`

---

## Décisions actées dans cette Session 2

Les décisions sont arrivées en 11 questions successives. Chacune conditionne la suivante.

### Gates et logique d'exécution

1. **Gates = fichiers TS custom** dans le repo du workflow.
   - Raison : les gates peuvent être de tout type (déterministe, LLM-as-judge, check contextuel des tool_calls de la session user, etc.).
   - Portée : limité aux gates. Les steps et le workflow lui-même ne sont pas du code TS.

2. **Exécution des gates = serveur-side, sandboxé**.
   - Node VM sandbox côté serveur MnM.
   - Les gates ne sont JAMAIS envoyées au client. Le harness reporte des artifacts via MCP, le serveur eval.
   - Trust model à définir dans le design technique.

### Format et structure

3. **Workflow = JSON déclaratif** (data pure, pas de code).
   - Raison : visualisable dans un éditeur UI future, JSON Schema friendly, pas de pièges de parsing (indent YAML, strings multi-lignes).
   - Le fichier workflow contient : steps + deps + triggers + config des gates (pas leur logique).

4. **Agent = format Anthropic standard** (`.md` + YAML frontmatter Claude Code natif).
   - Pas de format MnM-proprio. Cohérent avec l'écosystème Claude Code.
   - L'agent `.md` n'embarque PAS la config runtime (MCP/hooks/settings). Ces configs vivent à part dans les **config layers**.

5. **Config layers = entités DB attachées aux agents (1..N par agent)**, priority-merged (pattern MnM existant, migration 0054).
   - Un config layer = `{ mcp, hooks, settings, env_vars_refs }`.
   - Un agent peut avoir plusieurs layers (défaut, prod, avec-mcp-X, etc.). Le merge produit la config effective côté user.
   - **Évolution future** : support de config layers globaux partagés (ex: "MCP gitnexus", "MCP clickup" applicable à plusieurs agents). Data model doit le permettre, mais hors scope MVP.

### Versionning et structure repos

6. **Versionning git pour tout** : workflows, gates TS, agents `.md`, config layers JSON.
   - DB = index + cache parsé. Git = source de vérité.
   - Commit author = user réel (traçabilité), token d'écriture = bot MnM (simple).
   - GitLab self-hosted réutilisé comme infra git.

7. **Structure = 2 repos par company pour MVP** (skills reportés) :
   ```
   mnm-<company>-workflows/
   └── hello-world/
       ├── workflow.json
       └── gates/
           ├── step1-entry.gate.ts
           └── step1-exit.gate.ts

   mnm-<company>-agents/
   ├── greeter/
   │   ├── agent.md
   │   └── layers/
   │       └── default.json
   └── shouter/
       ├── agent.md
       └── layers/
           └── default.json
   ```
   - Config layers co-localisés avec l'agent (agent = dossier).
   - Un agent est une unité sémantique cohérente (prompt + ses configs alternatives).

### Plugin Claude Code et écriture locale

8. **Plugin Claude Code ultra-minimaliste** : uniquement la config MCP + le hook SessionStart.
   - Pas de skills bundlés, pas d'agents bundlés, pas de workflows bundlés.
   - Raison : éviter de dépendre du cycle de release plugin Claude Code (lourd). Tout le contenu passe par le MCP + cache local sync.

9. **Écriture user-level `~/.claude/` avec namespacing `mnm--*`** (pas project-level).
   - Raison : un `/reload-plugins` par session serait lourd. User-level = dispo dans toutes les sessions.
   - Préfixe `mnm--` sur fichiers/clés pour éviter les collisions avec ce que l'user a déjà.
   - Fichiers concernés :
     - `~/.claude/agents/mnm--greeter.md`
     - `~/.claude/mcp.json` (merge MCP servers des config layers)
     - `~/.claude/settings.json` (merge hooks + settings)
     - Env vars : mécanisme à définir (probablement injection au boot Claude Code)

10. **Cache staging `~/.mnm/cache/<company>/`** — le SessionStart hook sync depuis MnM d'abord ici (pour diff + changelog), puis applique dans `~/.claude/`.

### Secrets

11. **Secrets : user saisit lui-même pour MVP.**
    - Pas de copie de secrets depuis le serveur MnM vers le PC user.
    - Le MCP MnM détecte l'absence d'un secret nécessaire et guide l'user ("renseigne X dans ton settings").
    - Chiffrement au repos dans git = à voir post-MVP si on veut répliquer des secrets.

### Périmètre MVP

12. **Périmètre hello-world = β (full pipe)** :
    - 2 steps dont au moins 1 lance un **sub-agent** via Task tool.
    - Gates TS côté serveur + cache agents côté client + sync SessionStart, tous testés.
    - Exemple : step 1 = `greeter` produit `{greeting}`, step 2 = `shouter` uppercase.

13. **Skills reportés post-MVP** : un workflow peut tourner "libre" (sans skills) ou avec un agent dédié. Skills non-bloquant pour hello-world.

14. **Multi-company dès l'archi** (path-scoped) mais MVP single-company (`companyId = "default"` hardcodé).

---

## Design par sections (en cours)

### Section 1/7 — Architecture globale **[VALIDÉE]**

```
┌─────────────────────────────────────────────────────────────┐
│ POSTE USER                                                  │
│                                                             │
│  Claude Code (harness) ──► MCP MnM (stdio)                  │
│       │                         │                           │
│       ▼                         │                           │
│  ~/.claude/ (agents, mcp,       │                           │
│    settings, hooks)             │                           │
│    - namespacing mnm--*         │                           │
│                                 │                           │
│  ~/.mnm/cache/<company>/...     │                           │
│    (staging avant copie .claude)│                           │
└─────────────────────────────────┼───────────────────────────┘
                                  │ HTTPS + auth
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│ SERVEUR MnM                                                 │
│                                                             │
│  MCP tools ─► Gate Runner (Node VM sandbox) ─► DB (PG)      │
│                     │                             │         │
│                     └──────► Git Provider ───────┤          │
│                              (GitlabProvider)     │         │
└───────────────────────────────────────────────────┼─────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │ GitLab self-hosted       │
                                          │ - workflows repo │
                                          │ - agents repo    │
                                          └──────────────────┘
```

**3 plans** :
- **Poste user** : Claude Code execute les sub-agents. Cache staging MnM + copie finale dans `~/.claude/` avec préfixe `mnm--`. Hook SessionStart sync.
- **Serveur MnM** : control plane. Gate Runner eval les gates TS dans un sandbox Node VM. Git Provider pull workflow.json/gates/agents depuis GitLab, cache en DB.
- **GitLab self-hosted** : source de vérité. 2 repos par company. MnM commit au nom de l'user (author) avec son token bot.

**Flow d'un step typique** :
1. Harness → `launchStep(step-1, runId)` → MCP
2. Serveur eval entry gate (TS sandbox) → OK → retourne `{agent: "greeter", prompt_context: {...}}`
3. Harness → `Task(subagent_type: "mnm--greeter")` (le `.md` est déjà dans `~/.claude/agents/`)
4. Sub-agent produit artifact
5. Harness → `completeStep(runId, step-1, artifact)` → MCP
6. Serveur eval exit gate → OK → run passe au step suivant

---

### Section 2/7 — Data model **[À VALIDER]**

**4 nouvelles tables (greenfield, les actuelles `workflow_templates` / `workflow_instances` / XState sont abandonnées)** :

| Table | Colonnes clés |
|---|---|
| `governed_workflow_definitions` | `id, company_id, name, version, git_ref (sha), parsed_json, created_at` — cache parsé du `workflow.json` synchronisé depuis git. |
| `governed_workflow_runs` | `id, workflow_def_id, company_id, initiated_by_user, status (draft/active/completed/failed), started_at, completed_at, params_json` |
| `governed_step_executions` | `id, run_id, step_id_in_json, state (pending/running/gate_eval/succeeded/failed), started_at, completed_at, artifacts_json, launched_by_actor` |
| `gate_results` | `id, run_id, step_exec_id, gate_id_in_json, kind (entry/exit), pass, report, error_code, hints_json, evaluated_at` |

**2 tables existantes MnM étendues** :

- **`agents`** (existe) → ajouter `markdown_content` (le `.md` Anthropic) + `git_ref`. Le `.md` versionné git, indexé DB.
- **`agent_config_layers`** (existe, migration 0054) → étendu pour porter `mcp_config`, `hooks_config`, `settings_config`, `env_vars_refs` (refs aux secrets, pas valeurs). Priority-merge déjà implémenté côté serveur.

**Reporté post-MVP** :
- `governed_action_registry` (mapping action → workflow obligatoire)
- `synthesis_snapshots`, `synthesis_proposals` (Nightly Synthesis)

**Flow d'écriture minimal** :
- Création workflow/agent via MCP → commit git (author = user, token = bot MnM) + insertion DB
- `launchWorkflow` → 1 row `runs` + N rows `step_executions` (état `pending`)
- `launchStep` → update `step_executions` vers `running`, eval entry gate → row `gate_results`
- `completeStep` → eval exit gate → update `step_executions` + artifacts

---

### Sections restantes (à concevoir)

3. **Repo structure git détaillée** — fichiers exacts pour hello-world (workflow.json, gates/*.gate.ts, agents/*.md, layers/*.json)
4. **MCP tools list pour MVP** — primitives exposées (listWorkflows, launchStep, completeStep, syncConfigLayer, etc.)
5. **Sync config layer côté user** — protocole hook SessionStart : diff, changelog, accept/refuse, application atomique
6. **Gate sandbox** — trust model TS sandbox, contexte exposé (helpers DB, query artifacts), limites (timeout, pas de FS/réseau non-whitelistés)
7. **Hello-world concret + découpage en tranches d'impl** — PRs testables incrémentales

---

## Points ouverts non tranchés

- **Trust model sandbox TS** : les gates sont du code user-écrit exécuté côté serveur. Quel isolation (Node VM ? isolated-vm ? container ?). Quels helpers exposés (accès DB ? query cross-run ?).
- **Git author resolution quand user = MnM (nightly, CAO)** : le design consolidé prévoit que CAO peut modifier des workflows. Quel author ?
- **Merge des MCP/hooks côté user si déjà configurés** : si l'user a déjà `~/.claude/mcp.json` perso, comment on merge sans casser ?
- **Invalidation cache** : TTL ? Invalidation à chaque SessionStart ? Webhook post-commit git ?
- **Gestion erreur sandbox** : si gate crash (exception TS), quel verdict ? Fail-closed / retry / escalate ?
- **Versioning SemVer** : génération auto ou explicite ?
