# Connectors — UI custom (OAuth 2.0 / API key)

## Contexte

`ui/src/pages/Connectors.tsx` n'expose aujourd'hui que la grille des 10 templates pré-définis (Jira, GitHub, GitLab, Microsoft, Google, Slack, ClickUp, Linear, Notion, OpenAI). Pourtant le backend (`server/src/routes/connectors.ts:84-146` + `server/src/services/connectors.ts:212-396`) accepte déjà un mode "custom" : si la requête `POST /companies/:companyId/connectors` n'a pas de `templateSlug`, le serveur lit les champs bruts (`providerSlug`, `displayName`, `type`, `authorizationUrl`, `tokenUrl`, `userinfoUrl`, `scopes[]`, `redirectUri`, `clientId`, `clientSecret`, `refreshSupported`, `apiKeyLabel`).

Manque côté UI : une porte d'entrée pour ce mode. Toute API qui parle OAuth 2.0 (RFC 6749) ou Bearer/API-key devrait pouvoir être branchée sans toucher au code.

## Objectif

Donner à l'admin une carte "Connecteur custom" en tête de l'onglet "Ajouter" qui ouvre un wizard 3 étapes :

1. **Basics** — type (oauth2 | api_key), `providerSlug`, `displayName`
2. **Endpoints** (oauth2 uniquement) — `authorizationUrl`, `tokenUrl`, `userinfoUrl`, `scopes` (input texte → split sur espace), `redirectUri`, `refreshSupported`
3. **Credentials** — oauth2: `clientId` + `clientSecret` ; api_key: `apiKeyLabel`

À la soumission, on appelle le même `connectorsApi.create(companyId, payload)` mais sans `templateSlug`. Le serveur applique déjà la validation HTTPS-only en prod + anti-SSRF.

## Phases

### P1 — UI

- Réutiliser le `Dialog` existant (renommer `WizardState` pour porter le mode `template | custom`).
- Carte "Connecteur custom" : `<Plus />` icon, tagline "OAuth 2.0 ou clé API — n'importe quelle API qui suit le standard."
- Wizard custom : 3 étapes pour oauth2, 1 étape pour api_key.
- Validation client : `providerSlug` doit matcher `^[a-z0-9-]+$`, URLs HTTPS recommandées (warning visible si HTTP non-localhost), scopes splités sur espace/virgule.
- Erreur backend (badRequest sur URL invalide, conflict sur slug existant) déjà surfacée par `createMutation.error`.

### P2 — Parity

- `scripts/parity/data.ts` : entrée `connectors-custom-ui` dans le domain admin/connectors. Web `done`, desktop hérite (thin client → `done` aussi car URL même backend).

### P3 — QA

- Typecheck UI vert.
- Smoke manuel : créer un connecteur custom OAuth pointant vers un mock + un connecteur custom api_key. Vérifier que la liste les affiche et que les badges OAuth/API-key sont corrects.

## Acceptance criteria

- [x] Carte "Custom" présente en haut de l'onglet "Ajouter".
- [x] Wizard custom permet de soumettre oauth2 sans `templateSlug` et obtenir un 201.
- [x] Wizard custom permet de soumettre api_key sans `templateSlug` et obtenir un 201.
- [x] Le backend rejette un slug invalide / une URL non-HTTPS en prod — l'erreur s'affiche dans le dialog.
- [x] Typecheck UI vert.
- [x] `scripts/parity/data.ts` à jour.

## Risques / rollback

- **Risque bas** : aucune modif backend, surface UI isolée à `Connectors.tsx`. Rollback = revert le seul commit.
- **Sécurité** : la validation reste serveur-side ; le client ne peut pas bypasser `validateOAuthUrl` ni le check unique `(companyId, providerSlug)`.

## Hors scope

- Édition d'un connecteur custom existant (le PATCH backend existe mais l'UI n'a pas d'édition full — seul le toggle enabled est exposé). À traiter dans un prochain chantier si besoin.
- Discovery automatique via `.well-known/openid-configuration` — backend n'a pas le helper, à ajouter plus tard si demandé.
