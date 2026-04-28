# Brainstorm — Virer le PAT fallback, le remplacer par un service account

**Date** : 2026-04-27 (post-démo cc-plugin-import)
**Origine** : MnM founder — "Je veux JAMAIS utiliser un PAT, ce sera l'admin qui mettra un service account plutôt."
**Statut** : à brainstormer à froid, pas pendant la démo.

---

## 1. État actuel

Aujourd'hui, MnM utilise un PAT GitLab (Personal Access Token) stocké en clair dans une row `config_layer_items` de type `git_provider`. Ce PAT sert de **fallback** quand l'OAuth user n'est pas dispo.

**Surface impactée** :

1. **`server/src/mcp/build-mcp-services.ts:170+` — `createResolveGitProvider`**
   - Step 1 : OAuth user (mode `authenticated` + `userId` présent + social-link GitLab)
   - Step 2 : PAT fallback (`local_trusted` mode OU OAuth absent/expiré)
   - Utilisé par tous les workflows existants pour commiter sur le repo company.

2. **`server/src/services/cc-plugin-import/source-provider-factory.ts` — `buildSourceProvider`**
   - Même pattern (commit `5b45786`) : OAuth-first, PAT fallback.

3. **`docs/governed-workflows-gitlab-setup.md`**
   - Tout le doc d'onboarding parle de "PAT GitLab → curl PUT git-provider-config".

4. **Mode `local_trusted` (dev solo, zero auth)**
   - Pas d'OAuth utilisateur du tout. Le PAT est l'unique moyen de commit.

---

## 2. Vision cible (MnM founder)

**Plus jamais de PAT humain stocké en DB.** À la place :

- L'**admin** d'une company configure un **service account GitLab** (compte machine dédié, pas un humain).
- Ce service account a son propre OAuth (refresh-token long-vécu).
- MnM stocke le `(access_token, refresh_token)` du service account de la même façon qu'un utilisateur normal — table `authAccounts` row dédiée.
- `createResolveGitProvider` utilise ce service account quand l'utilisateur courant n'a pas son propre OAuth GitLab (= mode `local_trusted` ou utilisateur sans social-link).
- **Plus de Step 2 PAT.** Suppression de l'`item_type='git_provider'`.

---

## 3. Questions ouvertes pour le brainstorm

1. **Modèle DB du service account** :
   - A) Un user `system` avec un row dans `authAccounts` (`providerId="gitlab"`). Simple, réutilise tout l'existant. Mais doit être cherchable par `companyId` → ajouter une colonne ou une convention (`userId = "service-account:<companyId>"`).
   - B) Une nouvelle table `service_accounts` (companyId, kind, accessToken, refreshToken, …). Plus propre sémantiquement, mais duplique la logique de refresh.
   - C) Étendre `authAccounts` avec une colonne `is_service_account boolean` + `company_id` (NULL pour humains, NOT NULL pour service accounts).

2. **Mode `local_trusted` (dev)** :
   - Plus de PAT → plus de mode "ouvre `bun run dev` et ça marche tout seul" sans config.
   - Soit on **seed automatiquement un service account fictif** au premier boot (avec un faux token qui mockait Git en mémoire — bare repo local).
   - Soit on garde le local bare repo (`~/.mnm/dev-workflows-bare/repo.git`) qui ne nécessite **aucun token**, et le service account ne sert qu'en `authenticated` mode. C'est probablement le bon move : décorréler "auth" et "git" en local.

3. **Migration** :
   - Stratégie progressive ou big-bang ?
   - Si progressive : ajouter le code service account, garder le PAT fallback derrière une feature flag pendant 1 sprint, déprécier, supprimer.
   - Si big-bang : 1 migration qui crée les service accounts à partir des PAT existants (auto-import du PAT dans un row `authAccounts` system), puis supprime les rows `git_provider`. Coup unique mais demande tooling de migration.

4. **UX admin pour configurer le service account** :
   - GitLab OAuth flow pour le service account = pénible (doit s'authentifier comme bot manuellement).
   - Alternative : l'admin colle un **refresh_token long-vécu** généré côté GitLab. MnM s'occupe du refresh access_token.
   - Question : ce refresh_token vit où ? Encrypté at-rest ? Secret manager ?

5. **Audit log** :
   - Aujourd'hui les commits Git sont stampés `authorName/authorEmail` du user. Avec le service account, **tous** les commits du fallback seront stampés "service-account@company". On perd l'attribution utilisateur quand l'OAuth user n'est pas dispo.
   - Acceptable ou doit-on stamper l'utilisateur "demandeur" même quand le commit est techniquement fait par le service account ?

6. **Rotation** :
   - Le PAT actuel est rotaté manuellement (admin re-PUT le config). Avec service account OAuth, refresh_token GitLab a une durée de vie. Comment gérer son expiration / sa rotation ? Notification admin ?

7. **Multi-instance GitLab** :
   - Si une company veut importer un plugin depuis une autre instance GitLab (cross-votre organisation / public hub), le service account d'instance A ne peut pas lire instance B. Garder le check "same instance" ou autoriser N service accounts par company (1 par instance) ?

---

## 4. Surface de modification estimée

| Module | Type de change |
|---|---|
| `server/src/mcp/build-mcp-services.ts` | Step 2 PAT → Step 2 service account lookup |
| `server/src/services/cc-plugin-import/source-provider-factory.ts` | Idem |
| `packages/db/src/schema/auth-accounts.ts` (ou nouvelle table) | Schema change selon option 1.A/B/C |
| Migration | Convertir les rows `config_layer_items` type=`git_provider` → service account row |
| UI admin (Alex) | Page de config service account (formulaire OAuth flow ou refresh_token paste) |
| `docs/governed-workflows-gitlab-setup.md` | Réécrire entièrement |
| Mode dev | Décider si on garde le PAT côté `local_trusted` ou si bare repo local suffit |

---

## 5. Recommandation initiale (à challenger)

- **Option DB** : 1.A (user `system` per-company avec convention de userId). Réutilise `authAccounts`, refresh token via `refreshGitlabAccessToken` existant, zéro nouvelle table.
- **Mode `local_trusted`** : garde le bare repo local, **pas** de service account requis. Le PAT Git n'existe plus du tout.
- **Migration** : progressive avec feature flag `MNM_DISABLE_PAT_FALLBACK=true`, dépréciation 1 sprint, suppression.
- **UX admin** : refresh_token paste (le plus simple), avec alert UI 2 semaines avant expiration.

---

## 6. À faire pour démarrer la feature

1. Brainstormer ce doc avec MnM founder pour valider/affiner les options.
2. Écrire le spec via `superpowers:brainstorming`.
3. Plan d'implem via `superpowers:writing-plans`.
4. Exécution via subagent-driven-development.

**Estimation grossière** : 3-5 jours dev + 1 jour migration data + 1 jour UX admin (Alex). Total ~1 semaine.
