# Section 7 — Design Tokens, UX Patterns & Accessibility

> **Par Paige la Tech Writer** | Date : 2026-03-14 | Version : 1.0
> Source : PRD B2B v1.0, UX Journeys & Requirements v1.0, index.css existant (Tailwind CSS v4 + shadcn/ui)

---

## Table des matieres

1. [Design Tokens Specification](#1-design-tokens-specification)
2. [Conventions de Nommage](#2-conventions-de-nommage)
3. [UX Patterns Documentation](#3-ux-patterns-documentation)
4. [Responsive & Accessibility (WCAG 2.1 AA)](#4-responsive--accessibility-wcag-21-aa)

---

## 1. Design Tokens Specification

Cette section definit l'ensemble des tokens de design pour MnM B2B. Les tokens sont implementes via CSS custom properties (variables) et consommes par Tailwind CSS v4 via la directive `@theme inline`. L'architecture actuelle utilise le format oklch pour les couleurs, permettant une manipulation perceptuellement uniforme.

### 1.1 Couleurs — Systeme de Couleurs

#### 1.1.1 Couleurs de Surface (Core)

Les tokens de surface definissent les fonds, textes et bordures de base. Ils existent en mode clair et sombre.

```css
/* === MODE CLAIR (defaut) === */
:root {
  color-scheme: light;

  /* Surfaces principales */
  --background: oklch(1 0 0);                /* #ffffff — fond de page */
  --foreground: oklch(0.145 0 0);            /* #1a1a1a — texte principal */

  /* Cartes */
  --card: oklch(1 0 0);                      /* #ffffff — fond de carte */
  --card-foreground: oklch(0.145 0 0);       /* texte sur carte */

  /* Popovers / Dropdowns */
  --popover: oklch(1 0 0);                   /* fond popover */
  --popover-foreground: oklch(0.145 0 0);    /* texte popover */

  /* Zones secondaires / mutees */
  --muted: oklch(0.97 0 0);                  /* #f5f5f5 — fond attenue */
  --muted-foreground: oklch(0.556 0 0);      /* #737373 — texte secondaire */

  /* Accents */
  --accent: oklch(0.97 0 0);                 /* fond accent */
  --accent-foreground: oklch(0.205 0 0);     /* texte accent */

  /* Bordures et inputs */
  --border: oklch(0.922 0 0);               /* #e5e5e5 — bordures */
  --input: oklch(0.922 0 0);                /* bordure inputs */
  --ring: oklch(0.708 0 0);                 /* focus ring */
}

/* === MODE SOMBRE === */
.dark {
  color-scheme: dark;

  --background: oklch(0.145 0 0);            /* #1a1a1a */
  --foreground: oklch(0.985 0 0);            /* #fafafa */

  --card: oklch(0.205 0 0);                  /* #2a2a2a */
  --card-foreground: oklch(0.985 0 0);

  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --muted: oklch(0.269 0 0);                /* #3a3a3a */
  --muted-foreground: oklch(0.708 0 0);     /* #999999 */

  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);

  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
}
```

**Utilisation Tailwind** :
```html
<div class="bg-background text-foreground">Page</div>
<div class="bg-card text-card-foreground border border-border">Carte</div>
<span class="text-muted-foreground">Texte secondaire</span>
```

#### 1.1.2 Couleurs Primaires et Secondaires

```css
:root {
  /* Primaire — Bleu MnM (brand) */
  --primary: oklch(0.205 0 0);              /* Noir profond en v1 — a evoluer vers Bleu MnM */
  --primary-foreground: oklch(0.985 0 0);   /* Blanc sur primaire */

  /* Secondaire — Gris ardoise */
  --secondary: oklch(0.97 0 0);             /* Gris tres clair */
  --secondary-foreground: oklch(0.205 0 0); /* Texte sombre sur secondaire */

  /* Destructif — Actions dangereuses */
  --destructive: oklch(0.577 0.245 27.325); /* Rouge — suppression, erreurs */
  --destructive-foreground: oklch(0.577 0.245 27.325);
}

.dark {
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);

  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);

  --destructive: oklch(0.637 0.237 25.331);
  --destructive-foreground: oklch(0.985 0 0);
}
```

#### 1.1.3 Couleurs par Role (B2B RBAC)

Les badges de role utilisent des couleurs distinctes pour differencier visuellement les quatre roles RBAC de MnM. **Rappel WCAG** : ne jamais utiliser la couleur seule — toujours accompagner d'un texte visible.

```css
:root {
  /* Roles RBAC */
  --role-admin: oklch(0.637 0.237 25);      /* Rouge — Admin */
  --role-manager: oklch(0.488 0.243 264);   /* Bleu — Manager */
  --role-contributor: oklch(0.6 0.178 155);  /* Vert — Contributor */
  --role-viewer: oklch(0.556 0 0);           /* Gris — Viewer (lecture seule) */

  /* Agent IA — visuellement distinct des actions humaines */
  --agent: oklch(0.627 0.265 303.9);        /* Violet — Actions IA */
  --agent-foreground: oklch(0.985 0 0);
}
```

**Utilisation en composant** :
```tsx
// RoleBadge.tsx
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
  style={{ backgroundColor: `oklch(from var(--role-admin) l c h / 0.15)`, color: 'var(--role-admin)' }}>
  <ShieldIcon className="w-3 h-3" />
  Admin
</span>
```

#### 1.1.4 Couleurs Semantiques

```css
:root {
  /* Feedback semantique */
  --success: oklch(0.6 0.178 155);           /* Vert — operation reussie */
  --success-foreground: oklch(0.985 0 0);
  --warning: oklch(0.75 0.183 65);           /* Orange — attention requise */
  --warning-foreground: oklch(0.205 0 0);
  --error: oklch(0.577 0.245 27.325);        /* Rouge — erreur (= destructive) */
  --error-foreground: oklch(0.985 0 0);
  --info: oklch(0.488 0.243 264);            /* Bleu — information */
  --info-foreground: oklch(0.985 0 0);
}
```

#### 1.1.5 Couleurs de Graphiques

Cinq couleurs pre-definies pour les graphiques du dashboard, avec des hues bien reparties pour la lisibilite daltonien.

```css
:root {
  --chart-1: oklch(0.646 0.222 41.116);   /* Orange chaud */
  --chart-2: oklch(0.6 0.118 184.704);    /* Teal */
  --chart-3: oklch(0.398 0.07 227.392);   /* Bleu sombre */
  --chart-4: oklch(0.828 0.189 84.429);   /* Jaune dore */
  --chart-5: oklch(0.769 0.188 70.08);    /* Ambre */
}

.dark {
  --chart-1: oklch(0.488 0.243 264.376);  /* Bleu vif */
  --chart-2: oklch(0.696 0.17 162.48);    /* Vert menthe */
  --chart-3: oklch(0.769 0.188 70.08);    /* Ambre */
  --chart-4: oklch(0.627 0.265 303.9);    /* Violet */
  --chart-5: oklch(0.645 0.246 16.439);   /* Rose corail */
}
```

#### 1.1.6 Couleurs Sidebar

La sidebar possede son propre jeu de tokens pour permettre un traitement visuel distinct (fond legerement different, highlights specifiques).

```css
:root {
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --sidebar: oklch(0.145 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}
```

### 1.2 Typographie

#### 1.2.1 Familles de polices

| Token | Police | Usage |
|-------|--------|-------|
| `--font-sans` | `Inter, system-ui, sans-serif` | Corps de texte, titres, UI |
| `--font-mono` | `JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Code, logs, identifiants techniques |

```css
@theme inline {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```

#### 1.2.2 Echelle typographique

| Token | Taille | Utilisation |
|-------|--------|-------------|
| `text-xs` | 12px (0.75rem) | Labels, badges, metadata |
| `text-sm` | 14px (0.875rem) | Corps secondaire, tableaux, sidebar |
| `text-base` | 16px (1rem) | Corps principal |
| `text-lg` | 18px (1.125rem) | Sous-titres de section |
| `text-xl` | 20px (1.25rem) | Titres de page secondaires |
| `text-2xl` | 24px (1.5rem) | Titres de page |
| `text-3xl` | 30px (1.875rem) | Titres principaux dashboard |
| `text-4xl` | 36px (2.25rem) | Titre d'accueil / onboarding |

#### 1.2.3 Graisses

| Token | Poids | Usage |
|-------|-------|-------|
| `font-normal` | 400 | Corps de texte |
| `font-medium` | 500 | Labels, navigation active |
| `font-semibold` | 600 | Titres de carte, noms d'entite |
| `font-bold` | 700 | Titres de page, metriques cles |

#### 1.2.4 Hauteurs de ligne

| Token | Ratio | Usage |
|-------|-------|-------|
| `leading-tight` | 1.25 | Titres, metriques compactes |
| `leading-normal` | 1.5 | Corps de texte (defaut) |
| `leading-relaxed` | 1.75 | Texte de description longue, onboarding |

### 1.3 Espacement

Systeme base sur une unite de 4px. Tous les espacements sont des multiples de cette base.

| Token | Valeur | Pixels | Usage typique |
|-------|--------|--------|---------------|
| `spacing-0` | 0 | 0px | Pas d'espacement |
| `spacing-1` | 0.25rem | 4px | Ecart minimal (icone-texte inline) |
| `spacing-2` | 0.5rem | 8px | Padding interne compact |
| `spacing-3` | 0.75rem | 12px | Gap entre elements lies |
| `spacing-4` | 1rem | 16px | Padding standard de carte |
| `spacing-5` | 1.25rem | 20px | Gap entre sections liees |
| `spacing-6` | 1.5rem | 24px | Padding de section |
| `spacing-8` | 2rem | 32px | Separation entre blocs |
| `spacing-10` | 2.5rem | 40px | Grande separation |
| `spacing-12` | 3rem | 48px | Marge de page |
| `spacing-16` | 4rem | 64px | Marge verticale majeure |

**Principes d'espacement** :
- **Padding de carte** : `p-4` (16px) standard, `p-3` (12px) compact
- **Gap entre elements** : `gap-2` (8px) pour les listes denses, `gap-4` (16px) pour les grilles
- **Marge de page** : `px-6` (24px) desktop, `px-4` (16px) mobile
- **Separation de sections** : `space-y-8` (32px) entre sections majeures

### 1.4 Border Radius

Le projet utilise actuellement des rayons a zero pour une esthetique angulaire. Les tokens definissent neanmoins l'echelle complete pour l'evolution du design system.

```css
@theme inline {
  --radius-sm: 0.375rem;  /* 6px — petits elements : badges, chips */
  --radius-md: 0.5rem;    /* 8px — boutons, inputs, cartes */
  --radius-lg: 0px;       /* 0px — actuellement desactive */
  --radius-xl: 0px;       /* 0px — actuellement desactive */
}

:root {
  --radius: 0;             /* Rayon global de base */
}
```

| Token | Valeur | Usage |
|-------|--------|-------|
| `rounded-none` | 0px | Valeur actuelle par defaut du design |
| `rounded-sm` | 6px | Badges, chips, mentions |
| `rounded-md` | 8px | Boutons, inputs, cartes |
| `rounded-lg` | 12px | Modales, panels (futur) |
| `rounded-xl` | 16px | Sections hero, onboarding (futur) |
| `rounded-full` | 9999px | Avatars, indicateurs de statut |

### 1.5 Ombres (Elevation)

Trois niveaux d'elevation pour la hierarchie visuelle des elements.

```css
/* Tailwind defaults utilises */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  /* Usage : cartes au repos, boutons subtils */

--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  /* Usage : cartes survolees, dropdowns ouverts */

--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  /* Usage : modales, command palette, panels flottants */
```

| Niveau | Token | Contexte |
|--------|-------|----------|
| Bas | `shadow-sm` | Carte au repos, separateurs subtils |
| Moyen | `shadow-md` | Carte survolee, dropdown, popover |
| Haut | `shadow-lg` | Modale, command palette (Ctrl+K), toast |

### 1.6 Z-index

Echelle structuree pour eviter les conflits d'empilement.

| Token | Valeur | Element |
|-------|--------|---------|
| `z-base` | 0 | Contenu de la page |
| `z-dropdown` | 50 | Dropdowns, popovers, menus contextuels |
| `z-sticky` | 100 | Header, breadcrumbs, barre de filtre sticky |
| `z-modal` | 200 | Modales, dialogs, command palette |
| `z-toast` | 300 | Toast notifications, snackbars |
| `z-tooltip` | 400 | Tooltips au survol |

**Note** : L'editeur MDXEditor utilise `z-index: 80-81` pour ses popups internes (cf. `index.css` lignes 480-500), place entre dropdown et sticky.

```css
/* Implementation Tailwind via @theme ou classes utilitaires */
.z-dropdown { z-index: 50; }
.z-sticky   { z-index: 100; }
.z-modal    { z-index: 200; }
.z-toast    { z-index: 300; }
.z-tooltip  { z-index: 400; }
```

### 1.7 Transitions et Animations

#### 1.7.1 Durees

| Token | Duree | Easing | Usage |
|-------|-------|--------|-------|
| `transition-fast` | 150ms | `ease-in-out` | Survol boutons, changement de couleur |
| `transition-normal` | 200ms | `ease-in-out` | Ouverture dropdown, expansion sidebar |
| `transition-slow` | 300ms | `ease-in-out` | Ouverture modale, transitions de page |

#### 1.7.2 Animations specifiques existantes

```css
/* Entree de ligne d'activite dans le dashboard */
@keyframes dashboard-activity-enter {
  0%   { opacity: 0; transform: translateY(-14px) scale(0.985); filter: blur(4px); }
  62%  { opacity: 1; transform: translateY(2px) scale(1.002); filter: blur(0); }
  100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

/* Highlight temporaire apres insertion */
@keyframes dashboard-activity-highlight {
  0%   { box-shadow: inset 2px 0 0 var(--primary); background-color: color-mix(in oklab, var(--accent) 55%, transparent); }
  100% { box-shadow: inset 0 0 0 transparent; background-color: transparent; }
}

/* Combinaison — classe a appliquer sur la ligne */
.activity-row-enter {
  animation:
    dashboard-activity-enter 520ms cubic-bezier(0.16, 1, 0.3, 1),
    dashboard-activity-highlight 920ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

#### 1.7.3 Respect de `prefers-reduced-motion`

**Obligatoire** : desactiver toutes les animations pour les utilisateurs ayant active la preference de reduction de mouvement.

```css
@media (prefers-reduced-motion: reduce) {
  .activity-row-enter {
    animation: none;
  }

  /* Appliquer globalement pour toutes les animations futures */
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 2. Conventions de Nommage

### 2.1 Composants React

| Categorie | Convention | Exemples |
|-----------|-----------|----------|
| Composants | PascalCase | `WorkflowPipeline`, `DriftAlert`, `AutomationCursor`, `RoleBadge` |
| Pages | PascalCase + suffixe Page | `DashboardPage`, `WorkflowDetailPage`, `SettingsPage` |
| Layouts | PascalCase + suffixe Layout | `AppLayout`, `AuthLayout`, `OnboardingLayout` |

### 2.2 Fichiers

| Categorie | Convention | Exemples |
|-----------|-----------|----------|
| Composants | kebab-case.tsx | `workflow-pipeline.tsx`, `drift-alert.tsx`, `automation-cursor.tsx` |
| API / hooks | kebab-case.ts | `use-workflow.ts`, `use-drift-alerts.ts` |
| Types | kebab-case.ts | `workflow-types.ts`, `drift-types.ts` |
| Tests | kebab-case.test.ts(x) | `workflow-pipeline.test.tsx` |

### 2.3 CSS / Styles

| Categorie | Convention | Notes |
|-----------|-----------|-------|
| Classes Tailwind | Utility-first | Priorite aux classes utilitaires Tailwind |
| Tokens CSS | kebab-case avec prefixe semantique | `--role-admin`, `--agent`, `--chart-1` |
| Classes custom | kebab-case, prefix projet | `paperclip-mdxeditor`, `activity-row-enter` |
| **Regle** | Eviter les classes custom | Sauf pour les tokens, animations complexes et integrations tierces |

### 2.4 Variables et Types TypeScript

| Categorie | Convention | Exemples |
|-----------|-----------|----------|
| Variables | camelCase | `isLoading`, `hasPermission`, `driftSeverity`, `agentStatus` |
| Constantes | UPPER_SNAKE_CASE | `MAX_AGENTS`, `ROLE_ADMIN`, `WEBSOCKET_RECONNECT_DELAY` |
| Types / Interfaces | PascalCase | `WorkflowStep`, `DriftAlert`, `AgentConfig` |
| Props | PascalCase + Props | `WorkflowPipelineProps`, `DriftAlertProps`, `AutomationCursorProps` |
| State types | PascalCase + State | `DriftAlertState`, `WorkflowEditorState` |
| Enums | PascalCase | `AgentStatus`, `DriftSeverity`, `AutomationLevel` |
| Hooks | camelCase prefixe use | `useWorkflow`, `useDriftAlerts`, `usePermissions` |

---

## 3. UX Patterns Documentation

### 3.1 Navigation

#### 3.1.1 Sidebar collapsible

La sidebar est le point d'entree principal de la navigation. Elle affiche les sections par contexte de l'utilisateur (projets, agents, workflows, parametres).

**Comportement** :
- Desktop (>= 1024px) : sidebar visible, collapsible via bouton chevron
- Tablette (768px-1023px) : masquee par defaut, accessible via hamburger
- Mode collapse : seules les icones sont visibles, labels masques
- Tooltip au survol en mode collapse pour indiquer le label
- Le Company Rail (multi-tenant) est affiche a gauche de la sidebar principale

**Implementation** :
```tsx
// Structure attendue
<aside role="navigation" aria-label="Navigation principale"
  className="flex flex-col w-60 bg-sidebar text-sidebar-foreground border-r border-sidebar-border
             transition-all transition-normal data-[collapsed]:w-14">
  <CompanyRail />       {/* Selecteur de tenant */}
  <SidebarProjects />   {/* Liste des projets */}
  <SidebarAgents />     {/* Agents actifs */}
  <SidebarSection />    {/* Sections additionnelles */}
</aside>
```

**Raccourci clavier** : `Ctrl+B` pour toggle collapse.

#### 3.1.2 Breadcrumbs

Fil d'Ariane contextuel affiché sous le header pour orienter l'utilisateur dans la hierarchie.

**Format** : `Company > Projet > Section > Element`

**Regles** :
- Maximum 4 niveaux affiches
- Le dernier element n'est pas cliquable (page courante)
- Chaque segment est un lien vers le niveau parent
- Sur mobile, seuls les 2 derniers niveaux sont visibles avec un bouton "..." pour les precedents

#### 3.1.3 Command Palette (Ctrl+K)

Palette de commandes globale accessible depuis n'importe quelle page.

**Fonctionnalites** :
- Recherche fuzzy sur projets, issues, agents, workflows, parametres
- Actions rapides : "Creer un agent", "Lancer workflow", "Ouvrir parametres"
- Navigation rapide : "Aller au projet X", "Ouvrir le dashboard"
- Filtrage par prefixe : `>` pour les commandes, `#` pour les projets, `@` pour les agents

**Implementation** :
```tsx
<dialog role="dialog" aria-label="Palette de commandes"
  className="z-modal shadow-lg bg-popover text-popover-foreground rounded-md w-[640px] max-h-[400px]">
  <input type="text" placeholder="Rechercher une commande, un projet, un agent..."
    aria-label="Recherche dans la palette de commandes"
    className="w-full px-4 py-3 text-lg bg-transparent border-b border-border" />
  <ul role="listbox" className="overflow-y-auto max-h-[320px]">
    {/* Resultats groupes par categorie */}
  </ul>
</dialog>
```

**Raccourci** : `Ctrl+K` (global), `Escape` pour fermer.

### 3.2 Feedback Utilisateur

#### 3.2.1 Toast Notifications

Les toasts sont des notifications temporaires non-bloquantes affichees en haut a droite de l'ecran.

| Variante | Couleur | Icone | Duree | Usage |
|----------|---------|-------|-------|-------|
| Success | `--success` | CheckCircle | 4s | Action reussie (agent lance, workflow sauvegarde) |
| Error | `--error` | XCircle | 8s (ou persistant) | Erreur (echec API, timeout) |
| Warning | `--warning` | AlertTriangle | 6s | Attention (quota proche, drift detecte) |
| Info | `--info` | Info | 4s | Information (mise a jour disponible) |

**Regles** :
- Maximum 3 toasts simultanement, les plus anciens sont depiles (FIFO)
- Toasts empilables en haut a droite, `z-toast` (300)
- Bouton de fermeture (X) toujours present
- `aria-live="polite"` pour les toasts non-critiques
- `aria-live="assertive"` pour les erreurs et les alertes drift
- Pause de l'auto-dismiss au survol

```tsx
// Structure de toast
<div role="status" aria-live="polite"
  className="z-toast flex items-start gap-3 p-4 bg-card border border-border shadow-lg rounded-md
             transition-fast">
  <CheckCircleIcon className="w-5 h-5 text-success shrink-0" />
  <div className="flex-1">
    <p className="font-medium text-sm">Agent lance avec succes</p>
    <p className="text-xs text-muted-foreground">L'agent "Code Review" est en cours d'execution.</p>
  </div>
  <button aria-label="Fermer la notification" className="shrink-0">
    <XIcon className="w-4 h-4 text-muted-foreground" />
  </button>
</div>
```

#### 3.2.2 Etats de chargement

Trois patterns de chargement selon le contexte :

| Pattern | Usage | Implementation |
|---------|-------|----------------|
| **Skeleton** | Chargement initial de page | Formes grises animees epousant la forme du contenu (cf. `PageSkeleton.tsx`) |
| **Spinner** | Action en cours (bouton, soumission) | Spinner circulaire 16-20px dans le bouton, texte change ("Lancement..." au lieu de "Lancer") |
| **Progress bar** | Operations longues (import, deploiement) | Barre horizontale avec pourcentage, `aria-valuenow` / `aria-valuemax` |

**Regles** :
- Skeleton pour tout chargement > 200ms (eviter le flash)
- Bouton desactive (`disabled`) pendant le loading, spinner inline
- Progress bar pour les operations > 5s avec estimation de temps
- `aria-busy="true"` sur le conteneur en chargement

### 3.3 Centre de Notifications

#### 3.3.1 Architecture

Le centre de notifications est accessible via une icone cloche dans le header avec badge de compteur.

**Types de notifications** :
- **Actions requises** : approbations en attente, validations humaines (human-in-the-loop)
- **Alertes** : drift detecte, agent en erreur, seuil de cout depasse
- **Informatives** : agent termine, workflow complete, nouveau membre invite

**Comportement** :
- Badge numerique sur l'icone cloche (rouge pour les actions requises)
- Panel slide-in depuis la droite au clic
- Notifications groupees par jour
- Actions inline ("Approuver", "Voir le detail", "Ignorer")
- Marquer comme lu / tout marquer comme lu

#### 3.3.2 Notifications prioritaires

Les alertes critiques (drift `severity: high`, agent crash, violation de securite) declenchent en plus :
- Un toast `aria-live="assertive"` immediat
- Un badge rouge clignotant sur l'icone cloche
- Un son optionnel (configurable dans les parametres)

### 3.4 Gestion des Permissions (RBAC)

**Principe** : masquer les elements non-autorises plutot que les griser.

| Situation | Comportement |
|-----------|-------------|
| Bouton non-autorise | Masque completement (`hidden`), pas `disabled` |
| Page non-autorisee | Redirect vers la page autorisee la plus proche |
| Action non-autorisee (API) | Message 403 clair : "Vous n'avez pas la permission de [action]. Contactez un administrateur." |
| Menu item non-autorise | Non affiche dans la navigation |
| Route directe non-autorisee | Page 403 avec lien de retour et explication |

**Implementation** :
```tsx
// Pattern canUser() — masquage conditionnel
{canUser('agent:create') && (
  <Button onClick={handleCreateAgent}>Nouvel agent</Button>
)}

// Page de permission refusee
<div className="flex flex-col items-center justify-center h-full gap-4">
  <ShieldOffIcon className="w-12 h-12 text-muted-foreground" />
  <h2 className="text-xl font-semibold">Acces refuse</h2>
  <p className="text-muted-foreground">Vous n'avez pas la permission d'acceder a cette page.</p>
  <Button variant="secondary" asChild>
    <Link to="/dashboard">Retour au dashboard</Link>
  </Button>
</div>
```

### 3.5 Gestion des Erreurs

#### 3.5.1 Error Boundary

Chaque section majeure de l'application est encapsulee dans un Error Boundary React pour eviter les crashes globaux.

**Affichage** : message convivial avec option de recharger la section, sans perdre le reste de l'interface.

#### 3.5.2 Page 404

```
+------------------------------------------+
|  Illustration                            |
|                                          |
|  Page introuvable                        |
|  L'URL que vous avez suivie ne          |
|  correspond a aucune page.               |
|                                          |
|  [Retour au dashboard]                   |
+------------------------------------------+
```

#### 3.5.3 Erreurs de formulaire (inline)

- Les erreurs s'affichent sous le champ concerne, en rouge (`--error`) avec icone
- Le champ en erreur a une bordure rouge
- `aria-describedby` lie le champ a son message d'erreur
- `aria-invalid="true"` sur le champ invalide
- Focus automatique sur le premier champ en erreur apres soumission

```tsx
<div className="space-y-1">
  <label htmlFor="email" className="text-sm font-medium">Email</label>
  <input id="email" type="email"
    aria-invalid={!!errors.email} aria-describedby="email-error"
    className="border border-input rounded-md px-3 py-2
               aria-[invalid=true]:border-error aria-[invalid=true]:ring-error" />
  {errors.email && (
    <p id="email-error" role="alert" className="text-xs text-error flex items-center gap-1">
      <AlertCircleIcon className="w-3 h-3" />
      {errors.email}
    </p>
  )}
</div>
```

#### 3.5.4 Pattern de retry

Pour les erreurs reseau ou timeout :
- Afficher le message d'erreur avec un bouton "Reessayer"
- Retry automatique avec backoff exponentiel (1s, 2s, 4s) pour les requetes en arriere-plan
- Maximum 3 tentatives automatiques avant de demander une action manuelle
- Indicateur visuel de reconnexion ("Reconnexion en cours...")

### 3.6 Temps Reel (WebSocket)

#### 3.6.1 Indicateur de connexion

Un indicateur discret dans le footer ou le header montre l'etat de la connexion WebSocket.

| Etat | Visuel | Aria |
|------|--------|------|
| Connecte | Pastille verte (5px) | `aria-label="Connexion temps reel active"` |
| Reconnexion | Pastille orange pulsante | `aria-label="Reconnexion en cours"` + `aria-live="polite"` annonce |
| Deconnecte | Pastille rouge + banniere | `aria-label="Connexion perdue"` + `aria-live="assertive"` |

#### 3.6.2 Reconnexion automatique

- Tentative de reconnexion immediate, puis backoff exponentiel (1s, 2s, 4s, 8s, max 30s)
- Banniere d'avertissement apres 10s de deconnexion : "Connexion perdue. Les donnees peuvent ne pas etre a jour."
- Bouton "Reconnecter maintenant" dans la banniere
- Resynchronisation automatique des donnees a la reconnexion

#### 3.6.3 Mises a jour optimistes (Optimistic Updates)

Pour les actions utilisateur rapides (deplacer une story, changer un statut) :
- Mise a jour immediate de l'UI avant confirmation serveur
- Revert automatique si le serveur rejette l'action
- Toast d'erreur en cas de revert : "L'action n'a pas pu etre sauvegardee. La modification a ete annulee."

---

## 4. Responsive & Accessibility (WCAG 2.1 AA)

### 4.1 Responsive Design

#### 4.1.1 Breakpoints

MnM est desktop-first (cible B2B = usage principalement desktop). L'interface est responsive down to tablet.

| Breakpoint | Taille | Description |
|------------|--------|-------------|
| `sm` | >= 640px | Petit ecran, telephone paysage |
| `md` | >= 768px | Tablette portrait |
| `lg` | >= 1024px | Tablette paysage / petit laptop |
| `xl` | >= 1280px | Desktop (experience optimale) |
| `2xl` | >= 1536px | Grand ecran / moniteur externe |

```css
/* Implementation Tailwind — desktop-first avec min-width */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md */ }
@media (min-width: 1024px) { /* lg */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

#### 4.1.2 Comportement adaptatif par composant

| Composant | Desktop (>= 1280px) | Laptop (1024-1279px) | Tablette (768-1023px) | Mobile (< 768px) |
|-----------|---------------------|---------------------|----------------------|-------------------|
| **Sidebar** | Fixe, visible | Fixe, collapsible | Overlay hamburger | Overlay hamburger |
| **ChatPanel** | Panel fixe a droite | Overlay glissant | Overlay plein ecran | Plein ecran |
| **Board Kanban** | Toutes colonnes | Scroll horizontal | Scroll horizontal | Scroll horizontal |
| **Pipeline workflow** | Horizontal complet | Horizontal scroll | Liste verticale | Liste verticale |
| **Dashboard widgets** | Grille 3-4 colonnes | Grille 2-3 colonnes | Grille 1-2 colonnes | Pile verticale |
| **Tableaux** | Affichage complet | Scroll horizontal | Scroll horizontal | Vue carte |
| **Modales** | Centrees (max 640px) | Centrees | Centrees | Plein ecran |
| **Notifications** | Panel lateral | Panel lateral | Plein ecran | Plein ecran |

#### 4.1.3 Cible tactile (mobile)

Le projet integre deja la regle des 44px pour les cibles tactiles sur ecrans tactiles :

```css
@media (pointer: coarse) {
  button, [role="button"], input, select, textarea,
  [data-slot="select-trigger"] {
    min-height: 44px;
  }
}
```

### 4.2 Accessibility (WCAG 2.1 AA)

#### 4.2.1 Contraste

**Ratios minimaux obligatoires** :

| Element | Ratio minimum | Norme |
|---------|--------------|-------|
| Texte normal (< 18pt / < 14pt bold) | 4.5:1 | WCAG 2.1 AA 1.4.3 |
| Texte large (>= 18pt ou >= 14pt bold) | 3:1 | WCAG 2.1 AA 1.4.3 |
| Composants UI et icones | 3:1 | WCAG 2.1 AA 1.4.11 |
| Focus indicator | 3:1 | WCAG 2.1 AA 2.4.7 |

**Verification** : les tokens oklch actuels dans les modes clair et sombre doivent etre valides avec un outil de verification de contraste oklch. Chaque nouveau token de couleur doit etre verifie avant integration.

**Regle critique** : ne jamais utiliser la couleur seule pour communiquer une information. Toujours combiner couleur + icone + texte.

- Statut agent : couleur + icone + texte ("Running" en vert avec icone play)
- Drift : couleur orange + icone warning + texte "Drift detecte"
- Roles : couleur badge + texte du role toujours visible
- Priorite : couleur + icone + label

#### 4.2.2 Focus visible

Tous les elements interactifs doivent avoir un indicateur de focus visible.

```css
/* Pattern de focus recommande */
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

/* Suppression du focus pour clic souris uniquement */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Exigences** :
- Outline 2px minimum avec contraste suffisant (3:1 contre le fond)
- Ordre de tabulation logique : gauche a droite, haut en bas
- Aucun piege clavier : `Escape` ou `Tab` permet toujours de sortir
- Focus restaure a l'element declencheur a la fermeture d'une modale

#### 4.2.3 Navigation clavier complete

| Contexte | Raccourci | Action |
|----------|-----------|--------|
| Global | `Tab` / `Shift+Tab` | Navigation sequentielle |
| Global | `Ctrl+K` | Palette de commandes |
| Global | `Escape` | Fermer modale / panneau / dropdown |
| Board | `Arrow keys` | Naviguer entre stories |
| Board | `Enter` | Ouvrir le detail |
| Board | `D` | Activer le mode deplacement |
| Chat | `Enter` | Envoyer message |
| Chat | `Shift+Enter` | Nouvelle ligne |
| Chat | `Ctrl+Shift+S` | Stopper l'agent |
| Workflow | `Arrow Left/Right` | Naviguer entre etapes |
| Dashboard | `Tab` | Naviguer entre widgets |

**Skip links** : liens "Aller au contenu principal" et "Aller a la navigation" en haut de page, visibles uniquement au focus clavier.

```tsx
<a href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2
             focus:z-tooltip focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground
             focus:rounded-md focus:shadow-lg">
  Aller au contenu principal
</a>
```

#### 4.2.4 ARIA Landmarks et Labels

**Landmarks obligatoires** :

```html
<header role="banner">...</header>
<nav role="navigation" aria-label="Navigation principale">Sidebar</nav>
<main role="main" id="main-content">Contenu</main>
<aside role="complementary" aria-label="Chat avec l'agent">ChatPanel</aside>
<div role="status" aria-live="polite">Notifications</div>
```

**Labels obligatoires** :
- Boutons d'icone (sans texte visible) : `aria-label` descriptif
- Indicateurs de statut : `aria-live="polite"` pour mises a jour automatiques
- Alertes drift : `aria-live="assertive"` pour alertes critiques
- Progress bars : `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Tableaux : `aria-sort` sur colonnes triables
- Onglets : pattern `role="tablist"` / `role="tab"` / `role="tabpanel"` avec `aria-selected`

#### 4.2.5 Annonces dynamiques pour lecteurs d'ecran

| Evenement | Live region | Message annonce |
|-----------|-------------|-----------------|
| Changement d'etape workflow | `aria-live="polite"` | "Etape 3 : Review - En cours" |
| Message agent recu | `aria-live="polite"` | "Nouveau message de l'agent : [debut]" |
| Drift detecte | `aria-live="assertive"` | "Alerte : drift detecte sur [story]" |
| Action completee | `aria-live="polite"` | "Story US-142 passee en Done" |
| Toast notification | `role="status"` | Contenu du toast lu automatiquement |
| Mode automatisation change | `aria-live="polite"` | "Mode automatisation change en : Assiste" |
| Connexion perdue | `aria-live="assertive"` | "Connexion temps reel perdue" |

#### 4.2.6 Composants MnM — Exigences specifiques

**Curseur d'automatisation** :
- Accessible au clavier : `Arrow Left/Right` pour changer de position
- `aria-label="Curseur d'automatisation"`
- `aria-valuenow="assiste"` + `aria-valuetext="Mode assiste : l'agent propose, vous validez"`
- Les 3 positions (Manuel, Assiste, Auto) sont cliquables ET atteignables au clavier

**Pipeline Workflow** :
- Chaque etape est focusable
- `aria-current="step"` sur l'etape en cours
- `aria-label` incluant le statut : "Etape 2, Code, en cours, 45 pourcent"
- Navigation fleches gauche/droite, `Enter` pour ouvrir le detail

**Drag-and-drop (Board, Workflow editor)** :
- Alternative clavier obligatoire pour toutes les operations
- Mode "deplacer" active par touche `D` ou `Espace`
- Annonce vocale : "Story US-142 selectionnee. Fleches pour deplacer. Enter pour deposer."
- Menu contextuel "Deplacer vers..." comme alternative sans drag

**ChatPanel** :
- Messages navigables avec fleches haut/bas
- Chaque message a un `aria-label` avec emetteur et horodatage
- Boutons Stop/Rollback accessibles au clavier meme pendant le scroll
- Zone de saisie : `aria-label="Envoyer un message a l'agent"`

#### 4.2.7 Themes et preferences systeme

```css
/* Detection automatique du theme systeme */
@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    /* Appliquer les tokens sombres si pas de surcharge manuelle */
  }
}

/* Respect de la preference de mouvement reduit */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Les deux themes (clair et sombre) doivent respecter les ratios de contraste WCAG 2.1 AA.

#### 4.2.8 Tests d'accessibilite requis

**Automatises (CI/CD)** :
- axe-core integre sur chaque composant (regles WCAG 2.1 AA)
- Lighthouse accessibility score >= 90
- Pa11y sur les pages principales

**Manuels (avant chaque release)** :
- Navigation complete au clavier (aucun element inaccessible)
- Test avec NVDA (Windows) et VoiceOver (macOS)
- Test avec zoom navigateur a 200% (pas de perte de fonctionnalite)
- Test daltonisme via simulateur Chrome DevTools
- Verification des annonces `aria-live` avec un lecteur d'ecran reel

---

*Section 7 — Design Tokens, UX Patterns & Accessibility v1.0 — ~2800 mots. Basee sur les tokens CSS existants (index.css, Tailwind CSS v4 + shadcn/ui), le PRD B2B v1.0, et les UX Requirements v1.0.*
