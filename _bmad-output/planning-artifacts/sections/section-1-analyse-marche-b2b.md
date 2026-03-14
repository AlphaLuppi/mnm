# Section 1 — Analyse Marché B2B & Paysage Concurrentiel

**Auteur :** Mary l'Analyste (Business Analyst Senior)
**Date :** 2026-03-13
**Sources :** 57 vérités fondamentales du brainstorming, B2B Enterprise Roadmap, Nanoclaw Analysis, recherches marché actualisées

---

## 1. Analyse du Marché B2B de l'Orchestration d'Agents IA

### 1.1 Taille du marché et projections

Le marché de l'orchestration IA connaît une croissance explosive. Les données actuelles montrent :

| Segment | 2025 | 2026 (estimé) | 2030 (projeté) | CAGR |
|---------|------|---------------|----------------|------|
| **Marché de l'orchestration IA** | 11,02 Mrd USD | ~13,5 Mrd USD | 30,23 Mrd USD | 22,3% |
| **Marché des agents IA** | 7,63 Mrd USD | 10,91 Mrd USD | ~65 Mrd USD | 49,6% |
| **Agents IA autonomes** | ~5 Mrd USD | 8,5 Mrd USD | 35 Mrd USD | ~45% |

**Projection Gartner :** Les agents IA commanderont 15 000 milliards USD en achats B2B d'ici 2028 — signalant que l'agent IA devient un acteur économique à part entière, pas juste un outil.

### 1.2 Tendances structurantes (mars 2026)

**Tendance 1 — Du chatbot à l'agent exécutant.** Le marché passe des assistants conversationnels (répondre à des questions) aux agents qui exécutent des actions dans les systèmes live : mises à jour de comptes, demandes IT, approbations procurement. C'est exactement le positionnement de MnM (vérité #33 : "l'entreprise autonome avec l'humain en go/no-go").

**Tendance 2 — La gouvernance comme différenciateur.** Deloitte souligne que les plateformes d'orchestration leaders sont celles qui traduisent les intentions en langage naturel en **actions step-by-step, liées à des politiques**, avec audit trail. C'est le noyau 1 de MnM (orchestrateur déterministique) + le noyau 2 (observabilité & audit).

**Tendance 3 — Multi-agent plutôt que mono-agent.** L'industrie converge vers des architectures où plusieurs agents spécialisés collaborent via des protocoles standardisés (A2A de Google, MCP d'Anthropic). Microsoft a fusionné AutoGen + Semantic Kernel dans le Microsoft Agent Framework (RC le 19 février 2026). MnM est nativement multi-agent avec communication inter-agents (noyau 4).

**Tendance 4 — Human-in-the-loop obligatoire en enterprise.** Les entreprises exigent des points de validation humaine dans les workflows automatisés. Le curseur d'automatisation de MnM (manuel → assisté → auto, vérité #30) répond directement à cette exigence.

**Tendance 5 — L'ère de l'IDE agentique.** Cursor ($29,3 Mrd de valorisation, $1 Mrd ARR) et Windsurf ($30M ARR enterprise, croissance 500% YoY) prouvent que les développeurs adoptent massivement les outils IA. Plus de la moitié du Fortune 500 utilise Cursor. Mais ces IDE restent du dev-only — ils ne connectent pas le dev au reste de l'organisation.

### 1.3 Maturité du marché — Analyse par segment

| Segment | Maturité | Leaders | Gap MnM |
|---------|----------|---------|---------|
| **IDE IA (dev)** | Mature | Cursor, Windsurf, Claude Code | MnM n'est PAS un IDE — il orchestre les IDE |
| **Gestion de projet** | Mature (+ IA naissante) | Jira, Linear, ClickUp | MnM remplace la couche workflow, pas les tickets |
| **Frameworks d'agents** | Émergent | CrewAI, LangGraph, AutoGen/MS Agent | MnM est au-DESSUS des frameworks — il les contrôle |
| **Orchestration déterministique** | Quasi-inexistant | — | **C'est le white space de MnM** |
| **Supervision multi-rôle** | Inexistant | — | **C'est le blue ocean de MnM** |

**Conclusion marché :** Le marché est en pleine structuration. Il y a des outils pour coder (IDE), des outils pour tracker (PM), des frameworks pour construire des agents. Mais **personne ne propose une plateforme unifiée qui orchestre de manière déterministique des agents sur toute la chaîne de valeur d'une entreprise**, avec audit, permissions multi-rôles, et adoption progressive. C'est le positionnement unique de MnM.

---

## 2. Paysage Concurrentiel Détaillé

### 2.1 Outils de Gestion de Projet (Jira, Linear, ClickUp)

#### Jira (Atlassian)

| Aspect | Détail |
|--------|--------|
| **Ce qu'il fait** | Standard enterprise pour le suivi de projet. Février 2026 : lancement "Agents in Jira" — assigner des tâches à des agents IA comme à des humains, suivi de progression, deadlines. Contexte Confluence + historique issues. Score IA : 30/50. |
| **Ce qu'il ne fait PAS (et que MnM fera)** | (1) Workflows déterministiques imposés aux agents — les agents Jira opèrent librement sans garantie de compliance au process. (2) Orchestration inter-rôles — Jira ne modélise pas la chaîne CEO → CTO → PM → PO → Dev → QA. (3) Drift detection — aucune alerte si un agent dévie. (4) Dual-speed workflow — pas de distinction entre vitesse humaine (réflexion) et vitesse machine (exécution). (5) Capture du savoir tacite — Jira stocke des tickets, pas la connaissance contextuelle. |

#### Linear

| Aspect | Détail |
|--------|--------|
| **Ce qu'il fait** | UX rapide et épurée, triage IA automatique (routage, détection duplicats, suggestion d'assignation). Génération instantanée de sous-issues et critères d'acceptation. Populaire chez les startups et équipes engineering modernes. |
| **Ce qu'il ne fait PAS (et que MnM fera)** | (1) Multi-rôle — Linear est fait pour les devs, pas pour CEO/PM/Designer/QA dans le même outil. (2) Agents d'exécution — Linear génère du contenu mais n'exécute pas de code, de tests, de reviews. (3) Workflows configurables par niveau hiérarchique — pas de cascade onboarding (vérité #35). (4) Mode oral vs visuel — pas de dual-mode configuration (vérité #41). (5) Connecteurs auto-générés — pas de capacité d'intégration agent-driven. |

#### ClickUp

| Aspect | Détail |
|--------|--------|
| **Ce qu'il fait** | Suite tout-en-un (docs, whiteboards, sprints, goals). ClickUp Brain : agents IA qui exécutent des actions dans le workspace, Enterprise AI Search cross-tasks/docs/discussions. Score IA : 32/50 (meilleur score actuel). Sprint planning en langage naturel. |
| **Ce qu'il ne fait PAS (et que MnM fera)** | (1) Orchestration déterministique — ClickUp Brain est probabiliste, pas contraint par un workflow imposé. (2) Containerisation/isolation — aucun sandboxing des agents. (3) Audit trail des agents — pas de traçabilité action par action de ce que l'agent a fait et pourquoi. (4) Permissions agent-to-agent — les agents partagent tout, pas de human-in-the-loop pour le partage inter-agents (vérité #48). (5) Compaction management — aucune gestion du contexte long des agents (vérité #37). |

### 2.2 IDE IA (Cursor, Windsurf)

#### Cursor (Anysphere)

| Aspect | Détail |
|--------|--------|
| **Ce qu'il fait** | IDE IA dominant. $29,3 Mrd de valorisation (Series D nov. 2025). $1 Mrd+ ARR. 1M+ devs quotidiens. Plus de 50% du Fortune 500. Completion, chat, agent mode, multi-fichier. |
| **Ce qu'il ne fait PAS (et que MnM fera)** | (1) Multi-rôle — Cursor est exclusivement pour les développeurs. Le CEO, PM, PO, QA, Designer n'y ont pas accès. (2) Workflow orchestration — Cursor est un outil individuel, pas un orchestrateur d'entreprise. (3) Visibilité managériale — aucun dashboard pour le management. (4) Workflows déterministiques — l'agent Cursor fait ce qu'il veut dans le code. (5) Coordination inter-agents — pas de communication agent-to-agent (vérité #48). (6) Audit centralisé — les logs restent sur le poste du dev (vérité #40). |

#### Windsurf (Codeium → Cognition AI)

| Aspect | Détail |
|--------|--------|
| **Ce qu'il fait** | IDE enterprise-first. FedRAMP High + HIPAA. $30M ARR enterprise (croissance 500% YoY). 1M+ devs. Modèles propriétaires (Fast Context, SWE-1.5). Codemaps pour navigation intelligente. Pilotes chez Uber, Coinbase. |
| **Ce qu'il ne fait PAS (et que MnM fera)** | Mêmes limitations que Cursor PLUS : (1) Malgré son positionnement enterprise, Windsurf reste un IDE — il ne connecte pas le dev au PM, au PO, au QA. (2) Pas de supervision multi-agent — un dev, un agent, pas d'orchestration. (3) Pas de capture du savoir tribal — le QA qui connaît les edge cases métier n'a pas sa place (vérité #27). |

### 2.3 Frameworks d'Agents (CrewAI, AutoGen/Microsoft Agent Framework, LangGraph)

#### CrewAI

| Aspect | Détail |
|--------|--------|
| **Ce qu'il fait** | Framework open source d'agents multi-agents role-based. Modèle inspiré des structures organisationnelles réelles (rôles, tâches, objectifs). Time-to-production 40% plus rapide que LangGraph pour les workflows business standard. Licencing commercial + support enterprise. |
| **Ce qu'il ne fait PAS (et que MnM fera)** | (1) Pas de UI — c'est un framework code-only, inaccessible aux non-devs. (2) Pas de déterminisme imposé — les rôles sont des prompts, pas des contraintes algorithmiques (vérité #36). (3) Pas d'onboarding enterprise — pas d'import Jira, pas de cascade hiérarchique. (4) Pas d'observabilité intégrée — il faut brancher Langfuse ou autre manuellement. (5) Pas de gestion de compaction — aucune protection contre la perte de contexte (vérité #44). |

#### Microsoft Agent Framework (ex-AutoGen + Semantic Kernel)

| Aspect | Détail |
|--------|--------|
| **Ce qu'il fait** | Framework fusionné (RC 19 février 2026, GA prévu mars 2026). Graph-based workflows, protocoles A2A et MCP, streaming, checkpointing, human-in-the-loop. Python + .NET. Intégration Azure. Soutien Microsoft. |
| **Ce qu'il ne fait PAS (et que MnM fera)** | (1) Framework = briques, pas produit fini. Il faut CONSTRUIRE sa plateforme dessus. MnM EST le produit fini. (2) Lock-in Azure — le choix naturel pour les équipes Azure, mais pas agnostique. MnM est agnostique (vérité #42). (3) Pas de UI de supervision — pas de cockpit multi-rôle. (4) Pas de drift detection — les workflows sont durable mais pas monitorés pour la déviance. (5) Pas de modèle d'adoption progressive — pas de curseur manuel → assisté → auto. |

#### LangGraph (LangChain)

| Aspect | Détail |
|--------|--------|
| **Ce qu'il fait** | Graph-based workflow avec durable execution. 30-40% meilleure latence que les alternatives. Parallel processing natif. Perte de travail empêchée par checkpointing. Human-in-the-loop patterns. Support enterprise + consulting LangChain. |
| **Ce qu'il ne fait PAS (et que MnM fera)** | (1) Comme CrewAI : framework code-only, pas de UI. (2) Pas de modèle multi-rôle enterprise — pas de CEO, PM, Dev, QA dans le même système. (3) Pas de containerisation d'agents — les agents tournent dans le même process. (4) Pas d'import/migration depuis les outils existants. (5) Le graph est défini par le dev, pas par le workflow métier — l'abstraction est technique, pas organisationnelle. |

### 2.4 Matrice de synthèse concurrentielle

| Capacité | Jira | Linear | ClickUp | Cursor | Windsurf | CrewAI | MS Agent | LangGraph | **MnM** |
|----------|------|--------|---------|--------|----------|--------|----------|-----------|---------|
| Multi-rôle (CEO→Dev) | Partiel | Non | Partiel | Non | Non | Non | Non | Non | **Oui** |
| Workflows déterministiques | Non | Non | Non | Non | Non | Non | Partiel | Partiel | **Oui** |
| Agents d'exécution | Naissant | Non | Basique | Oui | Oui | Oui | Oui | Oui | **Oui** |
| Drift detection | Non | Non | Non | Non | Non | Non | Non | Non | **Oui** |
| Audit centralisé | Basique | Non | Basique | Non | Non | Non | Non | Non | **Oui** |
| Containerisation agents | Non | Non | Non | Sandbox | Non | Non | Non | Non | **Oui** |
| Dual-speed workflow | Non | Non | Non | Non | Non | Non | Non | Non | **Oui** |
| Curseur automatisation | Non | Non | Non | Non | Non | Non | Partiel | Partiel | **Oui** |
| Import Jira/Linear | N/A | N/A | N/A | Non | Non | Non | Non | Non | **Oui** |
| Gestion compaction | Non | Non | Non | Non | Non | Non | Checkpoint | Checkpoint | **Oui** |
| UI non-technique | Oui | Oui | Oui | Non | Non | Non | Non | Non | **Oui** |
| Open Source | Non | Non | Non | Non | Non | Oui | Oui | Oui | **Oui** |

---

## 3. Requirements Business Extraits des 57 Vérités

Chaque vérité du brainstorming qui implique un besoin business a été traduite en requirement formel.

### 3.1 Requirements d'Orchestration (Noyau 1)

| Vérité | Besoin identifié | Requirement Business |
|--------|-----------------|---------------------|
| #36 — Workflows déterministiques, PAS confiés à l'IA | Les agents doivent suivre un process défini, pas l'interpréter | **REQ-ORCH-01** : Le système DOIT imposer algorithmiquement les étapes d'un workflow aux agents, sans laisser l'IA décider de l'ordre ou du contenu des étapes. |
| #37 — Gestion de contexte = avantage différenciateur | La compaction fait perdre le workflow aux agents | **REQ-ORCH-02** : Le système DOIT réinjecter les pré-prompts et informations critiques du workflow après chaque compaction de contexte d'un agent. |
| #44 — Compaction = responsabilité plateforme | L'agent ne gère pas sa propre mémoire | **REQ-ORCH-03** : Le système DOIT fournir 2 stratégies de gestion de compaction : (A) kill + relance avec contexte frais, (B) réinjection post-compaction. |
| #45 — Le contrôle déterministique est un vrai besoin | Le CTO a été frustré par des agents non-contrôlés | **REQ-ORCH-04** : L'administrateur DOIT pouvoir définir les fichiers/prompts obligatoires chargés par un agent à chaque étape d'un workflow. |
| #54 — Drift detection = argument enterprise | Monitoring de déviance des agents | **REQ-ORCH-05** : Le système DOIT détecter et alerter quand un agent dévie du workflow défini (drift detection). |

### 3.2 Requirements d'Observabilité & Audit (Noyau 2)

| Vérité | Besoin identifié | Requirement Business |
|--------|-----------------|---------------------|
| #39 — Observabilité simplifiée = prérequis de confiance | Les logs bruts sont illisibles | **REQ-OBS-01** : Le système DOIT fournir un résumé LLM temps réel des actions de chaque agent (pas juste des logs bruts). |
| #40 — Audit centralisé = argument B2B | Debug sans accéder au poste de la personne | **REQ-OBS-02** : Le système DOIT centraliser tous les logs d'actions d'agents avec traçabilité complète (qui, quoi, quand, dans quel workflow). |
| #20 — Transparence managériale = deal-breaker | Les devs ne doivent pas se sentir fliqués | **REQ-OBS-03** : Les dashboards management DOIVENT afficher des données agrégées, JAMAIS des métriques individuelles identifiables par le management. |
| #3 — Décisions non-documentées | Connaissance qui disparaît | **REQ-OBS-04** : Le système DOIT tracer automatiquement les décisions prises pendant l'exécution d'un workflow (corrections, ajustements, choix de l'agent). |

### 3.3 Requirements d'Onboarding & Configuration (Noyau 3)

| Vérité | Besoin identifié | Requirement Business |
|--------|-----------------|---------------------|
| #35 — Onboarding = cascade hiérarchique | Chaque niveau définit le suivant | **REQ-ONB-01** : Le système DOIT supporter un onboarding en cascade : CEO définit la structure → CTO raffine → Leads raffinent → opérationnels configurent leurs agents. |
| #41 — Dual-mode configuration | Oral (CEO) vs visuel (CTO) | **REQ-ONB-02** : Le système DOIT offrir 2 modes de configuration : conversationnel (chat) et visuel (UI technique). |
| #43 — Import initial = moment critique | Migration depuis Jira/Linear/ClickUp | **REQ-ONB-03** : Le système DOIT fournir un import intelligent depuis Jira, Linear, et ClickUp avec mapping automatique vers le modèle MnM. |
| #42 — Source unique de vérité | MnM remplace, ne se branche pas au-dessus | **REQ-ONB-04** : Après import, le système DOIT devenir la source unique de vérité — pas de double tracking. |

### 3.4 Requirements de Communication Inter-Agents (Noyau 4)

| Vérité | Besoin identifié | Requirement Business |
|--------|-----------------|---------------------|
| #48 — Partage avec permissions humain-in-the-loop | Confidentialité + contrôle | **REQ-A2A-01** : Le système DOIT permettre aux agents de demander l'accès aux artefacts d'autres agents, avec validation explicite du propriétaire humain. |
| #51 — Agents créent leurs propres connecteurs | Extensibilité agent-driven | **REQ-A2A-02** : Les agents DOIVENT pouvoir générer des connecteurs vers des systèmes externes (API, bases de données, outils internes). |
| #52 — MnM modifiable de l'intérieur | Auto-amélioration | **REQ-A2A-03** : Le responsable MnM DOIT pouvoir utiliser des agents MnM pour modifier les workflows et la configuration de MnM lui-même. |
| WhatIf #1 — Agents comme proxys de communication | Communication machine-to-machine | **REQ-A2A-04** : L'agent d'un rôle DOIT pouvoir query directement le contexte de l'agent d'un autre rôle sans passer par un dialogue humain pour le transfert d'information factuelle. |

### 3.5 Requirements de Workflow & Automatisation (Noyau 5)

| Vérité | Besoin identifié | Requirement Business |
|--------|-----------------|---------------------|
| #30 — Curseur d'automatisation individuel | Adoption à son rythme | **REQ-DUAL-01** : Chaque utilisateur DOIT pouvoir régler indépendamment son niveau d'automatisation : manuel, assisté, ou automatique. |
| #22 — Process mécanique vs humain irremplaçable | Automatiser le bon truc | **REQ-DUAL-02** : Le système DOIT distinguer les tâches mécaniques (automatisables) des tâches de jugement humain (nécessitant validation). |
| #38 — Agent "conduisible" en temps réel | Dialogue pendant l'exécution | **REQ-DUAL-03** : L'utilisateur DOIT pouvoir dialoguer avec son agent PENDANT l'exécution d'une tâche (voir, arrêter, guider, corriger). |
| #31 — Brainstorm = point d'entrée | Le workflow commence par la pensée collective | **REQ-DUAL-04** : Le système DOIT supporter le brainstorm comme point d'entrée d'un workflow, avec output structuré directement consommable par les agents d'exécution. |

### 3.6 Requirements Multi-User & Enterprise

| Vérité | Besoin identifié | Requirement Business |
|--------|-----------------|---------------------|
| #21 — Rôles composites | Un Lead Dev = 4 rôles | **REQ-ENT-01** : Le système DOIT supporter des rôles composites (combinaisons de permissions de plusieurs rôles théoriques). |
| #16 — 3 niveaux de workflow | Entreprise, individuel, connexion | **REQ-ENT-02** : Le système DOIT modéliser 3 niveaux de workflow : global (inter-rôles), individuel (chaque user), et interconnexion (liaison entre workflows individuels). |
| #19 — Élévation, pas disparition | Discours de montée en compétence | **REQ-ENT-03** : L'interface DOIT présenter l'automatisation comme une évolution du rôle (libérer du temps pour la réflexion stratégique), pas comme un remplacement. |
| #29 — CEO achète l'accès direct à l'information | Sans intermédiaire humain | **REQ-ENT-04** : Le CEO/DSI DOIT pouvoir interroger directement les agents pour obtenir des insights sur l'avancement, les blocages, et les métriques — sans attendre de reporting humain. |

---

## 4. Modèle de Domaine Conceptuel

### 4.1 Entités principales et relations

```
┌─────────────────────────────────────────────────────────────┐
│                        INSTANCE MnM                         │
│  (Déploiement SaaS ou on-premise)                           │
│                                                             │
│  ┌───────────┐       1:N        ┌───────────┐              │
│  │   User    │─────────────────→│ Company   │              │
│  │           │  (membership)    │ (tenant)  │              │
│  └─────┬─────┘                  └─────┬─────┘              │
│        │                              │                     │
│        │ possède                       │ contient            │
│        ▼                              ▼                     │
│  ┌───────────┐                  ┌───────────┐              │
│  │   Role    │                  │  Project  │              │
│  │(composite)│                  │           │              │
│  └─────┬─────┘                  └─────┬─────┘              │
│        │                              │                     │
│        │ détermine                    │ contient            │
│        ▼                              ▼                     │
│  ┌───────────┐                  ┌───────────┐              │
│  │Permission │                  │   Agent   │              │
│  │  (Grant)  │                  │           │              │
│  └───────────┘                  └─────┬─────┘              │
│                                       │                     │
│                              exécute  │  suit               │
│                                       ▼                     │
│                                 ┌───────────┐              │
│                                 │ Workflow  │              │
│                                 │(template) │              │
│                                 └─────┬─────┘              │
│                                       │                     │
│                              instancie│                     │
│                                       ▼                     │
│                                 ┌───────────┐              │
│                                 │   Task    │              │
│                                 │ (instance)│              │
│                                 └───────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Description des entités

| Entité | Description | Attributs clés | Relations |
|--------|-------------|----------------|-----------|
| **Instance** | Déploiement MnM (SaaS multi-tenant ou on-premise) | mode (local_trusted / authenticated), exposure (private / public) | Contient N Companies |
| **Company** | Unité organisationnelle (BU, département, projet transverse) | name, plan (free / team / enterprise), settings | Appartient à 1 Instance, contient N Projects, N Users (via Membership), N Agents |
| **User** | Personne physique utilisant MnM | email, name, auth_provider (local / SSO) | Membre de N Companies, possède N Roles, contrôle N Agents |
| **Role** | Rôle composite attribué à un User dans une Company | name, type (admin / manager / contributor / viewer), custom_permissions | Associé à 1 User + 1 Company, détermine N Permissions |
| **Permission** | Droit d'action granulaire | key (ex: agents:create, workflows:execute), scope (JSONB: project_id, agent_ids) | Associée à 1 Role, scopée optionnellement à 1 Project |
| **Project** | Conteneur de travail (produit, feature, initiative) | name, status, visibility | Appartient à 1 Company, contient N Agents, N Workflows, N Tasks |
| **Agent** | Entité IA exécutante, assignée à un rôle fonctionnel | name, role_type (dev / qa / pm / ...), adapter, runtimeConfig, automation_level (manual / assisted / auto) | Appartient à 1 Project, exécute N Workflows, produit N Tasks |
| **Workflow** | Template de process déterministique | name, stages[], transitions[], required_context[], blocking_rules | Appartient à 1 Project, instancié en N WorkflowInstances |
| **WorkflowInstance** | Exécution concrète d'un Workflow | current_stage, status, started_at, completed_at | Instance de 1 Workflow, contient N Tasks, pilotée par N Agents |
| **Task** | Unité atomique de travail | title, description, status, assigned_to (User ou Agent), result | Appartient à 1 WorkflowInstance ou directement à 1 Project |
| **AuditLog** | Trace d'action | actor (User ou Agent), action, target, context, timestamp | Réfère à toute entité modifiée |
| **Connector** | Interface vers un système externe | type, config, created_by (Agent ou User) | Utilisé par N Agents, appartient à 1 Company |

### 4.3 Relations clés du modèle

**User ↔ Company** (N:N via CompanyMembership)
- Un User peut être membre de plusieurs Companies (ex: BU France + Projet Transverse)
- Chaque membership porte un Role spécifique à cette Company
- Le scope de permissions est restreint aux Projects assignés (vérité #16)

**User ↔ Agent** (1:N propriété, N:N supervision)
- Un User possède ses agents personnels (son agent dev, son agent QA)
- Un User peut superviser des agents d'autres Users (selon permissions)
- Le curseur d'automatisation (manual/assisted/auto) est par Agent, pas par User

**Agent ↔ Workflow** (N:N exécution)
- Un Agent est assigné à des étapes spécifiques de Workflows
- Le Workflow impose le contexte, les fichiers, et les prompts à chaque étape (déterministique)
- L'Agent ne peut PAS dévier du Workflow — c'est MnM qui contrôle (vérité #36)

**Agent ↔ Agent** (N:N communication)
- Communication inter-agents via query de contexte (pas de dialogue libre)
- Permissions human-in-the-loop pour le partage d'artefacts (vérité #48)
- Connecteurs auto-générés pour systèmes externes (vérité #51)

**Workflow ↔ Task** (1:N instanciation)
- Un Workflow template génère des Tasks concrètes à chaque instance
- Chaque Task a un statut, un assigné (humain ou agent), et un résultat
- La Task est l'unité atomique de tracking et d'audit

**Company ↔ Hierarchy** (implicite via Roles)
- La cascade hiérarchique n'est pas modélisée comme une entité séparée
- Elle émerge des Roles et des permissions de configuration : le Role "admin" peut créer des Projects et des Agents, le Role "contributor" ne peut que configurer ses propres agents dans les Projects auxquels il est assigné
- Respecte le principe "chaque niveau définit le suivant" (vérité #35)

### 4.4 Invariants du domaine

1. **Isolation Company** : Aucun User ne peut accéder aux données d'une Company dont il n'est pas membre.
2. **Déterminisme Workflow** : Un Agent en exécution est toujours contraint par le Workflow qui l'a lancé — pas de freestyle.
3. **Audit Total** : Toute mutation (création, modification, suppression) sur toute entité génère un AuditLog.
4. **Permission Scope** : Un Permission sans scope s'applique à toute la Company ; avec scope, seulement aux Projects/Agents spécifiés.
5. **Curseur Individuel** : Le niveau d'automatisation d'un Agent est configurable par son propriétaire User, dans les limites définies par le Role du User dans la Company.

---

## 5. Synthèse et Implications Stratégiques

### 5.1 Le white space identifié

MnM se positionne dans un espace que **personne n'occupe aujourd'hui** :

```
                    Technique (devs)          Business (tous rôles)
                    ┌─────────────────────────┬─────────────────────┐
Exécution           │ Cursor, Windsurf        │ ClickUp Brain       │
(agents font)       │ Claude Code             │ Jira Agents         │
                    ├─────────────────────────┼─────────────────────┤
Orchestration       │ CrewAI, LangGraph       │                     │
(agents suivent     │ MS Agent Framework      │      ███ MnM ███   │
 des workflows)     │                         │                     │
                    ├─────────────────────────┼─────────────────────┤
Supervision         │                         │                     │
(humain contrôle,   │                         │      ███ MnM ███   │
 audit, drift)      │                         │                     │
                    └─────────────────────────┴─────────────────────┘
```

MnM est le seul produit qui combine :
1. **Orchestration déterministique** (pas un framework, un produit fini avec UI)
2. **Multi-rôle enterprise** (du CEO au dev, chacun à sa place)
3. **Supervision & audit** (drift detection, observabilité, traçabilité)
4. **Adoption progressive** (curseur automatisation, import existant)

### 5.2 Risques concurrentiels

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Jira ajoute des workflows déterministiques | Moyenne | Le legacy Jira est massif — la dette technique empêche l'innovation rapide. MnM est natif-agent. |
| Cursor/Windsurf s'étendent au multi-rôle | Faible | Leur ADN est le code. S'étendre au CEO/PM/QA est un pivot majeur. |
| CrewAI ajoute une UI | Moyenne | Passer de framework à produit fini = réécriture. MnM a l'avantage du first-mover. |
| Microsoft sort un produit fini | Haute | Le MS Agent Framework est un building block, mais Microsoft pourrait le packager. Mitigation : open source + agilité vs. lenteur corporate. |
| Un nouveau concurrent apparaît | Haute | Le marché est jeune. Mitigation : vitesse d'exécution, CBA comme design partner, communauté open source. |

---

*Fin de la Section 1 — Analyse Marché B2B & Paysage Concurrentiel*
*Total : ~2800 mots*
