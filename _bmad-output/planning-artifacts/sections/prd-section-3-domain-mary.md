# PRD Section 3 — Analyse de Domaine, Requirements Concurrentiels & Réglementaires

*Par Mary l'Analyste 📊* | Task #3 | 2026-03-13

---

## PARTIE 1 — Domain Analysis Approfondie : L'Orchestration d'Agents IA Enterprise

### 1.1 Acteurs du domaine

Le domaine de MnM met en jeu deux catégories fondamentales d'acteurs : les **acteurs humains** et les **acteurs machine (agents IA)**. Leur interaction structurée est le coeur du produit.

#### Acteurs humains

| Acteur | Rôle dans le domaine | Interactions clés |
|--------|---------------------|-------------------|
| **CEO / DSI** | Pilote stratégique. Définit la structure organisationnelle, les priorités, les plafonds d'automatisation. Consomme des synthèses agrégées. | Configure via mode ORAL, valide la cascade, interroge les agents pour insights |
| **CTO / Lead Tech** | Garant technique. Définit les workflows déterministiques, les standards, les politiques de drift. Configure SSO et sécurité. | Mode VISUEL + CODE, monitoring drift, définition des templates de workflow |
| **DPO (Directeur Produit)** | Chef d'orchestre produit. Supervise la roadmap, les inter-dépendances, la cohérence cross-équipes. | Mode BOARD + ORAL, vue inter-équipes, résolution de conflits |
| **PM (Product Manager)** | Stratège produit. Brainstorme, structure les epics, connecte recherche et exécution. | Mode BOARD + ORAL, brainstorm assisté, output structuré exploitable |
| **PO (Product Owner)** | Traducteur de besoins. Valide les stories générées, capture le savoir tribal, assure la Definition of Ready. | Mode BOARD, validation des artefacts agents, enrichissement progressif du savoir |
| **Designer** | Architecte de l'expérience. Produit les maquettes, intervient tôt dans le cycle de workflow. | Notification automatique dans le workflow, maquettes liées aux stories |
| **Développeur** | Artisan du code. Pilote son agent personnel en temps réel, review le code généré, contribue cross-rôles. | Mode CODE, dialogue temps réel avec agent, curseur d'automatisation personnel |
| **QA / Testeur** | Gardien de la qualité. Formalise le savoir tacite en tests, valide la couverture, capture les edge cases. | Mode TEST, capture progressive du savoir, shift-left |
| **Instance Admin** | Super-administrateur technique. Gère le déploiement, la configuration globale, la maintenance. | Configuration multi-tenant, backup/restore, health monitoring |

#### Acteurs machine (Agents IA)

| Type d'agent | Fonction | Contraintes |
|-------------|----------|-------------|
| **Agent d'onboarding** | Guide conversationnel pour la configuration initiale (CEO, CTO, etc.) | Doit respecter la cascade hiérarchique |
| **Agent d'exécution** | Exécute les tâches dans un workflow déterministique (code, tests, stories, analyses) | Contraint par le workflow template, containerisé, avec credentials isolées |
| **Agent de reporting** | Synthétise les données d'avancement, KPIs, alertes pour le management | Accès en lecture seule, agrégation obligatoire (jamais individuel) |
| **Agent de brainstorm** | Accompagne les sessions de réflexion, structure les outputs | Mode manuel ou assisté uniquement (jamais full auto pour la créativité) |
| **Agent inter-rôle** | Proxy de communication entre les agents de différents utilisateurs | Soumis aux permissions human-in-the-loop, query avec validation |
| **Agent connecteur** | Génère et maintient les connecteurs vers les systèmes externes (Jira, Linear, etc.) | Auto-généré via MCP/codegen, validé par le CTO |

### 1.2 Processus métier clés

#### Processus 1 — Onboarding Cascade

```
CEO définit la structure (mode oral)
  → CTO raffine la stratégie technique (mode visuel)
    → Managers définissent leur périmètre
      → Opérationnels configurent leurs workflows et agents
```

**Caractéristiques :** Chaque niveau définit le cadre du niveau inférieur. Les pairs d'un même niveau se coordonnent pour assurer la cohérence. L'import depuis les outils existants (Jira, Linear, ClickUp) est le "moment de vérité" de l'adoption.

#### Processus 2 — Orchestration Déterministique d'un Workflow

```
Template Workflow défini (étapes, fichiers obligatoires, prompts, contraintes)
  → Agent assigné et lancé dans un container éphémère
    → Exécution step-by-step imposée par la plateforme (pas par le LLM)
      → Drift detection en continu
        → Si compaction : kill+relance ou réinjection des pré-prompts
          → Résultats intermédiaires persistés à chaque étape
            → Validation humaine selon le curseur d'automatisation
```

#### Processus 3 — Communication Inter-Agents (A2A)

```
Agent A (du Dev) a besoin du contexte de l'Agent B (du PO)
  → Agent A émet une requête de query inter-agent
    → MnM vérifie les permissions (scope, rôle, projet)
      → Le propriétaire humain de l'Agent B reçoit une notification (si mode assisté/manuel)
        → Si approuvé : Agent A reçoit le contexte demandé
          → Audit log enregistre la transaction
```

#### Processus 4 — Audit et Observabilité

```
Toute mutation dans le système génère un AuditLog
  → LLM analyse les traces en temps réel → résumé simplifié
    → Dashboards management : données agrégées (JAMAIS individuelles)
      → Drift detection : alerte quand un agent dévie de son workflow
        → Replay possible : chaque déviation est tracée, attribuée, replayable
```

#### Processus 5 — Gestion du Curseur d'Automatisation

```
Entreprise définit un plafond global (ex: "aucun merge sans validation humaine")
  → CTO définit par projet (ex: "projet legacy = assisté")
    → Utilisateur choisit par agent/action (ex: "tests = auto, code review = assisté")
      → Hiérarchie l'emporte : le niveau supérieur ne peut pas être dépassé
        → Évolution naturelle : Manuel (S1-2) → Assisté (M1) → Auto (M3+)
```

### 1.3 Règles métier (invariants, contraintes, politiques)

#### 5 Invariants fondamentaux du domaine

1. **Isolation Company (INV-01)** : Aucun accès cross-company sans membership explicite. Toutes les routes passent par `assertCompanyAccess`. Toutes les queries UI scopées par `companyId`.

2. **Déterminisme Workflow (INV-02)** : Un agent est TOUJOURS contraint par son Workflow template. L'agent n'interprète pas le workflow — MnM l'exécute pour lui. Les étapes, fichiers obligatoires, et prompts sont imposés algorithmiquement.

3. **Audit Total (INV-03)** : Toute mutation dans le système génère un AuditLog. Qui, quoi, quand, dans quel workflow, avec quel résultat. Aucune action ne peut contourner l'audit.

4. **Permission Scope (INV-04)** : Sans scope = accès à toute la Company. Avec scope = uniquement les Projects spécifiés. Le champ `scope` JSONB sur `principalPermissionGrants` doit être lu et appliqué (actuellement stocké mais jamais lu — trou identifié).

5. **Curseur Individuel (INV-05)** : L'automatisation est configurable par le propriétaire, dans les limites imposées par son Role et la hiérarchie. Le plafond supérieur l'emporte toujours.

#### Contraintes métier additionnelles

- **C-01 : Métriques agrégées uniquement** — Les dashboards management ne montrent JAMAIS de données individuelles (Vérité #20). Pas de flicage.
- **C-02 : Élévation, pas remplacement** — L'automatisation est présentée comme une élévation du rôle (de producteur à validateur), jamais comme un remplacement.
- **C-03 : Source unique de vérité** — Après import depuis Jira/Linear, MnM devient LA source de vérité. Pas de double saisie.
- **C-04 : Containerisation obligatoire en multi-tenant** — Les agents doivent être isolés dans des containers Docker éphémères avant toute injection de messages en production multi-tenant.
- **C-05 : Credential proxy** — Aucune clé API ne doit être visible par les agents directement. Passage obligatoire par un proxy HTTP de credentials.

### 1.4 Glossaire du domaine

| Terme | Définition |
|-------|-----------|
| **Orchestration déterministique** | Mode d'exécution où la plateforme impose algorithmiquement les étapes d'un workflow aux agents, par opposition à l'orchestration probabiliste où le LLM "interprète" le workflow |
| **Drift detection** | Capacité à détecter en temps réel quand un agent IA dévie de son workflow assigné. Basé sur des signatures comportementales enrichies par chaque drift détecté/confirmé |
| **Compaction** | Événement où un LLM atteint sa limite de fenêtre de contexte et doit résumer/condenser son historique, perdant potentiellement des informations critiques du workflow |
| **Kill+relance** | Stratégie de gestion de compaction : tuer l'agent et le relancer avec un contexte frais + résultats intermédiaires déjà produits |
| **Réinjection** | Stratégie alternative de compaction : réinjecter les pré-prompts critiques et la définition du workflow après la compaction |
| **Curseur d'automatisation** | Mécanisme à 3 positions (Manuel, Assisté, Automatique) permettant à chaque utilisateur de contrôler son niveau d'automatisation, dans les limites fixées par la hiérarchie |
| **Dual-speed workflow** | Architecture de flux parallèles : vitesse humaine (réflexion, décision, asynchrone) et vitesse machine (exécution, coordination, temps réel) |
| **Onboarding cascade** | Processus d'adoption hiérarchique où chaque niveau organisationnel configure le cadre du niveau inférieur |
| **Human-in-the-loop** | Point de validation humaine obligatoire dans un workflow automatisé. Exigence enterprise standard |
| **Tenant** | Entité d'isolation dans un déploiement multi-tenant. Correspond à une Company dans MnM |
| **Scope** | Périmètre d'accès d'un utilisateur au sein d'une Company. Peut être global (toute la company) ou restreint (projets spécifiques) |
| **Agent-to-Agent (A2A)** | Communication directe entre agents IA de différents utilisateurs, avec permissions et validation humaine |
| **Connecteur auto-généré** | Interface créée automatiquement par un agent MnM pour interagir avec un système externe (Jira, Slack, etc.) via MCP ou codegen |
| **Workflow template** | Définition réutilisable d'un processus : étapes, fichiers obligatoires, prompts injectés, contraintes, critères de validation |
| **Workflow instance** | Exécution concrète d'un workflow template par un agent, avec état persisté et audit |
| **Container éphémère** | Environnement Docker isolé créé pour l'exécution d'un agent, détruit après usage (`--rm`). Garantit l'isolation des credentials et du filesystem |
| **Credential proxy** | Service MnM qui intercepte les requêtes d'accès aux secrets/API des agents et les route vers le provider approprié (local, AWS, GCP, Vault) sans exposer les clés |
| **Savoir tribal / tacite** | Connaissances non-documentées détenues par les experts (edge cases QA, contexte métier PO). MnM les capture progressivement pour les rendre queryables |
| **Mode oral** | Interface conversationnelle où l'utilisateur dicte ses intentions et MnM structure. Destiné au CEO, DSI, DPO |
| **Mode visuel** | Interface dashboards, graphes, monitoring. Destiné au CTO, Lead Tech |

---

## PARTIE 2 — Competitive Requirements

### 2.1 Jira (Atlassian) — Standard enterprise gestion de projet

| Capacité Jira | Détail | Requirement MnM |
|--------------|--------|-----------------|
| **Tracking de tickets et sprints** | Backlog, sprint boards, velocity, burndown | MnM DOIT fournir un mode BOARD avec kanban, epics, stories, suivi sprint au minimum équivalent. L'agent augmente le tracking passif. |
| **Agents in Jira (fév. 2026)** | Assigner des tâches basiques à des agents IA | MnM DOIT proposer des agents d'exécution complets (pas juste du triage) avec orchestration déterministique, ce que Jira ne fait pas. |
| **Marketplace d'intégrations** | 3000+ apps/plugins | MnM DOIT proposer un système de connecteurs auto-générés et un support MCP natif. La capacité des agents à créer leurs propres connecteurs compense l'absence d'un marketplace mature. |
| **Permissions enterprise** | Schémas de permissions complexes, groupes, rôles projet | MnM DOIT égaler avec RBAC métier (admin, manager, contributor, viewer), scoping par projet, et permissions composites. |
| **Audit log** | Journal d'activité basique | MnM DOIT SURPASSER avec un audit log complet couvrant aussi les actions des agents IA, pas seulement des humains. |
| **SSO / SAML / SCIM** | Intégration AD/Okta/Azure AD standard | MnM DOIT supporter SSO SAML/OIDC pour être déployable en enterprise. Prérequis non-négociable. |
| **Import/Export** | CSV, API REST | MnM DOIT proposer un import intelligent depuis Jira (mapping automatique des projets, epics, stories, utilisateurs, statuts). |
| **API REST mature** | API documentée, webhooks | MnM DOIT exposer une API documentée pour l'intégration dans les écosystèmes enterprise existants. |

**Ce que MnM fait que Jira ne fera JAMAIS :** Workflows déterministiques, orchestration inter-rôles CEO-to-Dev, drift detection, dual-speed workflow, capture du savoir tacite, curseur d'automatisation.

### 2.2 Cursor (Anysphere) — IDE IA dominant

| Capacité Cursor | Détail | Requirement MnM |
|----------------|--------|-----------------|
| **Édition code IA** | Tab completion, multi-file edit, agent mode | MnM n'est PAS un IDE. MnM DOIT orchestrer les IDE (y compris Cursor) via des connecteurs. L'agent dev MnM pilote le code dans l'environnement du développeur. |
| **Context awareness** | Indexation codebase, @mentions, docs | MnM DOIT fournir un contexte complet aux agents (fichiers obligatoires par étape, pré-prompts, résultats intermédiaires) via l'orchestration déterministique. |
| **Sandbox d'exécution** | Environnement isolé pour tests | MnM DOIT SURPASSER avec la containerisation Docker éphémère + credential proxy + mount allowlist tamper-proof (5 couches de défense). |
| **Enterprise (FedRAMP, SOC 2)** | Certifications de sécurité | MnM DOIT viser les certifications enterprise équivalentes à moyen terme. À court terme : on-premise deploy couvre les besoins de sécurité. |
| **50% Fortune 500** | Adoption massive | MnM cible un segment différent (orchestration multi-rôle, pas IDE). Mais DOIT offrir une DX excellent pour les développeurs afin qu'ils ne perçoivent pas MnM comme un downgrade par rapport à Cursor. |

**Ce que MnM fait que Cursor ne fera JAMAIS :** Multi-rôle (CEO, PM, PO, QA dans la même plateforme), workflow orchestration, visibilité managériale, coordination inter-agents, audit centralisé cross-rôles.

### 2.3 CrewAI — Framework open source d'agents role-based

| Capacité CrewAI | Détail | Requirement MnM |
|----------------|--------|-----------------|
| **Role-based agents** | Définition d'agents avec rôles, goals, backstory | MnM DOIT proposer une modélisation d'agents au moins aussi riche (11 rôles existants dans le schéma) avec en plus des permissions granulaires et un curseur d'automatisation. |
| **Task delegation** | Agents délèguent des sous-tâches entre eux | MnM DOIT supporter la communication A2A avec validation human-in-the-loop, ce que CrewAI ne fait pas. |
| **40% plus rapide que LangGraph** | Performance d'exécution | MnM DOIT optimiser la latence d'orchestration. L'overhead du déterminisme ne doit pas dégrader l'expérience. WebSocket (vs file-based IPC) donne un avantage structurel. |
| **Open source** | Code disponible, communauté active | MnM DOIT maintenir son tier open source (gratuit, auto-hébergé) pour alimenter le flywheel d'adoption. |
| **Python ecosystem** | Intégration native Python, LangChain | MnM DOIT être agnostique au framework sous-jacent. L'adapter pattern (8 types existants) permet d'orchestrer CrewAI, LangGraph, ou tout autre framework. |

**Ce que MnM fait que CrewAI ne fera JAMAIS :** UI complète, déterminisme imposé (pas suggéré), onboarding enterprise, observabilité intégrée, gestion de compaction, RBAC multi-rôle, drift detection.

### 2.4 Microsoft Agent Framework — La menace la plus sérieuse

| Capacité MS Agent | Détail | Requirement MnM |
|------------------|--------|-----------------|
| **Graph-based workflows** | Définition de workflows comme graphes dirigés | MnM DOIT proposer des workflows au moins aussi expressifs (le schéma existant avec stages et transitions le permet), PLUS le déterminisme imposé que MS ne garantit pas. |
| **A2A + MCP natif** | Protocoles standardisés de communication inter-agents | MnM DOIT supporter A2A et MCP nativement. C'est déjà dans l'architecture (connecteurs auto-générés via MCP). |
| **Azure ecosystem** | Intégration native Azure AD, Cognitive Services, etc. | MnM DOIT être cloud-agnostique (on-premise, AWS, GCP, Azure). Le lock-in Azure de MS est une faiblesse que MnM exploite. |
| **Enterprise backing** | Budget R&D Microsoft, base clients Azure | MnM DOIT compenser par l'agilité, l'open source, et le first-mover advantage sur le "produit fini" (MS est un building block). |
| **Durable execution** | State management robuste pour les workflows longs | MnM DOIT garantir la persistance d'état à chaque étape (résultats intermédiaires, état du workflow, contexte de compaction). |

**Ce que MnM fait que Microsoft ne fera PAS facilement :** UI non-technique pour CEO/PM/PO, drift detection, curseur d'automatisation, onboarding cascade, métriques agrégées (pas individuelles), indépendance cloud.

**ALERTE CONCURRENTIELLE :** Microsoft est la menace la plus sérieuse. Leur framework est en RC depuis février 2026. S'ils sortent un produit fini avec UI, MnM perd son avantage. La mitigation : agilité, open source, CBA comme design partner, et le fait que MS sera toujours Azure-first.

---

## PARTIE 3 — Regulatory Requirements

### 3.1 RGPD (Règlement Général sur la Protection des Données)

#### REG-RGPD-01 : Base légale du traitement
- **Exigence** : Tout traitement de données personnelles doit reposer sur une base légale
- **Impact architecture** : MnM doit enregistrer et tracer la base légale pour chaque type de traitement
- **Requirement** : REQ-REG-01 — Configurer et documenter la base légale de chaque traitement

#### REG-RGPD-02 : Droit à l'effacement (Article 17)
- **Exigence** : Suppression complète des données personnelles sur demande
- **Impact architecture** : Identifier TOUTES les données liées à un utilisateur (profil, sessions, audit logs, contextes d'agents, savoir tribal)
- **Requirement** : REQ-REG-02 — Mécanisme de suppression/anonymisation complète, délai 30 jours max

#### REG-RGPD-03 : Portabilité des données (Article 20)
- **Exigence** : Export dans un format structuré, lisible par machine
- **Requirement** : REQ-REG-03 — Export complet JSON/CSV, délai 30 jours max

#### REG-RGPD-04 : Consentement explicite
- **Exigence** : Consentement libre, spécifique, éclairé, avec possibilité de retrait
- **Requirement** : REQ-REG-04 — Consentement granulaire pour traitement IA, A2A, savoir tacite

#### REG-RGPD-05 : Privacy by Design (Article 25)
- **Exigence** : Protection des données dès la conception et par défaut
- **Requirement** : REQ-REG-05 — TLS, AES-256, pseudonymisation, collecte minimale

### 3.2 Audit Trail

- **REQ-AUDIT-01** : Log append-only immutable (humains + agents), rétention 3 ans minimum
- **REQ-AUDIT-02** : Non-répudiation par chaînage cryptographique (hash chain)
- **REQ-AUDIT-03** : Interface read-only de consultation avec filtres et export

### 3.3 Data Residency

- **REQ-RESID-01** : On-premise complet + choix région SaaS, aucune donnée hors région
- **REQ-RESID-02** : Support LLM EU/on-premise, choix du provider par le client

### 3.4 Spécificités Agents IA

- **REQ-IA-01** : Pas de décision exclusivement automatique, explication lisible, contestation possible
- **REQ-IA-02** : Classification agents par niveau de risque (AI Act), obligations proportionnelles

## Synthèse des Requirements Réglementaires

| ID | Catégorie | Résumé | Priorité |
|----|-----------|--------|----------|
| REQ-REG-01 | RGPD | Base légale configurable | P2 |
| REQ-REG-02 | RGPD | Droit à l'effacement complet | P1 |
| REQ-REG-03 | RGPD | Portabilité données JSON/CSV | P2 |
| REQ-REG-04 | RGPD | Consentement granulaire + retrait | P1 |
| REQ-REG-05 | RGPD | Privacy by design | P1 |
| REQ-AUDIT-01 | Audit | Log immutable append-only | P1 |
| REQ-AUDIT-02 | Audit | Non-répudiation (hash chain) | P2 |
| REQ-AUDIT-03 | Audit | Interface read-only consultation | P1 |
| REQ-RESID-01 | Data Residency | On-premise + choix région | P1 |
| REQ-RESID-02 | Data Residency | Support LLM EU | P2 |
| REQ-ACCESS-01 | Accès | Rapport transparence utilisateur | P2 |
| REQ-IA-01 | IA / RGPD Art.22 | Pas de décision exclusivement auto | P1 |
| REQ-IA-02 | AI Act | Classification agents par risque | P2 |

---

*~2800 mots — Domain analysis, competitive requirements (4 concurrents), regulatory requirements (RGPD, audit, data residency, AI Act).*
