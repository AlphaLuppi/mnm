# MU-S04 : Selecteur de Company (Multi-Company) -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | MU-S04 |
| **Titre** | Selecteur de Company (Multi-Company) |
| **Epic** | Epic 3 -- Multi-User & Auth |
| **Sprint** | Batch 4 -- RBAC + Multi-User |
| **Effort** | S (2 SP, 1j) |
| **Assignation** | Cofondateur |
| **Bloque par** | TECH-07 (Modifications 5 tables existantes) |
| **Debloque** | RBAC-S07 (Badges role) |
| **Type** | Frontend-only (refactoring UI existante + ajout data-testid) |

---

## Description

### Contexte

MnM permet deja aux utilisateurs de naviguer entre plusieurs companies. L'infrastructure multi-company est **entierement implementee** :

1. **CompanyRail** (`ui/src/components/CompanyRail.tsx`) : barre laterale gauche (72px) avec les icones des companies, drag-and-drop pour reordonner, indicateurs live agents / unread inbox, bouton "Add company", menu utilisateur.
2. **CompanySwitcher** (`ui/src/components/CompanySwitcher.tsx`) : dropdown dans le header (utilise dans le Sidebar) avec liste des companies, lien vers Settings et Manage Companies.
3. **CompanyContext** (`ui/src/context/CompanyContext.tsx`) : React Context qui gere la liste des companies, la selection active, la persistance localStorage (`mnm.selectedCompanyId`), et l'auto-selection au chargement.
4. **Layout** (`ui/src/components/Layout.tsx`) : route-sync entre le prefix URL (`/:companyPrefix/...`) et la company selectionnee, avec `Cmd+1..9` pour switcher par index.
5. **useCompanyPageMemory** (`ui/src/hooks/useCompanyPageMemory.ts`) : memorise la derniere page visitee par company et y navigue lors du switch.
6. **API filtering** : Toutes les API calls (issues, agents, projects, goals, workflows, approvals, costs, activity, secrets, etc.) utilisent deja `selectedCompanyId` comme parametre obligatoire via les patterns `GET /companies/${companyId}/...` ou `?companyId=...`.

### Ce qui existe deja (analyse detaillee)

| Composant | Fichier | Etat |
|-----------|---------|------|
| CompanyRail (icones laterales) | `ui/src/components/CompanyRail.tsx` | Fonctionnel, drag-and-drop, badges live |
| CompanyPatternIcon | `ui/src/components/CompanyPatternIcon.tsx` | Fonctionnel, pattern Bayer dither |
| CompanySwitcher (dropdown) | `ui/src/components/CompanySwitcher.tsx` | Fonctionnel, dans Sidebar non utilise actuellement |
| CompanyContext (state global) | `ui/src/context/CompanyContext.tsx` | Fonctionnel, localStorage, auto-select |
| Sidebar (company name + nav) | `ui/src/components/Sidebar.tsx` | Affiche le nom de la company active L51-58 |
| Layout (route sync + shortcuts) | `ui/src/components/Layout.tsx` | Fonctionnel, Cmd+1..9, route_sync |
| useCompanyPageMemory | `ui/src/hooks/useCompanyPageMemory.ts` | Fonctionnel, localStorage par company |
| API client (companyId scoping) | `ui/src/api/*.ts` | Tous les endpoints utilisent companyId |
| queryKeys (cache keys) | `ui/src/lib/queryKeys.ts` | companyId dans toutes les list keys |
| Route sync (URL prefix) | `ui/src/components/Layout.tsx` L57-89 | Bi-directionnel prefix <-> selectedCompanyId |

### Ce qui manque

La story epics mentionne "UI dropdown dans header, stockage company active en Zustand, filtrage API par companyId". En realite, **tout est deja implemente** via React Context + localStorage + CompanyRail + route sync. Il n'y a pas besoin de migrer vers Zustand car le CompanyContext remplit deja ce role.

Ce qui manque concretement :

1. **`data-testid` attributes** : Aucun des composants existants (CompanyRail, CompanySwitcher, CompanyPatternIcon, Sidebar company name, Layout) n'a de `data-testid` pour les tests E2E.
2. **Accessibilite** : Le CompanyRail utilise des `<a>` avec `e.preventDefault()` au lieu de `<button>`, et manque de `aria-label` specifiques pour le company switcher.
3. **Etat visuel** : Pas d'indication claire du nombre de companies disponibles, ni de feedback visuel lors du switch (transition/animation).
4. **Robustesse** : Pas de gestion du cas ou `localStorage` est indisponible (mode prive, quota depasse).
5. **Tests** : Aucun test E2E pour le flow de switch de company.

---

## Etat Actuel du Code (Analyse)

### Fichiers a modifier

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `ui/src/components/CompanyRail.tsx` | Barre laterale avec icones company | MODIFIE : ajout `data-testid` sur tous les elements interactifs/verifiables |
| `ui/src/components/CompanySwitcher.tsx` | Dropdown company switcher | MODIFIE : ajout `data-testid`, amelioration accessibilite |
| `ui/src/components/Sidebar.tsx` | Sidebar avec company name | MODIFIE : ajout `data-testid` sur le nom de company active |
| `ui/src/components/Layout.tsx` | Layout principal | MODIFIE : ajout `data-testid` sur le container sidebar |
| `ui/src/context/CompanyContext.tsx` | Context avec state company | MODIFIE : gestion gracieuse localStorage indisponible |
| `ui/src/components/UserMenu.tsx` | Menu utilisateur | Pas de modification (a deja `data-testid`) |

### Fichiers a creer

Aucun fichier a creer. Tout existe deja.

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `ui/src/components/CompanyPatternIcon.tsx` | Icone pattern generee pour chaque company |
| `ui/src/hooks/useCompanyPageMemory.ts` | Memoire de page par company |
| `ui/src/hooks/useCurrentUser.ts` | Hook utilisateur courant |
| `ui/src/api/companies.ts` | API client companies |
| `ui/src/lib/queryKeys.ts` | Cache keys React Query |
| `packages/db/src/schema/companies.ts` | Schema table companies |
| `packages/db/src/schema/company_memberships.ts` | Schema table memberships |
| `server/src/routes/companies.ts` | Routes backend companies |
| `packages/shared/src/constants.ts` | Constantes partagees |

---

## Specification Technique

### 1. data-testid sur CompanyRail

Ajouter les `data-testid` suivants dans `CompanyRail.tsx` :

| Element | data-testid | Selecteur |
|---------|-------------|-----------|
| Container CompanyRail | `data-testid="mu-s04-company-rail"` | Le `<div>` racine du CompanyRail |
| Chaque icone company (SortableCompanyItem) | `data-testid="mu-s04-company-icon-{companyId}"` | Le `<a>` cliquable dans SortableCompanyItem |
| Icone company selectionnee | `data-testid="mu-s04-company-icon-selected"` | Attribut supplementaire sur l'icone active |
| Indicator pill de selection | `data-testid="mu-s04-selection-pill"` | Le `<div>` de la pill laterale |
| Badge live agents | `data-testid="mu-s04-live-badge-{companyId}"` | Le `<span>` du badge bleu pulsant |
| Badge unread inbox | `data-testid="mu-s04-unread-badge-{companyId}"` | Le `<span>` du badge rouge |
| Bouton "Add company" | `data-testid="mu-s04-add-company-btn"` | Le `<button>` "Add company" |
| Tooltip company name | `data-testid="mu-s04-company-tooltip-{companyId}"` | Le `<TooltipContent>` |

### 2. data-testid sur CompanySwitcher

Ajouter les `data-testid` suivants dans `CompanySwitcher.tsx` :

| Element | data-testid | Selecteur |
|---------|-------------|-----------|
| Trigger button | `data-testid="mu-s04-switcher-trigger"` | Le `<Button>` qui ouvre le dropdown |
| Dropdown content | `data-testid="mu-s04-switcher-dropdown"` | Le `<DropdownMenuContent>` |
| Company name affiche | `data-testid="mu-s04-switcher-current-name"` | Le `<span>` avec le nom de la company selectionnee |
| Status dot | `data-testid="mu-s04-switcher-status-dot"` | Le `<span>` du dot de statut |
| Chaque option company | `data-testid="mu-s04-switcher-option-{companyId}"` | Chaque `<DropdownMenuItem>` |
| Option active (highlight) | `data-testid="mu-s04-switcher-option-active"` | L'option avec `bg-accent` |
| Lien "Company Settings" | `data-testid="mu-s04-switcher-settings"` | Le `<Link>` vers /company/settings |
| Lien "Manage Companies" | `data-testid="mu-s04-switcher-manage"` | Le `<Link>` vers /companies |
| Empty state | `data-testid="mu-s04-switcher-empty"` | Le `<DropdownMenuItem disabled>` "No companies" |

### 3. data-testid sur Sidebar (company name)

| Element | data-testid | Selecteur |
|---------|-------------|-----------|
| Company name dans Sidebar header | `data-testid="mu-s04-sidebar-company-name"` | Le `<span>` affichant le nom L57 |
| Brand color swatch | `data-testid="mu-s04-sidebar-brand-color"` | Le `<div>` carre avec backgroundColor L51-55 |

### 4. data-testid sur Layout

| Element | data-testid | Selecteur |
|---------|-------------|-----------|
| Container sidebar complet (rail + sidebar) | `data-testid="mu-s04-sidebar-container"` | Le `<div>` parent contenant CompanyRail + Sidebar |

### 5. CompanyContext -- Robustesse localStorage

Modifier `CompanyContext.tsx` pour :

- Wrapper les appels `localStorage.getItem()` et `localStorage.setItem()` dans un try/catch
- Fallback gracieux : si localStorage est indisponible, le state fonctionne en memoire seulement (pas de persistance cross-refresh)
- Le comportement actuel est deja partiellement robuste (auto-select au chargement), mais le `useState` initializer (L42) peut throw si localStorage n'est pas disponible

```typescript
// Avant (L42)
const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(
  () => localStorage.getItem(STORAGE_KEY)
);

// Apres
const [selectedCompanyId, setSelectedCompanyIdState] = useState<string | null>(
  () => {
    try { return localStorage.getItem(STORAGE_KEY); }
    catch { return null; }
  }
);
```

Meme pattern pour `setSelectedCompanyId` (L78-82) et l'`useEffect` auto-select (L64-76).

### 6. Accessibilite CompanyRail

- Ajouter `role="navigation"` et `aria-label="Company selector"` sur le container CompanyRail
- Ajouter `aria-current="true"` sur l'icone company selectionnee
- Le SortableCompanyItem utilise un `<a>` avec `e.preventDefault()` -- garder tel quel car le drag-and-drop DnD Kit requiert ce pattern

---

## Mapping data-testid Complet

| data-testid | Composant | Element | Type |
|-------------|-----------|---------|------|
| `mu-s04-company-rail` | CompanyRail | Container racine | Verification |
| `mu-s04-company-icon-{id}` | SortableCompanyItem | Lien company cliquable | Interactif |
| `mu-s04-company-icon-selected` | SortableCompanyItem | Attribut sur l'icone active | Verification |
| `mu-s04-selection-pill` | SortableCompanyItem | Pill de selection laterale | Verification |
| `mu-s04-live-badge-{id}` | SortableCompanyItem | Badge agents actifs | Verification |
| `mu-s04-unread-badge-{id}` | SortableCompanyItem | Badge inbox non lu | Verification |
| `mu-s04-add-company-btn` | CompanyRail | Bouton ajouter company | Interactif |
| `mu-s04-company-tooltip-{id}` | SortableCompanyItem | Tooltip nom company | Verification |
| `mu-s04-switcher-trigger` | CompanySwitcher | Bouton ouvrir dropdown | Interactif |
| `mu-s04-switcher-dropdown` | CompanySwitcher | Contenu du dropdown | Verification |
| `mu-s04-switcher-current-name` | CompanySwitcher | Nom company affiche | Verification |
| `mu-s04-switcher-status-dot` | CompanySwitcher | Dot de statut | Verification |
| `mu-s04-switcher-option-{id}` | CompanySwitcher | Option company dans dropdown | Interactif |
| `mu-s04-switcher-option-active` | CompanySwitcher | Option active highlight | Verification |
| `mu-s04-switcher-settings` | CompanySwitcher | Lien settings | Interactif |
| `mu-s04-switcher-manage` | CompanySwitcher | Lien manage companies | Interactif |
| `mu-s04-switcher-empty` | CompanySwitcher | Empty state | Verification |
| `mu-s04-sidebar-company-name` | Sidebar | Nom company en haut | Verification |
| `mu-s04-sidebar-brand-color` | Sidebar | Carre couleur brand | Verification |
| `mu-s04-sidebar-container` | Layout | Container sidebar complet | Verification |

---

## Acceptance Criteria (Given / When / Then)

### AC-1 : Company Rail affiche les companies de l'utilisateur

```
Given un utilisateur connecte avec 3 companies (Acme Corp, Beta Inc, Gamma Ltd)
When la page se charge
Then le CompanyRail affiche 3 icones company [mu-s04-company-rail]
 And chaque icone a un data-testid [mu-s04-company-icon-{companyId}]
 And l'icone de la company active a l'attribut [mu-s04-company-icon-selected]
 And la pill de selection [mu-s04-selection-pill] est visible (h-5) sur la company active
```

### AC-2 : Switch de company via CompanyRail

```
Given l'utilisateur a "Acme Corp" selectionnee
When il clique sur l'icone de "Beta Inc" [mu-s04-company-icon-{betaId}]
Then la company active devient "Beta Inc"
 And le Sidebar affiche "Beta Inc" [mu-s04-sidebar-company-name]
 And l'URL change vers /{betaPrefix}/...
 And les donnees (issues, agents, projets) se rechargent pour Beta Inc
 And la pill de selection se deplace vers l'icone Beta Inc
```

### AC-3 : Switch de company via CompanySwitcher dropdown

```
Given l'utilisateur ouvre le dropdown [mu-s04-switcher-trigger]
Then le dropdown affiche la liste des companies non-archivees [mu-s04-switcher-dropdown]
 And la company active est highlightee [mu-s04-switcher-option-active]
When il clique sur "Gamma Ltd" [mu-s04-switcher-option-{gammaId}]
Then la company active devient "Gamma Ltd"
 And le dropdown se ferme
 And le Sidebar affiche "Gamma Ltd"
```

### AC-4 : Persistance de la selection au rechargement

```
Given l'utilisateur a selectionne "Beta Inc"
When il recharge la page (F5)
Then "Beta Inc" reste la company active
 And le Sidebar affiche "Beta Inc" [mu-s04-sidebar-company-name]
 And le CompanyRail montre la pill de selection sur Beta Inc
```

### AC-5 : Memoire de page par company

```
Given l'utilisateur est sur la page /acme/issues avec "Acme Corp" active
When il switch vers "Beta Inc" qui etait precedemment sur /beta/goals
Then il est redirige vers /beta/goals (et non /beta/dashboard)
When il re-switch vers "Acme Corp"
Then il est redirige vers /acme/issues
```

### AC-6 : Route sync bidirectionnelle

```
Given l'utilisateur est sur /acme/dashboard avec "Acme Corp" active
When il navigue manuellement vers /beta/dashboard (via URL)
Then "Beta Inc" est automatiquement selectionnee dans le CompanyRail
 And le Sidebar affiche "Beta Inc"
 And la pill de selection se deplace
```

### AC-7 : Shortcut clavier Cmd+1..9

```
Given l'utilisateur a 3 companies dans le CompanyRail
When il appuie sur Cmd+2 (ou Ctrl+2 sur Windows)
Then la 2eme company du rail est selectionnee
 And le switch se fait comme un click normal (URL, donnees, sidebar)
```

### AC-8 : Bouton "Add company"

```
Given l'utilisateur voit le CompanyRail
When il clique sur le bouton "+" [mu-s04-add-company-btn]
Then le dialog d'onboarding s'ouvre
```

### AC-9 : CompanySwitcher liens Settings et Manage

```
Given l'utilisateur ouvre le CompanySwitcher dropdown
When il clique sur "Company Settings" [mu-s04-switcher-settings]
Then il est redirige vers /company/settings
When il clique sur "Manage Companies" [mu-s04-switcher-manage]
Then il est redirige vers /companies
```

### AC-10 : Badges live agents et unread inbox

```
Given la company "Acme Corp" a 2 agents actifs et 3 inbox unread
When le CompanyRail se charge
Then l'icone Acme Corp affiche un badge bleu pulsant [mu-s04-live-badge-{acmeId}]
 And un badge rouge [mu-s04-unread-badge-{acmeId}]
```

### AC-11 : Empty state (0 companies)

```
Given l'utilisateur n'a aucune company
When le CompanySwitcher dropdown s'ouvre
Then il affiche "No companies" [mu-s04-switcher-empty]
```

### AC-12 : localStorage indisponible (mode prive)

```
Given localStorage n'est pas disponible (navigation privee restrictive)
When l'utilisateur selectionne une company
Then le switch fonctionne normalement dans la session
But la selection n'est pas persistee au rechargement
 And l'auto-select choisit la premiere company au rechargement
```

### AC-13 : Accessibilite

```
Given l'utilisateur navigue au clavier
When il tab jusqu'au CompanyRail
Then le container a role="navigation" et aria-label="Company selector"
 And l'icone active a aria-current="true"
 And chaque icone a un tooltip accessible [mu-s04-company-tooltip-{id}]
```

### AC-14 : Drag-and-drop reorder persiste

```
Given l'utilisateur a 3 companies dans le CompanyRail
When il drag "Beta Inc" au-dessus de "Acme Corp"
Then l'ordre change visuellement
 And l'ordre est persiste en localStorage
When il recharge la page
Then l'ordre est conserve
```

---

## Regles de Developpement

1. **Pas de Zustand** : La story epics mentionnait Zustand, mais le CompanyContext existant remplit deja ce role. On garde React Context + localStorage pour la coherence avec le code existant.
2. **Pas de nouveau composant** : Tous les composants existent. On ajoute uniquement des `data-testid` et des ameliorations mineures de robustesse.
3. **data-testid format** : `data-testid="mu-s04-{element}"` avec `{companyId}` pour les elements dynamiques.
4. **Backward compatible** : Aucun changement de comportement observable. Les `data-testid` sont invisibles pour l'utilisateur.
5. **No backend changes** : Cette story est purement frontend.

---

## Dev Checklist

- [ ] Ajouter `data-testid="mu-s04-company-rail"` + `role="navigation"` + `aria-label="Company selector"` sur le container CompanyRail
- [ ] Ajouter `data-testid="mu-s04-company-icon-{id}"` sur chaque SortableCompanyItem `<a>`
- [ ] Ajouter `data-testid="mu-s04-company-icon-selected"` + `aria-current="true"` sur l'icone active
- [ ] Ajouter `data-testid="mu-s04-selection-pill"` sur la pill de selection
- [ ] Ajouter `data-testid="mu-s04-live-badge-{id}"` et `data-testid="mu-s04-unread-badge-{id}"` sur les badges
- [ ] Ajouter `data-testid="mu-s04-add-company-btn"` sur le bouton "+"
- [ ] Ajouter `data-testid="mu-s04-company-tooltip-{id}"` sur les tooltips
- [ ] Ajouter `data-testid="mu-s04-switcher-trigger"` sur le trigger du CompanySwitcher
- [ ] Ajouter `data-testid="mu-s04-switcher-dropdown"` sur le DropdownMenuContent
- [ ] Ajouter `data-testid="mu-s04-switcher-current-name"` sur le nom affiche
- [ ] Ajouter `data-testid="mu-s04-switcher-status-dot"` sur le status dot
- [ ] Ajouter `data-testid="mu-s04-switcher-option-{id}"` sur chaque option
- [ ] Ajouter `data-testid="mu-s04-switcher-option-active"` sur l'option active
- [ ] Ajouter `data-testid="mu-s04-switcher-settings"` et `data-testid="mu-s04-switcher-manage"` sur les liens
- [ ] Ajouter `data-testid="mu-s04-switcher-empty"` sur le empty state
- [ ] Ajouter `data-testid="mu-s04-sidebar-company-name"` dans Sidebar L57
- [ ] Ajouter `data-testid="mu-s04-sidebar-brand-color"` dans Sidebar L51-55
- [ ] Ajouter `data-testid="mu-s04-sidebar-container"` dans Layout
- [ ] Wrapper localStorage dans try/catch dans CompanyContext.tsx (initializer L42, setter L78-82, auto-select L64-76)
- [ ] Verifier que tous les AC passent manuellement

---

## Test Strategy (QA Agent)

### Tests E2E Playwright : `e2e/tests/MU-S04.spec.ts`

| Test | Description | Assertions |
|------|-------------|-----------|
| `company-rail-renders` | CompanyRail affiche les companies | `[mu-s04-company-rail]` visible, N icones presentes |
| `company-rail-shows-selected` | Icone active a la pill et l'attribut selected | `[mu-s04-company-icon-selected]` present, `[mu-s04-selection-pill]` hauteur 20px |
| `company-switch-via-rail` | Click sur une autre icone switch la company | Sidebar name change, URL change, queries refetch |
| `company-switch-via-switcher` | Dropdown CompanySwitcher fonctionne | Open trigger, click option, verify switch |
| `company-selection-persists` | Selection survit au rechargement | Reload page, verify same company selected |
| `company-page-memory` | Memoire de page par company | Switch away, switch back, verify page restored |
| `company-route-sync` | Navigation URL synchronise la selection | Navigate to different prefix URL, verify rail updates |
| `company-keyboard-shortcut` | Cmd+N switch vers la Nieme company | Press shortcut, verify switch |
| `company-add-button` | Bouton "+" ouvre onboarding | Click add, verify dialog opens |
| `company-switcher-settings` | Liens Settings et Manage fonctionnent | Click links, verify navigation |
| `company-badges` | Badges live/unread affiche correctement | Verify badge presence/absence based on data |
| `company-accessibility` | Attributs ARIA corrects | Verify role, aria-label, aria-current |
| `company-drag-reorder` | Drag-and-drop change l'ordre | Drag item, verify new order, reload and verify persistence |

### Setup de test requis

- Au moins 2 companies avec des donnees (issues, agents) pour verifier le switch
- Un agent actif dans une company pour verifier le badge live
- Des items unread dans l'inbox d'une company pour verifier le badge unread

---

## Dependances

### Pre-requis (DONE ou IN_PROGRESS)

| Story | Description | Statut requis |
|-------|-------------|---------------|
| TECH-07 | Modifications 5 tables existantes (businessRole, invitationOnly, etc.) | DONE |

### Ce qui en depend

| Story | Description | Relation |
|-------|-------------|----------|
| RBAC-S07 | Badges role dans la page Membres | Utilise le company selector pour afficher les badges role dans le contexte de la company active |
