---
title: 'Auth & Onboarding — Standalone Pages'
slug: 'auth-onboarding-standalone-pages'
created: '2026-03-18'
status: 'review'
stepsCompleted: [1, 2, 3]
tech_stack: ['React 18', 'react-router-dom', 'Radix UI Dialog', 'Playwright', 'Express', 'TanStack Query']
files_to_modify: ['ui/src/App.tsx', 'ui/src/components/OnboardingWizard.tsx', 'ui/src/context/DialogContext.tsx', 'ui/src/components/Layout.tsx', 'ui/src/components/CompanyRail.tsx', 'ui/src/pages/Dashboard.tsx', 'ui/src/pages/Companies.tsx', 'e2e/tests/auth/sign-in.browser.ts']
code_patterns: ['top-level routes outside CloudAccessGate for public pages', 'CloudAccessGate Outlet wrapper for protected routes', 'Dialog/DialogPortal for modal overlays', 'useDialog() hook for dialog state', 'storageState for pre-authenticated E2E contexts', 'openOnboarding() with OnboardingOptions (initialStep, companyId)']
test_patterns: ['Playwright browser tests (.browser.ts) with storageState admin', 'Playwright RBAC tests (.rbac.browser.ts) with role-based fixtures', 'Playwright API tests (.spec.ts) for file-content checks', 'Clean storageState override for auth-specific tests', 'isAuthenticatedMode() skip for local_trusted mode']
---

# Tech-Spec: Auth & Onboarding — Standalone Pages

**Created:** 2026-03-18

## Overview

### Problem Statement

L'auth et l'onboarding se superposent au contenu existant de l'application, ce qui pose deux problèmes majeurs :

1. **Screenshots/vidéos E2E polluées** : Tous les tests capturent la page auth (redirect CloudAccessGate) dans leurs screenshots/vidéos, même quand le test n'a rien à voir avec l'auth
2. **Faux positifs E2E** : L'onboarding étant un Dialog portal (modal overlay), les tests peuvent "passer" alors qu'ils sont bloqués sur le wizard d'onboarding
3. **Tests fragiles** : Impossible de naviguer proprement vers l'onboarding via URL — il faut trigger le dialog programmatiquement

### Solution

- Transformer le `OnboardingWizard` de Dialog portal en **route dédiée** avec layout minimaliste (sans sidebar)
- S'assurer que l'auth est proprement isolée dans le flow E2E : une fois connecté, plus d'auth visible
- Adapter les tests E2E pour que les tests partant d'une page vierge commencent par un sign-in avant le test réel
- Zero changement fonctionnel sur les steps d'onboarding

### Scope

**In Scope:**
- Transformer l'onboarding de Dialog portal en route dédiée (`/onboarding`)
- Cleanup du `DialogContext` (retirer `onboardingOpen`/`openOnboarding`/`closeOnboarding`)
- Layout minimaliste pour la page onboarding (pas de sidebar)
- Adapter les redirects : après auth → onboarding si nécessaire → dashboard
- Adapter les tests E2E existants :
  - Tests authentifiés : plus d'auth visible dans les captures
  - Tests from scratch : sign-in comme première étape
  - URLs stables pour navigation Playwright

**Out of Scope:**
- Changement fonctionnel des 4 steps d'onboarding
- Refonte de l'UI auth
- Nouveaux tests E2E (au-delà de l'adaptation des existants)

## Context for Development

### Codebase Patterns

- **Routes publiques** : routes top-level dans `App.tsx` hors `CloudAccessGate` (`/auth`, `/board-claim/:token`, `/invite/:token`)
- **Routes protégées** : toutes les routes dans `<Route element={<CloudAccessGate />}>` — redirigent vers `/auth?next=...` si pas de session en mode `authenticated`
- **Onboarding actuel** : `<OnboardingWizard />` rendu en L307 de `App.tsx` hors du `<Routes>`, utilise `Dialog`+`DialogPortal` de Radix UI
- **openOnboarding()** : appelé depuis 5 endroits avec `useDialog()` — `Layout.tsx` (auto-trigger si 0 companies en local_trusted), `CompanyRail.tsx` (bouton), `Dashboard.tsx` (empty state + dual mode config), `Companies.tsx` (bouton), `NoCompaniesStartPage` (auto-trigger + bouton)
- **OnboardingOptions** : `{ initialStep?: 1|2|3|4, companyId?: string }` passé à `openOnboarding()` depuis Dashboard pour aller directement au step 2 (dual mode)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `ui/src/App.tsx` | Router principal, CloudAccessGate, NoCompaniesStartPage, OnboardingWizard mount |
| `ui/src/components/OnboardingWizard.tsx` | Wizard 4 steps (66KB), Dialog portal, useDialog() consumer |
| `ui/src/context/DialogContext.tsx` | State management pour tous les dialogs (issues, projects, goals, agents, onboarding) |
| `ui/src/components/Layout.tsx` | App shell (sidebar + main), auto-trigger onboarding si 0 companies |
| `ui/src/components/CompanyRail.tsx` | Company switcher sidebar, bouton "New Company" → openOnboarding() |
| `ui/src/pages/Dashboard.tsx` | Dashboard avec empty state + dual mode trigger → openOnboarding() |
| `ui/src/pages/Companies.tsx` | Liste companies, bouton "New Company" → openOnboarding() |
| `ui/src/pages/Auth.tsx` | Page auth standalone (référence design — full-screen, `fixed inset-0`) |
| `e2e/global-setup.ts` | Setup E2E : auth 5 users, seed data, save storageState per role |
| `e2e/fixtures/auth.fixture.ts` | Fixtures role-based (adminPage, managerPage, etc.) |
| `e2e/tests/auth/sign-in.browser.ts` | Tests sign-in (context clean, skip en local_trusted) |
| `playwright.config.ts` | Config 3 projets (api, browser, browser-rbac), video: "on", screenshot: "on" |

### Technical Decisions

1. **Onboarding = route protégée `/onboarding`** : à l'intérieur de `CloudAccessGate` mais HORS de `Layout`. Full-screen comme `/auth` mais protégée par l'auth.
2. **`openOnboarding()` → `navigate("/onboarding")`** : tous les 5 call sites convertis en navigation. Les `OnboardingOptions` passées en query params (`/onboarding?step=2&companyId=xxx`).
3. **OnboardingWizard refactoré** : retirer `Dialog`/`DialogPortal`, lire les options depuis `useSearchParams`, render comme page full-screen (`fixed inset-0`).
4. **DialogContext cleanup** : retirer les 4 champs onboarding (`onboardingOpen`, `onboardingOptions`, `openOnboarding`, `closeOnboarding`).
5. **CompanyRootRedirect** : au lieu de `openOnboarding()`, redirect vers `/onboarding` quand 0 companies.
6. **NoCompaniesStartPage** : simplifier — le bouton "New Company" navigate vers `/onboarding`.
7. **Layout.tsx** : retirer le useEffect qui auto-trigger onboarding en local_trusted, remplacer par navigate.

## Implementation Plan

### Tasks

- [ ] **Task 1 : Refactorer OnboardingWizard en page standalone**
  - File: `ui/src/components/OnboardingWizard.tsx`
  - Action:
    - Retirer l'import et l'utilisation de `Dialog`, `DialogPortal` de Radix UI
    - Retirer l'appel à `useDialog()` (`onboardingOpen`, `onboardingOptions`, `closeOnboarding`)
    - Ajouter `useSearchParams` pour lire `step` et `companyId` depuis l'URL
    - Remplacer le wrapper `<Dialog open={onboardingOpen}>...<DialogPortal>...</DialogPortal></Dialog>` par un `<div className="fixed inset-0 z-50 bg-background">...</div>` (full-screen, comme AuthPage)
    - Remplacer `closeOnboarding()` par `navigate("/")` (retour au dashboard après complétion)
    - Le composant doit lire `initialStep` depuis `searchParams.get("step")` au lieu de `onboardingOptions.initialStep`
    - Le composant doit lire `companyId` depuis `searchParams.get("companyId")` au lieu de `onboardingOptions.companyId`
  - Notes: Fichier de 66KB — toucher au minimum. Seul le wrapper Dialog et la source des options changent. Toute la logique des 4 steps reste intacte.

- [ ] **Task 2 : Cleanup DialogContext (retirer onboarding)**
  - File: `ui/src/context/DialogContext.tsx`
  - Action:
    - Retirer l'interface `OnboardingOptions`
    - Retirer du `DialogContextValue` : `onboardingOpen`, `onboardingOptions`, `openOnboarding`, `closeOnboarding`
    - Retirer du `DialogProvider` : les 2 useState (`onboardingOpen`, `onboardingOptions`), les 2 useCallback (`openOnboarding`, `closeOnboarding`)
    - Retirer du Provider value : les 4 champs onboarding
  - Notes: Le reste du DialogContext (newIssue, newProject, newGoal, newAgent) reste intact.

- [ ] **Task 3 : Ajouter route `/onboarding` dans App.tsx**
  - File: `ui/src/App.tsx`
  - Action:
    - Retirer `<OnboardingWizard />` de la fin du composant `App()` (L307)
    - Ajouter `<Route path="onboarding" element={<OnboardingWizard />} />` à l'INTÉRIEUR de `<Route element={<CloudAccessGate />}>` mais HORS de `<Route path=":companyPrefix" element={<Layout />}>` (même niveau que `CompanyRootRedirect`)
    - Modifier `CompanyRootRedirect` : remplacer le check `if (onboardingOpen)` par `<Navigate to="/onboarding" replace />` quand `companies.length === 0`
    - Modifier `NoCompaniesStartPage` : retirer `useDialog()` et `useEffect` auto-open, remplacer le bouton par `<Link to="/onboarding">` ou `navigate("/onboarding")`
    - Retirer l'import de `useDialog` de App.tsx si plus utilisé
    - Retirer l'import de `OnboardingWizard` du top-level (il sera importé via la route)
  - Notes: La route `/onboarding` est protégée par `CloudAccessGate` (nécessite auth en mode authenticated) mais n'est PAS dans `Layout` (pas de sidebar).

- [ ] **Task 4 : Adapter Layout.tsx — retirer auto-trigger onboarding**
  - File: `ui/src/components/Layout.tsx`
  - Action:
    - Retirer le `useEffect` L48-55 qui appelle `openOnboarding()` quand `companies.length === 0` en local_trusted
    - Retirer `openOnboarding` du destructuring de `useDialog()` (garder `openNewIssue` qui est toujours utilisé)
    - Ajouter un `navigate("/onboarding")` dans un useEffect si `companies.length === 0` et mode `local_trusted` (ou mieux : laisser `CompanyRootRedirect` gérer ce cas, qui redirige déjà avant d'arriver au Layout)
  - Notes: En pratique, `CompanyRootRedirect` redirigera vers `/onboarding` avant que `Layout` ne soit monté si companies === 0. Le useEffect dans Layout est donc redondant. On peut le retirer complètement.

- [ ] **Task 5 : Adapter CompanyRail.tsx — navigate au lieu de dialog**
  - File: `ui/src/components/CompanyRail.tsx`
  - Action:
    - Remplacer `const { openOnboarding } = useDialog()` par `const navigate = useNavigate()`
    - Remplacer `onClick={() => openOnboarding()}` (L307) par `onClick={() => navigate("/onboarding")}`
    - Retirer l'import de `useDialog` si plus utilisé dans ce fichier
    - Ajouter l'import de `useNavigate` depuis `@/lib/router`
  - Notes: Vérifier si `useDialog` est utilisé pour autre chose dans CompanyRail (sinon retirer l'import).

- [ ] **Task 6 : Adapter Dashboard.tsx — navigate au lieu de dialog**
  - File: `ui/src/pages/Dashboard.tsx`
  - Action:
    - Remplacer `const { openOnboarding } = useDialog()` par usage de `useNavigate()`
    - L204 `onAction={openOnboarding}` → `onAction={() => navigate("/onboarding")}`
    - L261 `onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}` → `onClick={() => navigate(\`/onboarding?step=2&companyId=\${selectedCompanyId}\`)}`
    - Retirer l'import de `useDialog` si plus utilisé
  - Notes: Le Dashboard a déjà `useNavigate` importé (vérifier). Le cas `initialStep: 2` passe le step en query param.

- [ ] **Task 7 : Adapter Companies.tsx — navigate au lieu de dialog**
  - File: `ui/src/pages/Companies.tsx`
  - Action:
    - Remplacer `const { openOnboarding } = useDialog()` par `useNavigate()`
    - L93 `onClick={() => openOnboarding()}` → `onClick={() => navigate("/onboarding")}`
    - Retirer l'import de `useDialog` si plus utilisé
  - Notes: Changement simple.

- [ ] **Task 8 : Vérifier et adapter les tests E2E**
  - Files: `e2e/tests/auth/sign-in.browser.ts`, `e2e/tests/auth/sign-out.browser.ts`, tests onboarding
  - Action:
    - Vérifier que les tests auth sign-in continuent de fonctionner (ils naviguent déjà vers `/auth` explicitement avec un storageState clean)
    - Vérifier que les tests browser (storageState admin) ne passent plus par `/auth` dans les vidéos — grâce au storageState pré-auth, le `CloudAccessGate` ne redirigera pas vers `/auth`
    - Si des tests E2E onboarding existent en browser (pas seulement file-content .spec.ts), vérifier qu'ils naviguent vers `/onboarding` au lieu de trigger le dialog
    - Vérifier que les tests "from scratch" (context clean) font un sign-in avant le test via le fixture ou un beforeEach
  - Notes: Les tests auth existants utilisent déjà un `storageState` clean override. Les tests browser standards utilisent `storageState: "e2e/.auth/storageState.json"` (admin). Le problème principal est que le redirect `CloudAccessGate` vers `/auth` apparaît dans les vidéos si le storageState est invalide ou si la session a expiré. Avec le storageState pré-auth du global-setup, ça devrait déjà fonctionner proprement.

### Acceptance Criteria

- [ ] **AC 1** : Given un utilisateur non connecté en mode `authenticated`, when il accède à `/dashboard`, then il est redirigé vers `/auth?next=%2Fdashboard` et voit UNIQUEMENT la page auth (pas de sidebar, pas de contenu derrière)
- [ ] **AC 2** : Given un utilisateur connecté sans company, when il accède à `/`, then il est redirigé vers `/onboarding` (page full-screen, pas de sidebar)
- [ ] **AC 3** : Given un utilisateur connecté avec au moins 1 company, when il accède à `/`, then il est redirigé vers `/:prefix/dashboard` (pas de redirect auth, pas d'onboarding)
- [ ] **AC 4** : Given un utilisateur sur la page onboarding, when il complète les 4 steps, then il est redirigé vers le dashboard de la company créée
- [ ] **AC 5** : Given un utilisateur connecté sur le Dashboard, when il clique "Configure Dual Mode", then il est navigué vers `/onboarding?step=2&companyId=xxx`
- [ ] **AC 6** : Given un utilisateur connecté sur CompanyRail/Companies, when il clique "New Company", then il est navigué vers `/onboarding`
- [ ] **AC 7** : Given un test E2E browser avec storageState admin, when le test prend un screenshot/vidéo, then la page `/auth` n'apparaît PAS dans la capture
- [ ] **AC 8** : Given un test E2E sign-in (context clean), when le test navigue vers `/auth`, then la page auth est autonome (pas de contenu derrière)
- [ ] **AC 9** : Given la route `/onboarding` en mode `local_trusted`, when un utilisateur sans company accède à l'app, then il est redirigé vers `/onboarding` (même comportement qu'en mode authenticated, sans l'étape auth)
- [ ] **AC 10** : Given le `DialogContext`, when on inspecte l'interface, then les champs `onboardingOpen`, `onboardingOptions`, `openOnboarding`, `closeOnboarding` n'existent plus

## Additional Context

### Dependencies

- Aucune nouvelle dépendance npm
- Aucun changement backend
- 100% frontend (React routing + composant) + E2E (Playwright)
- `@radix-ui/react-dialog` reste utilisé pour les autres dialogs (NewIssue, NewProject, NewGoal, NewAgent)

### Testing Strategy

- **Tests existants à adapter** : vérifier que `sign-in.browser.ts` et `sign-out.browser.ts` passent toujours
- **Tests existants file-content** : `ONB-S01.spec.ts` vérifie la structure du code — mettre à jour les assertions si nécessaire (retrait Dialog import dans OnboardingWizard)
- **Vérification manuelle** :
  1. Lancer `bun run dev` → accéder à l'app → vérifier redirect vers onboarding si 0 companies
  2. Lancer Docker authenticated → vérifier redirect `/auth` → sign-in → redirect `/onboarding` si 0 companies → complétion → dashboard
  3. Lancer `bun run test:e2e` → vérifier screenshots/vidéos propres (pas d'auth en arrière-plan)
- **Build** : `bun run build` + `bun run typecheck` doivent passer (aucun import cassé)

### Notes

- **Risque principal** : OnboardingWizard fait 66KB — refactoring du wrapper Dialog doit être chirurgical pour ne pas casser les 4 steps internes
- **Edge case** : Dashboard appelle `openOnboarding({ initialStep: 2, companyId })` — s'assurer que les query params sont bien lus dans OnboardingWizard
- **Compatibilité local_trusted** : le useEffect dans Layout qui trigger l'onboarding en local_trusted doit être remplacé par le redirect dans CompanyRootRedirect (qui couvre les deux modes)
- **Futur** : une fois que l'onboarding est une route, on pourra facilement ajouter des deep links et des tests E2E browser pour chaque step
