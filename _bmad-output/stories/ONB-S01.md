# ONB-S01 — Onboarding CEO (Wizard B2B)

> **Epic** : ONB — Onboarding Cascade (Noyau C)
> **Sprint** : Batch 14
> **Assignation** : Tom (backend + frontend)
> **Effort** : M (3 SP, 2-3j)
> **Bloque par** : MU-S01 (API invitations email), TECH-06 (tables), TECH-07 (company schema)
> **Debloque** : ONB-S02 (cascade hierarchique), ONB-S04 (dual-mode config)
> **ADR** : —

---

## Contexte

MnM dispose deja d'un `OnboardingWizard` (1225 lignes) qui guide l'utilisateur dans un wizard 4 etapes :
1. Creer une Company (nom + objectif)
2. Configurer un Agent CEO (adapter, model, cwd)
3. Creer une premiere Story/Task
4. Lancer l'agent et voir les resultats

Ce wizard est fonctionnel pour le mode mono-utilisateur. ONB-S01 l'enrichit pour le contexte B2B enterprise en ajoutant :

1. **Tracking de progression serveur** — L'etat d'avancement de l'onboarding est persiste cote serveur (champ `onboardingStep` sur la table `companies`) pour permettre la reprise en cas de deconnexion et le suivi par le systeme.
2. **Etape "Invite Members"** — Nouvelle etape 4 (avant l'ancienne etape 4 "Launch") qui permet au CEO d'inviter des membres (email + role) directement depuis le wizard.
3. **Progress indicator enrichi** — Barre de progression avec etapes nommees, icones par etape, etat visuellement distinct (done/current/upcoming).
4. **Persistance etat wizard** — localStorage backup + API sync pour reprendre l'onboarding la ou l'utilisateur s'est arrete.
5. **Completion tracking** — Quand toutes les etapes sont completees, le champ `onboardingCompleted` est mis a `true` cote serveur, et le wizard ne s'ouvre plus automatiquement.

Le wizard existant n'est pas remplace — il est **enrichi** avec les nouvelles capacites B2B.

---

## Dependances verifiees

| Story | Statut | Ce qu'elle fournit |
|-------|--------|-------------------|
| TECH-06 | DONE | Tables DB (10 nouvelles) |
| TECH-07 | DONE | Modifications companies (tier, ssoEnabled, maxUsers) |
| MU-S01 | DONE | API invitations email (POST /api/invites) |
| MU-S02 | DONE | Page membres UI (pattern reference) |
| RBAC-S01 | DONE | hasPermission scope fix |
| RBAC-S05 | DONE | Navigation masquee, RequirePermission |

---

## Deliverables

### Backend

1. **Migration Drizzle** — `packages/db/src/migrations/XXXX_onboarding_tracking.sql`
   - Ajouter `onboarding_step` (integer, default 0) sur `companies`
   - Ajouter `onboarding_completed` (boolean, default false) sur `companies`
   - Ajouter `onboarding_data` (jsonb, nullable) sur `companies` — stocke les donnees intermediaires du wizard

2. **Schema Drizzle enrichi** — `packages/db/src/schema/companies.ts`
   - Nouvelles colonnes dans le schema

3. **Service onboarding** — `server/src/services/onboarding.ts`
   - `getOnboardingStatus(companyId)` — retourne step, completed, data
   - `updateOnboardingStep(companyId, step, data?)` — met a jour l'etape courante
   - `completeOnboarding(companyId)` — marque l'onboarding comme termine
   - `resetOnboarding(companyId)` — reset (admin only, pour re-onboarding)

4. **Routes API** — `server/src/routes/onboarding.ts`
   - `GET /api/companies/:companyId/onboarding` — status
   - `PUT /api/companies/:companyId/onboarding` — update step + data
   - `POST /api/companies/:companyId/onboarding/complete` — mark complete
   - `POST /api/companies/:companyId/onboarding/reset` — reset (admin)

5. **Barrel exports** — `server/src/services/index.ts`, `server/src/routes/index.ts`

6. **App.ts mounting** — Mount onboarding routes under `/api/companies/:companyId/onboarding`

### Frontend

7. **API client** — `ui/src/api/onboarding.ts`
   - `onboardingApi.getStatus(companyId)` — GET status
   - `onboardingApi.updateStep(companyId, step, data?)` — PUT update
   - `onboardingApi.complete(companyId)` — POST complete
   - `onboardingApi.reset(companyId)` — POST reset

8. **Query keys** — `ui/src/lib/queryKeys.ts`
   - `onboarding.status` key

9. **OnboardingWizard enrichment** — `ui/src/components/OnboardingWizard.tsx`
   - Progress bar component with 5 named steps
   - Server-sync of current step (useEffect + mutation)
   - Step 4 "Invite Members" (email input + role select + send invitations)
   - Completion callback persists to server
   - Resume from server state on re-open
   - localStorage fallback for offline resilience

10. **OnboardingProgressBar component** — `ui/src/components/OnboardingProgressBar.tsx`
    - 5-step visual indicator with icons and labels
    - States: completed (checkmark), current (pulsing), upcoming (grey)
    - Responsive (horizontal desktop, vertical mobile)

11. **OnboardingInviteStep component** — `ui/src/components/OnboardingInviteStep.tsx`
    - Email input field
    - Role selector (admin/manager/contributor/viewer)
    - "Add to list" button
    - Invite list with remove capability
    - "Send All Invitations" button
    - Skip option ("I'll do this later")

---

## Acceptance Criteria (Given/When/Then)

### AC1 — Onboarding status endpoint
**Given** a company with `onboarding_step = 2` and `onboarding_completed = false`
**When** GET `/api/companies/:companyId/onboarding` is called
**Then** response contains `{ step: 2, completed: false, data: {...} }`

### AC2 — Step update persists
**Given** the CEO is on step 2 of the wizard
**When** they complete step 2 and move to step 3
**Then** PUT `/api/companies/:companyId/onboarding` updates `onboarding_step = 3` in DB

### AC3 — Onboarding completion
**Given** the CEO completes all 5 steps
**When** the wizard fires the completion callback
**Then** `onboarding_completed = true` is set on the company and the wizard closes

### AC4 — Resume on reconnection
**Given** the CEO was on step 3 and disconnected
**When** they log back in and open the wizard
**Then** the wizard resumes at step 3 with previously entered data

### AC5 — Progress bar visual states
**Given** the wizard is at step 3
**When** the progress bar renders
**Then** steps 1-2 show checkmarks (completed), step 3 shows pulse (current), steps 4-5 show grey (upcoming)

### AC6 — Invite members step
**Given** the CEO is at the invite step (step 4)
**When** they add "alice@example.com" with role "manager" and click "Send Invitations"
**Then** invitations are sent via the MU-S01 API and success feedback is shown

### AC7 — Skip invite step
**Given** the CEO is at the invite step
**When** they click "Skip for now"
**Then** they proceed to step 5 without sending invitations

### AC8 — Onboarding completed state
**Given** a company with `onboarding_completed = true`
**When** the user navigates to the dashboard
**Then** the onboarding wizard does NOT auto-open

### AC9 — Admin reset onboarding
**Given** an admin user
**When** they call POST `/api/companies/:companyId/onboarding/reset`
**Then** `onboarding_step = 0` and `onboarding_completed = false` and the wizard can be re-triggered

### AC10 — Audit trail
**Given** the CEO completes onboarding
**When** the completion event fires
**Then** an audit event `onboarding.completed` is emitted with `{ companyId, steps_completed: 5 }`

### AC11 — localStorage fallback
**Given** the server is unreachable
**When** the CEO progresses through steps
**Then** progress is saved to localStorage and synced when connectivity returns

### AC12 — data-testid coverage
**Given** all interactive/verifiable elements
**When** the wizard renders
**Then** every element has a `data-testid` attribute with prefix `onb-s01-`

---

## data-testid Mapping Table

| Element | data-testid | File |
|---------|------------|------|
| Progress bar container | `onb-s01-progress-bar` | OnboardingProgressBar.tsx |
| Progress step 1 | `onb-s01-progress-step-1` | OnboardingProgressBar.tsx |
| Progress step 2 | `onb-s01-progress-step-2` | OnboardingProgressBar.tsx |
| Progress step 3 | `onb-s01-progress-step-3` | OnboardingProgressBar.tsx |
| Progress step 4 | `onb-s01-progress-step-4` | OnboardingProgressBar.tsx |
| Progress step 5 | `onb-s01-progress-step-5` | OnboardingProgressBar.tsx |
| Step label (dynamic) | `onb-s01-step-label-{n}` | OnboardingProgressBar.tsx |
| Invite email input | `onb-s01-invite-email` | OnboardingInviteStep.tsx |
| Invite role select | `onb-s01-invite-role` | OnboardingInviteStep.tsx |
| Invite add button | `onb-s01-invite-add` | OnboardingInviteStep.tsx |
| Invite list container | `onb-s01-invite-list` | OnboardingInviteStep.tsx |
| Invite list item | `onb-s01-invite-item-{i}` | OnboardingInviteStep.tsx |
| Invite item remove | `onb-s01-invite-remove-{i}` | OnboardingInviteStep.tsx |
| Invite send all button | `onb-s01-invite-send` | OnboardingInviteStep.tsx |
| Invite skip button | `onb-s01-invite-skip` | OnboardingInviteStep.tsx |
| Invite success message | `onb-s01-invite-success` | OnboardingInviteStep.tsx |
| Invite error message | `onb-s01-invite-error` | OnboardingInviteStep.tsx |
| Wizard container | `onb-s01-wizard` | OnboardingWizard.tsx |
| Step title | `onb-s01-step-title` | OnboardingWizard.tsx |
| Next button | `onb-s01-next` | OnboardingWizard.tsx |
| Back button | `onb-s01-back` | OnboardingWizard.tsx |
| Complete button | `onb-s01-complete` | OnboardingWizard.tsx |
| Server sync indicator | `onb-s01-sync-status` | OnboardingWizard.tsx |

---

## Test Cases (file-content based)

### Backend — Service (T01-T06)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T01 | Service exports getOnboardingStatus | onboarding.ts | `export.*getOnboardingStatus` |
| T02 | Service exports updateOnboardingStep | onboarding.ts | `export.*updateOnboardingStep` |
| T03 | Service exports completeOnboarding | onboarding.ts | `export.*completeOnboarding` |
| T04 | Service exports resetOnboarding | onboarding.ts | `export.*resetOnboarding` |
| T05 | Service uses companies table | onboarding.ts | `companies` table reference |
| T06 | Service barrel export | services/index.ts | `onboardingService` or `onboarding` export |

### Backend — Routes (T07-T14)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T07 | GET route for status | routes/onboarding.ts | `router.get.*"/"` |
| T08 | PUT route for update | routes/onboarding.ts | `router.put.*"/"` |
| T09 | POST route for complete | routes/onboarding.ts | `router.post.*"/complete"` |
| T10 | POST route for reset | routes/onboarding.ts | `router.post.*"/reset"` |
| T11 | Routes use assertCompanyAccess | routes/onboarding.ts | `assertCompanyAccess` |
| T12 | Routes emit audit events | routes/onboarding.ts | `emitAudit` |
| T13 | Routes barrel export | routes/index.ts | `onboardingRoutes` |
| T14 | App.ts mounts onboarding routes | app.ts | `onboarding` route mount |

### Backend — Schema (T15-T18)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T15 | onboardingStep column added | schema/companies.ts | `onboarding_step` or `onboardingStep` |
| T16 | onboardingCompleted column added | schema/companies.ts | `onboarding_completed` or `onboardingCompleted` |
| T17 | onboardingData column added | schema/companies.ts | `onboarding_data` or `onboardingData` |
| T18 | Migration file exists | migrations/ | SQL file with onboarding columns |

### Frontend — API Client (T19-T23)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T19 | onboardingApi.getStatus exists | api/onboarding.ts | `getStatus.*companyId` |
| T20 | onboardingApi.updateStep exists | api/onboarding.ts | `updateStep.*companyId` |
| T21 | onboardingApi.complete exists | api/onboarding.ts | `complete.*companyId` |
| T22 | onboardingApi.reset exists | api/onboarding.ts | `reset.*companyId` |
| T23 | API barrel export | api/index.ts | `onboardingApi` |

### Frontend — Query Keys (T24)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T24 | Onboarding query keys exist | lib/queryKeys.ts | `onboarding` key section |

### Frontend — OnboardingProgressBar (T25-T31)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T25 | Component exists and is exported | OnboardingProgressBar.tsx | `export.*OnboardingProgressBar` |
| T26 | data-testid progress-bar | OnboardingProgressBar.tsx | `onb-s01-progress-bar` |
| T27 | data-testid progress-step-1 through 5 | OnboardingProgressBar.tsx | `onb-s01-progress-step-` |
| T28 | Step labels rendered | OnboardingProgressBar.tsx | `onb-s01-step-label-` |
| T29 | Completed state checkmark | OnboardingProgressBar.tsx | `Check` or `checkmark` or `completed` |
| T30 | Current state pulse | OnboardingProgressBar.tsx | `animate-pulse` or `current` |
| T31 | Step icons present | OnboardingProgressBar.tsx | `Building2` or `Bot` or `ListTodo` or icon references |

### Frontend — OnboardingInviteStep (T32-T42)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T32 | Component exists and is exported | OnboardingInviteStep.tsx | `export.*OnboardingInviteStep` |
| T33 | data-testid invite-email | OnboardingInviteStep.tsx | `onb-s01-invite-email` |
| T34 | data-testid invite-role | OnboardingInviteStep.tsx | `onb-s01-invite-role` |
| T35 | data-testid invite-add | OnboardingInviteStep.tsx | `onb-s01-invite-add` |
| T36 | data-testid invite-list | OnboardingInviteStep.tsx | `onb-s01-invite-list` |
| T37 | data-testid invite-send | OnboardingInviteStep.tsx | `onb-s01-invite-send` |
| T38 | data-testid invite-skip | OnboardingInviteStep.tsx | `onb-s01-invite-skip` |
| T39 | Email validation present | OnboardingInviteStep.tsx | `email` validation or `@` check |
| T40 | Role options include 4 roles | OnboardingInviteStep.tsx | `admin.*manager.*contributor.*viewer` or all 4 role values |
| T41 | data-testid invite-success | OnboardingInviteStep.tsx | `onb-s01-invite-success` |
| T42 | data-testid invite-error | OnboardingInviteStep.tsx | `onb-s01-invite-error` |

### Frontend — OnboardingWizard Enhancement (T43-T52)

| ID | Test | File | Assertion |
|----|------|------|-----------|
| T43 | data-testid wizard container | OnboardingWizard.tsx | `onb-s01-wizard` |
| T44 | data-testid step-title | OnboardingWizard.tsx | `onb-s01-step-title` |
| T45 | data-testid next button | OnboardingWizard.tsx | `onb-s01-next` |
| T46 | data-testid back button | OnboardingWizard.tsx | `onb-s01-back` |
| T47 | data-testid complete button | OnboardingWizard.tsx | `onb-s01-complete` |
| T48 | OnboardingProgressBar imported | OnboardingWizard.tsx | `OnboardingProgressBar` import |
| T49 | OnboardingInviteStep imported | OnboardingWizard.tsx | `OnboardingInviteStep` import |
| T50 | Server sync hook present | OnboardingWizard.tsx | `onboardingApi` or `updateStep` or mutation |
| T51 | localStorage persistence | OnboardingWizard.tsx | `localStorage` reference |
| T52 | data-testid sync-status | OnboardingWizard.tsx | `onb-s01-sync-status` |

---

## Notes techniques

- Le wizard existant a 4 etapes (Company, Agent, Task, Launch). ONB-S01 insere "Invite Members" comme etape 4 et pousse "Launch" a etape 5. Le type `Step` passe de `1|2|3|4` a `1|2|3|4|5`.
- L'etat `onboardingStep` cote serveur est un integer simple (0 = pas commence, 1-5 = etape en cours, 6 = complete). Le champ `onboardingCompleted` est un boolean pour le check rapide.
- Le champ `onboardingData` (JSONB) stocke les donnees intermediaires : company name draft, invited emails list, agent config, etc.
- La synchronisation serveur utilise un debounce de 2 secondes pour eviter les appels excessifs.
- Le fallback localStorage utilise la cle `mnm-onboarding-{companyId}` pour stocker l'etat hors-ligne.
- Les invitations utilisent l'API MU-S01 existante (POST /api/invites) avec les champs email + role.
