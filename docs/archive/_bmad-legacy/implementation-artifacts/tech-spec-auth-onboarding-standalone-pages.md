---
title: 'Auth & Onboarding — Standalone Pages'
slug: 'auth-onboarding-standalone-pages'
created: '2026-03-18'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['React 18', 'react-router-dom', 'Radix UI Dialog', 'Playwright', 'Express', 'TanStack Query']
files_to_modify: ['ui/src/lib/company-routes.ts', 'ui/src/App.tsx', 'ui/src/components/OnboardingWizard.tsx', 'ui/src/context/DialogContext.tsx', 'ui/src/components/Layout.tsx', 'ui/src/components/CompanyRail.tsx', 'ui/src/pages/Dashboard.tsx', 'ui/src/pages/Companies.tsx', 'e2e/tests/onboarding/onboarding-wizard.browser.ts']
code_patterns: ['top-level routes outside CloudAccessGate for public pages', 'CloudAccessGate Outlet wrapper for protected routes', 'Dialog/DialogPortal for modal overlays', 'useDialog() hook for dialog state', 'storageState for pre-authenticated E2E contexts', 'openOnboarding() with OnboardingOptions (initialStep, companyId)', 'GLOBAL_ROUTE_ROOTS / BOARD_ROUTE_ROOTS in company-routes.ts controls navigate() prefix rewriting', 'useNavigate from @/lib/router applies company prefix — /onboarding must be in GLOBAL_ROUTE_ROOTS']
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

### Architecture Onboarding (2 flows)

Il existe en réalité **deux flows d'onboarding** :

1. **Global** (`/onboarding`) — Premier setup admin serveur, crée la première company + configure. Hors Layout, hors company context. Route dans `GLOBAL_ROUTE_ROOTS`.
2. **Per-company** — Configuration d'une company existante (dual mode, invites, agents). Aujourd'hui déclenché via `openOnboarding({ initialStep: 2, companyId })` depuis le Dashboard.

**Pour cette itération** : un seul composant `OnboardingWizard` couvre les deux cas, routé vers `/onboarding` avec query params (`?step=2&companyId=xxx` pour le per-company). Le routing est conçu pour supporter un futur split vers `/:companyPrefix/onboarding` quand nécessaire.

### Scope

**In Scope:**
- Transformer l'onboarding de Dialog portal en route dédiée (`/onboarding`)
- Enregistrer `"onboarding"` dans `GLOBAL_ROUTE_ROOTS` (éviter la réécriture de préfixe par le custom router)
- Cleanup du `DialogContext` (retirer `onboardingOpen`/`openOnboarding`/`closeOnboarding`)
- Layout minimaliste pour la page onboarding (pas de sidebar)
- Adapter les redirects : après auth → onboarding si nécessaire → dashboard
- Adapter les tests E2E existants (auth + onboarding browser tests)

**Out of Scope:**
- Changement fonctionnel des 6 steps d'onboarding (type Step = 1 | 2 | 3 | 4 | 5 | 6)
- Refonte de l'UI auth
- Split per-company onboarding en route `/:companyPrefix/onboarding` (futur)

## Context for Development

### Codebase Patterns

- **Routes publiques** : routes top-level dans `App.tsx` hors `CloudAccessGate` (`/auth`, `/board-claim/:token`, `/invite/:token`)
- **Routes protégées** : toutes les routes dans `<Route element={<CloudAccessGate />}>` — redirigent vers `/auth?next=...` si pas de session en mode `authenticated`
- **Custom router** (`ui/src/lib/router.tsx`) : exporte `useNavigate`, `Navigate`, `Link`, `NavLink` qui wrappent react-router-dom et appliquent `applyCompanyPrefix()`. Le prefix rewriting est contrôlé par `GLOBAL_ROUTE_ROOTS` et `BOARD_ROUTE_ROOTS` dans `ui/src/lib/company-routes.ts`. Les paths dont le root segment est dans `GLOBAL_ROUTE_ROOTS` ne sont PAS préfixés. **`"onboarding"` doit être ajouté à `GLOBAL_ROUTE_ROOTS`** sinon `navigate("/onboarding")` sera réécrit en `/:companyPrefix/onboarding`.
- **Onboarding actuel** : `<OnboardingWizard />` rendu en L307 de `App.tsx` hors du `<Routes>`, utilise `Dialog`+`DialogPortal` de Radix UI
- **openOnboarding()** : appelé depuis **6 endroits** avec `useDialog()` :
  1. `App.tsx` L180 — `CompanyRootRedirect` lit `onboardingOpen` (condition)
  2. `App.tsx` L228 — `NoCompaniesStartPage` auto-open via `useEffect` + bouton onClick
  3. `Layout.tsx` L53 — auto-trigger si 0 companies en local_trusted
  4. `CompanyRail.tsx` L307 — bouton "New Company"
  5. `Dashboard.tsx` L204/L261 — empty state + dual mode config
  6. `Companies.tsx` L93 — bouton "New Company"
- **OnboardingWizard steps** : `type Step = 1 | 2 | 3 | 4 | 5 | 6` (6 steps, pas 4). L'interface `OnboardingOptions` dans DialogContext type `initialStep` à `1|2|3|4` (incomplet).
- **Completion flow** (`OnboardingWizard.tsx` L607-619) : après complétion, le wizard appelle `closeOnboarding()` PUIS `navigate()` vers l'URL spécifique de la company créée (`/${prefix}/issues/${ref}` ou `/${prefix}/dashboard`). L'ordre est important : la navigation APRÈS le close.
- **Cancel flow** (`OnboardingWizard.tsx` L300-303) : `handleClose()` appelle `reset()` puis `closeOnboarding()`. Pas de navigation explicite.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `ui/src/lib/company-routes.ts` | `GLOBAL_ROUTE_ROOTS` / `BOARD_ROUTE_ROOTS` — contrôle le prefix rewriting du custom router |
| `ui/src/lib/router.tsx` | Custom `useNavigate`/`Navigate`/`Link` qui applique `applyCompanyPrefix()` |
| `ui/src/App.tsx` | Router principal, CloudAccessGate, CompanyRootRedirect, NoCompaniesStartPage, OnboardingWizard mount (L307) |
| `ui/src/components/OnboardingWizard.tsx` | Wizard 6 steps (66KB), Dialog portal, useDialog() consumer. Completion L607-619, cancel L300-303 |
| `ui/src/context/DialogContext.tsx` | State management pour tous les dialogs (issues, projects, goals, agents, onboarding) |
| `ui/src/components/Layout.tsx` | App shell (sidebar + main), auto-trigger onboarding si 0 companies en local_trusted |
| `ui/src/components/CompanyRail.tsx` | Company switcher sidebar, bouton "New Company" → openOnboarding() |
| `ui/src/pages/Dashboard.tsx` | Dashboard avec empty state + dual mode trigger → openOnboarding(). A déjà `useNavigate` importé. |
| `ui/src/pages/Companies.tsx` | Liste companies, bouton "New Company" → openOnboarding() |
| `ui/src/pages/Auth.tsx` | Page auth standalone (référence design — full-screen, `fixed inset-0`) |
| `e2e/tests/onboarding/onboarding-wizard.browser.ts` | Tests browser onboarding — descriptions stale ("Dialog component triggered from EmptyState or sidebar"), à mettre à jour |
| `e2e/tests/auth/sign-in.browser.ts` | Tests sign-in (context clean, skip en local_trusted) |
| `e2e/tests/auth/sign-out.browser.ts` | Tests sign-out (admin fixture, skip en local_trusted) |
| `playwright.config.ts` | Config 3 projets (api, browser, browser-rbac), video: "on", screenshot: "on" |

### Technical Decisions

1. **`"onboarding"` ajouté à `GLOBAL_ROUTE_ROOTS`** dans `company-routes.ts`. Ceci garantit que `navigate("/onboarding")` depuis n'importe quel contexte (y compris avec un company prefix actif) ne sera PAS réécrit en `/:companyPrefix/onboarding`. C'est un prérequis pour toutes les Tasks suivantes. (Fix F1/F8/F11)
2. **Onboarding = route protégée `/onboarding`** : à l'intérieur de `CloudAccessGate` mais HORS de `Layout`. Placée AVANT la route `<Route path=":companyPrefix" element={<Layout />}>` pour éviter que `:companyPrefix` matche "onboarding" comme préfixe de company. (Fix F7)
3. **`openOnboarding()` → `navigate("/onboarding")`** : les 6 call sites convertis. Query params : `?step=N&companyId=xxx` pour le per-company flow.
4. **OnboardingWizard : 2 chemins de navigation distincts** (Fix F5) :
   - **Cancel** (`handleClose`) : `navigate("/")` → retour au dashboard ou page d'accueil
   - **Success** (completion L607-619) : garder la navigation existante vers `/${createdCompanyPrefix}/issues/${ref}` ou `/${createdCompanyPrefix}/dashboard`. Ne PAS remplacer par `navigate("/")`.
5. **Race condition post-completion** (Fix F3) : après complétion, le wizard doit `await queryClient.refetchQueries({ queryKey: queryKeys.companies.all })` (PAS `invalidateQueries` qui trigger un refetch mais ne l'attend pas) et attendre que le cache TanStack Query se rafraîchisse AVANT de naviguer. `refetchQueries` retourne une Promise qui resolve quand le refetch est terminé. Ceci évite que `CompanyRootRedirect` redirige vers `/onboarding` car `companies.length` est encore 0.
6. **DialogContext cleanup** : retirer les 4 champs onboarding. L'interface `OnboardingOptions` est supprimée (les options passent via query params).
7. **CompanyRootRedirect** : `companies.length === 0` → `<Navigate to="/onboarding" replace />`. Retire la dépendance à `onboardingOpen`.
8. **NoCompaniesStartPage** : retire `useDialog()`, `useEffect` auto-open, et `useRef`. Le bouton "New Company" utilise `<a href="/onboarding">` ou `navigate("/onboarding")`.
9. **Layout.tsx** : retirer complètement le useEffect L48-55 (redondant — CompanyRootRedirect gère le redirect avant que Layout ne soit monté).
10. **Step type** : le wizard a 6 steps (`type Step = 1 | 2 | 3 | 4 | 5 | 6`). Le query param `step` accepte des valeurs 1-6, pas 1-4. (Fix F2/F10)
11. **Escape key handler** : en retirant le `Dialog` Radix, on perd le comportement natif de fermeture sur Escape. Ajouter un `useEffect` dans OnboardingWizard qui écoute `keydown` Escape → appelle `handleClose()`. Ceci remplace le comportement `onOpenChange` du Dialog.
12. **Préparation futur split per-company** : le composant OnboardingWizard doit aussi lire `companyId` depuis les route params (`useParams`) en plus des query params. Pattern : `const { companyId: paramCompanyId } = useParams()` puis `const effectiveCompanyId = paramCompanyId ?? searchParams.get("companyId") ?? undefined`. Ceci permettra le futur split vers `/:companyPrefix/onboarding` sans toucher au composant.

## Implementation Plan

### Tasks

- [ ] **Task 1 : Ajouter `"onboarding"` à `GLOBAL_ROUTE_ROOTS`** (PREREQUIS)
  - File: `ui/src/lib/company-routes.ts`
  - Action:
    - Ajouter `"onboarding"` dans le Set `GLOBAL_ROUTE_ROOTS` (L27) : `new Set(["auth", "invite", "board-claim", "docs", "onboarding"])`
  - Notes: **Doit être fait en premier.** Sans ça, `navigate("/onboarding")` depuis un contexte avec company prefix sera réécrit en `/:companyPrefix/onboarding` et ne matchera pas la route. Toutes les Tasks 3-7 dépendent de celle-ci.

- [ ] **Task 2 : Cleanup DialogContext (retirer onboarding)**
  - File: `ui/src/context/DialogContext.tsx`
  - Action:
    - Retirer l'interface `OnboardingOptions`
    - Retirer du `DialogContextValue` : `onboardingOpen`, `onboardingOptions`, `openOnboarding`, `closeOnboarding`
    - Retirer du `DialogProvider` : les 2 useState (`onboardingOpen`, `onboardingOptions`), les 2 useCallback (`openOnboarding`, `closeOnboarding`)
    - Retirer du Provider value : les 4 champs onboarding
  - Notes: Le reste du DialogContext (newIssue, newProject, newGoal, newAgent) reste intact.

- [ ] **Task 3 : Refactorer OnboardingWizard en page standalone**
  - File: `ui/src/components/OnboardingWizard.tsx`
  - Action:
    - Retirer l'import de `Dialog`, `DialogPortal` de `@/components/ui/dialog`
    - Retirer l'appel à `useDialog()` (`onboardingOpen`, `onboardingOptions`, `closeOnboarding`)
    - Ajouter `import { useSearchParams } from "react-router-dom"` (utiliser le raw, pas le custom router)
    - Lire les options depuis les search params (+ route params pour futur split) :
      ```tsx
      const [searchParams] = useSearchParams();
      const { companyId: paramCompanyId } = useParams<{ companyId?: string }>();
      const initialStep = (Number(searchParams.get("step")) || 1) as Step;
      const initialCompanyId = paramCompanyId ?? searchParams.get("companyId") ?? undefined;
      ```
    - Parser `initialStep` en tant que `Step` (valeurs valides : 1-6, pas 1-4)
    - **Escape key handler** : ajouter un `useEffect` pour remplacer le comportement natif de fermeture du Dialog Radix :
      ```tsx
      useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === "Escape") handleClose();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
      }, []);
      ```
    - Remplacer le wrapper `<Dialog open={onboardingOpen}>...<DialogPortal>...<div className="fixed inset-0 z-50 flex">` par juste `<div className="fixed inset-0 z-50 flex bg-background">` (retirer Dialog et DialogPortal, garder le div interne tel quel)
    - **Cancel flow** (`handleClose` L300-303) : remplacer `closeOnboarding()` par `navigate("/")`. L'appel à `reset()` reste.
    - **Success flow** (L607-619) : retirer `closeOnboarding()` mais **garder** les 3 lignes de navigation existantes telles quelles :
      ```tsx
      // Si company + issue créés → aller sur l'issue
      if (createdCompanyPrefix && createdIssueRef) {
        navigate(`/${createdCompanyPrefix}/issues/${createdIssueRef}`);
        return;
      }
      // Si company créée → dashboard
      if (createdCompanyPrefix) {
        navigate(`/${createdCompanyPrefix}/dashboard`);
        return;
      }
      // Fallback
      navigate("/dashboard");
      ```
    - **Race condition** : avant les navigate du success flow, ajouter :
      ```tsx
      await queryClient.refetchQueries({ queryKey: queryKeys.companies.all });
      ```
      (le queryClient est déjà disponible dans le composant — L80). Utiliser `refetchQueries` (PAS `invalidateQueries`) car `refetchQueries` retourne une Promise qui resolve quand le refetch est terminé, tandis que `invalidateQueries` trigger un refetch en arrière-plan sans l'attendre. Ceci force le refresh du cache companies avant la navigation, évitant que CompanyRootRedirect redirige vers `/onboarding` en boucle.
    - Retirer le `onOpenChange` handler du Dialog (plus de Dialog)
    - Garder le bouton close (X) en haut à gauche, qui appelle `handleClose`
  - Notes: Fichier de 66KB — changements chirurgicaux. Seuls le wrapper Dialog, la source des options, et le close/success flow changent. Les 6 steps internes restent intacts.

- [ ] **Task 4 : Ajouter route `/onboarding` dans App.tsx + adapter redirects**
  - File: `ui/src/App.tsx`
  - Action:
    - **Retirer** `<OnboardingWizard />` de la fin du composant `App()` (L307, hors des Routes)
    - **Ajouter** `<Route path="onboarding" element={<OnboardingWizard />} />` à l'intérieur de `<Route element={<CloudAccessGate />}>`, **AVANT** la route `<Route path=":companyPrefix" element={<Layout />}>` (L302). Le placer juste après les routes `UnprefixedBoardRedirect` et avant le `:companyPrefix` catch-all.
    - **Modifier `CompanyRootRedirect`** (L178-197) :
      - Retirer `const { onboardingOpen } = useDialog();` (L180)
      - Retirer le block `if (onboardingOpen) { return <NoCompaniesStartPage autoOpen={false} /> }` (L187-189)
      - Le check `companies.length === 0` : retourner `<Navigate to="/onboarding" replace />` au lieu de `<NoCompaniesStartPage />`
      - Résultat simplifié :
        ```tsx
        function CompanyRootRedirect() {
          const { companies, selectedCompany, loading } = useCompany();
          if (loading) return <div>Loading...</div>;
          if (companies.length === 0) return <Navigate to="/onboarding" replace />;
          const target = selectedCompany ?? companies[0] ?? null;
          if (!target) return <Navigate to="/onboarding" replace />;
          return <Navigate to={`/${target.issuePrefix}/dashboard`} replace />;
        }
        ```
    - **Modifier `NoCompaniesStartPage`** (L220-244) :
      - Retirer `const { openOnboarding } = useDialog();` (L221)
      - Retirer le `useRef` (L222) et le `useEffect` auto-open (L224-229)
      - Remplacer `<Button onClick={() => openOnboarding()}>New Company</Button>` par un lien simple vers `/onboarding`. Utiliser `react-router-dom` directement : `<a href="/onboarding">` ou importer `Link` depuis `@/lib/router`.
      - Note: `NoCompaniesStartPage` pourrait être conservé comme fallback UI ou retiré si CompanyRootRedirect redirige toujours vers `/onboarding`. Si conservé, simplifier drastiquement.
    - **Retirer** l'import de `useDialog` dans App.tsx si plus utilisé nulle part
    - **Garder** l'import de `OnboardingWizard` (il est toujours utilisé, juste dans une Route au lieu du root)
  - Notes: L'import `OnboardingWizard` reste un static import (pas de lazy loading). La route `/onboarding` est placée AVANT `:companyPrefix` pour éviter que react-router matche "onboarding" comme un company prefix.

- [ ] **Task 5 : Adapter Layout.tsx — retirer auto-trigger onboarding**
  - File: `ui/src/components/Layout.tsx`
  - Action:
    - **Retirer** le `useEffect` L48-55 qui appelle `openOnboarding()` quand `companies.length === 0` en local_trusted
    - **Retirer** `openOnboarding` du destructuring de `useDialog()` L31. Garder `openNewIssue` qui est toujours utilisé.
    - Retirer `onboardingTriggered` ref (L38) qui n'est plus utilisée
  - Notes: CompanyRootRedirect redirige vers `/onboarding` avant que Layout ne soit monté si companies === 0. Le useEffect était redondant et ne servait qu'en local_trusted.

- [ ] **Task 6 : Adapter CompanyRail.tsx — navigate au lieu de dialog**
  - File: `ui/src/components/CompanyRail.tsx`
  - Action:
    - Remplacer `const { openOnboarding } = useDialog()` par usage de `useNavigate()` (déjà importé depuis `@/lib/router` ? vérifier, sinon ajouter l'import)
    - Remplacer `onClick={() => openOnboarding()}` (L307) par `onClick={() => navigate("/onboarding")}`
    - Retirer l'import de `useDialog` si plus utilisé dans ce fichier (vérifier les autres usages dans le même fichier)
  - Notes: `navigate("/onboarding")` ne sera PAS préfixé grâce à Task 1 (`"onboarding"` dans `GLOBAL_ROUTE_ROOTS`).

- [ ] **Task 7 : Adapter Dashboard.tsx — navigate au lieu de dialog**
  - File: `ui/src/pages/Dashboard.tsx`
  - Action:
    - Retirer `const { openOnboarding } = useDialog()` (L41)
    - L204 : remplacer `onAction={openOnboarding}` par `onAction={() => navigate("/onboarding")}`
    - L261 : remplacer `onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}` par `onClick={() => navigate(\`/onboarding?step=2&companyId=\${selectedCompanyId}\`)}`
    - Retirer l'import de `useDialog` si plus utilisé dans ce fichier
    - `useNavigate` est déjà importé dans ce fichier (vérifier qu'il vient de `@/lib/router`)
  - Notes: Le query param `step=2` sera lu par OnboardingWizard via `useSearchParams`. Grâce à Task 1, `/onboarding?step=2&companyId=xxx` ne sera pas préfixé.

- [ ] **Task 8 : Adapter Companies.tsx — navigate au lieu de dialog**
  - File: `ui/src/pages/Companies.tsx`
  - Action:
    - Remplacer `const { openOnboarding } = useDialog()` (L39) par usage de `useNavigate()`
    - L93 : remplacer `onClick={() => openOnboarding()}` par `onClick={() => navigate("/onboarding")}`
    - Retirer l'import de `useDialog` si plus utilisé
  - Notes: Changement simple.

- [ ] **Task 9 : Adapter les tests E2E onboarding + auth**
  - Files:
    - `e2e/tests/onboarding/onboarding-wizard.browser.ts` — **modifications concrètes requises**
    - `e2e/tests/auth/sign-in.browser.ts` — vérifier (probablement aucun changement)
    - `e2e/tests/auth/sign-out.browser.ts` — vérifier (probablement aucun changement)
  - Action sur `onboarding-wizard.browser.ts` :
    - Mettre à jour le JSDoc en haut : retirer "The wizard is a Dialog component triggered from EmptyState or sidebar", remplacer par "The wizard is a standalone page at /onboarding, accessible via redirect when no companies exist."
    - **Ajouter 2 assertions concrètes** pour valider le changement d'architecture (les tests actuels sont trop faibles et ne vérifient rien du refacto) :
      1. Test que la route `/onboarding` rend le wizard en standalone :
         ```ts
         test("onboarding page renders wizard as standalone page", async ({ adminPage }) => {
           await adminPage.goto("/onboarding");
           await expect(adminPage.locator('[data-testid="onb-s01-wizard"]')).toBeVisible({ timeout: 10_000 });
           // Verify it's a standalone page (no sidebar visible)
           await expect(adminPage.locator('[data-testid="mu-s04-sidebar-container"]')).not.toBeVisible();
         });
         ```
      2. Test que le redirect fonctionne pour un user sans company (si possible en env non-seedée, sinon vérifier la route directe)
    - Si des tests naviguent vers l'app et s'attendent à voir un dialog, mettre à jour pour naviguer vers `/onboarding` directement
  - Vérification sur les tests auth :
    - `sign-in.browser.ts` : utilise déjà un storageState clean et navigue vers `/auth` — aucun changement nécessaire
    - `sign-out.browser.ts` : utilise adminPage fixture avec storageState admin — aucun changement nécessaire
    - Les tests browser standards (storageState admin) ne devraient pas voir `/auth` dans les vidéos grâce au storageState pré-auth du global-setup
  - Notes: Le fichier `onboarding-wizard.browser.ts` est le seul test browser onboarding. Les fichiers `ONB-S01.spec.ts` à `ONB-S04.spec.ts` sont des tests file-content (vérifient la structure du code, pas le comportement browser). Ils pourraient nécessiter une mise à jour si les assertions vérifient la présence de `Dialog` import dans OnboardingWizard — vérifier au moment de l'exécution.

- [ ] **Task 10 : Build + typecheck + vérification finale**
  - Action:
    - `bun run build` — vérifier que le build passe (aucun import cassé)
    - `bun run typecheck` — vérifier le typage (retrait de `useDialog` props, etc.)
    - `bun run test:e2e` — run les tests E2E et vérifier les screenshots/vidéos
    - Vérification manuelle si possible : `bun run dev` → accéder à l'app → vérifier les flows auth/onboarding
  - Notes: Si des tests `ONB-S0*.spec.ts` échouent car ils vérifient la présence de `Dialog` dans OnboardingWizard, mettre à jour les assertions.

### Acceptance Criteria

- [ ] **AC 1** : Given un utilisateur non connecté en mode `authenticated`, when il accède à `/dashboard`, then il est redirigé vers `/auth?next=%2Fdashboard` et voit UNIQUEMENT la page auth (pas de sidebar, pas de contenu derrière)
- [ ] **AC 2** : Given un utilisateur connecté sans company, when il accède à `/`, then il est redirigé vers `/onboarding` (page full-screen, pas de sidebar, pas de contenu derrière)
- [ ] **AC 3** : Given un utilisateur connecté avec au moins 1 company, when il accède à `/`, then il est redirigé vers `/:prefix/dashboard` (pas de redirect auth, pas d'onboarding)
- [ ] **AC 4** : Given un utilisateur sur la page onboarding, when il complète tous les steps du wizard, then il est redirigé vers la page de la company créée (issues ou dashboard) — pas de redirect loop vers `/onboarding`
- [ ] **AC 5** : Given un utilisateur connecté sur le Dashboard, when il clique "Configure Dual Mode", then il est navigué vers `/onboarding?step=2&companyId=xxx` et le wizard s'ouvre au step demandé
- [ ] **AC 6** : Given un utilisateur connecté sur CompanyRail ou Companies, when il clique "New Company", then il est navigué vers `/onboarding`
- [ ] **AC 7** : Given un test E2E browser avec storageState admin, when le test prend un screenshot/vidéo, then la page `/auth` n'apparaît PAS dans la capture
- [ ] **AC 8** : Given un test E2E sign-in (context clean), when le test navigue vers `/auth`, then la page auth est autonome (pas de contenu derrière)
- [ ] **AC 9** : Given la route `/onboarding` en mode `local_trusted`, when un utilisateur sans company accède à l'app, then il est redirigé vers `/onboarding` (même comportement qu'en mode authenticated, sans l'étape auth)
- [ ] **AC 10** : Given le `DialogContext`, when on inspecte l'interface, then les champs `onboardingOpen`, `onboardingOptions`, `openOnboarding`, `closeOnboarding` n'existent plus
- [ ] **AC 11** : Given `navigate("/onboarding")` appelé depuis un composant dans un contexte company (ex: CompanyRail avec prefix "NOVATECH"), when la navigation s'exécute, then l'URL résultante est `/onboarding` (pas `/NOVATECH/onboarding`)
- [ ] **AC 12** : Given `bun run build` et `bun run typecheck`, when exécutés après tous les changements, then aucune erreur
- [ ] **AC 13** : Given un utilisateur sur la page `/onboarding`, when il appuie sur Escape, then le wizard se ferme et il est redirigé vers `/` (même comportement que le bouton X)
- [ ] **AC 14** : Given un utilisateur qui complète le wizard onboarding (success flow), when la dernière étape se termine, then le cache companies est rafraîchi (`refetchQueries`) AVANT la navigation — pas de redirect loop vers `/onboarding`
- [ ] **AC 15** : Given la page `/onboarding` et le test E2E `onboarding-wizard.browser.ts`, when le test navigue vers `/onboarding`, then le wizard est visible en standalone (pas de sidebar `mu-s04-sidebar-container`)

## Additional Context

### Dependencies

- Aucune nouvelle dépendance npm
- Aucun changement backend
- 100% frontend (React routing + composant) + E2E (Playwright)
- `@radix-ui/react-dialog` reste utilisé pour les autres dialogs (NewIssue, NewProject, NewGoal, NewAgent)

### Task Dependencies (ordre d'exécution)

```
Task 1 (company-routes.ts) ──┐
Task 2 (DialogContext)  ──────┼──→ Task 3 (OnboardingWizard) ──→ Task 4 (App.tsx routes) ──→ Tasks 5-8 (call sites) ──→ Task 9 (E2E) ──→ Task 10 (verify)
```

Tasks 5-8 sont indépendantes entre elles et peuvent être faites en parallèle après Task 4.

### Testing Strategy

- **Tests existants à adapter** : `e2e/tests/onboarding/onboarding-wizard.browser.ts` (descriptions stale à mettre à jour)
- **Tests existants à vérifier** : `sign-in.browser.ts`, `sign-out.browser.ts` (probablement aucun changement)
- **Tests file-content** : `ONB-S01.spec.ts` à `ONB-S04.spec.ts` — vérifier si des assertions checkent la présence de `Dialog` dans OnboardingWizard
- **Build verification** : `bun run build` + `bun run typecheck`
- **Vérification manuelle** :
  1. `bun run dev` → accéder à l'app → vérifier redirect vers `/onboarding` si 0 companies
  2. Docker authenticated → `/auth` → sign-in → redirect `/onboarding` si 0 companies → complétion → dashboard (pas de loop)
  3. `bun run test:e2e` → vérifier screenshots/vidéos propres

### Notes

- **Risque principal** : OnboardingWizard fait 66KB — changements chirurgicaux uniquement (wrapper Dialog + source options + close/success flow)
- **Race condition critique** (F3) : après complétion du wizard, il FAUT `await invalidateQueries(companies)` avant de naviguer, sinon CompanyRootRedirect redirige en boucle vers `/onboarding`
- **Custom router piège** (F1) : le `useNavigate` de `@/lib/router` préfixe les paths — `"onboarding"` doit être dans `GLOBAL_ROUTE_ROOTS`
- **Success vs Cancel** (F5) : le success flow a sa propre navigation (vers la company créée), ne PAS le remplacer par `navigate("/")`
- **6 steps, pas 4** (F2/F10) : `type Step = 1 | 2 | 3 | 4 | 5 | 6`
- **Futur** : pour le split per-company onboarding, ajouter `"onboarding"` à `BOARD_ROUTE_ROOTS` et créer une route `/:companyPrefix/onboarding` dans le `boardRoutes()`. Le composant restera le même grâce au pattern `paramCompanyId ?? searchParams.get("companyId")`, juste la source du companyId changera (param vs query param).
- **Known issue (hors scope)** : `playwright.config.ts` L65 utilise encore `command: "pnpm dev"` dans `webServer` pour le CI. Le projet a migré vers bun. Si le CI E2E casse, c'est probablement ça — pas lié à cette refacto.
