# Plan — GitHub Provider (parité GitLab + private orgs)

Date : 2026-05-04
Auteur : Claude (validation Tom 2026-05-04)
Branche cible : `feat/github-provider` (à créer depuis `master`)

## Contexte

Le Sprint 1 + Phase 4 du chantier Connectors-Platform est shippé. GitHub existe
aujourd'hui comme **template OAuth** dans
[`server/src/services/connector-templates.ts:55-68`](../../server/src/services/connector-templates.ts) — donc
`getUserToken("github")` est utilisable côté serveur dès qu'un admin crée le
connector. Mais toute la couche **git-protocol** (clone / commit / tag / PR
review) est **GitLab-hardcodée** :

- Pas de classe `GitHubProvider` dans
  [`packages/git-provider/src/`](../../packages/git-provider/src/index.ts) —
  uniquement `GitlabProvider` + `LocalBareRepoProvider`.
- [`server/src/mcp/build-mcp-services.ts:404-434`](../../server/src/mcp/build-mcp-services.ts)
  ne dispatche que `kind === "gitlab" | "local"`.
- [`server/src/mcp/build-mcp-services.ts:257-258`](../../server/src/mcp/build-mcp-services.ts)
  hardcode `connectorRequired("gitlab", "GitLab")`.
- [`server/src/services/cc-plugin-import/source-provider-factory.ts:82-86`](../../server/src/services/cc-plugin-import/source-provider-factory.ts)
  throw explicite `"only supports kind=gitlab in V1"`.

Pour les **private repos dans des private orgs GitHub**, OAuth seul ne suffit pas
proprement : friction SSO SAML, scopes user-level qui exposent toutes les repos
de l'user, pas de granularité per-repo. La bonne primitive GitHub est la
**GitHub App** (install par un org admin, scopes per-repo, installation token
1h server-side).

## Décisions verrouillées (Tom 2026-05-04)

- **D1 — Per-company App.** Chaque company crée sa propre App GitHub, paste App
  ID + private key (.pem) dans MnM. Audit trail trace au company admin qui a
  registered l'App (cohérent §1.7 — la "service account" du flow App = l'admin
  company qui l'a setup).
- **D2 — Pas de GitHub Enterprise Server (GHES) en V0.** github.com only. Aucun
  champ `instanceBaseUrl` dans le template. Refacto trivial plus tard si besoin.
- **D3 — Scénarios couverts** : github.com public repo, repo privée standalone,
  org publique avec repos public/privé, org privée avec repo privée. Repos
  hors-org (user repos) supportés via OAuth ou App installée sur le user.
- **D4 — Pas de migration GitLab → GitHub V0.** Le provider git est choisi par
  l'admin de la company **au setup**. Coexistence possible si une company veut
  les deux pour des workflows différents.
- **D5 — Étendre l'interface `GitProvider`.** PR reviews ≠ MR approvals shape.
  MnM doit rester provider-agnostique : on introduit une abstraction
  `CodeReviewState` unifiée (cf Phase 2).
- **D6 — Un seul template `github` unifié.** Pas de second template
  `github-app`. La GitHub App est une **option de configuration** sur le
  connector `github` (l'admin company peut "ajouter une App" en plus de
  l'OAuth). Le résolveur côté serveur dispatche automatiquement : si une App
  est configurée et installée sur le repo cible → mode App, sinon mode OAuth
  user. UX : 1 seule card dans le tile grid, wizard adaptatif.
- **D7 — Commit identity = user partout.** Pour tout commit fait via MnM
  (OAuth ou App), `author` ET `committer` du commit git sont l'**user humain**
  qui a triggered le workflow (jamais "MnM-AppName[bot]"). Pour les ops
  système (CAO / Watchdog / Nightly), §1.7 dit l'identité = admin instance qui
  a setup le job, donc même règle : author = committer = cet admin.

## Objectifs

1. GitHub utilisable comme provider git first-class à parité fonctionnelle avec
   GitLab pour : Governed Workflows runtime, CC plugin importer, Workflow Studio
   file ops, workflow hooks `helpers.http`, strict-mode 412
   `CONNECTOR_REQUIRED`, CAO / Watchdog / Nightly Synthesis.
2. Support des **private repos dans private orgs** via GitHub App per-company.
3. **Dual-flow auth** : App pour les write ops, OAuth user pour résoudre
   `authorName`/`authorEmail` du commit (préserve §1.7 traçabilité humaine).
4. Zero régression GitLab. Tests `bun run typecheck` 17/17 + Vitest + E2E
   passent à chaque commit.

## Hors-scope V0 (suivis explicites)

- GitHub Enterprise Server self-hosted (D2).
- Webhook ingestion (`installation.suspended`, `pull_request.opened`, `push`,
  …) — utilité pour CAO live triggers, à traiter en chantier dédié.
- Migration helper GitLab → GitHub (D4).
- Bitbucket / Gitea / Azure DevOps (les types existent dans
  [`packages/shared/src/utils/git-provider.ts`](../../packages/shared/src/utils/git-provider.ts)
  mais ce plan ne les implémente pas).

## Phase 1 — GitHub App per-company infrastructure (~2.5j)

**Objectif** : stocker App credentials chiffrées, mint installation tokens,
recevoir le callback d'installation sur une org.

**Steps** :
1. Migration `0080_github_apps.sql` :
   - Table `github_apps` :
     `(id uuid pk, company_id uuid fk → companies, connector_id uuid fk → oauth_connectors, app_id text, app_slug text, private_key_iv bytea, private_key_ciphertext bytea, private_key_tag bytea, webhook_secret_iv bytea nullable, webhook_secret_ciphertext bytea nullable, webhook_secret_tag bytea nullable, created_by_user_id text fk → "user", created_at timestamptz default now(), revoked_at timestamptz nullable)`.
   - Table `github_app_installations` :
     `(id uuid pk, github_app_id uuid fk → github_apps cascade, installation_id text not null, account_login text, account_type text check in ('User','Organization'), account_id bigint, repository_selection text check in ('all','selected'), suspended_at timestamptz nullable, created_at timestamptz default now())`.
     Unique `(github_app_id, installation_id)`.
   - RLS policies AS RESTRICTIVE FOR ALL `tenant_isolation` sur `company_id`
     (pattern existant). Tracker NEW-S1 dans le test setup (PERMISSIVE temporaire
     comme HIGH-Q3).
2. Service `server/src/services/github-app.ts` :
   - `createGitHubApp(input)` — chiffre la private key via `secret-crypto.ts`
     (pattern Sprint 1). Validation : on tente un `POST` JWT-signé sur
     `https://api.github.com/app` pour vérifier que la clé est valide avant
     persistence.
   - `mintInstallationToken(companyId, githubAppId, installationId)` — JWT RS256
     signé avec la private key déchiffrée (TTL 10min côté GitHub), puis
     `POST /app/installations/:id/access_tokens` → token TTL 1h. Cache in-memory
     keyed `(githubAppId, installationId)` avec TTL 55min. Advisory lock pour
     éviter mint concurrent (pattern MED-B1).
   - `listInstallations(companyId, githubAppId)` — `GET /app/installations` avec
     pagination, sync vers la table `github_app_installations`.
   - `assertInstallationActive(githubAppId, installationId)` — 409 si
     `suspended_at IS NOT NULL`.
   - `revokeGitHubApp(githubAppId)` — soft-delete, `revoked_at = now()`.
3. **PAS de nouveau template** (D6). Le template existant `slug: "github"`
   (déjà dans
   [`server/src/services/connector-templates.ts:55-68`](../../server/src/services/connector-templates.ts))
   reste l'unique entry. La GitHub App est une **option de configuration**
   attachée au même `connector_id` :
   - La table `github_apps` est liée par `connector_id FK → oauth_connectors`
     du connector `github` de la company.
   - 0 ou 1 App par connector (unique sur `connector_id`).
   - Le template ne change pas. Aucune extension du `ConnectorTemplateType`
     union nécessaire.
4. Routes REST admin (montées sous `/companies/:companyId`) :
   - `POST /connectors/:connectorId/github/app` — body `{ appId, privateKey, webhookSecret? }`. Permission `company:manage_connectors`. Crée la row `github_apps` liée au connector.
   - `GET /connectors/:connectorId/github/app` — retourne la config App (private key masquée, juste `appId`, `appSlug`, dates) et la liste des installations actives.
   - `POST /connectors/:connectorId/github/app/installations/sync` — re-sync depuis GitHub.
   - `DELETE /connectors/:connectorId/github/app` — soft-delete + supprime cache tokens. L'OAuth du connector reste actif.
5. Callback handler `/connectors/github/app-install/callback` (nouveau dans
   [`server/src/routes/connectors-callback.ts`](../../server/src/routes/connectors-callback.ts))
   qui reçoit `installation_id` + `setup_action=install` (et optionnellement
   `code` pour le user OAuth combiné), upsert dans `github_app_installations`,
   redirect vers `/admin/connectors/:connectorId?focus=app-installations`.

**Acceptance** :
- Admin company peut attacher une App à un connector `github` existant via
  REST puis via UI (Phase 5).
- Org admin peut installer l'App sur son org, callback enregistre
  `installation_id` + `account_login`.
- `mintInstallationToken` retourne un token utilisable (test e2e :
  `GET /installation/repositories` répond 200).
- RLS : test e2e clone HIGH-Q3 vérifie qu'un membership company A ne voit
  jamais les rows company B sur `github_apps` ni `github_app_installations`.
- Private key jamais loggée. Audit trail via `oauth_connectors_audit` enrichi.

**Files actifs** :
```
packages/db/src/migrations/0080_github_apps.sql + .test.ts
packages/db/src/schema/{github_apps,github_app_installations}.ts
server/src/services/github-app.ts
server/src/services/__tests__/github-app.test.ts
server/src/routes/github-app.ts
server/src/routes/__tests__/github-app.test.ts
server/src/routes/connectors-callback.ts (nouvelle route /github/app-install/callback)
server/src/app.ts (mount routes github-app)
server/src/__tests__/github-apps.rls.e2e.test.ts (clone HIGH-Q3)
```

## Phase 2 — `GitHubProvider` class + interface extension (~2j)

**Objectif** : implémentation complète du contrat `GitProvider` pour GitHub +
abstraction `CodeReviewState` agnostique.

**Steps** :
1. Refactor `packages/git-provider/src/types.ts` :
   - Renommer `getMergeRequestApprovals(mrId)` en
     `getCodeReviewState(reference)` retournant `CodeReviewState` :
     ```ts
     export type CodeReviewState = {
       requiredApprovals: number;        // GitLab: approvals_required ; GitHub: required reviewers count from branch protection (best-effort)
       currentApprovals: number;         // count of unique reviewers in APPROVED state (GitHub) or approved_by (GitLab)
       reviewers: Array<{
         login: string;
         state: "approved" | "changes_requested" | "commented" | "pending" | "dismissed";
         submittedAt?: string;
       }>;
       raw: unknown;                     // provider-specific payload pour gates avancés
     };
     ```
   - Mettre à jour `GitlabProvider` pour produire ce shape (mapping :
     `approvals_required` → `requiredApprovals`, `approved_by[].user.username` →
     `reviewers` state="approved"). `raw` = payload GitLab original.
   - Tous les call sites (gates, gate-runner) consomment maintenant
     `CodeReviewState`. Audit + update.
2. Nouveau `packages/git-provider/src/github-provider.ts` :
   - Constructor accepte `{ mode: "user-oauth", token }` ou
     `{ mode: "app-installation", mintToken: () => Promise<string> }` (closure
     qui hit `mintInstallationToken` avec re-mint au TTL).
   - Implémenter chaque méthode du contrat via `@octokit/rest` (à ajouter aux
     deps du package). **Toutes les méthodes d'écriture utilisent le path
     low-level Git Data API (`git.createBlob` + `git.createTree` +
     `git.createCommit` + `git.updateRef`) afin de pouvoir injecter `author`
     ET `committer` = `commitIdentity` (D7 strict). Le high-level
     `repos.createOrUpdateFileContents` est INTERDIT car il force
     `committer = App[bot]` en mode App. Conséquence assumée : commits
     marqués "Unverified" dans GitHub UI (badge gris) — follow-up GPG
     signing tracké hors V0.**
     - `fetchBlob(repo, ref, path)` → `repos.getContent` (lecture, pas
       d'enjeu D7).
     - `commitFile(repo, branch, path, content, message, commitIdentity)` →
       implémenté en délégation vers `commitMultipleFiles` avec un seul
       fichier (réutilise le path low-level, garantit D7).
     - `commitMultipleFiles(repo, branch, files, message, commitIdentity)` →
       flow `git.getRef` (head SHA) + `git.getCommit` (current tree) +
       `git.createBlob` × N + `git.createTree` + `git.createCommit` (avec
       `author` ET `committer` = `commitIdentity`) + `git.updateRef`.
     - `createTag(repo, ref, name, message, commitIdentity)` → `git.createTag`
       avec `tagger` = `commitIdentity` + `git.createRef` (les annotated tags
       acceptent `tagger`, qui est le user).
     - `fetchTree(repo, ref, path?, recursive?)` → `git.getTree({ recursive: 1 })`
     - `mergeBranch(repo, base, head, strategy?, commitIdentity?)` →
       `repos.merge`. `strategy` mappé : `merge` → default, `squash` →
       indisponible (GitHub PR-only) → fallback merge + warn. `commitIdentity`
       n'est pas honoré par `repos.merge` côté GitHub (limitation API : le
       merge commit author = qui détient le token). Documenté.
     - `deleteBranch(repo, branch)` → `git.deleteRef`.
     - `getCodeReviewState(prNumber)` → combine `pulls.listReviews` +
       `repos.getBranchProtection` (pour `requiredApprovals`).
3. Tests unitaires `packages/git-provider/src/__tests__/github-provider.test.ts`
   avec **msw** : mock `api.github.com` pour chaque méthode. Patterns happy +
   404 + 401 + rate limit (`X-RateLimit-Remaining: 0`).
4. Update `packages/git-provider/src/__tests__/gitlab-provider.test.ts` pour le
   nouveau shape `CodeReviewState`.
5. Export depuis `packages/git-provider/src/index.ts`.

**Acceptance** :
- `bun run typecheck` 17/17 pass après extension de l'interface.
- Vitest covers les 8 méthodes pour GitHub + le mapping GitLab.
- Round-trip manuel : créer une repo de test sur github.com (perso Tom), créer
  une App de test, commit un fichier via le provider, vérifier sur l'UI GitHub.

**Files actifs** :
```
packages/git-provider/src/types.ts (CodeReviewState + getCodeReviewState)
packages/git-provider/src/github-provider.ts
packages/git-provider/src/gitlab-provider.ts (mapping vers nouveau shape)
packages/git-provider/src/__tests__/github-provider.test.ts
packages/git-provider/src/__tests__/gitlab-provider.test.ts
packages/git-provider/src/index.ts
packages/git-provider/package.json (+ @octokit/rest, jsonwebtoken si pas déjà)
```

## Phase 3 — Plug GitHub dans le pipeline MCP services (~1.5j)

**Objectif** : éliminer le hardcodage GitLab dans `build-mcp-services.ts` et
`cc-plugin-import`. GitHub devient first-class dans le résolveur, avec
auto-dispatch OAuth vs App selon ce qui est configuré.

**Steps** :
1. Refactor `server/src/mcp/build-mcp-services.ts` `createResolveGitProvider`
   (lignes ~182-441) :
   - Extraire le dispatch `kind` → builder dans une map `providerBuilders` :
     `{ gitlab, github, local }` (PAS de `github-app` séparé, cf D6). Chaque
     builder reçoit la config item du `git_provider` config_layer + le
     contexte `(userId, companyId)` et retourne une instance de `GitProvider`.
   - **Builder `github` — auto-dispatch OAuth vs App** :
     1. Lit le `connector` `github` de la company.
     2. Lit la table `github_apps` pour ce connector. Si une App existe ET une
        installation matche le `repoOwner` du target → mode App :
        `GitHubProvider({ mode: "app-installation", mintToken: () => mintInstallationToken(companyId, githubAppId, installationId) })`.
     3. Sinon → mode OAuth user : tente `getUserToken("github")`, instancie
        `GitHubProvider({ mode: "user-oauth", token })`. Si échec et company
        en strict mode → `connectorRequired("github", "GitHub")`.
   - `connectorRequired(slug, label)` devient slug-driven (mapping `kind` →
     `(slug, label)`) : `gitlab` → `("gitlab", "GitLab")`, `github` →
     `("github", "GitHub")`. Pas d'entry `github-app` (D6).
   - `buildEnvFallbackProvider` (lignes ~497-519) reste GitLab par compat
     pilotes existants ; documenter que c'est legacy.
2. Refactor
   [`server/src/services/cc-plugin-import/source-provider-factory.ts:82-86`](../../server/src/services/cc-plugin-import/source-provider-factory.ts) :
   - Supprimer le throw "only supports kind=gitlab".
   - Ajouter branche `kind === "github"` qui réutilise le builder unifié
     ci-dessus (auto-dispatch App vs OAuth selon config).
3. Update `git_provider` config_layer item type schema (à localiser dans
   `packages/shared/src/types/config-layer-items.ts` ou équivalent) : ajouter
   `kind: "github"` à l'union. **Pas de `kind: "github-app"`** : le mode App
   est résolu côté builder à partir de la config connector + presence de la
   row `github_apps`, pas via le config layer (D6).
4. Tests `server/src/mcp/__tests__/resolve-git-provider.test.ts` :
   - Cases existants GitLab restent.
   - Nouveaux cases :
     - github sans App configurée + OAuth présent → mode user-oauth
     - github sans App configurée + pas d'OAuth → `connectorRequired("github", "GitHub")`
     - github avec App configurée + installation matche repoOwner → mode app-installation
     - github avec App configurée + installation suspendue → 409
     - github avec App configurée mais pas d'installation pour ce repoOwner → fallback OAuth user (et si pas d'OAuth → `connectorRequired`)

**Acceptance** :
- `bun run typecheck` 17/17 pass.
- `resolve-git-provider.test.ts` couvre 4 kinds × (happy + erreur) = 8+ cases.
- Lancer un governed workflow stub pointant vers une repo GitHub privée passe
  end-to-end (test manuel avec une App de test).

**Files actifs** :
```
server/src/mcp/build-mcp-services.ts (refactor providerBuilders + connectorRequired slug-driven)
server/src/mcp/__tests__/resolve-git-provider.test.ts
server/src/services/cc-plugin-import/source-provider-factory.ts
packages/shared/src/types/config-layer-items.ts (kind union)
```

## Phase 4 — Helpers + identity dual flow (~1j)

**Objectif** : `helpers.http("github", ...)` dans les hooks + résolution
identité commit user pour le flow App.

**Steps** :
1. `server/src/services/workflow-hooks.ts:1174-1197` `providerCatalog` :
   - Ajouter `github: { baseUrl: "https://api.github.com", authHeader: "Bearer", tokenSlug: "github" }`.
   - Pas d'entry pour `github-app` ici — les hooks user-level utilisent l'OAuth
     user, l'App est pour les ops système (governed workflows).
2. Étendre `server/src/mcp/build-mcp-services.ts:560-565` pour câbler le slug
   `github` au providerCatalog (pattern Jira/ClickUp).
3. Service `server/src/services/commit-identity.ts` (nouveau) :
   - `resolveCommitIdentity(userId, companyId, providerKind)` retourne
     `{ name, email }` qui sera utilisé pour **author ET committer** (D7).
     - Si `providerKind === "github"` ET user a connecté son GitHub OAuth →
       fetch `https://api.github.com/user` (cached en mémoire 24h par userId)
       → `{ name: response.name || response.login, email: response.email || ${login}@users.noreply.github.com }`.
     - Si `providerKind === "gitlab"` ET user a connecté son GitLab OAuth →
       fetch `/api/v4/user`, idem.
     - Sinon → fallback sur `user.email` + `user.displayName` du profil MnM.
   - Pour les ops système (CAO / Watchdog / Nightly) : appelé avec
     `userId = createdByUserId` du job (l'admin instance qui a setup, cf §1.7).
   - Utilisé par `GitHubProvider.commitFile` / `commitMultipleFiles` /
     `createTag` qui injectent `{ author: identity, committer: identity }` —
     pas de bot dans aucun champ (D7).
4. Update existing
   [`server/src/services/governed-workflows.ts:resolveAuthor`](../../server/src/services/governed-workflows.ts)
   pour symétrie : remplacer par `resolveCommitIdentity` (même contrat) et
   l'utiliser pour les deux providers (gitlab + github). Mise à jour
   `GitlabProvider.commitFile` etc. pour aussi injecter `committer` ===
   `author` (les actions GitLab acceptent ces champs).

**Acceptance** :
- Hook `helpers.http("github", "/user")` retourne le user du token sans
  config supplémentaire.
- Un commit fait via App token montre l'user MnM **à la fois comme author ET
  committer** dans GitHub UI (pas "MnM-AppName[bot]" ni dans `author` ni dans
  `committer` — D7).
- Test §1.7 : audit log enregistre bien l'user humain qui a triggered le
  workflow, pas l'App ni le mint d'installation token.
- Cache identity expire correctement après 24h (test temporel mocké).

**Files actifs** :
```
server/src/services/workflow-hooks.ts (providerCatalog + github)
server/src/services/commit-identity.ts (nouveau)
server/src/services/__tests__/commit-identity.test.ts
server/src/services/governed-workflows.ts (refactor resolveAuthor → resolveCommitIdentity)
server/src/mcp/build-mcp-services.ts (slug github → providerCatalog)
packages/git-provider/src/github-provider.ts (consume commit-identity, inject author+committer)
packages/git-provider/src/gitlab-provider.ts (inject author+committer aussi pour symétrie)
```

## Phase 5 — UI admin Connectors (~1.5j)

**Objectif** : 1 seule card "GitHub" avec un wizard adaptatif qui gère OAuth
+ option App, sans dupliquer la tile (D6).

**Steps** :
1. Update `ui/src/pages/admin/Connectors.tsx` template grid :
   - **Une seule card "GitHub"** (pas de split). Tooltip "Supporte private
     orgs via GitHub App optionnelle".
2. Wizard GitHub adaptatif (composant
   `ui/src/components/connectors/GitHubConnectorWizard.tsx`) :
   - **Step 1 — OAuth setup (commun à tous les connectors OAuth, déjà en
     place)** : admin paste Client ID + Client Secret. Submit crée le
     connector. Comme aujourd'hui pour GitLab/Slack/etc.
   - **Step 2 — "Tu accèdes à des private orgs ?" (banner-screen optionnel)** :
     Une fois le connector créé, on affiche une banner sur la Sheet détail
     du connector : "Pour accéder aux repos privées d'organisations GitHub,
     installe une GitHub App per-company. [Configurer la App]". Skip possible
     si l'admin ne veut que OAuth.
   - **Step 3 — App credentials** (panel qui s'ouvre quand on clique
     "Configurer la App") :
     - Sub-step 3a — Créer l'App : bouton "Ouvrir GitHub" qui pointe vers
       `https://github.com/settings/apps/new` avec préset URL params (`name`,
       `url`, `callback_urls`, `webhook_url`, `webhook_secret_required=false`
       V0, `request_oauth_on_install=true`, permissions cochées via le
       manifest query string : `contents=write`, `metadata=read`,
       `pull_requests=write`, `actions=read`, `issues=write`).
     - Sub-step 3b — Paste credentials : form `{ appId, privateKey (textarea
       .pem), webhookSecret? }`. Submit hit
       `POST /companies/:companyId/connectors/:connectorId/github/app`.
       Validation côté serveur via `POST /app` JWT-signé → 200. Si fail, 422
       "Private key invalide ou App ID incorrect".
     - Sub-step 3c — Installer sur orgs : deep-link "Installer sur une org" →
       `https://github.com/apps/{app_slug}/installations/new`. Subscribe SSE
       `connector.github_app_installation_added` pour refresh la liste en
       temps réel (sans polling). Bouton "Terminer" enabled dès qu'au moins 1
       installation active.
3. Sheet détail connector GitHub (`GitHubConnectorSheet.tsx`) :
   - Section "OAuth" : affiche Client ID, redirect URL.
   - Section "App (optionnelle)" : si pas configurée, banner avec
     "Configurer la App". Si configurée : `appId`, `appSlug`, liste des
     installations actives (`account_login`, `account_type`,
     `repository_selection`, `created_at`), boutons "Voir sur GitHub"
     (deep-link `https://github.com/organizations/{org}/settings/installations/{id}`),
     "Reconfigurer", "Désinstaller la App".
4. SSE event `connector.github_app_installation_added` côté server émis dans
   le callback handler (Phase 1 step 5). Côté UI, hook
   `useConnectorEvents(connectorId)` invalide le query React Query.
5. Update parity tracker `scripts/parity/data.ts` : entrée pour
   `Connectors:GitHubAppPanel` (status `done` web, `n/a` desktop si pas
   porté).

**Acceptance** :
- Tom peut configurer un connector GitHub OAuth seul en <2min (parité avec
  les autres connectors).
- Tom peut, sur le même connector, ajouter une App + l'installer sur une org
  de test en <5min sans toucher à curl.
- UI montre les installations en temps réel sans refresh manuel.
- `bun run parity --domain=connectors` clean.
- Test Playwright `e2e/playwright/connectors-github.spec.ts` : create OAuth →
  open Sheet → configure App (mock `/app` 200) → install (mock callback) →
  Sheet shows installation.

**Files actifs** :
```
ui/src/pages/admin/Connectors.tsx (1 card GitHub unifiée)
ui/src/components/connectors/GitHubConnectorWizard.tsx (nouveau, OAuth+App adaptatif)
ui/src/components/connectors/GitHubConnectorSheet.tsx (nouveau, sections OAuth + App)
ui/src/hooks/useConnectorEvents.ts (extend pour github_app event)
ui/src/api/connectors.ts (méthodes github/app)
e2e/playwright/connectors-github.spec.ts
scripts/parity/data.ts
```

## Phase 6 — Tests E2E + parity tracker + docs (~1j)

**Objectif** : validation end-to-end, alignement parity, decision-log,
runbook ops.

**Steps** :
1. E2E Playwright `github-flow.spec.ts` couvrant happy path complet :
   admin crée connector github (OAuth) → ouvre Sheet → configure App
   (sub-panel) → installation callback simulée → governed workflow stub
   commit un fichier via App → vérification `git log` côté repo de test
   montre **author=user ET committer=user** (D7).
2. E2E Playwright `github-oauth-only.spec.ts` similaire pour le flow OAuth
   pur (pas de configuration App). Vérifie commit attribué au user.
3. Update `scripts/parity/data.ts` final pass.
4. Doc `docs/governed-workflows/connectors.md` :
   - Nouveau § "GitHub : OAuth seul vs App optionnelle" (table décisionnelle :
     repo public seul / repo privée perso / org publique / org privée /
     multi-org → reco binaire "App ou pas").
   - Steps d'onboarding admin avec screenshots du wizard adaptatif.
   - Runbook "L'App a été suspendue" / "Renouveler la private key".
5. Decision-log entry §4.7 "GitHub Provider — connector unifié OAuth + App
   optionnelle per-company" avec rationale (D1-D7) et lien vers ce plan.
6. Update memory perso `feedback_human_traceability.md` pour mentionner D7
   (author=committer=user, jamais de bot).

**Acceptance** :
- E2E pass en CI (mocked GitHub API via msw, pas de vraie repo).
- `bun run parity` clean.
- Decision log mis à jour.
- 17/17 typecheck + tous les Vitest pass.
- Smoke test manuel : Tom valide le flow complet sur une vraie repo GitHub
  perso avant merge.

**Files actifs** :
```
e2e/playwright/github-flow.spec.ts (App + OAuth)
e2e/playwright/github-oauth-only.spec.ts
docs/governed-workflows/connectors.md (§ GitHub OAuth vs App optionnelle)
docs/decision-log.md (§4.7 nouveau)
scripts/parity/data.ts
```

## Risks

- **R1 — Private key handling.** La private key d'une App est très sensible (≈
  équivalent password root pour l'org installée). Mitigation : chiffrement
  AES-256-GCM via `secret-crypto.ts` (pattern Sprint 1, audit Phase 4 OK),
  audit log à chaque déchiffrement, jamais loggée, masquée dans les responses
  API (pattern H3 redaction). Test e2e : vérifie que la response REST n'inclut
  jamais la clé en clair même pour l'admin.
- **R2 — Token mint cost.** Installation tokens minted on-demand peuvent flood
  l'API GitHub (rate limit App = 12500 req/h × #installations). Mitigation :
  cache in-memory TTL=55min, advisory lock pour éviter mint concurrent.
- **R3 — Webhook ingestion absente V0.** Pas de listener pour
  `installation.suspended` etc. Conséquence : un admin org qui suspend l'App →
  MnM ne le sait pas immédiatement, échec à la prochaine API call avec 401/403
  → on doit catch et update `suspended_at` à ce moment-là (lazy detection).
  Acceptable V0, ticket follow-up pour webhook listener.
- **R4 — Interface `GitProvider` breaking change.** Étendre `getMergeRequestApprovals`
  → `getCodeReviewState` casse les implémentations existantes (gates qui
  consomment le shape GitLab brut). Mitigation : update atomique gitlab +
  github + tous les call sites + tests dans la même PR. Pas de période de
  cohabitation. Le `raw: unknown` field permet aux gates avancés de garder
  l'accès au payload GitLab original.
- **R5 — RLS NEW-S1 still applies.** Les nouvelles tables `github_apps` et
  `github_app_installations` héritent du même bug RLS (RESTRICTIVE-only sans
  PERMISSIVE = default-deny qui ne fait rien parce que l'app user a
  BYPASSRLS). Mitigation : appliquer le même test pattern HIGH-Q3 (PERMISSIVE
  temporaire dans test setup), tracker dans le chantier RLS dédié post-Sprint 2.
- **R6 — SSO orgs friction OAuth.** Un user qui se connecte à GitHub via OAuth
  pour une org SSO doit autoriser le token per-org. App tokens contournent
  proprement ça. Documenter : "si ta société utilise SAML SSO, prends GitHub
  App, pas OAuth".
- **R7 — `commitMultipleFiles` shape difference.** GitLab a un endpoint
  `commits` avec `actions[]` ; GitHub demande de construire un tree (3 calls).
  Plus lent, plus de surface d'erreur. Mitigation : tests msw dédiés sur le
  scénario 50 fichiers ; rate-limit retry intégré.
- **R8 — Commits "Unverified" en mode App (assumé V0, choix Tom A).**
  D7 strict (committer = user) impose le path low-level Git Data API qui ne
  peut pas signer le commit. GitHub UI affichera un badge gris "Unverified"
  sur tous les commits MnM. Acceptable car la traçabilité §1.7 prime sur le
  badge visuel. Mitigation V1 : signature GPG côté serveur avec une clé
  per-company (open follow-up). Documenter clairement dans le runbook
  connectors.md pour éviter la surprise des reviewers humains.

## Rollback

- Chaque phase est commitable indépendamment.
- Phase 1 rollback : `DROP TABLE github_apps, github_app_installations` +
  revert migration. Pas de drop de données existantes (tables nouvelles).
- Phase 2-3 rollback : revert commits `git-provider` + `mcp/build-mcp-services`.
  GitLab path inchangé.
- Phase 4-5 rollback : feature flag `MNM_GITHUB_APP_ENABLED=false` (env var
  consultée dans le résolveur pour ignorer la presence de `github_apps` rows
  → fallback OAuth user pour tous). Le template `github` (déjà en prod) reste
  actif.
- Phase 6 rollback : trivial (docs).

## Build sequence

Ordre recommandé pour minimiser le risque :

1. **Phase 2** d'abord — refactor interface `GitProvider` + `CodeReviewState`
   + nouveau `GitHubProvider` mode OAuth seul (mode App stub `throw new Error("not impl")`).
   → Permet de valider le pattern interface sans toucher au runtime.
2. **Phase 3** — plug le mode OAuth dans `build-mcp-services` + `cc-plugin-import`.
   → On peut déjà commit/pull sur des **repos publiques + privées personnelles**
   en OAuth user.
3. **Phase 4** — helpers + commit-author.
   → `helpers.http("github", ...)` opérationnel, identity dual-flow câblée.
4. **Phase 1** — App infra (DB + service + REST + callback).
   → Backend complet pour le flow App.
5. **Phase 2 (compléter)** — implémenter le mode `app-installation` du
   `GitHubProvider` (le stub est levé).
6. **Phase 3 (compléter)** — auto-dispatch App vs OAuth dans le builder
   `github` du `providerBuilders` (presence d'une App + installation matche
   → mode App, sinon OAuth user).
   → On peut maintenant commit sur des **private repos d'orgs privées** via App.
7. **Phase 5** — UI wizard.
   → UX admin opérationnelle.
8. **Phase 6** — E2E + docs + decision-log.
   → Ship-ready.

Effort total estimé : **~9j** (avec marge intégrée). Compressible à ~7j si on
saute le polish UX du wizard ou si on sépare le flow App en sprint suivant.

## Acceptance globale

- [ ] `bun run typecheck` 17/17 pass à chaque commit.
- [ ] Tous les Vitest existants + nouveaux pass.
- [ ] E2E Playwright github-flow + github-oauth-only pass.
- [ ] Smoke test manuel : commit sur repo privée d'org privée GitHub via App.
- [ ] Smoke test manuel : commit sur repo publique perso via OAuth.
- [ ] `bun run parity` clean.
- [ ] Doc connectors.md + decision-log mis à jour.
- [ ] Aucun nom client/prospect dans le code/doc/commits (CLAUDE.md invariant).
- [ ] Audit §1.7 + D7 : commit fait via App montre l'user humain à la fois
      comme `author` ET `committer` dans le payload commit GitHub. Aucune
      occurrence "MnM-AppName[bot]" dans aucun champ du commit.

## Open follow-ups (post-V0)

- Webhook ingestion (`installation.suspended`, `pull_request.*`, `push`) →
  chantier dédié, débloque CAO live triggers.
- GitHub Enterprise Server support → ajout d'un champ `instanceBaseUrl` au
  template, refacto `GitHubProvider` baseURL configurable.
- Migration helper GitLab → GitHub pour les workflows existants → ops doc d'abord.
- Bitbucket / Gitea / Azure DevOps providers → pattern réutilisable une fois
  l'interface `GitProvider` étendue ici.
- RLS chantier dédié NEW-S1 (PERMISSIVE policies + app user non-bypass).
- **Signature GPG côté serveur** pour transformer les commits MnM "Unverified"
  en "Verified" dans GitHub UI (cf R8). Approche : clé GPG per-company
  stockée chiffrée (pattern `secret-crypto.ts`), signature dans
  `git.createCommit` payload via `signature` field. ~1.5j. Optionnel par
  company (l'opt-in active la signature, sinon Unverified par défaut).
