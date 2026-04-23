# Test en local — Governed Workflows hello-world

Ce guide déroule le happy path `hello-world` en dev local, **sans créer** le repo marketplace GitHub. On utilise :

- **Embedded Postgres** (inclus dans `bun run dev`, pas de Docker)
- **LocalBareRepoProvider** (un bare git repo dans `~/.mnm/dev-workflows-bare/`, pas de GitLab)
- **Mode `local_trusted`** (pas d'auth, company par défaut auto-créée)
- **Plugin Claude Code en install locale** (via `~/.claude/settings.json`, pas de marketplace)

Temps total : ~5 minutes.

---

## Prérequis

- Node 20+ / bun installé
- Claude Code installé (CLI ou desktop)
- `git` disponible dans le PATH

---

## Étape 1 — Démarrer le serveur une première fois

```bash
bun install
bun run dev
```

Le serveur boot en mode `local_trusted` (par défaut), auto-crée une company, applique les migrations sur le postgres embarqué (port `54329`), et sert :

- API + UI sur `http://127.0.0.1:3100`
- MCP endpoint sur `http://127.0.0.1:3100/mcp`

Laisse tourner dans ce terminal. La première boot peut prendre 30-60s (migrations + fresh embedded PG).

Quand tu vois `[mnm] ready on http://127.0.0.1:3100`, passe à l'étape 2 **dans un autre terminal**.

---

## Étape 2 — Seeder le workflow hello-world

Dans un nouveau terminal :

```bash
bun run seed:hello-world
```

Le script est dans `server/scripts/` (il importe `postgres` qui est une dep du workspace `server`). L'npm script au root s'en charge, tu n'as rien à configurer.

Actions :

1. Crée un bare git repo à `~/.mnm/dev-workflows-bare/repo.git` avec `hello-world/workflow.json` + gates + `greeter/agent.md` + `shouter/agent.md`, taggé `v1.0.0`.
2. Insère la ligne `governed_workflow_definitions` (hello-world) et les deux `agents` (greeter, shouter) pour la company par défaut.
3. Affiche les valeurs à coller dans `settings.json` + les variables d'env pour redémarrer le serveur.

Garde la sortie du script — tu en auras besoin juste après. Elle contient notamment :

- Ton **`company_id`** (UUID)
- Le chemin absolu du bare repo (à passer via `MNM_GIT_LOCAL_PATH`)

Le script est **idempotent** : tu peux le rerun autant que tu veux, il réutilise le bare repo existant et fait des upserts DB.

---

## Étape 3 — Installer le plugin MnM en local dans Claude Code

> **Pas besoin de redémarrer le serveur** — en mode `local_trusted` (default dev), le provider git fallback pointe automatiquement sur `~/.mnm/dev-workflows-bare/repo.git`, exactement où le seed a écrit le bare repo. Si ton server tourne toujours depuis l'étape 1, il est prêt. Si tu l'as arrêté, un simple `bun run dev` suffit.


Ouvre `~/.claude/settings.json` et ajoute (ou merge) ce bloc :

```json
{
  "extraLocalPlugins": [
    {
      "id": "mnm",
      "source": {
        "type": "local",
        "path": "C:/Users/example-org/repo/perso/alphalup/mnm/plugins/mnm"
      }
    }
  ]
}
```

> Adapte le `path` si ton repo est ailleurs. Utilise **forward slashes** même sur Windows.

Redémarre Claude Code complètement (pas juste `/reload-plugins` — le harness doit re-scanner `settings.json`).

Au prochain démarrage, Claude Code devrait :

- Détecter le plugin `mnm` dans `extraLocalPlugins`
- Lire `plugins/mnm/.claude-plugin/plugin.json` et te demander de configurer `company_id` + `server_url`
- Charger le MCP server depuis `plugins/mnm/.mcp.json`
- Exécuter le SessionStart hook (`bin/mnm-session-start`)

**Valeurs à rentrer quand Claude Code demande la config du plugin :**

- `company_id` = la valeur UUID imprimée par `seed:hello-world`
- `server_url` = `http://127.0.0.1:3100`

Vérifie que le plugin est chargé :

```
/plugin list
```

Les outils MCP `mnm.*` doivent apparaître en autocomplete.

---

## Étape 4 — Lancer le skill d'onboarding

Dans la nouvelle session Claude Code :

```
/mnm--onboard
```

Le skill va :

1. Appeler `mcp__mnm__authenticate` (en `local_trusted` ça devrait passer direct ou te montrer un flow OAuth minimal).
2. Appeler `mnm.setup_workspace` → te renvoyer les agents à matérialiser (greeter + shouter).
3. Écrire les fichiers `~/.claude/agents/mnm--greeter.md` + `~/.claude/agents/mnm--shouter.md`.
4. **S'arrêter et te demander de lancer `/reload-plugins`**. Fais-le, puis envoie un message (ex. "ok").
5. Appeler `mnm.push_local_state` avec le sha.
6. Te proposer de lancer hello-world.

---

## Étape 5 — Lancer hello-world

Accepte l'option 1 proposée par le skill, ou bien fais-le à la main :

```
mnm.list_governed_workflows
```

Tu dois voir hello-world dans la liste. Puis :

```
mnm.launch_governed_workflow  with  { name: "hello-world", params: { name: "Tom" } }
```

Cela crée un run. Note l'`id` retourné, puis :

```
mnm.launch_governed_step  with  { run_id: "<id>", step_id: "greet" }
```

Le serveur va :
- Matérialiser `mnm--greeter` si pas déjà fait (mais le skill onboard l'a fait)
- Te demander de dispatcher `Task(subagent_type: "mnm--greeter", prompt: "<prompt_context>")`

Exécute ce dispatch, récupère l'artifact JSON `{ "greeting": "..." }`, puis :

```
mnm.complete_governed_step  with  { run_id: "<id>", step_id: "greet", artifact: { "greeting": "Hello Tom!" } }
```

La gate `greeting-ok` s'évalue (check que `greeting` est non-vide), le step `shout` devient dispatchable. Tu répètes pour `shout` → artifact `{ "shouted": "HELLO TOM!" }` → gate `uppercase-ok` passe → **workflow terminé**.

---

## Debug

| Symptôme | Piste |
|---|---|
| `agent not found` quand Task dispatche `mnm--greeter` | `/reload-plugins` a été skippé à l'étape 5 point 4. Relance. |
| `MISSING_TOOLS` | Le SessionStart hook n'a pas enregistré les `session_tools`. Vérifie que le plugin est bien chargé via `/plugin list`. |
| `governed_workflow_definitions` row manquante | Re-run `bun run seed:hello-world`. |
| `AGENTS_STALE` en boucle après Write + reload | Le sha du fichier écrit ne match pas `latest_git_tag`. Le seed script force les deux à `v1.0.0` — vérifie que le bare repo n'a pas dérivé, sinon `rm -rf ~/.mnm/dev-workflows-bare` et re-seed. |
| MCP auth loop | En `local_trusted` l'OAuth est court-circuité. Si tu te retrouves sur une page d'auth web, vérifie `MNM_DEPLOYMENT_MODE` n'est pas forcé à `authenticated`. |
| UUID `invalid input syntax` côté serveur | Ton `company_id` dans la config plugin est malformé. Recopie l'UUID imprimé par le seed script. |

---

## Reset complet

```bash
# Stoppe le serveur.
rm -rf ~/.mnm/dev-workflows-bare
rm -rf ~/.mnm/instances/default/db   # supprime la DB embarquée
# Retire le bloc extraLocalPlugins de ~/.claude/settings.json si voulu.
bun run dev                            # recrée la DB + la company par défaut
bun run seed:hello-world
```
