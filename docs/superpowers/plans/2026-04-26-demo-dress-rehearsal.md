# Démo CBA — Dress Rehearsal & Cold-Start Playbook

**Date démo** : lundi 2026-04-28
**Setup réalisé** : 2026-04-26 (session précédente)
**État** : Docker stack UP & bootstrappé. Reste à connecter le plugin Claude Code + jouer M3/M4.

---

## 1. État pré-rehearsal (déjà fait, à NE PAS rejouer si Docker tourne encore)

| # | Étape | Statut | Détail |
|---|---|---|---|
| 1 | `bun run dev` killé | ✅ | Port 3100 libéré pour Docker |
| 2 | M1 GitLab restructure | ✅ | `mnm-workflows-tom` → `mnm-demo` avec `/agents` + `/workflows` propres + tags `agents/v1.0.0` + `cba-feature-dev/v1.0.2`, repo renommé. Commit GitLab `ebe23aa`. |
| 3 | Docker stack `docker compose up -d` | ✅ | 3 containers healthy : `mnm-db-1` (Postgres 17.9), `mnm-redis-1`, `mnm-server-1` (mode `authenticated`, port 3100) |
| 4 | M0 migrations Drizzle | ✅ | Auto-appliquées au boot (`MNM_MIGRATION_AUTO_APPLY=true`). 68 tables RLS protégées. |
| 5 | BetterAuth signup | ✅ | `tom@cbainfo.fr` / `DemoMnM2026!` |
| 6 | Bootstrap CEO invite | ✅ | User promu `instance_admin` via `/api/invites/<token>/accept` |
| 7 | Création company "CBA Demo" | ✅ | `id = f262468b-d0aa-408b-9f69-5053bf34671d` (issuePrefix=CBA) |
| 8 | Git provider config | ✅ | `kind=gitlab`, `baseUrl=https://lab.cbainfo.fr`, `projectId=tom.andrieu/mnm-demo`, `token=<PAT>`, `paths={agents,workflows}` |
| 9 | Server restart (cache flush) | ✅ | `resolveGitProvider` cache process-lifetime, restart obligatoire après config layer change. `bootstrapStatus: ready`, `hasCompany: true`. |
| 10 | Commit fixes Docker (`2a58f96`) | ✅ | Dockerfile (5 packages manquants + CRLF fix entrypoint.sh) + `MNM_SECRETS_KEY` dans compose. Pushed sur master. |

### Vérif rapide (à faire au début de la rehearsal)

```bash
docker compose ps                                            # 3 containers Up (healthy)
curl -s http://localhost:3100/api/health | head -c 300       # status:ok, bootstrapStatus:ready, hasCompany:true (Postgres 17.9)
docker compose exec -T db psql -U mnm -d mnm -c "SELECT name, id FROM companies;"  # 1 row CBA Demo
```

Si l'un échoue → soit Docker arrêté (relance via `docker compose up -d`), soit DB nuked (refaire le cold-start headless en bas de doc).

---

## 2. Steps 4+ playbook (à exécuter MAINTENANT pour la dress rehearsal)

### Step A — Reconfigure le plugin Claude Code MnM

Le plugin pointe par défaut sur prod. Le repointer sur localhost :

```
/plugin → MnM Governed Workflows → Configure
  server_url = http://localhost:3100
  company_id = f262468b-d0aa-408b-9f69-5053bf34671d
/reload-plugins
```

### Step B — OAuth MCP MnM

Appel de l'outil :

```
mcp__plugin_mnm_mnm__authenticate
```

→ retourne une URL d'autorisation. Ouvre-la dans le browser. Login avec `tom@cbainfo.fr` / `DemoMnM2026!`. Consent screen → "Authorize". JWT auto-stocké côté plugin.

Vérif : les tools `mcp__plugin_mnm_mnm__create_agent`, `mcp__plugin_mnm_mnm__setup_workspace`, `mcp__plugin_mnm_mnm__launch_governed_workflow` apparaissent dans la liste des tools disponibles.

### Step C — Seed des 4 agents depuis Git (M3)

```jsonc
mcp__plugin_mnm_mnm__create_agent({ name: "senior-dev",     latestGitTag: "agents/v1.0.0", title: "Senior Dev (CBA demo)",     adapterType: "claude_local" })
mcp__plugin_mnm_mnm__create_agent({ name: "dev",            latestGitTag: "agents/v1.0.0", title: "Dev (CBA demo)",            adapterType: "claude_local" })
mcp__plugin_mnm_mnm__create_agent({ name: "review-watcher", latestGitTag: "agents/v1.0.0", title: "Review Watcher (CBA demo)", adapterType: "claude_local" })
mcp__plugin_mnm_mnm__create_agent({ name: "release-mgr",    latestGitTag: "agents/v1.0.0", title: "Release Manager (CBA demo)",adapterType: "claude_local" })
```

Chaque appel fait un git fetch sur `lab.cbainfo.fr/tom.andrieu/mnm-demo` au tag `agents/v1.0.0`, vérifie `agents/<name>/agent.md`, insère la row dans `agents` table.

**Rollback si un appel pète mid-way** :
```sql
DELETE FROM agents
WHERE name IN ('senior-dev','dev','review-watcher','release-mgr')
  AND company_id = 'f262468b-d0aa-408b-9f69-5053bf34671d';
```

### Step D — Matérialise les agents en local (M4 part 1)

```jsonc
mcp__plugin_mnm_mnm__setup_workspace({})
```

→ matérialise `~/.claude/agents/mnm--senior-dev.md`, `mnm--dev.md`, `mnm--review-watcher.md`, `mnm--release-mgr.md` à partir des `.md` GitLab. Retourne un `current_agents` sha map.

```
/reload-plugins
```

→ Claude Code re-scanne `~/.claude/agents/` et charge les 4 nouveaux subagents.

```jsonc
mcp__plugin_mnm_mnm__push_local_state({})
```

→ remonte l'état local au serveur (sha matérialisés vs sha en DB).

### Step E — Lance le workflow `cba-feature-dev` (M4 part 2)

```jsonc
mcp__plugin_mnm_mnm__launch_governed_workflow({
  name: "cba-feature-dev",
  params: {
    ticket_id: "AY-10074",
    gitlab_project: "tom.andrieu/cba-mnm-demo-app"
  }
})
```

→ git fetch tag `cba-feature-dev/v1.0.2`, parse `workflows/cba-feature-dev/workflow.json`, retourne un `run_id`.

```jsonc
mcp__plugin_mnm_mnm__launch_governed_step({
  run_id: "<run_id retourné>",
  step_id: "tech-design",
  current_agents: { /* sha map retournée par setup_workspace */ },
  session_tools: ["mcp__plugin_atlassian_atlassian__*", "mcp__plugin_gitlab_gitlab__*"]
})
```

**Réponse attendue** :
```json
{
  "agent_name": "senior-dev",
  "subagent_type": "mnm--senior-dev",
  "prompt_context": { "ticket_id": "AY-10074", "gitlab_project": "tom.andrieu/cba-mnm-demo-app" }
}
```

→ Claude Code peut maintenant invoquer `Agent({ subagent_type: "mnm--senior-dev", prompt: "<from prompt_context>" })` pour lancer la tech-design.

---

## 3. Le pitch démo "DB meurt, on resetup tout depuis Git"

C'est l'angle philosophique fort : MnM = harness orchestrateur autour de Git. La DB est un cache. Si elle meurt, GitLab a la mémoire.

### Bouton kill switch en live

```bash
docker compose down -v       # nuke pgdata + redisdata + mnm-data
docker compose up -d         # 30s → fresh DB + Redis + serveur
```

### Resetup post-nuke (~3 min) — UI 100% si tu veux l'effet visuel

1. `http://localhost:3100` → signup `tom@cbainfo.fr` / `DemoMnM2026!`
2. Open `/invite/<bootstrap_token>` (généré via SQL — voir snippet plus bas)
3. UI accept invite → tu deviens `instance_admin`
4. UI "Create company" → "CBA Demo"
5. UI Settings → Git Provider → PAT GitLab + `tom.andrieu/mnm-demo` + paths
6. Restart `docker compose restart server` (cache flush)
7. **Reconnect plugin** : `/plugin` → set new `company_id`, `mcp__plugin_mnm_mnm__authenticate`
8. Step C, D, E ci-dessus → 4 agents + cba-feature-dev v1.0.2 reprennent vie depuis GitLab

### Resetup post-nuke headless (plus rapide pour la rehearsal)

Si tu veux re-faire le cold-start sans repasser par le browser, copie-colle ces blocs (ils sont 100% des commandes que j'ai exécutées la dernière fois) :

```bash
# 1. Wait healthy
until curl -sf http://localhost:3100/api/health >/dev/null 2>&1; do sleep 3; done

# 2. Signup
curl -sX POST http://localhost:3100/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"tom@cbainfo.fr","password":"DemoMnM2026!","name":"Tom Andrieu"}' \
  -c /tmp/mnm-cookies.txt

# 3. Bootstrap invite (insert + accept)
TOKEN="pcp_bootstrap_$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')"
HASH=$(node -e "console.log(require('crypto').createHash('sha256').update('$TOKEN').digest('hex'))")
docker compose exec -T db psql -U mnm -d mnm -c \
  "INSERT INTO invites (invite_type, token_hash, allowed_join_types, expires_at, invited_by_user_id) \
   VALUES ('bootstrap_ceo', '$HASH', 'human', NOW() + INTERVAL '24 hours', 'system');"
curl -sX POST "http://localhost:3100/api/invites/$TOKEN/accept" \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3100" \
  -b /tmp/mnm-cookies.txt -d '{"requestType":"human"}'

# 4. Create company → ⚠️ NOTE LE NOUVEAU company_id retourné, il sera DIFFÉRENT
COMPANY_RESP=$(curl -sX POST http://localhost:3100/api/companies \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3100" \
  -b /tmp/mnm-cookies.txt -d '{"name":"CBA Demo"}')
echo "$COMPANY_RESP" | jq .id
CID=$(echo "$COMPANY_RESP" | jq -r .id)

# 5. Git provider config (NÉCESSITE $GITLAB_TOKEN dans ton env)
curl -sX PUT "http://localhost:3100/api/companies/$CID/governed-workflows/git-provider-config" \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3100" \
  -b /tmp/mnm-cookies.txt \
  -d "{\"kind\":\"gitlab\",\"providerId\":\"cba-lab\",\"baseUrl\":\"https://lab.cbainfo.fr\",\"projectId\":\"tom.andrieu/mnm-demo\",\"token\":\"$GITLAB_TOKEN\"}"

# 6. Add paths (PUT endpoint ne les supporte pas)
docker compose exec -T db psql -U mnm -d mnm -c \
  "UPDATE config_layer_items \
   SET config_json = config_json || jsonb_build_object('paths', jsonb_build_object('agents','agents','workflows','workflows')) \
   WHERE company_id = '$CID' AND item_type = 'git_provider';"

# 7. Restart server (cache flush)
docker compose restart server
until docker compose ps server --format "{{.Status}}" | grep -q "healthy"; do sleep 3; done

# 8. Tu reprends à Step A du playbook ci-dessus avec le nouveau $CID
echo "NEW company_id = $CID"
```

---

## 4. Pièges + troubleshooting

### Conflits de ports
- Si `bun run dev` tourne en parallèle (PID :3100), Docker accepte de bind sur 0.0.0.0 mais des requêtes peuvent atterrir sur l'un ou l'autre → KILL `bun run dev` avant tout test.
- Vérif : `docker compose exec server curl -s http://localhost:3100/api/health` retourne **Postgres 17.9** (Docker), `bun run dev` retourne **18.1** (embedded).

### CRLF Windows
- Si on rebuild après modif du repo : `docker/entrypoint.sh` peut récupérer du CRLF au prochain `git checkout`. Le Dockerfile a un `sed -i 's/\r$//'` qui neutralise. Si jamais le container restart-loop avec `exec entrypoint.sh: no such file or directory` → c'est ça.

### Cache resolveGitProvider
- Process-lifetime. Tout changement sur le `config_layer_item` git_provider exige `docker compose restart server`. Pas de SIGHUP, pas de reload chaud.

### Origin header pour les routes "board"
- Toutes les routes board mutation exigent `Origin: http://localhost:3100` (CORS-like check). Curl sans Origin → 403 "Board mutation requires trusted browser origin". Browser le fait nativement, en headless faut le forcer.

### `paths` config absente du PUT endpoint
- `PUT /git-provider-config` schéma zod ne contient PAS `paths`. Faut faire un SQL UPDATE manuel pour l'ajouter (cf. step 6 du headless cold-start). À fixer un jour côté backend.

### Pre-existing failures (à ignorer)
- `bun test` plante sur Windows à cause d'une DLL `isolated-vm` cassée. Tests passent en CI Linux. Confirmé par les reviewers Phase 5.
- `bun run typecheck` à la racine plante : `Cannot find module '@embedded-postgres/windows-x64'`. Pre-existing, non bloquant pour la démo (Docker n'utilise pas embedded-postgres).

---

## 5. Documents associés

- Spec refacto Git-first agents : `docs/superpowers/specs/2026-04-26-mnm-git-first-agents-design.md`
- Plan exécution : `docs/superpowers/plans/2026-04-26-mnm-git-first-agents.md`
- Log orchestration overnight : `docs/superpowers/plans/2026-04-26-orchestration-log.md`
- Reviews :
  - Code review : `docs/superpowers/reviews/2026-04-26-code-review.md`
  - PM validation : `docs/superpowers/reviews/2026-04-26-pm-validation.md`
  - Re-review fix verification : `docs/superpowers/reviews/2026-04-26-re-review.md`
- Migration scripts (M1 + M2) : `scripts/migrate-2026-04-26-{mnm-demo.sh,db.sql}`

---

## 6. Commits clés (chronologique)

```
2a58f96 fix(docker): missing workspace packages + CRLF + MNM_SECRETS_KEY
0564479 docs(orchestration): finalize log + runbook for Tom
f3b9094 docs(review): re-review round 2 — verify fix-dev closures
fdb0471 chore(scripts): OPS-1 commit M1 + M2 migration scripts
9c23218 chore(tests): apply MINOR/NIT review findings
35d7c2f fix(governed-workflow-files): M-FIX-3 reject traversal
c816b43 fix(mcp): M-FIX-2 create_agent throws via wrap()
9e0afcc fix(db): M-FIX-1 idempotent migration 0067
68a2872 feat(db): B-FIX-2 partial unique index (company_id, name)
e91f640 fix(governed-workflows): B-FIX-1 syncEnvironment helper
a140402 feat(governed-workflows): P11 E2E integration test
[…11 commits dev Phase 2…]
```
