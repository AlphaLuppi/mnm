---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-12.md']
session_topic: 'Transformation B2B de MnM — multi-user, workflow engine, vues par role, inbox, agent mediateur, anti-shadow-AI'
session_goals: 'Enrichir et challenger les idees du proposal avant discussion avec Tom'
selected_approach: 'ai-recommended'
techniques_used: ['role-playing', 'cross-pollination']
ideas_generated: ['RP1-dashboard-ceo', 'RP2-dashboard-po', 'RP3-dashboard-dev', 'RP4-ceo-workflow-architect', 'RP5-multi-workflow-supervisor', 'RP6-nested-workflows', 'RP7-collaborative-enrichment', 'RP8-chained-output-contracts', 'WI1-agent-proxy-comms', 'WI2-human-as-brain', 'WI3-end-of-misunderstanding', 'WI4-dual-speed-workflow', 'WI5-death-of-planning-poker', 'WI6-brainstorm-only-human-event', 'WI7-container-per-agent', 'WI8-agent-spawned-visualizations', 'WI9-kubernetes-for-ai-agents', 'CP1-kubernetes-model', 'CP2-figma-moment', 'CP3-github-actions-model', 'CP4-human-control-plane', 'CP5-network-policies-governance', 'CP6-docker-api-runtime']
context_file: '_bmad-output/planning-artifacts/sprint-change-proposal-2026-03-12.md'
---

# Brainstorming Session — B2B Gab

**Facilitateur:** Gabri
**Date:** 2026-03-12
**Mise a jour:** 2026-03-17

## Session Overview

**Topic:** Transformation B2B de MnM — multi-user, workflow configurable, vues par role, inbox intelligente, agent mediateur
**Goals:** Enrichir et challenger les idees du Sprint Change Proposal avant discussion avec Tom

### Context

MnM passe de cockpit mono-utilisateur a plateforme B2B type ClickUp ou chaque role Scrum a son espace, ses agents IA, et une Inbox intelligente. L'agent IA est le mediateur entre humains. Le workflow configurable est le pilier central qui determine les vues par role.

**Insight cle :** MnM comme plateforme self-hosted d'ordonnancement d'IA permet de lutter contre la shadow AI en entreprise.

### Technique Selection

**Approche:** AI-Recommended Techniques

**Techniques utilisees:**
- **Role Playing** : Incarner chaque role Scrum pour comprendre leurs besoins dans MnM
- **What If Scenarios** : Explorer des possibilites radicales (via session Tom)
- **Cross-Pollination** : Transferer des solutions d'autres domaines (Kubernetes, Figma, GitHub Actions)

---

## Phase 1 : Role Playing — Incarner les roles Scrum

### Dashboard par role

**[RP #1]**: Dashboard CEO/DSI
_Concept_: Cards specifiques — couverture IA (% equipes sur MnM), velocite par equipe (avant/apres IA), conformite (zero shadow AI), + les existantes (Spend, Health, Agents)
_Novelty_: L'angle "anti-shadow AI" transforme MnM de simple outil de productivite en outil de gouvernance IA

**[RP #2]**: Dashboard PO
_Concept_: Cards — mon backlog par priorite, livrables en attente de ma validation, velocite de mes agents
_Novelty_: Le PO ne voit pas les couts ni la sante technique — il voit son flux de travail metier

**[RP #3]**: Dashboard Dev
_Concept_: Cards — mes issues assignees, statut de mes agents, couverture tests
_Novelty_: Le dev a une vue "pair programming avec l'IA" — ses agents sont ses coequipiers

### Modele agent-workflow

**[RP #4]**: Le CEO comme architecte de workflows
_Concept_: Le CEO/responsable outils concoit les workflows visuellement avec des agents comme noeuds, definit leurs acces, puis invite les humains comme superviseurs de chaque noeud
_Novelty_: L'agent n'est plus attache a une personne mais a un workflow. L'humain supervise, pas possede. Un meme agent couvre plusieurs domaines fonctionnels

**[RP #5]**: L'humain comme superviseur multi-workflow
_Concept_: Un dev peut superviser l'Agent Dev dans le workflow "Feature Pipeline" ET dans le workflow "Hotfix". Sa vue MnM agrege toutes ses supervisions
_Novelty_: Le dashboard n'est plus par role statique mais par participation aux workflows — bien plus adaptatif

**[RP #6]**: Workflows imbriques — global + par agent
_Concept_: Le workflow global definit la sequence des roles (PM -> PO -> Archi -> Lead -> Dev -> QA -> Ops). Chaque noeud du workflow global contient un sous-workflow (les etapes de l'agent). Le CEO fixe le cadre obligatoire, les superviseurs enrichissent leur sous-workflow.
_Novelty_: Deux niveaux d'autonomie — le CEO controle le "quoi", le superviseur controle le "comment" de son agent

**[RP #7]**: Enrichissement collaboratif des workflows
_Concept_: Le superviseur propose des ameliorations a son sous-workflow (nouvelles etapes, conditions). Soumis a approbation ou auto-approuve selon la politique de la company. Les bonnes pratiques remontent naturellement.
_Novelty_: Le workflow n'est pas fige top-down — il s'ameliore bottom-up tout en gardant le cadre

**[RP #8]**: Output chaine comme contrat entre agents
_Concept_: L'output de l'Agent PM est l'input obligatoire de l'Agent PO. Comme un contrat d'interface. Si l'output ne respecte pas le format attendu, la transition est bloquee et le superviseur est notifie.
_Novelty_: Ca force la qualite a chaque etape — l'IA ne peut pas bacler parce que l'etape suivante depend d'un livrable structure

---

## Phase 2 : What If Scenarios + Cross-Pollination

### What If — Idees radicales

**[WI #1]**: Agents comme proxys de communication
_Concept_: L'agent du dev peut directement query l'agent du PO pour obtenir le contexte exact d'une story, sans passer par un humain qui reformule/interprete. La communication inter-roles devient machine-to-machine avec l'humain en superviseur.
_Novelty_: On ne remplace pas le dialogue humain — on le rend inutile pour le transfert d'information factuelle.

**[WI #2]**: L'humain comme cerveau, pas comme bras
_Concept_: Chaque role garde son expertise decisionnelle/critique/creative mais delegue 100% de l'execution a ses agents. Le PO pense les besoins mais n'ecrit plus de stories. Le QA pense les scenarios mais n'ecrit plus de tests.
_Novelty_: Ratio inverse — aujourd'hui 80% execution / 20% reflexion -> demain 20% supervision / 80% reflexion strategique.

**[WI #3]**: La fin du malentendu structurel
_Concept_: Le probleme inter-equipe disparait car les agents partagent un contexte commun queryable. Le "malentendu" n'existe plus car l'information n'est plus traduite/interpretee par des humains.
_Novelty_: On ne resout pas le probleme de communication — on le supprime.

**[WI #4]**: Le dual-speed workflow
_Concept_: MnM gere 2 flux paralleles — un flux "pensee" (humain, asynchrone, brainstorm/decision) et un flux "execution" (machine, continu, code/tests/deploy). L'humain injecte des decisions dans le flux machine quand il est pret.
_Novelty_: On ne force plus les humains a penser au rythme du sprint. Les machines n'attendent plus les humains pour executer.

**[WI #5]**: La mort du planning poker
_Concept_: Si l'execution est machine et continue, la notion de "complexite" d'un ticket et de "velocite" n'a plus de sens. L'IA execute. Le planning devient de la priorisation pure, pas de l'estimation.
_Novelty_: On supprime toute la ceremonie d'estimation qui est un aveu que les humains sont mauvais pour predire.

**[WI #6]**: Le brainstorm comme seul "evenement" humain
_Concept_: Si toute l'execution est automatisee, les seuls moments ou les humains se reunissent c'est pour penser ensemble. Plus de daily, plus de grooming. Juste des sessions de reflexion collective quand il y a un vrai sujet.
_Novelty_: Les reunions ne sont plus des ceremonies de coordination — elles deviennent des sessions de creation pure.

### Architecture container — MnM comme mini-Kubernetes

**[WI #7]**: Architecture container-per-agent
_Concept_: Chaque agent tourne dans son propre container Docker isole avec contexte, skills et permissions reseau definis. Les communications inter-agents sont controlees comme un reseau — le workflow global est un graphe de containers connectes.
_Novelty_: Le cloisonnement est infrastructurel (reseau Docker), pas logiciel. Un agent compromis ou bugge ne peut physiquement pas acceder a ce qui n'est pas dans ses permissions.

**[WI #8]**: Agents qui spawnent des containers de visualisation
_Concept_: Un agent peut generer du code, le deployer dans un nouveau container, et exposer une interface custom qui interagit avec la BDD MnM. N'importe quel utilisateur peut demander "je veux voir X" et un agent construit l'interface.
_Novelty_: MnM devient extensible a l'infini sans que l'equipe core developpe chaque vue. C'est du "UI as a service" par les agents.

**[WI #9]**: MnM comme "Kubernetes for AI agents"
_Concept_: MnM est a l'orchestration d'agents IA ce que Kubernetes est a l'orchestration de microservices. Containers isoles, networking, permissions, scaling, health checks — mais l'interface est metier pas infra.
_Novelty_: Ca n'existe pas aujourd'hui. LangGraph c'est du code. CrewAI c'est mono-process. Personne ne propose un orchestrateur d'agents IA avec isolation container + interface metier + workflow configurable.

### Cross-Pollination — Paralleles avec d'autres domaines

**[CP #1]**: Le modele Kubernetes applique aux agents IA
_Concept_: Mapping K8s -> MnM : Pod=container agent, Namespace=projet, Network Policy=permissions inter-agents, RBAC=supervision humaine, ConfigMap=contexte agent, Health Probe=monitoring, HPA=scaling, CronJob=agent planifie, Ingress=interface humain, Control Plane=dashboard CEO/DSI
_Novelty_: Un vocabulaire et une architecture eprouves a l'echelle, reappliques a un domaine nouveau

**[CP #2]**: Le moment Figma — tout le monde dans le meme espace
_Concept_: Comme Figma a tue l'export PNG, MnM tue l'export de specs/stories entre outils. Tout vit au meme endroit, les agents connectent les contextes en temps reel
_Novelty_: Le handoff inter-roles disparait — il n'y a plus de "j'envoie mon livrable au suivant"

**[CP #3]**: GitHub Actions comme modele de workflow
_Concept_: Workflows visuels = des steps avec containers isoles, secrets scopes, outputs chaines. Le CEO ecrit des "pipelines metier" comme un DevOps ecrit des CI/CD pipelines
_Novelty_: Le workflow metier herite de la robustesse des pipelines CI/CD

**[CP #4]**: Le Control Plane humain
_Concept_: Le CEO/DSI a un "kubectl dashboard" metier — il voit tous les agents qui tournent, leur sante, leur cout, leur throughput. Il peut scaler, stopper, redeployer un agent.
_Novelty_: On donne au management les memes super-pouvoirs que les DevOps ont sur l'infra, mais sur l'IA et les process metier.

**[CP #5]**: Network Policies comme gouvernance IA
_Concept_: Les permissions inter-agents sont des network policies. Le DSI configure ca visuellement. C'est l'anti-shadow-AI au niveau reseau — un agent ne peut physiquement pas faire ce qui n'est pas autorise.
_Novelty_: La gouvernance IA n'est plus du policy document — c'est de l'infrastructure enforced.

**[CP #6]**: Docker API comme runtime d'agents
_Concept_: MnM parle directement a l'API Docker socket pour orchestrer les containers agents. Pas de K8s, pas de Compose statique — du Docker dynamique pilote par le workflow engine. Simple a self-host, puissant pour isoler.
_Novelty_: Le sweet spot entre "tout dans un process" (actuel) et "full K8s" (overkill). MnM devient son propre mini-orchestrateur.

---

## Phase 3 : Pattern Recognition — 5 noyaux de valeur

**Noyau 1 — L'orchestrateur d'agents IA (le moteur)**
MnM est un mini-Kubernetes pour agents IA. Container-per-agent, networking controle, health monitoring, scaling. Le workflow engine est le control plane.
> Idees : WI #7, #8, #9, CP #1, #4, #5, #6

**Noyau 2 — La fin du handoff lossy (la killer feature)**
L'information ne se degrade plus entre les roles. Les agents partagent un contexte commun queryable. Plus de traduction PPT -> Epic -> Story -> Code.
> Idees : WI #1, #3, CP #2

**Noyau 3 — Le dual-speed workflow (le differenciant UX)**
Deux vitesses : humain (reflexion, decision) et machine (execution continue). L'humain n'est plus contraint par le rythme du sprint.
> Idees : WI #4, #5, #6

**Noyau 4 — L'anti-shadow-AI / gouvernance (l'argument de vente DSI)**
Tout passe par MnM. Le DSI voit quels agents font quoi, combien ca coute, qui supervise quoi. Network policies = gouvernance IA enforced par l'infra.
> Idees : WI #9, CP #5

**Noyau 5 — La capture de savoir tacite (la bombe a retardement)**
MnM capture progressivement le savoir tribal (tests dans la tete du QA, contexte metier du PO). Avec le temps, ce savoir devient un actif numerique.
> Idees : WI #2

---

## Phase 4 : Vision actionnable — Sequence MVP B2B

### Etat des lieux (branche tom-paperclip)

Tom a deja implemente :
- Auth / Login (Auth.tsx)
- Page Invitation (InviteLanding.tsx)
- Company Settings (CompanySettings.tsx, 770 lignes)
- Organigramme (Org.tsx + OrgChart.tsx)
- Inbox (Inbox.tsx, 974 lignes — filtres, categories, tabs)
- Workflows avec stages (Workflows.tsx, WorkflowDetail.tsx, NewWorkflow.tsx)
- API workflows + templates

### Ce qui reste pour le MVP B2B

**Etape 1 — Roles metier + permissions (~2 semaines)**
- Roles metier (PO, PM, Dev, Lead, QA, Designer) au-dela de admin/member
- Permissions par role — qui voit quoi, qui fait quoi
- Dashboard derive du role/workflow

**Etape 2 — Container-per-agent (~3 semaines)**
- MnM parle a l'API Docker socket pour spawner des containers
- Chaque agent = un container isole avec son contexte, ses skills, ses permissions
- Health checks, logs, kill natifs Docker
- Network Docker par workflow (isolation inter-agents)

**Etape 3 — Editeur visuel de workflow (~3 semaines)**
- React Flow pour l'editeur drag & drop
- Workflows a 2 niveaux : global (pipeline entre roles) + par agent (sous-workflow)
- Templates Scrum/Kanban comme point de depart
- Output chaine entre agents (contrat d'interface)

**Etape 4 — Enrichissement Inbox + contextualisation agent (~2 semaines)**
- L'agent enrichit les notifications avec le contexte pertinent
- Notifications de transitions workflow
- Communication agent-mediee entre humains

**Total estime : ~10 semaines** a partir de l'existant de Tom.

### Points ouverts pour Tom

1. Architecture container — Docker API directe vs lib wrapper ?
2. Workflow engine backend — bpmn-engine vs custom ? Tom a deja des stages dans les workflows
3. Editeur visuel — React Flow, niveau de complexite Phase 1 ?
4. Network policies inter-agents — iptables Docker natif vs abstraction MnM ?
5. Runtime K8s — a terme si besoin de scaler a 500+ agents, mais Docker Compose suffit pour le MVP
