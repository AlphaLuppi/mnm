# PRD — Refonte page d'authentification legacy-app

**Feature** : Refonte page d'authentification legacy-app
**Workflow run** : `a3bef6b1-7574-45d0-b848-d4ed75f57c8e`
**Tag** : `product-feature-delivery/v1.0.0`
**Auteur** : MnM contributor
**Date** : 2026-04-24

## Problem

La page d'authentification actuelle d'legacy-app (web + mobile) souffre de plusieurs limitations :

- **UX vieillissante** : design antérieur au refresh du design system entreprise, incohérent avec le reste de l'app.
- **Pas d'options modernes** : ni SSO, ni 2nd-factor (Face ID / Touch ID sur mobile), ni "remember device" sécurisé.
- **Mauvaise gestion des erreurs** : messages génériques ("identifiants invalides") qui ne distinguent pas login inexistant, mot de passe erroné, compte verrouillé, ou local désactivé.
- **Accessibilité faible** : contraste insuffisant sur les libellés, ordre de tabulation cassé, absence de labels ARIA sur les champs.
- **Reset password friction** : 4 écrans, 2 emails, aucune indication de progression.
- **Pas d'analytics** : on ne sait pas combien d'professionnel de santé abandonnent la connexion, ni à quelle étape.

## Solution

Refonte complète de la page d'authentification sur les deux plateformes (web Angular + mobile hybrid-mobile-stack) avec :

1. **Nouvelle UI** alignée sur le design system entreprise (UI Kit `angular-libs`), avec support dark mode.
2. **Login unifié email/mot de passe** + SSO OAuth (Google, Microsoft) pour les cabinets en mode multi-professionnel de santé.
3. **Biometric unlock** sur mobile (Face ID / Touch ID / Android Biometric) après premier login.
4. **Gestion d'erreurs granulaire** : messages adaptés (login inexistant, mot de passe erroné, compte verrouillé après N tentatives, local désactivé, maintenance en cours).
5. **Reset password en 2 écrans** (saisie email → saisie nouveau mot de passe après clic lien) avec barre de progression et critères de robustesse live.
6. **Accessibilité WCAG 2.1 AA** : contrastes, ARIA labels, ordre de tabulation, lecteur d'écran.
7. **Analytics PostHog** : funnel de connexion (affichage page → saisie email → soumission → succès/échec), temps moyen, taux d'abandon.

## Scope

### In

- Page de login web (legacy-app-web) : `/auth/login`.
- Page de login mobile (legacy-app) : écran initial `LoginPage`.
- Flow reset password (web + mobile).
- Composants réutilisables dans `angular-libs` (input, button, password-strength-meter).
- Instrumentation PostHog.
- Support dark mode.
- Tests E2E Playwright (web) + e2e-testing (mobile) sur golden paths.

### Out

- Refonte écran inscription / création local (feature distincte).
- SSO SAML enterprise (réservé aux cabinets ≥20 professionnel de santé, phase ultérieure).
- Multi-factor authentication (MFA) — autre feature prioritaire au backlog.
- Migration des sessions existantes (les utilisateurs restent connectés).

## Non-goals

- Changer le backend d'authentification (legacy-backend legacy reste la source de vérité jusqu'à la migration API v2).
- Introduire un nouveau provider d'identité (ex: Auth0, Keycloak).
- Refondre la gestion des tokens / refresh tokens.

## Metrics

| Métrique | Baseline | Target | Measurement |
|---|---|---|---|
| Taux de succès login (1ère tentative) | ~78% | ≥90% | PostHog funnel |
| Temps moyen login → dashboard | 4.2s | ≤2.5s | PostHog + Sentry perf |
| Taux d'abandon page login | 12% | ≤5% | PostHog funnel |
| Tickets support "mot de passe oublié" / mois | ~45 | ≤20 | Zendesk tag `auth` |
| Score accessibilité Lighthouse | 72 | ≥95 | CI Lighthouse audit |
| Adoption 2nd-factor (mobile) à 30j | 0% | ≥40% | PostHog event `2nd-factor_enabled` |

## Risks & mitigations

| Risque | Mitigation |
|---|---|
| Régression sur le flow actuel pendant la migration | Feature flag PostHog `new-auth-page` + rollout progressif par cohorte de cabinets |
| Biometric bloqué par certains modèles Android old | Fallback PIN local + opt-out explicite |
| SSO OAuth casse les sessions multi-onglets | Tests multi-onglets sur qualif avant rollout |

## Dependencies

- **Design** : proto Figma + UX guidelines (step `design-kit` du workflow).
- **Backend** : endpoints `/api/v2/auth/login`, `/api/v2/auth/reset-password` déjà disponibles (backend-api).
- **Infra** : client OAuth configuré côté DevOps (legacy-app repo).

## Timeline (indicatif)

- S1-S2 : Design + prototype cliquable.
- S3-S4 : Implémentation web.
- S5-S6 : Implémentation mobile + 2nd-factor.
- S7 : QA + tests E2E.
- S8 : Rollout progressif (10% → 50% → 100%) avec monitoring PostHog.
