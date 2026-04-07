# PO Validation Report — Universal Git Provider + Generic Credential Store

**Date:** 2026-04-07
**Validateur:** PO Agent
**Documents revises:**
- `2026-04-07-universal-git-credentials-design.md` (tech-spec)
- `2026-04-07-architecture-blueprint.md` (blueprint architecture)
- `2026-04-07-ux-design-blueprint.md` (blueprint UX)

---

## 1. Gaps identifies

### GAP-01 — Migration DB : CHECK constraint manquant sur `config_layer_items.item_type`

**Severite : BLOQUANT**

La migration 0052 definit un CHECK constraint sur `config_layer_items`:
```sql
"item_type" text NOT NULL CHECK ("item_type" IN ('mcp', 'skill', 'hook', 'setting'))
```

La migration 0061 proposee ne modifie PAS ce CHECK constraint. Toute tentative d'INSERT d'un item avec `item_type = 'git_provider'` echouera avec une violation de contrainte.

**Action requise :** Ajouter dans la migration 0061 :
```sql
ALTER TABLE config_layer_items DROP CONSTRAINT IF EXISTS config_layer_items_item_type_check;
ALTER TABLE config_layer_items ADD CONSTRAINT config_layer_items_item_type_check
  CHECK (item_type IN ('mcp', 'skill', 'hook', 'setting', 'git_provider'));
```

### GAP-02 — Migration DB : RLS policy references l'ancien nom de table

**Severite : MOYEN**

La migration 0052 cree une RLS policy `tenant_isolation` sur `user_mcp_credentials`. Apres le `ALTER TABLE RENAME`, la policy continue de fonctionner (PostgreSQL la suit automatiquement lors d'un RENAME), mais son nom interne reste lie a l'ancien nom. Ce n'est pas bloquant, mais la migration devrait idealement recreer la policy avec un nom propre pour la maintenabilite.

### GAP-03 — Migration DOWN manquante

**Severite : FAIBLE**

Aucune migration de rollback n'est definie (le projet n'a aucune migration DOWN existante — confirme par grep). Acceptable si c'est la convention du projet, mais a noter pour le risque.

### GAP-04 — Signature `storePat` incoherente entre les blueprints

**Severite : BLOQUANT (incoherence spec)**

Le blueprint architecture (ligne 720) definit :
```typescript
storePat: (companyId: string, itemId: string, token: string) =>
  api.post<...>(`...`, { material: { token } })
```

Le blueprint UX (ligne 526 et 1015) definit :
```typescript
storePat: (companyId: string, itemId: string, material: { token: string }) =>
  api.post<...>(`...`, { material })
```

**Les signatures sont differentes** — le blueprint archi passe `token: string` directement, le blueprint UX passe `material: { token: string }`. Le composant `CredentialDialog` dans le blueprint UX appelle `configLayersApi.storePat(companyId, itemId, { token: patValue.trim() })`, ce qui suppose la signature UX.

**Action requise :** Aligner sur la signature UX (`material: { token: string }`), car c'est elle qui correspond a l'appel dans le composant.

### GAP-05 — Mode du `CredentialDialog` : incoherence `"mcp"/"git"` vs `"env"/"pat"`

**Severite : MOYEN**

Le blueprint architecture definit le mode comme `"env" | "pat"` (ligne 754-764).
Le blueprint UX definit le mode comme `"mcp" | "git"` (ligne 359, type `CredentialDialogMode`).

Ces deux conventions sont utilisees dans des fichiers differents mais referent au meme composant. Le dev qui implementera sera confus.

**Action requise :** Choisir UNE convention. Recommandation : `"mcp" | "git"` (blueprint UX) car plus semantique et coherent avec le `mode` passe a `ItemCredentialActions`.

### GAP-06 — `GitProviderIcon` : deux implementations differentes

**Severite : FAIBLE**

Le blueprint architecture (lignes 1104-1158) et le blueprint UX (lignes 80-172) proposent deux implementations differentes du meme composant `GitProviderIcon.tsx` :
- Archi : SVGs en viewBox 0 0 24, `className` seulement
- UX : SVGs en viewBox 0 0 16, props `SVGProps<SVGSVGElement>` complet

Les SVG paths sont completement differents. Le dev ne saura pas lequel implementer.

**Action requise :** Choisir une seule implementation. Le blueprint UX (viewBox 16) est plus minimaliste et mieux adapte aux petites tailles (h-3, h-4) utilisees dans le projet.

### GAP-07 — `GitProviderItemEditor` : deux implementations differentes

**Severite : FAIBLE**

Meme probleme — le blueprint archi (lignes 1040-1099) utilise un pattern `<div>` sans `<form>`, detection onChange immediate, boutons "Annuler"/"Sauvegarder" en francais. Le blueprint UX (lignes 206-305) utilise un `<form>` avec onBlur detection, boutons "Add"/"Cancel" en anglais.

**Action requise :** Le blueprint UX est plus complet (gestion du onBlur, etats documentes). Privilegier celui-ci.

### GAP-08 — Permission `mcp:connect` pour le endpoint PAT

**Severite : MOYEN**

Le blueprint architecture (ligne 600) utilise `requirePermission(db, "mcp:connect")` pour le nouveau endpoint `POST /credentials/:itemId/pat`. Ce nom de permission est specifique MCP alors que l'endpoint est generique.

**Options :**
1. Garder `mcp:connect` pour le MVP (moins de changements)
2. Creer une permission generique `credentials:manage`

**Recommandation :** Garder `mcp:connect` pour le MVP, ajouter une story de cleanup permissions en backlog V2.

### GAP-09 — Fichier `server/src/routes/index.ts` non couvert

**Severite : FAIBLE**

Le fichier `server/src/routes/index.ts` est mentionne dans le grep comme importateur de `mcp-credential`/`mcp-oauth`, mais aucun blueprint ne couvre sa modification. Verifier s'il re-exporte les routes (si oui, a mettre a jour).

### GAP-10 — Export `sanitizeEnvKey` manquant dans la tech-spec

**Severite : FAIBLE**

La fonction `sanitizeEnvKey` est definie dans `git-provider.ts` (blueprint archi, ligne 412) et utilisee dans `execute.ts` (ligne 1201), mais n'est pas mentionnee dans la tech-spec comme export de `@mnm/shared`. Le blueprint archi le couvre (ligne 419), mais pas la tech-spec.

### GAP-11 — `company-portability.ts` references GitHub directement

**Severite : HORS SCOPE (confirme)**

Le service `company-portability.ts` utilise `raw.githubusercontent.com` pour l'import. C'est explicitement marque hors scope dans la tech-spec (section 3.10) et confirme par le code. OK.

---

## 2. Risques supplementaires

### RISK-01 — Drizzle schema `user_mcp_credentials.ts` et `drizzle-kit`

Drizzle utilise le nom de fichier et la table dans le schema pour generer les migrations. Renommer le fichier `user_mcp_credentials.ts` → `user_credentials.ts` ET changer le nom de table dans `pgTable()` peut declencher une migration auto-generee par `drizzle-kit generate` qui DROP + CREATE la table au lieu de RENAME. 

**Mitigation :** La migration 0061 est ecrite a la main (SQL brut), donc pas de risque si le dev n'execute PAS `drizzle-kit generate` apres le rename. Documenter cette contrainte explicitement.

### RISK-02 — Azure DevOps URL patterns complexes

Les URLs Azure DevOps ont plusieurs formats :
- `https://dev.azure.com/{org}/{project}/_git/{repo}`
- `https://{org}.visualstudio.com/{project}/_git/{repo}`
- `git@ssh.dev.azure.com:v3/{org}/{project}/{repo}`

La detection couvre `dev.azure.com` et `ssh.dev.azure.com` et `vs-ssh.visualstudio.com`, mais PAS `{org}.visualstudio.com` (pattern wildcard). Un utilisateur avec un ancien compte Azure DevOps verrait "Generic" au lieu de "Azure DevOps".

**Mitigation :** Ajouter une heuristique `host.includes("visualstudio")` dans la detection, comme c'est fait pour gitlab/gitea.

### RISK-03 — Ports custom dans les URLs self-hosted

Les URLs avec port (`gitlab.corp.com:8443/org/repo`) ne sont pas couvertes dans les tests de detection. `new URL("https://gitlab.corp.com:8443")` donne `hostname = "gitlab.corp.com"` (correct, sans port). Mais `git@gitlab.corp.com:8443:org/repo.git` cassera le parsing SSH (le regex attend `git@host:owner/repo`, pas `git@host:port:owner/repo`).

**Mitigation :** La tech-spec ne couvre pas les URLs SSH avec port (rare). Documenter comme limitation connue ou ajouter un regex plus robuste pour le SSH.

### RISK-04 — `GIT_TOKEN_` env var naming collision

Si un utilisateur a deux workspaces sur le meme host (ex: deux repos GitHub differents), un seul `GIT_TOKEN_GITHUB_COM` sera injecte. C'est correct (meme token pour meme host), mais le nommage ne permet pas de distinguer si un token est lie a un repo specifique vs un host entier.

**Mitigation :** Acceptable pour le MVP (un PAT par host). Documenter la limitation.

### RISK-05 — Race condition : 301 redirect POST/DELETE perd le body

Les redirects 301/307 pour backward compat :
- `GET` avec 301 : OK, le navigateur/client suit
- `POST` avec 307 : OK, le body est preserve
- `DELETE` avec 307 : OK

Le blueprint archi (ligne 637) utilise 307 pour POST et DELETE, ce qui est correct. Mais la tech-spec (section 5.1) dit "301 redirect temporaire", ce qui est incorrect pour POST/DELETE (un 301 sur POST fait un GET selon la spec HTTP).

**Action requise :** Confirmer que l'implementation utilise bien 307 (pas 301) pour POST et DELETE, comme dans le blueprint archi.

### RISK-06 — Multiples adapters references `AdapterExecutionContext`

Le type `AdapterExecutionContext` dans `packages/adapter-utils/src/types.ts` est partage entre 5 adapters : `claude-local`, `pi-local`, `opencode-local`, `cursor-local`, `codex-local`. L'ajout de `gitProviders?` est optionnel et ne casse pas les autres, mais seul `claude-local` l'utilise.

Les autres adapters ignorent `gitProviders`. Si un jour on veut supporter git credentials dans d'autres adapters, il faudra l'implementer dans chacun.

### RISK-07 — Audit events avec ancien `targetType`

Le service `mcp-credential.ts` utilise `targetType: "mcp_credential"` et `action: "mcp_credential.stored"` dans les audit events. Le blueprint archi (ligne 462) demande de renommer vers `"credential.stored"` et `targetType: "credential"`. 

Si des dashboards ou queries audit existants filtrent sur `"mcp_credential"`, ils casseront.

**Mitigation :** Verifier s'il existe des dashboards/queries qui filtrent sur ces valeurs. Si oui, garder les anciens noms ou ajouter un dual-write temporaire.

---

## 3. Criteres d'acceptance enrichis

### 3.1 Migration DB

- [ ] `INSERT INTO config_layer_items (..., item_type) VALUES (..., 'git_provider')` reussit (CHECK constraint mis a jour)
- [ ] `INSERT INTO user_credentials (..., provider) VALUES (..., 'pat')` reussit
- [ ] Les credentials MCP existants sont accessibles via `SELECT * FROM user_credentials` apres migration
- [ ] Les index renommes sont fonctionnels (tester `EXPLAIN ANALYZE` sur une requete typique)
- [ ] RLS policy fonctionne apres rename (tester avec `SET app.current_company_id`)

### 3.2 Backward compatibility

- [ ] `GET /api/companies/:cid/mcp-credentials` retourne 301 → `/credentials`
- [ ] `POST /api/companies/:cid/mcp-credentials/:itemId/api-key` retourne 307 → `/credentials/:itemId/secret`
- [ ] `DELETE /api/companies/:cid/mcp-credentials/:id` retourne 307 → `/credentials/:id`
- [ ] L'import `MCP_CREDENTIAL_PROVIDERS` depuis `@mnm/shared` fonctionne (backward alias)
- [ ] L'import `UserMcpCredential` depuis `@mnm/shared` fonctionne (backward alias)
- [ ] Les UI existantes (MCP) continuent de fonctionner identiquement apres le rename

### 3.3 Git Provider detection

- [ ] `github.com` → github
- [ ] `gitlab.com` → gitlab
- [ ] `gitlab.mycompany.com` → gitlab (self-hosted)
- [ ] `bitbucket.org` → bitbucket
- [ ] `dev.azure.com` → azure_devops
- [ ] `ssh.dev.azure.com` → azure_devops
- [ ] `gitea.io` → gitea
- [ ] `random.host.com` → generic
- [ ] `www.github.com` → github (strip www)
- [ ] `https://github.com/org/repo.git` → github (extract from URL)
- [ ] `git@github.com:org/repo.git` → github (SSH format)
- [ ] `git@gitlab.corp.com:org/repo.git` → gitlab (SSH + self-hosted)
- [ ] URL vide/invalide → ne crash pas, retourne generic ou null

### 3.4 UI — CredentialDialog

- [ ] Mode MCP : textarea KEY=VALUE, label "Secret env vars"
- [ ] Mode git : champ password unique, label "Personal Access Token"
- [ ] Le token n'est jamais affiche en clair apres stockage
- [ ] Le placeholder guide l'utilisateur ("ghp_xxx..." pour GitHub)

### 3.5 Runtime

- [ ] `resolveForAgent()` retourne `gitProviders` non vide quand un git provider est configure
- [ ] Le token est decrypte dans `ResolvedGitProvider.token`
- [ ] Le token n'apparait JAMAIS dans les logs
- [ ] `GIT_TOKEN_GITHUB_COM` est present dans les env vars du container Docker

### 3.6 Workspace UI

- [ ] `NewProjectDialog` accepte une URL GitLab/Bitbucket/self-hosted
- [ ] L'icone change dynamiquement en fonction de l'URL saisie
- [ ] `ProjectProperties` affiche l'icone du provider pour les workspaces existants
- [ ] Les repos GitHub existants continuent de fonctionner sans changement
- [ ] Le message d'erreur est clair quand l'URL n'est pas valide

---

## 4. Recommandations d'implementation

### 4.1 Ordre optimal corrige

Le graph de dependances dans le blueprint archi est globalement correct, avec une correction :

```
Phase 1 (strictement sequentiel):
  1.1 Migration DB (INCLURE le fix CHECK constraint sur config_layer_items.item_type)
  1.2 Rename shared (types, constants, git-provider.ts utils)
  1.3 Rename services backend
  1.4 Rename routes API
  1.5 Rename composants UI

Phase 2 (parallelisable apres 1.5):
  2.1 Runtime git_provider          → depend 1.3
  2.2 UI onglet + editor            → depend 1.5
  2.3 GitProviderIcon               → depend 1.2 (PEUT commencer des 1.2)
  2.4 Unifier mode CredentialDialog → depend 1.5

Phase 3 (apres Phase 2):
  3.1 Credential injection runtime  → inclus dans 2.1
  3.2 Heartbeat git token injection → depend 2.1
  3.3 Workspace UI universelle      → depend 2.3
```

### 4.2 Parallelisation possible

- **2.3 GitProviderIcon** peut etre developpe en parallele avec les stories 1.3-1.5, car il ne depend que de `GitProviderType` (1.2)
- **3.3 Workspace UI** peut etre developpe en parallele avec 3.2, car il ne depend que de `GitProviderIcon` (2.3)
- **Tests unitaires** de `detectGitProvider` et `parseRepoUrl` peuvent etre ecrits des la story 1.2

### 4.3 Risque de regression principal

Le rename massif de Phase 1 est le risque #1. Recommandation :
1. Faire une branche dedicee `feat/credential-store-rename`
2. Un seul commit atomique pour toute la Phase 1
3. `bun run typecheck` + `bun run build` apres CHAQUE story
4. NE PAS executer `drizzle-kit generate` apres le rename du fichier schema

---

## 5. Checklist QA ChromeMCP

### Scenario 1 — Regression MCP credentials
1. Ouvrir un agent existant avec des MCP servers configures
2. Verifier que l'onglet "MCP Servers" affiche les items correctement
3. Verifier que le badge de status credential est visible (Connected/Pending)
4. Cliquer "Update secrets" → verifier que le dialog s'ouvre en mode MCP (textarea KEY=VALUE)
5. Stocker un nouveau secret → verifier que le badge passe a "Connected"
6. Revoquer le credential → verifier que le badge passe a "No secrets"

### Scenario 2 — Nouvel onglet Git Providers
1. Ouvrir le LayerEditor d'un agent
2. Verifier que l'onglet "Git Providers" est visible (entre MCP et Skills)
3. Cliquer sur l'onglet → verifier "No git providers configured."
4. Cliquer "Add Git Provider" → verifier que le formulaire apparait

### Scenario 3 — Ajouter un git provider GitHub
1. Dans le formulaire, coller `https://github.com/org/repo`
2. Quitter le champ (tab/click outside)
3. Verifier que le bloc "GitHub — github.com" apparait avec l'icone GitHub
4. Cliquer "Add" → verifier que l'item apparait dans la liste
5. Verifier badge "No secrets" et bouton "Add token"
6. Cliquer "Add token" → verifier le dialog PAT (champ password, pas textarea)
7. Saisir un token → "Store token" → verifier badge "Connected"

### Scenario 4 — Ajouter un git provider GitLab self-hosted
1. Dans le formulaire, coller `gitlab.mycompany.com`
2. Verifier l'icone GitLab et le label "GitLab (self-hosted)"
3. Verifier que le host affiche est "gitlab.mycompany.com"

### Scenario 5 — Workspace UI universelle
1. Creer un nouveau projet
2. Section workspace → cliquer "A git repo"
3. Verifier que le label est "A git repo" (pas "A github repo")
4. Verifier que le placeholder est generique
5. Coller `https://gitlab.com/org/repo` → verifier que la validation accepte
6. Verifier que l'icone dynamique passe a GitLab
7. Coller `https://github.com/org/repo` → verifier que ca fonctionne aussi (regression)

### Scenario 6 — ProjectProperties icone dynamique
1. Ouvrir un projet existant avec un repo GitHub
2. Verifier que l'icone GitHub s'affiche a cote de l'URL du workspace
3. Si possible, tester avec un repo non-GitHub pour verifier l'icone generique

### Scenario 7 — Edge cases URL
1. Tester `git@github.com:org/repo.git` dans le NewProjectDialog → doit etre accepte
2. Tester une URL invalide (ex: `not-a-url`) → doit afficher un message d'erreur clair
3. Tester une URL sans owner/repo (ex: `https://github.com/`) → doit etre rejete

### Scenario 8 — Responsive mobile
1. Reduire la fenetre a une largeur mobile (375px)
2. Verifier que le formulaire GitProviderItemEditor est lisible
3. Verifier que le CredentialDialog mode PAT s'affiche correctement
4. Verifier que les boutons dans ItemCredentialActions ne debordent pas

---

## 6. Resume executif

| Categorie | Nombre | Bloquants |
|-----------|--------|-----------|
| Gaps identifies | 11 | 2 (GAP-01, GAP-04) |
| Risques supplementaires | 7 | 0 (tous mitigeables) |
| Criteres d'acceptance ajoutes | 28 | — |
| Scenarios QA ChromeMCP | 8 | — |

**Verdict :** Le sprint peut demarrer apres correction des 2 gaps bloquants (CHECK constraint config_layer_items + alignement signature storePat). Les autres gaps et risques sont des ameliorations a integrer dans les stories correspondantes.

---

*Generated by PO Validation Agent*
