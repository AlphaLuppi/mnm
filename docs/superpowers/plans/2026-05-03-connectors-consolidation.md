# Plan — Consolidation Connectors / suppression du legacy GitLab/Microsoft

Date : 2026-05-03
Contexte : suite du sprint Connectors-Platform (Sprint 1+2 shippé). La page
`/settings/profile` expose encore une card "Comptes connectés" hardcodée
(GitLab `gitlab.example.com`, Microsoft Entra) qui doublonne `/settings/accounts`
(plateforme Connectors dynamique). En parallèle, le cascade `createResolveGitProvider`
fall-back silencieusement sur un token company-level / env var quand l'user
n'a pas connecté son compte → viole l'invariant de traçabilité humaine
(`docs/decision-log.md §1.7`).

## Phase 1 — UserProfile cleanup (small)

Objectif : supprimer la card hardcodée, laisser `/settings/accounts` source unique côté UX.

Acceptance :
- `ui/src/pages/UserProfile.tsx` ne référence plus `gitlab` / `microsoft` en dur,
  ne charge plus `linkedAccounts` BetterAuth.
- La page garde la card "Identité MnM" + une note pointant vers `/settings/accounts`.
- BetterAuth `linkSocial` reste actif côté serveur (utilisé en fallback Step 1
  du cascade). Pas de migration DB.

Risques : ≈ 0. Le code BetterAuth `account` n'est pas touché.

## Phase 2 — Pattern de blocage `CONNECTOR_REQUIRED` (medium)

Objectif : quand une feature exige un connecteur user-level non connecté,
échouer **explicitement** avec un payload exploitable côté frontend pour
rediriger l'user vers `/settings/accounts?focus={slug}`.

Backend :
- Ajouter `connectorRequired(slug, connectorLabel?)` dans `server/src/errors.ts`,
  status 412, code `CONNECTOR_REQUIRED`, payload `{ connectorSlug, connectFlowUrl }`.
- Dans `createResolveGitProvider` (Step 1a), quand `getUserToken` throw
  `CONNECTOR_USER_NOT_CONNECTED` ET la company est en mode strict (cf. Phase 3),
  re-throw `connectorRequired("gitlab")` au lieu de fall-through.

Frontend :
- Intercepteur dans `ui/src/api/client.ts` qui détecte `CONNECTOR_REQUIRED` et
  émet un `CustomEvent("connector:required", { detail: { slug, url } })`.
- Provider global (mount dans `App.tsx`) qui écoute l'event et affiche un
  Dialog shadcn : "Cette action requiert ton compte {label} connecté.
  [Annuler] [Configurer maintenant]" → navigation vers `/settings/accounts?focus={slug}`.
- `SettingsAccounts.tsx` lit le query param `focus` et scroll/ring sur la card.

Acceptance :
- En mode strict : un workflow tenté sans connecteur GitLab → Dialog
  apparaît, click "Configurer" amène sur `/settings/accounts` avec la card
  GitLab highlightée.
- En mode legacy (Phase 3 default off) : comportement actuel inchangé.

Risques : interception erreur côté React Query. Tester que le Dialog n'apparaît
qu'une fois (pas par mutation parallèle).

## Phase 3 — Mode strict opt-in (medium)

Objectif : permettre aux companies pilotes de basculer vers "connector-only"
(plus de fallback BetterAuth `account` ni env var) sans casser les pilotes
qui dépendent encore du PAT company-level.

Backend :
- Nouveau company setting `git.requireUserConnector: boolean` (default `false`
  pour ne rien casser des pilotes existants ; ce sera flippé `true` quand la
  doc d'onboarding sera mise à jour).
- `createResolveGitProvider` lit le flag : si `true`, après échec Step 1a,
  throw `connectorRequired` au lieu de tomber dans Step 1 + Step 2.
- Endpoint admin `PUT /companies/:companyId/settings/git` (permission
  `company:manage_settings`).

Acceptance :
- `companies.settings.git.requireUserConnector = false` (default) → cascade
  inchangé.
- `... = true` → `getUserToken` échec → 412 `CONNECTOR_REQUIRED`. Pas de fallback.
- Documenter dans `docs/governed-workflows/connectors.md §7` le passage strict.

Risques :
- Si le flag est mis sans avoir testé, les workflows planifiés cassent. → ne
  pas l'activer par défaut, juste fournir le mécanisme.

## Build sequence

1. Phase 1 (UserProfile) — commit + push.
2. Phase 3 (flag + branchement cascade) — backend isolé, commit + push.
3. Phase 2 (UX bloqueur) — frontend + glue, commit + push.
   (Phase 2 vient après Phase 3 parce qu'on a besoin du flag pour qu'elle se
   déclenche correctement.)

## Out of scope

- Suppression définitive du Step 1 BetterAuth `authAccounts` — tant que `linkSocial`
  est utilisé pour le SSO sign-in lui-même, on garde la table. Ce sera un
  follow-up quand toutes les companies pilotes auront flippé le flag.
- Migration des tokens existants. Les tokens BetterAuth ne migrent pas vers
  `connector_tokens` (pas de re-encryption automatique). User reconnecte
  manuellement depuis `/settings/accounts`.
