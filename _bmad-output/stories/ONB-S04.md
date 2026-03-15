# ONB-S04 — Dual-Mode Config (Onboarding)

> **Epic** : ONB — Onboarding Cascade (Noyau C)
> **Sprint** : Batch 14
> **Assignation** : Cofondateur
> **Effort** : M (3 SP, 2-3j)
> **Bloque par** : ONB-S01 (DONE), DUAL-S01 (DONE)
> **Debloque** : —
> **ADR** : ADR-003 (Dual-Speed Workflow)

---

## Contexte

Le wizard d'onboarding (ONB-S01) guide le CEO a travers 5 etapes : Company, Agent, Task, Invite, Launch. Le systeme Dual-Speed (DUAL-S01) permet de configurer un curseur d'automatisation a 3 positions (manual / assisted / auto) au niveau company.

ONB-S04 ajoute une **etape de configuration dual-mode** dans le wizard d'onboarding, entre l'etape Invite (step 4) et l'etape Launch (qui devient step 6). Cette nouvelle etape 5 permet au CEO de definir la vitesse par defaut des agents au niveau company pendant l'onboarding.

Le wizard passe de 5 a 6 etapes. Le CEO peut :
- Choisir la position par defaut parmi Manual / Assisted / Auto
- Voir une description claire de chaque mode
- La position choisie est persistee via l'API automation-cursors existante (PUT /companies/:companyId/automation-cursors)
- L'etape est optionnelle (skip possible, defaut = "assisted")

Le service d'onboarding (onboarding.ts), les routes (onboarding.ts), le composant wizard (OnboardingWizard.tsx), et le service automation-cursors (automation-cursors.ts) existent deja.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| ONB-S01 | DONE | Onboarding wizard 5 etapes, service, routes, progress bar |
| ONB-S02 | DONE | Cascade hierarchique |
| ONB-S03 | DONE | Import Jira |
| DUAL-S01 | DONE | automation_cursors table + service + routes |
| DUAL-S02 | DONE | UI curseur (page AutomationCursors) |
| DUAL-S03 | DONE | Cursor enforcement dans workflow |

---

## Acceptance Criteria (Given/When/Then)

### AC-01: New step visible in wizard
- **Given** le CEO dans le wizard d'onboarding
- **When** il complete l'etape Invite (step 4) et avance
- **Then** il voit l'etape "Agent Speed" (step 5) avec 3 options visuelles

### AC-02: Three position cards displayed
- **Given** le CEO sur l'etape "Agent Speed" (step 5)
- **Then** 3 cartes sont affichees : Manual, Assisted, Auto
- **And** chaque carte a un titre, une description, et une icone

### AC-03: Default selection is "assisted"
- **Given** le CEO arrive sur l'etape "Agent Speed"
- **When** la page se charge
- **Then** la carte "Assisted" est pre-selectionnee

### AC-04: Selection persistence via automation-cursors API
- **Given** le CEO selectionne "Manual" sur l'etape "Agent Speed"
- **When** il clique "Next"
- **Then** un PUT /companies/:companyId/automation-cursors est appele avec level="company", position="manual"
- **And** un audit event "automation_cursor.updated" est emis

### AC-05: Skip defaults to "assisted"
- **Given** le CEO sur l'etape "Agent Speed"
- **When** il clique "Skip"
- **Then** un PUT est appele avec position="assisted" (valeur par defaut)
- **And** le wizard avance a l'etape Launch (step 6)

### AC-06: Progress bar updated to 6 steps
- **Given** le wizard d'onboarding
- **When** il se charge
- **Then** la barre de progression affiche 6 etapes au lieu de 5
- **And** les labels sont : Company, Agent, Task, Invite, Speed, Launch

### AC-07: Step type extended to 6
- **Given** le composant OnboardingWizard
- **Then** le type Step est `1 | 2 | 3 | 4 | 5 | 6`
- **And** "Step X of 6" est affiche

### AC-08: Backend onboarding step range extended
- **Given** la route PUT /companies/:companyId/onboarding
- **When** step=5 est envoye
- **Then** la validation accepte step entre 0 et 7 (elargi de 0-6 a 0-7)

### AC-09: OnboardingDualModeStep component
- **Given** le nouveau composant OnboardingDualModeStep
- **Then** il exporte les props: onSelect(position), onSkip(), selectedPosition, loading
- **And** il affiche 3 cartes radio-button-style

### AC-10: Launch step summary includes speed
- **Given** le CEO arrive a l'etape Launch (step 6)
- **Then** le resume affiche aussi la vitesse choisie (Manual/Assisted/Auto)
- **And** avec l'icone appropriee

### AC-11: Onboarding completion step updated
- **Given** le service onboarding completeOnboarding
- **When** appele
- **Then** il set onboardingStep a 7 (elargi de 6 a 7)

### AC-12: Keyboard shortcut works on step 5
- **Given** le CEO sur l'etape "Agent Speed" (step 5)
- **When** il appuie Cmd+Enter
- **Then** la selection courante est sauvegardee et le wizard avance

---

## Deliverables

### Backend

1. **Route validation elargie** — `server/src/routes/onboarding.ts`
   - onb-s04-route-validation-marker: Modifier la validation step de `0-6` a `0-7`

2. **Service completion elargie** — `server/src/services/onboarding.ts`
   - onb-s04-service-completion-marker: Modifier completeOnboarding pour set step=7

### Frontend

3. **Nouveau composant** — `ui/src/components/OnboardingDualModeStep.tsx`
   - 3 cartes position (manual/assisted/auto)
   - Chaque carte : icone + titre + description + radio check
   - Props: onSelect, onSkip, selectedPosition, loading
   - data-testid="onb-s04-*" sur chaque element interactif

4. **Wizard enrichi** — `ui/src/components/OnboardingWizard.tsx`
   - Type Step elargi a 6
   - Import OnboardingDualModeStep
   - Nouvel etat: `dualModePosition` (default "assisted")
   - Nouvelle etape step 5 avec le composant
   - Step 5 (launch) → step 6 (launch)
   - handleDualModeNext() qui appelle automation-cursors API
   - handleDualModeSkip() qui sauvegarde "assisted" par defaut
   - Resume step 6 avec ligne vitesse
   - totalSteps=6 sur OnboardingProgressBar
   - "Step X of 6" dans le titre
   - Keyboard shortcut step 5

5. **Progress bar enrichie** — `ui/src/components/OnboardingProgressBar.tsx`
   - Ajouter { label: "Speed", icon: Gauge } dans STEP_CONFIG

### Barrel Exports

6. Pas de nouveaux barrel exports necessaires (le composant est importe directement dans le wizard)

---

## data-testid Mapping

| data-testid | Element | Composant |
|-------------|---------|-----------|
| `onb-s04-dual-mode-step` | Container etape | OnboardingDualModeStep |
| `onb-s04-card-manual` | Carte Manual | OnboardingDualModeStep |
| `onb-s04-card-assisted` | Carte Assisted | OnboardingDualModeStep |
| `onb-s04-card-auto` | Carte Auto | OnboardingDualModeStep |
| `onb-s04-card-title-manual` | Titre Manual | OnboardingDualModeStep |
| `onb-s04-card-title-assisted` | Titre Assisted | OnboardingDualModeStep |
| `onb-s04-card-title-auto` | Titre Auto | OnboardingDualModeStep |
| `onb-s04-card-desc-manual` | Description Manual | OnboardingDualModeStep |
| `onb-s04-card-desc-assisted` | Description Assisted | OnboardingDualModeStep |
| `onb-s04-card-desc-auto` | Description Auto | OnboardingDualModeStep |
| `onb-s04-card-radio-manual` | Radio indicator Manual | OnboardingDualModeStep |
| `onb-s04-card-radio-assisted` | Radio indicator Assisted | OnboardingDualModeStep |
| `onb-s04-card-radio-auto` | Radio indicator Auto | OnboardingDualModeStep |
| `onb-s04-skip` | Bouton Skip | OnboardingDualModeStep |
| `onb-s04-next` | Bouton Next/Confirm | OnboardingWizard |
| `onb-s04-speed-summary` | Ligne vitesse dans resume | OnboardingWizard (step 6) |
| `onb-s01-progress-step-5` | Step 5 icon (Speed) | OnboardingProgressBar |
| `onb-s01-step-label-5` | Step 5 label (Speed) | OnboardingProgressBar |
| `onb-s01-progress-step-6` | Step 6 icon (Launch) | OnboardingProgressBar |
| `onb-s01-step-label-6` | Step 6 label (Launch) | OnboardingProgressBar |

---

## Test Cases (E2E Playwright — file-content based)

### Backend — Route validation (T01-T03)
- T01: onboarding route accepts step 0-7 range (was 0-6)
- T02: onboarding route rejects step > 7
- T03: onboarding service completeOnboarding sets step=7

### Frontend — OnboardingDualModeStep component (T04-T16)
- T04: Component file exists at ui/src/components/OnboardingDualModeStep.tsx
- T05: Component exports OnboardingDualModeStep function
- T06: Component has data-testid="onb-s04-dual-mode-step"
- T07: Component renders card for "manual" with data-testid="onb-s04-card-manual"
- T08: Component renders card for "assisted" with data-testid="onb-s04-card-assisted"
- T09: Component renders card for "auto" with data-testid="onb-s04-card-auto"
- T10: Manual card has title data-testid="onb-s04-card-title-manual"
- T11: Assisted card has title data-testid="onb-s04-card-title-assisted"
- T12: Auto card has title data-testid="onb-s04-card-title-auto"
- T13: Component has description for each mode with data-testid="onb-s04-card-desc-*"
- T14: Component has radio indicator for each mode with data-testid="onb-s04-card-radio-*"
- T15: Component has skip button with data-testid="onb-s04-skip"
- T16: Component accepts props: onSelect, onSkip, selectedPosition, loading

### Frontend — OnboardingWizard integration (T17-T30)
- T17: Wizard type Step includes 6 (1 | 2 | 3 | 4 | 5 | 6)
- T18: Wizard imports OnboardingDualModeStep
- T19: Wizard has dualModePosition state initialized to "assisted"
- T20: Wizard renders step 5 with OnboardingDualModeStep
- T21: Wizard renders step 6 with launch content (was step 5)
- T22: Wizard calls automation-cursors API on dual mode next (handleDualModeNext)
- T23: Wizard has handleDualModeSkip function
- T24: Wizard shows "Step X of 6" in title area
- T25: Wizard passes totalSteps={6} to OnboardingProgressBar
- T26: Wizard keyboard shortcut handles step 5 (handleDualModeNext)
- T27: Wizard step 5 has "Next" button with data-testid="onb-s04-next"
- T28: Wizard step 6 summary includes speed line with data-testid="onb-s04-speed-summary"
- T29: Wizard step 6 has complete button (was step 5)
- T30: Wizard imports automationCursorsApi or calls automation-cursors endpoint

### Frontend — OnboardingProgressBar (T31-T34)
- T31: STEP_CONFIG has 6 entries (was 5)
- T32: STEP_CONFIG[4] has label "Speed"
- T33: STEP_CONFIG[5] has label "Launch"
- T34: ProgressBar imports Gauge icon from lucide-react

### Backend — Service onboarding (T35-T37)
- T35: completeOnboarding sets onboardingStep to 7 (was 6)
- T36: Service file has onb-s04 marker comment
- T37: Service handles step 7 as completed state

### Backend — Route onboarding (T38-T40)
- T38: Route validation accepts step up to 7 (was 6)
- T39: Route file has onb-s04 marker comment
- T40: Route rejects step > 7

### Regression — ONB-S01 compat (T41-T45)
- T41: OnboardingWizard still has data-testid="onb-s01-wizard"
- T42: OnboardingWizard still has data-testid="onb-s01-step-title"
- T43: OnboardingProgressBar still has data-testid="onb-s01-progress-bar"
- T44: OnboardingWizard still imports OnboardingProgressBar
- T45: OnboardingWizard still imports OnboardingInviteStep

### Regression — DUAL-S01 compat (T46-T48)
- T46: automation-cursors service still exports automationCursorService
- T47: automation-cursors routes still export automationCursorRoutes
- T48: automation-cursors API client still exports automationCursorsApi

---

## Position Descriptions

| Position | Titre | Description |
|----------|-------|-------------|
| manual | Manual Control | Every agent action requires your explicit approval. Best for critical workflows. |
| assisted | Assisted Mode | Agents suggest actions but wait for your confirmation at key checkpoints. Recommended. |
| auto | Full Automation | Agents execute autonomously with minimal interruption. Monitor via dashboard. |

---

## Notes techniques

- Le wizard d'onboarding existant est 1260+ lignes — les modifications sont chirurgicales
- L'API automation-cursors (DUAL-S01) est deja complete et fonctionnelle
- Le composant OnboardingDualModeStep est un nouveau composant standalone (comme OnboardingInviteStep)
- La barre de progression s'adapte automatiquement via totalSteps
- L'icone Gauge de lucide-react est utilisee pour l'etape Speed
