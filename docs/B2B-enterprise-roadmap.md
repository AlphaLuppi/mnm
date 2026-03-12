# MnM Enterprise — Roadmap B2B Transformation Digitale

> Transformer MnM d'un outil mono-utilisateur en plateforme B2B vendable à des grandes entreprises en cours de transformation digitale.

---

## 1. Etat actuel de MnM

MnM est aujourd'hui un outil mono-utilisateur permettant d'orchestrer une entreprise virtuelle d'agents IA : companies, projets, agents avec rôles (CEO, CTO, PM, Dev, QA, Designer), workflows, issues, goals — piloté depuis un dashboard unique.

### Stack

- Monorepo pnpm : `packages/shared`, `packages/db`, `server` (Express+tsx), `ui` (React+Vite)
- DB : PostgreSQL embedded (`~/.mnm/instances/default/db`), Drizzle ORM
- UI : React Query, Tailwind, shadcn/ui
- Agents : adapter `claude_local` + autres

---

## 2. Ce qui existe deja pour le multi-user

| Couche | Statut | Detail |
|--------|--------|--------|
| **Auth (login/signup/sessions)** | Complet | Better Auth, email+password, cookies, sessions DB |
| **UI Auth** | Complet | Page login/signup, route guards, redirect `/auth` |
| **Multi-company** | Complet | Un user = N companies, company switcher (rail gauche), localStorage |
| **Isolation company** | Complet | Toutes les routes passent par `assertCompanyAccess`, toutes les queries UI scopees par `companyId` |
| **Invitations** | Backend complet | Tokens hashes SHA256, TTL, join requests, approbation. **UI seulement pour agents, pas pour humains** |
| **Permissions admin** | Partiel | 6 cles : `agents:create`, `users:invite`, `users:manage_permissions`, `tasks:assign`, `tasks:assign_scope`, `joins:approve` |
| **Instance admin** | Complet | Super-admin technique via `instanceUserRoles` |
| **Mode deploiement** | Prevu | `local_trusted` (solo) vs `authenticated` (multi-user) + `private`/`public` exposure |

---

## 3. Ce qui manque — les 3 trous identifies

### Trou 1 — Pas de roles metier pour les users humains

- `AGENT_ROLES` (ceo, cto, pm, dev...) = roles des agents IA, pas des humains
- `membershipRole` sur `companyMemberships` existe mais vaut toujours `"member"`
- Aucun preset de permissions par role

### Trou 2 — Pas de scoping sous-company

- L'acces est binaire : membre de la company → voit TOUT (tous projets, agents, workflows, issues)
- Le champ `scope` (JSONB) sur `principalPermissionGrants` est stocke mais **jamais lu**
- Impossible de dire "ce PO ne voit que le projet X et les agents Y et Z"

### Trou 3 — UI d'administration manquante

- Pas de bouton "Inviter un humain"
- Pas de page "Membres" par company
- Pas de page profil/settings user
- Pas de bouton sign-out
- Pas d'UI d'attribution de permissions/roles

---

## 4. Vision produit

> MnM devient la **tour de controle** qu'une grande entreprise utilise pour piloter sa transformation digitale : chaque partie prenante (CEO, CTO, PM, PO, Lead, Dev, QA, Designer) se connecte, voit **son** perimetre, pilote **ses** agents IA, suit **ses** KPIs, dans un espace partage ou la strategie cascade du top vers l'execution.

### Architecture cible

```
Instance MnM (deployee chez le client ou SaaS)
|
+-- Holding / Groupe (instance_admin = DSI ou CEO groupe)
|
+-- Company "BU France"
|   +-- CEO (role: admin)       -> voit tout, budgets, approvals
|   +-- CTO (role: tech_lead)   -> archi, agents tech, workflows dev
|   +-- PM  (role: manager)     -> roadmaps, projets assignes, agents produit
|   +-- Dev (role: contributor) -> ses issues, ses agents, son workspace
|   +-- Agent CEO IA            -> strategie, reporting
|   +-- Agent Dev IA            -> code, reviews
|   +-- Agent QA IA             -> tests, bugs
|
+-- Company "BU USA"
|   +-- (meme structure, equipe differente)
|
+-- Company "Projet Transverse Migration Cloud"
    +-- (membres cross-BU avec acces scope)
```

---

## 5. Plan d'implementation

### PHASE 1 — Multi-user livrable (MVP B2B) — ~1 semaine

**Objectif** : le CEO peut inviter des humains, chacun ne voit que ses companies.

| Tache | Effort | Impact |
|-------|--------|--------|
| Bouton "Inviter un membre" dans CompanySettings | 1j | Debloque le multi-user |
| Page "Membres" par company (liste, suspend, remove) | 1j | Admin basique |
| Bouton sign-out dans le header | 0.5j | Indispensable |
| Desactiver signup libre (`authDisableSignUp: true`) | 0.5j | Securite entreprise |
| Page profil user (nom, email, changer mdp) | 1j | Basique attendu |
| Migration PostgreSQL externe (plus d'embedded) | 1j | Production-ready |

**Livrable** : CEO cree les companies, invite les gens par email, chacun ne voit que ses companies. Tout le monde voit tout dans sa company.

---

### PHASE 2 — RBAC metier — ~2 semaines

**Objectif** : chaque user a un role qui determine ce qu'il peut FAIRE.

| Tache | Effort |
|-------|--------|
| Definir les roles metier : `admin`, `manager`, `contributor`, `viewer` | 1j |
| Etendre `PERMISSION_KEYS` : `projects:create`, `workflows:create`, `workflows:execute`, `issues:create`, `issues:assign`, `goals:manage`, `costs:view`, `company:settings`, `members:manage` | 2j |
| Creer les presets de permissions par role | 1j |
| Brancher `access.canUser()` dans chaque route manquante | 3j |
| UI : selecteur de role a l'invitation + page admin permissions | 2j |
| UI : masquer les elements de navigation selon les permissions | 1j |

**Livrable** : le CEO invite un PO en tant que `manager` → le PO peut creer des issues et piloter des workflows mais ne peut pas toucher aux budgets ni aux settings company. Un `viewer` peut juste regarder.

---

### PHASE 3 — Scoping par projet/workspace — ~2-3 semaines

**Objectif** : un user ne voit que les projets/agents/workflows auxquels il est assigne.

| Tache | Effort |
|-------|--------|
| Table `project_memberships` (userId, projectId, role) | 1j |
| Modifier `hasPermission()` pour lire et filtrer par `scope` | 2j |
| Modifier toutes les routes `list` pour filtrer par project membership | 3-4j |
| Scoping des agents : un user ne voit que les agents de ses projets/workspaces | 2j |
| Scoping des workflows : idem | 1j |
| UI : page "Acces" par projet (ajouter/retirer des membres) | 2j |
| UI : filtrer la sidebar/navigation selon les projets accessibles | 2j |

**Livrable** : le CEO assigne le PO au "Projet Migration ERP", le PO ne voit que ce projet, ses agents et ses workflows. Le CEO voit tout.

---

### PHASE 4 — Enterprise-grade — ~3-4 semaines

**Objectif** : vendable a un grand compte.

| Tache | Effort |
|-------|--------|
| SSO (SAML/OIDC) — integration AD/Okta/Azure AD | 3-4j |
| Audit log complet (qui a fait quoi, quand) | 3j |
| Rate limiting + throttling API | 2j |
| Dashboards par role (le CEO ne voit pas le meme home que le Dev) | 3-5j |
| Multi-tenant SaaS (isolation DB ou row-level security) | 3-5j |
| Email transactionnel (invitations, notifications) | 2j |
| Backup/restore, health monitoring | 2j |
| Documentation admin + onboarding wizard | 2-3j |

---

## 6. Resume du chemin

```
Aujourd'hui          Phase 1           Phase 2          Phase 3          Phase 4
+----------+    +--------------+  +------------+  +-------------+  +--------------+
| 1 user   |--->| Multi-user   |->| RBAC       |->| Scoping     |->| Enterprise   |
| tout     |    | par company  |  | par role   |  | par projet  |  | SSO, audit,  |
| voit tout|    | invite+login |  | qui fait   |  | qui voit    |  | SaaS-ready   |
+----------+    +--------------+  | quoi       |  | quoi        |  +--------------+
                    ~1 sem        +------------+  +-------------+      ~3-4 sem
                                     ~2 sem          ~2-3 sem
```

**Total estime : ~8-10 semaines** pour passer de "outil perso" a "produit B2B vendable a des entreprises en transformation digitale".

---

## 7. Fichiers cles de reference

### Database Schema
- Auth : `packages/db/src/schema/auth.ts`
- Access Control : `packages/db/src/schema/{companies.ts, company_memberships.ts, instance_user_roles.ts, principal_permission_grants.ts, invites.ts, join_requests.ts}`

### Server Auth & Middleware
- Better Auth Setup : `server/src/auth/better-auth.ts`
- Request Actor Middleware : `server/src/middleware/auth.ts`
- Authorization Helpers : `server/src/routes/authz.ts`
- Access Service : `server/src/services/access.ts`

### Shared Types & Validators
- Constants (PERMISSION_KEYS, AGENT_ROLES, etc.) : `packages/shared/src/constants.ts`
- Types : `packages/shared/src/types/access.ts`
- Validators : `packages/shared/src/validators/{access.ts, index.ts}`

### UI
- Auth page : `ui/src/pages/Auth.tsx`
- Company context : `ui/src/context/CompanyContext.tsx`
- Company switcher : `ui/src/components/CompanyRail.tsx`
- Access API client : `ui/src/api/access.ts`
