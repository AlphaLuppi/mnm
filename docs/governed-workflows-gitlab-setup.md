# Pointer les Governed Workflows vers un repo GitLab (ex. gitlab.example.com)

Par défaut, en mode `local_trusted`, MnM stocke les `workflow.json` dans un repo bare local (`~/.mnm/dev-workflows-bare/repo.git`). Ce guide explique comment pointer une company vers un **vrai** repo GitLab — par exemple `https://gitlab.example.com/your-username/mnm-workflows-demo` — pour que `create_governed_workflow` (UI + MCP) y commit directement.

Le mécanisme est per-company via un `config_layer_item` de type `git_provider`.

## Prérequis

1. **Un repo GitLab vide**. Va sur https://gitlab.example.com, crée un projet (ex. `mnm-workflows-tom`) initialisé avec un README. Note son **path** (`your-username/mnm-workflows-demo`) ou son **numeric project ID** (visible dans Settings → General).

2. **Un Personal Access Token (PAT)** avec les scopes :
   - `api`
   - `read_repository`
   - `write_repository`

   GitLab → User Settings → Access Tokens → Create token. **Copie-le immédiatement** — GitLab ne le ré-affiche pas.

3. **Le companyId MnM** que tu veux configurer. En local :
   ```bash
   curl -sS http://localhost:3100/api/companies | jq -r '.[0].id'
   # ex: c26214de-ada2-4f71-ba6f-90c686a6dd5c
   ```

## Configuration

Un seul appel REST `PUT /api/companies/:companyId/governed-workflows/git-provider-config`. Idempotent — ré-exécuter met à jour la config existante.

```bash
export COMPANY_ID="c26214de-ada2-4f71-ba6f-90c686a6dd5c"
export GITLAB_TOKEN="glpat-xxxxxxxxxxxxxxxx"

curl -sS -X PUT \
  "http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows/git-provider-config" \
  -H "Content-Type: application/json" \
  -d "{
    \"kind\": \"gitlab\",
    \"providerId\": \"gitlab:primary\",
    \"baseUrl\": \"https://gitlab.example.com\",
    \"projectId\": \"your-username/mnm-workflows-demo\",
    \"token\": \"$GITLAB_TOKEN\"
  }"
```

Réponse attendue :
```json
{
  "ok": true,
  "kind": "gitlab",
  "layerId": "...",
  "restartRequired": true,
  "hint": "The resolveGitProvider cache is process-lifetime — restart the MnM dev server once for this change to take effect."
}
```

### ⚠️ Restart requis

Le `createResolveGitProvider` cache le `GitProvider` par `companyId` au premier appel et ne l'invalide jamais. Tu dois donc **redémarrer `bun run dev` une fois** après cette config pour que les prochains `create_governed_workflow` / `launch_governed_step` utilisent GitLab.

## Vérification

Après restart :

```bash
# 1. Crée un workflow — il doit commit sur gitlab.example.com
curl -sS -X POST \
  "http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows" \
  -H "Content-Type: application/json" \
  -d '{
    "definition": {
      "apiVersion": "mnm/v1",
      "kind": "GovernedWorkflow",
      "name": "gitlab-smoke",
      "description": "Smoke test pour vérifier le push GitLab",
      "steps": [{"id":"s1","agent":"claude_code","prompt_context":{"task":"echo"}}]
    },
    "commitMessage": "feat(gitlab-smoke): initial"
  }'
```

Réponse attendue : `{commitSha, newGitTag: "gitlab-smoke/v1.0.0", created: true}`.

Puis va voir ton repo GitLab : tu dois trouver le fichier `gitlab-smoke/workflow.json` sur `main` et le tag `gitlab-smoke/v1.0.0`.

## Rollback vers le local bare repo

```bash
curl -sS -X PUT \
  "http://localhost:3100/api/companies/$COMPANY_ID/governed-workflows/git-provider-config" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "local",
    "providerId": "local:dev",
    "repoDir": "~/.mnm/dev-workflows-bare/repo.git"
  }'
```
(Adapter le chemin pour Windows : `C:~/.mnm/dev-workflows-bare/repo.git`.)

Puis redémarrer le dev server.

## Troubleshooting

| Symptôme | Cause probable | Fix |
|---|---|---|
| Réponse `GIT_PROVIDER_MISCONFIG` au prochain create | Un champ obligatoire est vide dans `configJson` | Re-PUT avec tous les champs (baseUrl, projectId, token, providerId) |
| `401 Unauthorized` depuis le `commitFile` | Scopes PAT insuffisants | Regénère un PAT avec `api` + `read_repository` + `write_repository` |
| `403 Forbidden` sur `createTag` | Branche `main` protégée sur GitLab OU PAT sans `write_repository` | Autorise les push de tag sur `main` dans Settings → Repository → Protected branches / tags |
| `404 Not Found` sur `POST /projects/:id/repository/...` | Mauvais `projectId` | Utilise soit le numeric ID (visible sur la page du projet), soit le path URL-encodé `your-username%2Fmnm-workflows-tom` |
| Les anciens workflows (local) ont disparu de `list_governed_workflows` | Normal : MnM ne liste que ce qui est dans le provider actuel. Les rows DB pointent encore vers l'ancien sha/tag et ne trouveront plus les fichiers | Soit tu archives les anciennes rows, soit tu les recrées dans GitLab |
| Changement pas pris en compte | Cache `resolveGitProvider` pas invalidé | **Redémarre `bun run dev`** après chaque PUT git-provider-config |

## Sécurité

- Le PAT est stocké **en clair** dans `config_layer_items.config_json` (JSONB). Ne commit jamais le PAT ailleurs. En prod, utiliser un secret manager.
- Le endpoint `PUT /git-provider-config` est gardé par `workflows:create`. En production, préférer un permission admin dédiée.
- Le PAT a accès à **toute la portée** de ses scopes sur GitLab — ne pas le réutiliser pour d'autres usages.

## Prod vs dev

- En `local_trusted` (dev), fallback = local bare repo. Override = ce guide.
- En `authenticated` (prod), il n'y a pas de fallback utile — chaque company DOIT avoir son `git_provider` configuré, sinon `GIT_PROVIDER_MISCONFIG` à la première requête. Prévoir un onboarding qui exige cette config.
