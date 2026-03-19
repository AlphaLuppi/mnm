# Sprint Change Proposal — MnM B2B Transformation

**Date** : 2026-03-12 (maj 2026-03-17)
**Auteur** : Gabri (avec Claude)
**A discuter avec** : Tom
**Statut** : Draft enrichi par brainstorming Gab + session Tom

---

## 1. Resume du changement

### Probleme
MnM est concu sur le paradigme "1 humain supervise N agents IA". Ce modele ne convient pas pour la vente B2B a des entreprises, ou les equipes existantes (PO, PM, Dev, Lead, QA, Designer, CEO, DSI) doivent pouvoir exercer leur metier dans la plateforme.

### Declencheur
- Besoin business : vendre MnM a des grandes entreprises en transformation digitale
- Contrainte marche francais : protection de l'emploi, preservation des competences
- Constat produit : impossible d'inviter des humains, de communiquer entre humains, ou de definir des vues par role
- Opportunite : MnM self-hosted = anti-shadow-AI pour les DSI

### Vision cible
MnM = un **mini-Kubernetes pour agents IA** avec une couche metier par-dessus. Chaque role Scrum a son espace, ses agents IA dans des containers isoles, et une Inbox intelligente ou l'IA contextualise les echanges. Le workflow configurable est le pilier central.

---

## 2. Principes directeurs

1. **L'humain est l'acteur, l'agent est l'assistant** — l'agent est un noeud du workflow, pas un assistant personnel
2. **Le workflow est le pilier central** — 2 niveaux : global (pipeline entre roles) + par agent (sous-workflow)
3. **Container-per-agent** — chaque agent tourne dans un container Docker isole avec contexte, skills et permissions reseau
4. **L'Inbox est le hub de communication** — toute notification et echange y converge, contextualise par les agents
5. **Anti-shadow-AI** — tout passe par MnM, le DSI a un control plane sur toute l'IA de sa boite
6. **Dual-speed** — reflexion humaine asynchrone + execution machine continue

---

## 3. Les 5 noyaux de valeur (issus du brainstorming)

**Noyau 1 — L'orchestrateur d'agents IA**
MnM est a l'orchestration d'agents IA ce que Kubernetes est a l'orchestration de microservices. Container-per-agent via Docker API, networking controle, health monitoring. Le workflow engine est le control plane.

**Noyau 2 — La fin du handoff lossy**
L'information ne se degrade plus entre les roles. Les agents partagent un contexte commun queryable. Agent-to-agent communication remplace le telephone arabe humain.

**Noyau 3 — Le dual-speed workflow**
Deux vitesses : humain (reflexion, decision, brainstorm) et machine (execution continue). L'humain n'est plus contraint par le rythme du sprint. Mort du planning poker — l'IA execute, le planning devient de la priorisation pure.

**Noyau 4 — L'anti-shadow-AI / gouvernance**
Tout passe par MnM. Le DSI voit quels agents font quoi, combien ca coute. Network policies Docker = gouvernance IA enforced par l'infrastructure, pas par des documents de policy.

**Noyau 5 — La capture de savoir tacite**
MnM capture progressivement le savoir tribal (tests dans la tete du QA, contexte metier du PO). Actif numerique qui survit aux departs.

---

## 4. Architecture cible

### Modele container-per-agent

```
MnM Platform (Docker Compose)
|
|-- Container Server (Express + API + WebSocket)
|-- Container PostgreSQL
|
|-- Container Agent PM    <- contexte PM, skills, acces definis
|-- Container Agent PO    <- contexte PO, skills, acces definis
|-- Container Agent Dev   <- contexte Dev, acces repo
|-- Container Agent QA    <- contexte QA, acces tests
|
|-- Reseau inter-agents   <- network policies Docker
|   PM --> PO (ok)
|   PO --> Dev (ok)
|   Dev --> PM (bloque)
|
|-- Container Visualisation custom  <- spawne par un agent
    <- heberge une UI custom qui tape dans la BDD MnM
```

### Mapping Kubernetes -> MnM

| Kubernetes | MnM |
|---|---|
| Pod | Container agent |
| Deployment | Workflow step |
| Service | Agent endpoint |
| Namespace | Projet / Equipe |
| Network Policy | Permissions inter-agents |
| RBAC | Supervision humaine |
| ConfigMap / Secret | Contexte agent / Credentials |
| Health Probe | Agent monitoring |
| HPA | Scaling d'agents |
| CronJob | Agent planifie |
| Control Plane | Dashboard CEO/DSI |

### Stack technique recommandee

- **Runtime agents** : Docker API directe (pas K8s pour le MVP, migration possible plus tard)
- **Editeur workflow** : React Flow (drag & drop, 34k stars GitHub)
- **Backend workflow** : a determiner avec Tom — bpmn-engine vs extension du systeme de stages existant
- **Frontend** : React 19 existant (Paperclip fork)
- **Backend** : Express existant
- **BDD** : PostgreSQL existant

---

## 5. Plan d'action revise

### Etat des lieux — Ce que Tom a deja fait (branche tom-paperclip)

| Feature | Statut | Fichier |
|---|---|---|
| Auth / Login | OK | Auth.tsx |
| Page Invitation | OK | InviteLanding.tsx |
| Company Settings | OK | CompanySettings.tsx (770 lignes) |
| Organigramme | OK | Org.tsx + OrgChart.tsx |
| Inbox | OK | Inbox.tsx (974 lignes, filtres, categories, tabs) |
| Workflows + stages | OK | Workflows.tsx, WorkflowDetail.tsx, NewWorkflow.tsx |
| API workflows + templates | OK | workflowsApi, workflowTemplatesApi |

### Ce qui reste — Sequence MVP B2B

**Etape 1 — Roles metier + permissions (~2 semaines)**
- Roles metier (PO, PM, Dev, Lead, QA, Designer) au-dela de admin/member
- Permissions par role : qui voit quoi, qui fait quoi
- Dashboard derive du role/workflow (les MetricCards existent deja)

**Etape 2 — Container-per-agent (~3 semaines)**
- MnM parle a l'API Docker socket pour spawner des containers a la volee
- Chaque agent = container isole avec contexte, skills, permissions
- Health checks, logs, kill natifs Docker
- Network Docker par workflow (isolation inter-agents)
- Migration progressive depuis le modele actuel (spawn subprocess)

**Etape 3 — Editeur visuel de workflow (~3 semaines)**
- React Flow pour l'editeur drag & drop
- Workflows 2 niveaux : global (pipeline entre roles) + par agent (sous-workflow)
- Templates Scrum/Kanban comme point de depart
- Output chaine entre agents (contrat d'interface entre steps)
- Le superviseur peut proposer des enrichissements de sous-workflow (approuvable ou non)

**Etape 4 — Enrichissement Inbox + contextualisation agent (~2 semaines)**
- L'agent enrichit les notifications avec le contexte pertinent
- Notifications de transitions workflow (etape X terminee -> notif au superviseur etape X+1)
- Communication agent-mediee entre humains (query contexte de l'autre agent)

**Total estime : ~10 semaines** a partir de l'existant.

### Post-MVP

- Network policies avancees (editeur visuel des permissions inter-agents)
- Agents qui spawnent des containers de visualisation custom
- Agent d'onboarding qui scanne l'existant d'une entreprise et propose des workflows
- Capture de savoir tacite (formalisation progressive du savoir QA, PO etc.)
- Migration K8s si besoin de scaler a 500+ agents

---

## 6. Points ouverts pour discussion avec Tom

1. **Container runtime** — Docker API directe : quelle lib Node.js ? dockerode ? Comment gerer le lifecycle ?
2. **Workflow engine backend** — Tom a deja des stages dans les workflows. On etend ca ou on part sur bpmn-engine ?
3. **Editeur visuel** — React Flow, quel niveau de complexite Phase 1 ? Lineaire + conditions suffit ?
4. **Network policies** — Docker networks natifs ou abstraction MnM ? Quelle granularite ?
5. **Migration progressive** — Comment passer du modele actuel (subprocess) a container-per-agent sans tout casser ?
6. **Scope MVP B2B demo** — Quelle feature minimale pour une premiere demo client ?

---

## 7. Classification du changement

**Scope : MAJEUR** — Reorientation produit fondamentale

**Handoff** :
- **Tom (Architecte/Dev)** : Valider l'archi container-per-agent, evaluer Docker API vs alternatives, proposer le plan technique
- **Gabri (Produit)** : Valider la vision, prioriser les etapes, definir le scope MVP B2B, preparer le pitch client
- **Ensemble** : Trancher les points ouverts, redefinir les epics, merger les brainstorms (Tom + Gab)

**Brainstorming associe** : `_bmad-output/brainstorming/B2B-Gab-2026-03-12.md` (23 idees) + session Tom (brainstorming-session-2026-03-12.md, 29 verites)
