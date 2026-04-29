# Sprint Plan — Epic DV2: Dashboard V2 Unified Grid + Resize

> Date: 2026-04-07 | Auteur: PM/PO Agent
> Documents source: `dashboard-v2-architecture.md` (Section 2), `dashboard-v2-ux-spec.md`
> Statut: DRAFT

---

## Resume

| Metrique          | Valeur |
|-------------------|--------|
| Total stories     | 15     |
| Total points      | 55 SP  |
| Complexite haute  | 3 stories (8 SP chacune) |
| Complexite moyenne| 5 stories (5 SP chacune) |
| Complexite faible | 7 stories (1-3 SP)       |

### Ordre d'execution (par dependances)

```
DV2-01 (Install RGL)
  └─> DV2-02 (Types WidgetPlacement)
        ├─> DV2-03 (Layout Materializer)
        │     └─> DV2-04 (GET /my-view enhanced)
        │           └─> DV2-05 (PATCH /my-view/overrides V2)
        ├─> DV2-06 (WidgetCard)
        │     └─> DV2-07 (UnifiedDashboardGrid)
        │           ├─> DV2-08 (Drag-and-drop)
        │           ├─> DV2-09 (Resize handles)
        │           ├─> DV2-10 (Layout persistence)
        │           ├─> DV2-12 (Responsive breakpoints)
        │           └─> DV2-13 (Empty states)
        └─> DV2-11 (Add Widget dialog V2)
DV2-14 (Accessibility) — apres DV2-07/08/09
DV2-15 (Design polish) — derniere story, apres toutes les autres
```

---

## Stories

### DV2-01: Installer react-grid-layout et configurer le package

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-01 |
| **Points**       | 1      |
| **Dependances**  | Aucune |

**Description**

Ajouter `react-grid-layout` et `@types/react-grid-layout` au workspace `ui`. Importer le CSS necessaire de react-grid-layout. Verifier que le build et le typecheck passent.

**Criteres d'acceptation**

- [ ] `react-grid-layout` ^1.4.x installe dans `ui/package.json`
- [ ] `@types/react-grid-layout` ^1.4.x en devDependencies
- [ ] CSS de react-grid-layout importe dans `ui/src/index.css` ou via un import global
- [ ] `bun run build` passe sans erreur
- [ ] `bun run typecheck` passe (13/13 packages)

**Fichiers a creer/modifier**

- `ui/package.json` — ajouter les dependances
- `ui/src/index.css` ou `ui/src/main.tsx` — import CSS react-grid-layout

**Notes de design**

Aucune UI visible dans cette story. Foundation technique uniquement.

---

### DV2-02: Types WidgetPlacement + LayoutOverrides V2

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-02 |
| **Points**       | 2      |
| **Dependances**  | DV2-01 |

**Description**

Ajouter le type `WidgetPlacement` dans `@mnm/shared` et faire evoluer `LayoutOverrides.dashboard` pour supporter le champ `layout?: WidgetPlacement[]` en V2, tout en gardant la retrocompatibilite V1 (`hiddenWidgets`, `extraWidgets`).

**Criteres d'acceptation**

- [ ] `WidgetPlacement` exporte depuis `@mnm/shared` avec les champs: `widgetId`, `x`, `y`, `w`, `h`, `hidden?`, `props?`
- [ ] Convention d'ID: `"preset:{type}"` pour widgets registre, UUID pour user_widgets
- [ ] `LayoutOverrides.dashboard` accepte `layout?: WidgetPlacement[]` (V2) en plus des champs V1
- [ ] `MyViewResponse` inclut un champ `grid: WidgetPlacement[] | null`
- [ ] Ajouter `DEFAULT_HEIGHT` mapping exporte pour les hauteurs par defaut par type de widget
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `packages/shared/src/types/view-preset.ts` — ajouter `WidgetPlacement`, evoluer `LayoutOverrides`, ajouter `DEFAULT_HEIGHT`
- `packages/shared/src/index.ts` — verifier l'export

**Notes de design**

Ref. architecture doc 2.3.1 et 2.3.2. La grille utilise 12 colonnes (span 1 = 3 cols, span 4 = 12 cols). Row height base = 40px (h=3 ~120px).

---

### DV2-03: Layout Materializer (service backend)

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-03 |
| **Points**       | 5      |
| **Dependances**  | DV2-02 |

**Description**

Creer le service `layout-materializer.ts` cote serveur avec deux fonctions:
- `materializeLayout(presetWidgets, userWidgets)` — genere un `WidgetPlacement[]` automatique a partir des widgets du preset et des widgets utilisateur quand aucun layout V2 n'existe.
- `mergeNewWidgets(savedLayout, presetWidgets, userWidgets)` — fusionne les nouveaux widgets (preset ou custom) dans un layout V2 existant, en les placant en bas de la grille.

**Criteres d'acceptation**

- [ ] `materializeLayout()` place les preset widgets en premier, puis les user widgets, avec auto-wrapping sur 12 colonnes
- [ ] Chaque widget recoit une hauteur par defaut coherente (`DEFAULT_HEIGHT` mapping)
- [ ] `mergeNewWidgets()` detecte les widgets non-places (nouveau preset ajouté au preset, ou nouveau user widget) et les append a `y: 9999` (bottom)
- [ ] Les widgets caches (`hidden: true`) sont preserves dans le merge
- [ ] Tests unitaires: au moins 5 cas (layout vide, preset seul, user seul, mixte, merge avec nouveaux widgets)
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `server/src/services/layout-materializer.ts` — CREER
- `server/src/services/__tests__/layout-materializer.test.ts` — CREER

**Notes de design**

Ref. architecture doc 2.3.3. Grid 12 colonnes, `spanToWidth(span)` = span * 3. Algorithme de placement: curseur (x, y) avec row-wrap.

---

### DV2-04: Backend GET /my-view enhanced

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-04 |
| **Points**       | 5      |
| **Dependances**  | DV2-03 |

**Description**

Etendre l'endpoint `GET /my-view` pour retourner le champ `grid: WidgetPlacement[]` dans la reponse. Si l'utilisateur a un layout V2 sauvegarde (`dashboard.layout`), utiliser `mergeNewWidgets()`. Sinon, generer via `materializeLayout()`.

**Criteres d'acceptation**

- [ ] La reponse de `GET /my-view` inclut `grid: WidgetPlacement[]` (jamais null cote client)
- [ ] Si `layoutOverrides.dashboard.layout` existe (V2), le serveur retourne le merge avec les nouveaux widgets
- [ ] Si pas de layout V2, le serveur materialise automatiquement depuis le preset + user widgets
- [ ] Les user_widgets sont charges et integres dans le layout materialise
- [ ] Retrocompatibilite: les champs V1 (`hiddenWidgets`, `extraWidgets`) continuent a fonctionner pour les clients non-migres
- [ ] Test d'integration: verifier la reponse avec et sans layout V2
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `server/src/routes/view-presets.ts` — modifier handler GET /my-view
- `server/src/routes/__tests__/view-presets.test.ts` — ajouter tests

**Notes de design**

Ref. architecture doc 2.3.4. Zero-downtime: le champ `grid` est additif, l'ancien format reste fonctionnel.

---

### DV2-05: Backend PATCH /my-view/overrides V2

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-05 |
| **Points**       | 3      |
| **Dependances**  | DV2-04 |

**Description**

S'assurer que `PATCH /my-view/overrides` accepte correctement le format V2 `{ dashboard: { layout: WidgetPlacement[] } }`. Valider le payload cote serveur (structure `WidgetPlacement`). Quand un layout V2 est sauvegarde, les champs V1 (`hiddenWidgets`, `extraWidgets`) doivent etre ignores au profit du V2.

**Criteres d'acceptation**

- [ ] PATCH accepte `{ dashboard: { layout: WidgetPlacement[] } }` et le stocke dans le JSONB `layoutOverrides`
- [ ] Validation: chaque `WidgetPlacement` doit avoir `widgetId` (string), `x/y/w/h` (numbers >= 0), `w` entre 1-12, `h` entre 1-8
- [ ] Si le payload contient un `layout` V2, les champs V1 sont supprimes du stockage (nettoyage)
- [ ] Reponse 200 avec le layout sauvegarde
- [ ] Test: envoyer un layout V2, puis GET /my-view retourne le meme layout
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `server/src/routes/view-presets.ts` — modifier handler PATCH /my-view/overrides
- `server/src/routes/__tests__/view-presets.test.ts` — ajouter tests

**Notes de design**

Ref. architecture doc 2.3.4 (PATCH section). Pas de migration DB necessaire — le JSONB est schemaless.

---

### DV2-06: Composant WidgetCard unifie

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-06 |
| **Points**       | 5      |
| **Dependances**  | DV2-02 |

**Description**

Creer le composant `WidgetCard` — wrapper unifie pour TOUS les widgets (preset et custom). Il remplace la divergence actuelle entre le rendu nu des presets et `CustomWidgetCard`. Le composant inclut: drag handle (GripVertical), titre, menu d'actions (DropdownMenu shadcn), zone de contenu avec Suspense/Skeleton, et tous les etats visuels (hover, focus, dragging, resizing, loading, error).

**Criteres d'acceptation**

- [ ] `WidgetCard` utilise les composants shadcn `Card`, `CardHeader`, `CardContent`
- [ ] Drag handle: `GripVertical` lucide, classe `.widget-drag-handle`, `opacity-0 group-hover/widget:opacity-100 transition-opacity duration-150`
- [ ] Le card utilise `group/widget` pour le hover reveal des handles et actions
- [ ] Menu actions: `DropdownMenu` shadcn avec items "Configure" (Wrench), sous-menu "Resize" (Span 1-4, span actuel en gras), separateur, "Delete" (Trash2, text-destructive) avec dialog de confirmation
- [ ] Etats visuels conformes a la spec UX section 2.5: default (`border-border bg-card shadow-sm`), hover (`shadow-md`), focus (`ring-2 ring-ring ring-offset-2`), dragging (`shadow-xl opacity-80 z-50`), loading (Skeleton), error (AlertCircle + message)
- [ ] Header: `flex items-center gap-2 px-3 py-2.5 border-b border-border/50`
- [ ] Content: `p-4 overflow-hidden` avec ScrollArea pour contenu debordant
- [ ] Card wrapper: `rounded-lg border border-border bg-card shadow-sm overflow-hidden transition-shadow duration-150`
- [ ] Tous les composants UI utilisent le design system shadcn (PAS de composants custom inline)
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/components/WidgetCard.tsx` — CREER
- `ui/src/components/DashboardGrid.tsx` — `CustomWidgetCard` sera deprecie (non supprime dans cette story)

**Notes de design**

Ref. UX spec sections 2.1 a 2.5. Le composant est la brique fondamentale du dashboard V2 — la qualite visuelle est critique. Respecter exactement les classes Tailwind de la spec. Les icones lucide: `GripVertical`, `MoreHorizontal`, `Wrench`, `Maximize2`, `Trash2`, `AlertCircle`.

---

### DV2-07: Composant UnifiedDashboardGrid (react-grid-layout)

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-07 |
| **Points**       | 8      |
| **Dependances**  | DV2-01, DV2-06, DV2-04 |

**Description**

Creer `UnifiedDashboardGrid` — le composant central qui remplace `DashboardGrid`. Il utilise `react-grid-layout` (Responsive + WidthProvider) pour rendre tous les widgets dans une grille unique et unifiee. Chaque widget est wrappe dans `WidgetCard`. Integrer dans `Dashboard.tsx` en remplacement de l'ancien `DashboardGrid`.

**Criteres d'acceptation**

- [ ] Utilise `WidthProvider(Responsive)` de react-grid-layout
- [ ] Configuration grille: 12 colonnes (lg), breakpoints `{ lg: 1024, md: 768, sm: 0 }`
- [ ] `rowHeight: 40` (conforme a l'architecture)
- [ ] `compactType="vertical"` pour compaction automatique
- [ ] Convertit `WidgetPlacement[]` en `Layout[]` react-grid-layout
- [ ] Widgets preset resolus via `WIDGET_REGISTRY[type].component` avec `Suspense`/`Skeleton`
- [ ] Widgets custom resolus via `ContentRenderer` avec gestion de `dataSource`
- [ ] `draggableHandle=".widget-drag-handle"` — seul le handle permet le drag
- [ ] Props `onLayoutChange` callback pour remonter les changements de layout
- [ ] `Dashboard.tsx` mis a jour: utilise `useViewPreset()` avec `grid`, remplace `<DashboardGrid>` par `<UnifiedDashboardGrid>`
- [ ] Grille unique (plus de separation preset/custom) — tous les widgets au meme niveau
- [ ] Espacement: `gap-4` (16px) entre widgets conforme a la spec UX section 1.2
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/components/UnifiedDashboardGrid.tsx` — CREER
- `ui/src/pages/Dashboard.tsx` — modifier pour utiliser le nouveau composant
- `ui/src/hooks/useViewPreset.ts` — retourner `grid` depuis la reponse API

**Notes de design**

Ref. architecture doc 2.3.5, 2.3.6, 2.3.7. UX spec section 1. C'est la story la plus complexe — elle connecte backend (grid materialise) et frontend (react-grid-layout). Tester visuellement que les widgets se placent correctement avec les positions materialise.

---

### DV2-08: Drag-and-drop avec feedback visuel

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-08 |
| **Points**       | 5      |
| **Dependances**  | DV2-07 |

**Description**

Implementer le comportement complet de drag-and-drop avec tous les feedbacks visuels decrits dans la spec UX. Inclut: le guide de grille en arriere-plan pendant le drag, le placeholder dashed, l'elevation du widget dragge, et les animations de transition.

**Criteres d'acceptation**

- [ ] Pendant le drag: grille en arriere-plan visible avec `border-dashed border-border/20` sur les cellules
- [ ] Widget dragge: `shadow-xl opacity-80 z-50`, rotation subtile `rotate-1`
- [ ] Placeholder: `border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg`
- [ ] Autres widgets: animation fluide `transition-transform duration-200 ease-out` quand ils se deplacent
- [ ] Snap-to-grid: positions snappent aux colonnes (increments 1/12) et aux lignes (increments 40px)
- [ ] Animation de drop: `transition-all duration-300 ease-out` quand le widget se pose
- [ ] Curseur: `cursor-grab` au repos, `cursor-grabbing` pendant le drag
- [ ] Le guide de grille disparait immediatement a la fin du drag
- [ ] Fonctionne au toucher (tap target 44px minimum sur le handle)
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/components/UnifiedDashboardGrid.tsx` — ajouter CSS/classes pour les etats drag
- `ui/src/components/WidgetCard.tsx` — ajuster les classes pendant le drag
- `ui/src/index.css` — styles globaux pour react-grid-layout overrides si necessaire

**Notes de design**

Ref. UX spec sections 3.1 a 3.4. Le feedback visuel pendant le drag est essentiel pour l'UX. Utiliser les classes CSS de react-grid-layout (`.react-grid-item.react-grid-placeholder`) et les overrider avec les tokens du design system.

---

### DV2-09: Resize handles avec feedback visuel

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-09 |
| **Points**       | 5      |
| **Dependances**  | DV2-07 |

**Description**

Implementer le resize visuel des widgets via les handles de react-grid-layout. Inclut: handle custom en bas a droite, overlay de dimensions, contraintes min/max par type de widget, et feedback visuel pendant le resize.

**Criteres d'acceptation**

- [ ] Handle de resize: position `absolute bottom-1 right-1`, icone grip dots (3x2), 14x14px
- [ ] Handle visible au hover uniquement: `opacity-0 group-hover/widget:opacity-100 transition-opacity duration-150`
- [ ] Curseur: `cursor-se-resize`
- [ ] Pendant le resize: bordure du widget `border-primary/50`
- [ ] Overlay de dimensions: badge `"{cols}x{rows}"` pres du handle, `text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md`
- [ ] Grille guide activee pendant le resize (meme que pendant le drag)
- [ ] Contraintes par type de widget conformes a la spec UX section 4.3:
  - KPI/Metric: minW=3, maxW=12, minH=1, maxH=2
  - Chart: minW=3, maxW=12, minH=2, maxH=4
  - Table/List: minW=6, maxW=12, minH=2, maxH=6
  - Custom (CAO): minW=3, maxW=12, minH=1, maxH=6
  - KPI Bar (full): minW=12, maxW=12, minH=1, maxH=2
- [ ] `WidgetDef` dans `widget-registry.ts` etendu avec `minW?`, `maxW?`, `minH?`, `maxH?` optionnels
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/components/UnifiedDashboardGrid.tsx` — configurer resize handles et contraintes
- `ui/src/components/WidgetCard.tsx` — ajouter etat "resizing" et overlay dimensions
- `ui/src/lib/widget-registry.ts` — ajouter contraintes min/max au `WidgetDef`
- `ui/src/index.css` — styles pour le resize handle custom

**Notes de design**

Ref. UX spec sections 4.1 a 4.4. Les contraintes sont exprimees en unites grille (12 colonnes). Les hauteurs utilisent le row height de 40px.

---

### DV2-10: Persistance du layout (debounced PATCH)

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-10 |
| **Points**       | 3      |
| **Dependances**  | DV2-07, DV2-05 |

**Description**

Connecter les changements de layout (drag/resize) au backend via un PATCH debounce. Implementer les mises a jour optimistes pour eviter le flash de retour a l'ancienne position.

**Criteres d'acceptation**

- [ ] `onLayoutChange` de react-grid-layout declenche un `PATCH /my-view/overrides` avec `{ dashboard: { layout: WidgetPlacement[] } }`
- [ ] Debounce de 1 seconde — ne sauvegarde que la position finale, pas chaque pixel de drag
- [ ] Mise a jour optimiste: le layout local est mis a jour immediatement, le PATCH est en background
- [ ] En cas d'erreur PATCH: rollback au dernier layout sauvegarde, toast d'erreur discret
- [ ] Pas de polling (conforme aux regles CLAUDE.md) — SSE/WS pour les notifications de changement si necessaire
- [ ] Le layout persist entre les sessions (recharger la page = meme layout)
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/pages/Dashboard.tsx` — ajouter `useDebouncedCallback` pour `handleLayoutChange`
- `ui/src/hooks/useViewPreset.ts` — ajouter mutation `useSaveLayoutOverrides`

**Notes de design**

Ref. architecture doc 2.3.6. Utiliser `useDebouncedCallback` (lodash/debounce ou equivalent deja en place). Le PATCH est un appel standard via `api.patch()`.

---

### DV2-11: Dialog Add Widget V2 (Gallery + Create with AI)

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-11 |
| **Points**       | 8      |
| **Dependances**  | DV2-02 |

**Description**

Refondre le dialog `AddWidgetDialog` avec deux onglets: "Gallery" (widgets preset du registre) et "Create with AI" (CAO). L'onglet Gallery affiche une grille 2 colonnes de preview cards pour chaque widget du `WIDGET_REGISTRY` non encore place. L'onglet "Create with AI" reprend le flux CAO existant avec prompt, suggestions, selecteur de taille, et preview.

**Criteres d'acceptation**

- [ ] Dialog shadcn: `Dialog` + `DialogContent` avec `sm:max-w-[560px]`
- [ ] 2 onglets via `Tabs` shadcn: "Gallery" et "Create with AI"
- [ ] **Onglet Gallery**:
  - Grille 2 colonnes de widget preview cards
  - Chaque card: icone widget, nom (`text-sm font-medium`), description (`text-xs text-muted-foreground line-clamp-2`), taille par defaut (`text-xs text-muted-foreground/60`)
  - Card style: `rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer`
  - Bouton "Add" (`Button variant="outline" size="sm"`) pleine largeur en bas de chaque card
  - Selecteur de taille optionnel (Select dropdown 1-4) avant l'ajout
  - Les widgets deja places dans le layout sont grises ou masques
- [ ] **Onglet Create with AI**:
  - `Textarea` shadcn (3 lignes) pour le prompt
  - Chips de suggestions: `Button variant="outline" size="sm"` avec `rounded-full text-xs`
  - Selecteur de taille: groupe de 4 boutons (1-4), actif = `variant="default"`, inactif = `variant="outline"`
  - Bouton "Generate Widget": `Button variant="default" size="sm"`, disabled quand prompt vide
  - Zone de preview avec `ContentRenderer` apres generation
  - Loading: spinner + "CAO is generating..." + Skeleton dans la preview
  - Erreur: `text-xs text-destructive` sous le textarea
  - Post-generation: "Add to Dashboard" (`variant="default"`) + "Regenerate" (`variant="outline"`)
- [ ] Le dialog se ferme a l'ajout reussi, au clic backdrop, ou Escape
- [ ] Le prompt CAO est preserve si l'utilisateur change d'onglet dans le dialog
- [ ] L'etat est reinitialise completement a la fermeture du dialog
- [ ] Bouton trigger dans le header dashboard: `Button variant="outline" size="sm"` avec icone `Plus`
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/components/AddWidgetDialog.tsx` — REFONDRE (ou creer `AddWidgetDialogV2.tsx`)
- `ui/src/pages/Dashboard.tsx` — connecter le nouveau dialog

**Notes de design**

Ref. UX spec sections 5.1 a 5.5. C'est le point d'entree principal pour enrichir le dashboard. La qualite visuelle des preview cards est importante pour guider l'utilisateur.

---

### DV2-12: Breakpoints responsifs (4/2/1 colonnes)

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-12 |
| **Points**       | 3      |
| **Dependances**  | DV2-07 |

**Description**

Configurer les breakpoints responsifs de react-grid-layout et adapter le comportement UI par taille d'ecran: desktop (4 colonnes logiques, drag+resize), tablette (2 colonnes, drag seulement), mobile (1 colonne, lecture seule).

**Criteres d'acceptation**

- [ ] Breakpoints: `{ lg: 1024, md: 768, sm: 0 }` avec colonnes `{ lg: 12, md: 6, sm: 3 }`
- [ ] **Desktop (>=1024px)**: drag + resize actifs, handles visibles au hover, menu complet
- [ ] **Tablette (768-1023px)**: widgets > 2 colonnes logiques clampes a 2, drag actif, resize desactive, sous-menu "Resize" cache dans le dropdown
- [ ] **Mobile (<768px)**: tous les widgets en pleine largeur (1 colonne), drag desactive, resize desactive, menu actions: seulement "Delete" et "Configure", cards full-bleed
- [ ] Seul le layout `lg` est persiste — les autres sont auto-calcules par react-grid-layout
- [ ] Le contenu des widgets s'adapte (KpiBar responsive, charts en ratio, tables avec ScrollArea horizontal)
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/components/UnifiedDashboardGrid.tsx` — configurer breakpoints et desactiver drag/resize par taille
- `ui/src/components/WidgetCard.tsx` — adapter le menu actions par breakpoint

**Notes de design**

Ref. UX spec sections 6.1 a 6.4. Tester sur au moins 3 largeurs: 1440px, 900px, 375px.

---

### DV2-13: Etats vides (nouveau + tout supprime)

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-13 |
| **Points**       | 2      |
| **Dependances**  | DV2-07 |

**Description**

Implementer les deux etats vides du dashboard: "nouveau utilisateur" (aucun widget) et "tout supprime" (l'utilisateur avait des widgets et les a tous retires). Chaque etat a un design distinct conforme a la spec UX.

**Criteres d'acceptation**

- [ ] **Etat "nouveau"** (0 widgets, jamais eu de layout V2):
  - Icone: `LayoutDashboard` h-12 w-12 `text-muted-foreground/40`
  - Titre: "Your dashboard is empty" — `text-lg font-medium text-foreground`
  - Description: "Add widgets to monitor your agents, track issues, and stay on top of costs." — `text-sm text-muted-foreground`
  - CTA: "Add Your First Widget" — `Button variant="default"`
  - Container: `flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16 text-center bg-card/50`
- [ ] **Etat "tout supprime"** (layout V2 existe mais 0 widgets visibles):
  - Icone: `Sparkles` h-10 w-10 `text-muted-foreground/40`
  - Titre: "No widgets on your dashboard" — `text-sm font-medium text-foreground`
  - Description: "Add a preset widget or ask CAO to create something custom for you." — `text-xs text-muted-foreground`
  - CTA: "Add Widget" — `Button variant="outline" size="sm"`
  - Container: `flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center`
  - Visuellement plus leger que l'etat "nouveau"
- [ ] Le CTA ouvre le dialog Add Widget
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/components/UnifiedDashboardGrid.tsx` — ajouter la logique d'etat vide
- OU `ui/src/components/DashboardEmptyState.tsx` — CREER si la logique est significative

**Notes de design**

Ref. UX spec section 7. La distinction visuelle entre les deux etats est intentionnelle: le premier est accueillant (onboarding), le second est neutre (l'utilisateur connait deja le produit).

---

### DV2-14: Accessibilite (clavier, ARIA, live region)

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-14 |
| **Points**       | 3      |
| **Dependances**  | DV2-07, DV2-08, DV2-09 |

**Description**

Ajouter le support complet d'accessibilite au dashboard grid: navigation clavier, labels ARIA sur tous les elements interactifs, et live region pour annoncer les changements de position/taille.

**Criteres d'acceptation**

- [ ] `Tab`: naviguer entre les widgets (en ordre DOM = ordre layout)
- [ ] `Enter`/`Space` sur un widget: ouvrir le menu actions
- [ ] `Escape`: fermer tout menu ou dialog ouvert
- [ ] `Alt + Arrow keys`: deplacer le widget focus dans la grille
- [ ] `Alt + Shift + Arrow`: redimensionner le widget focus
- [ ] Focus ring shadcn standard: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- [ ] Widget card: `tabIndex={0}`, `role="article"`, `aria-label="Widget: {title}"`, `aria-roledescription="dashboard widget"`
- [ ] Drag handle: `aria-label="Drag to reorder {title}"`, `aria-roledescription="drag handle"`
- [ ] Resize handle: `role="separator"`, `aria-label="Resize {title}"`, `aria-valuenow/min/max`
- [ ] Live region `aria-live="polite"` annoncant: "Widget {title} moved to row {y}, column {x}" et "Widget {title} resized to {cols} columns, {rows} rows"
- [ ] Aria labels sur: Add Widget button, actions menu trigger, delete item, resize submenu, gallery tab, create with AI tab, size selector buttons
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- `ui/src/components/WidgetCard.tsx` — ajouter ARIA labels et roles
- `ui/src/components/UnifiedDashboardGrid.tsx` — ajouter live region et keyboard handlers
- `ui/src/components/AddWidgetDialog.tsx` — ajouter aria labels

**Notes de design**

Ref. UX spec sections 8.1 a 8.4. Les raccourcis clavier `Alt+Arrow` sont inspires de la convention OS pour deplacer des elements dans une grille.

---

### DV2-15: Polish design (tokens, shadows, transitions)

| Champ            | Valeur |
|------------------|--------|
| **ID**           | DV2-15 |
| **Points**       | 2      |
| **Dependances**  | Toutes les stories precedentes |

**Description**

Passe finale de polish visuel pour s'assurer que TOUS les elements du dashboard V2 respectent exactement les design tokens, shadows, transitions et espacements definis dans la spec UX section 9. Verifier la coherence avec le reste de l'application.

**Criteres d'acceptation**

- [ ] **Couleurs**: toutes les couleurs utilisent les CSS custom properties (`--card`, `--border`, `--primary`, etc.) — aucune valeur hardcodee
- [ ] **Shadows**: default=`shadow-sm`, hover=`shadow-md`, dragging=`shadow-xl`, dialog=`shadow-lg`
- [ ] **Transitions**: hover=`duration-150`, handle reveal=`duration-150`, movement=`duration-200 ease-out`, drop=`duration-300 ease-out`
- [ ] **Espacement**: grid gap=`gap-4`, header padding=`px-3 py-2.5`, content padding=`p-4`, icon-text gap=`gap-2`
- [ ] **Border radius**: cards=`rounded-lg`, buttons=theme, dialog=`rounded-xl`, badges=`rounded-full`, inner=`rounded-md`
- [ ] **Typographie**: widget title=`text-sm font-medium text-foreground`, description=`text-xs text-muted-foreground`, empty heading=`text-lg font-medium`
- [ ] **Skeleton pulse**: utilise `animate-pulse` standard Tailwind
- [ ] Verifier les deux themes (light + dark) — aucun probleme de contraste
- [ ] Pas de composant UI custom inline — tout utilise `ui/src/components/ui/`
- [ ] Tester visuellement a 3 tailles (desktop 1440px, tablette 900px, mobile 375px)
- [ ] `bun run typecheck` passe

**Fichiers a creer/modifier**

- Tous les fichiers crees dans les stories precedentes — ajustements mineurs
- `ui/src/index.css` — ajuster les overrides react-grid-layout si necessaire

**Notes de design**

Ref. UX spec sections 9.1 a 9.6 et section 10 (composants shadcn). Cette story est un controle qualite visuel. Chaque ecart avec la spec doit etre corrige.

---

## Tableau recapitulatif

| ID     | Titre                                  | Points | Dependances              |
|--------|----------------------------------------|--------|--------------------------|
| DV2-01 | Installer react-grid-layout            | 1      | —                        |
| DV2-02 | Types WidgetPlacement + LayoutOverrides| 2      | DV2-01                   |
| DV2-03 | Layout Materializer (backend)          | 5      | DV2-02                   |
| DV2-04 | GET /my-view enhanced                  | 5      | DV2-03                   |
| DV2-05 | PATCH /my-view/overrides V2            | 3      | DV2-04                   |
| DV2-06 | Composant WidgetCard unifie            | 5      | DV2-02                   |
| DV2-07 | UnifiedDashboardGrid (RGL)             | 8      | DV2-01, DV2-06, DV2-04  |
| DV2-08 | Drag-and-drop feedback visuel          | 5      | DV2-07                   |
| DV2-09 | Resize handles + contraintes           | 5      | DV2-07                   |
| DV2-10 | Persistance layout (debounced PATCH)   | 3      | DV2-07, DV2-05           |
| DV2-11 | Add Widget dialog V2                   | 8      | DV2-02                   |
| DV2-12 | Breakpoints responsifs                 | 3      | DV2-07                   |
| DV2-13 | Etats vides                            | 2      | DV2-07                   |
| DV2-14 | Accessibilite                          | 3      | DV2-07, DV2-08, DV2-09  |
| DV2-15 | Design polish                          | 2      | Toutes                   |
| **Total** |                                     | **55** |                          |

## Chemin critique

Le chemin critique (plus longue chaine de dependances) est:

**DV2-01 (1) → DV2-02 (2) → DV2-03 (5) → DV2-04 (5) → DV2-05 (3) → DV2-10 (3) = 19 SP**

Et en parallele sur le frontend:

**DV2-01 (1) → DV2-02 (2) → DV2-06 (5) → DV2-07 (8) → DV2-08 (5) / DV2-09 (5) → DV2-14 (3) → DV2-15 (2)**

Les deux chemins convergent sur DV2-07 (qui depend du backend DV2-04 ET du frontend DV2-06).

## Parallelisation recommandee

Deux developpeurs peuvent travailler en parallele:

- **Dev Backend**: DV2-01 → DV2-02 → DV2-03 → DV2-04 → DV2-05
- **Dev Frontend**: (attend DV2-02) → DV2-06 → DV2-11

Puis convergence sur DV2-07 quand les deux streams sont prets, suivie des stories restantes.
