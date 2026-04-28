# Brainstorming MnM v2 — Cross-Document Drift Detection & Workflow Editor

**Date**: 2026-02-19  
**Auteur**: Atlas (via Pantheon)  
**Contexte**: Extension du Product Brief initial avec 2 nouveaux éléments majeurs issus de discussions avec Gabriel

---

## Introduction

Ce document explore deux évolutions majeures de la vision MnM :

1. **Drift Detection Cross-Document** : Étendre la détection de drift au-delà de "code vs spec" pour détecter les incohérences ENTRE documents de spécification
2. **Workflow Editor** : Créer une interface centrale pour configurer et orchestrer les agents, avec synchronisation bidirectionnelle chat/builder visuel

Ces deux éléments renforcent la proposition de valeur core de MnM : maintenir l'alignement entre vision produit et implémentation dans un monde de développement agentique.

---

## 1. Drift Detection Cross-Document

### 1.1 Le Problème Réel (Use Case Gabriel)

**Scénario** :
- Le Product Brief spécifie "SSE" (Server-Sent Events) pour la communication temps réel
- Tom écrit une story front qui mentionne "websocket" (erreur d'inattention ou oubli)
- Gabriel travaille sur son microservice backend avec un agent IA
- L'agent, qui a le contexte de la story (avec "websocket"), guide Gabriel vers websocket
- Gabriel se souvient du brainstorming initial : "On avait dit SSE !"
- **Personne — ni l'agent, ni MnM — ne l'a alerté que le contexte était pollué**

**Le fond du problème** : Le drift ne se produit pas uniquement entre code et specs. Il peut se propager de spec en spec, polluant le contexte des agents et des développeurs en cascade.

### 1.2 Vision de la Solution

#### Détection Multi-Couches

MnM doit comprendre la **hiérarchie documentaire** :
```
Product Brief (source de vérité vision)
    ↓
PRD (détails fonctionnels)
    ↓
Architecture Spec (choix techniques)
    ↓
Stories (unités de travail)
    ↓
Code (implémentation)
```

Chaque niveau peut introduire un drift par rapport au niveau supérieur. Un drift non-détecté à un niveau pollue tous les niveaux inférieurs.

#### Types de Drift Cross-Document

1. **Terminologie inconsistante** : "SSE" dans Product Brief, "websocket" dans Story
2. **Comportement divergent** : PRD dit "notification push", Story dit "polling"
3. **Scope creep silencieux** : Story ajoute une fonctionnalité non prévue dans PRD
4. **Contradiction architecturale** : Architecture dit "monorepo", Story assume "micro-services"

### 1.3 User Stories

#### US1 : Détection proactive au moment de l'écriture
```
En tant que product engineer écrivant une story,
Je veux être alerté si mes termes/concepts divergent du Product Brief ou PRD,
Afin de corriger immédiatement ou de challenger la source de vérité.
```

#### US2 : Compliance Check à la demande
```
En tant que tech lead,
Je veux lancer un "Compliance Check" sur un ensemble de documents,
Afin de détecter toutes les inconsistances avant de commencer un sprint.
```

#### US3 : Compliance Check automatique sur événements clés
```
En tant que membre d'équipe,
Je veux que MnM vérifie automatiquement l'alignement quand :
- Une story passe en "Done"
- Une nouvelle story est créée
- Un merge request est ouvert,
Afin de capturer les drifts aux moments où ils importent le plus.
```

#### US4 : Propagation de la résolution
```
En tant que membre d'équipe,
Quand un collègue corrige un drift (ex: met à jour le PRD),
Je veux voir une notification avec le contexte (quels fichiers, pourquoi),
Afin de garder mon contexte mental synchronisé avec la source de vérité.
```

### 1.4 Mécanisme Technique Proposé

#### Indexation Sémantique

MnM doit construire un **graphe de concepts** à partir des documents :
- Extraire les entités techniques (websocket, SSE, REST, GraphQL, etc.)
- Mapper les décisions architecturales
- Identifier les comportements décrits

#### Comparaison Hiérarchique

Pour chaque document, comparer avec ses "parents" dans la hiérarchie :
- Story → Architecture + PRD + Product Brief
- Code → Story + Architecture

#### Algorithme de Détection

```
1. Identifier les concepts-clés dans le document source
2. Pour chaque concept, vérifier dans les documents parents :
   - Même concept existe ? → OK
   - Concept différent pour même sujet ? → DRIFT POTENTIEL
   - Nouveau concept sans mention parent ? → AJOUT (warning)
3. Calculer un score de confiance (context, fréquence, importance)
4. Si score > seuil → surfacer l'alerte avec contexte
```

### 1.5 UX de l'Alerte Drift

L'alerte ne doit pas être une simple notification. Elle doit être **actionnable** :

```
⚠️ Drift Détecté — Story-042 vs Product Brief

Tu mentionnes "websocket" mais le Product Brief spécifie "SSE" 
pour la communication temps réel.

📍 Contexte :
- Product Brief (ligne 47) : "Communication temps réel via SSE..."
- Story-042 (ligne 12) : "Implémenter websocket pour les updates..."

🤔 Est-ce intentionnel ?

[✅ Mettre à jour Product Brief → SSE devient websocket]
[🔄 Corriger Story → websocket devient SSE]
[💬 Demander clarification à @tom]
[❌ Ignorer — je sais ce que je fais]
```

### 1.6 Questions Ouvertes — Cross-Document Drift

| Question | Implications |
|----------|--------------|
| **Comment gérer les synonymes légitimes ?** | "Auth" vs "Authentication" vs "Authentification" — faux positifs potentiels |
| **Quelle granularité de scan ?** | Mot-clé ? Phrase ? Paragraphe ? Trade-off performance/précision |
| **Comment pondérer l'importance ?** | Un drift sur "SSE vs websocket" est critique. Un drift sur "bouton bleu vs bouton vert" moins |
| **Qui a l'autorité de résolution ?** | Si Gabriel corrige, Tom doit-il valider ? Workflow de validation ? |
| **Historique des drifts ?** | Garder une trace des drifts résolus pour éviter les régressions ? |

### 1.7 Risques Identifiés

1. **Bruit** : Trop d'alertes = ignorance. Le tuning du seuil de confiance est critique.
2. **Performance** : Scan cross-document sur gros projets peut être lent. Caching intelligent nécessaire.
3. **Faux positifs sur évolution légitime** : Parfois le Product Brief est outdated et les stories sont justes.
4. **Résistance utilisateur** : "Encore un outil qui me dit quoi faire" — l'UX doit être assistive, pas contraignante.

---

## 2. Workflow Editor

### 2.1 Vision Globale

Le Workflow Editor devient le **cœur de l'expérience MnM**. C'est ici que l'utilisateur :
- Configure ses agents et leurs rôles
- Définit les connexions et l'ordre d'exécution
- Visualise et modifie son pipeline de développement agentique

### 2.2 Double Interface Synchronisée

#### Builder Visuel (style n8n)

Une interface drag-and-drop pour :
- Ajouter des agents comme des "nodes"
- Connecter les agents entre eux (output → input)
- Définir le parallélisme (agents en parallèle, points de synchronisation)
- Configurer chaque agent (rôle, instructions, outils, connecteurs)

#### Chat LLM

Une interface conversationnelle pour :
- Créer/modifier le workflow en langage naturel
- "Ajoute un agent de code review après le dev"
- "Fais tourner les tests E2E en parallèle des tests unitaires"
- "Connecte l'agent QA à Linear pour créer des tickets automatiquement"

#### Synchronisation Bidirectionnelle

Les deux interfaces sont **toujours en sync** :
- Modification dans le builder → reflété instantanément dans le chat (comme conversation)
- Commande dans le chat → reflétée instantanément dans le builder

C'est le même modèle que "code + preview en sync" mais pour workflow + conversation.

### 2.3 Configuration par Agent

Chaque agent dans le workflow a des propriétés configurables :

| Propriété | Description | Exemple |
|-----------|-------------|---------|
| **Rôle** | Ce que fait l'agent | "Test Writer", "Code Reviewer", "Dev" |
| **Instructions** | Prompt système/guidelines | "Écris des tests TDD avant l'implémentation" |
| **Outils** | Capabilities de l'agent | Git, Terminal, Browser, etc. |
| **Connecteurs** | Intégrations externes | GitHub, Linear, ClickUp, fichiers Markdown |

### 2.4 Connecteurs

Les connecteurs permettent aux agents d'interagir avec le monde extérieur :

#### Types de Connecteurs

1. **Fichiers Markdown** : Comme BMAD avec son sprint-status.md — l'agent lit/écrit dans des fichiers structurés
2. **Intégrations MCP** : ClickUp, GitHub, Linear, Slack, etc.
3. **APIs Custom** : Pour les outils internes de l'équipe

#### Configuration des Connecteurs

- **Depuis le builder** : Panel de config pour chaque agent, dropdown des connecteurs disponibles
- **Depuis le chat** : "Connecte l'agent QA à notre projet Linear"
- **Suggestion proactive du LLM** : "Je vois que tu utilises GitHub. Veux-tu que je configure l'intégration pour les PR automatiques ?"

### 2.5 Onboarding = Workflow Editor

Le Workflow Editor est le **point d'entrée de l'application**. L'onboarding est entièrement conversationnel :

```
🤖 MnM : Bienvenue ! Je vais t'aider à configurer ton premier workflow.

    Quel provider LLM veux-tu utiliser ?
    [ ] Claude (Anthropic)
    [ ] GPT-4 (OpenAI)
    [ ] Autre

🤖 MnM : Super ! Et c'est quoi ton projet ?

👤 User : Une app SaaS de gestion de tâches pour équipes tech

🤖 MnM : Je te propose ce workflow de départ basé sur ton contexte :
    
    [Story Spec] → [Test Writer] → [Dev] → [Code Review] → [E2E Tests]
                         ↓
                   [QA Checker]
    
    Ça te va comme base ? Tu peux modifier dans le builder ou me dire 
    tes ajustements.
```

#### Objectifs de l'Onboarding

1. **Zéro friction technique** : Pas de config YAML ou JSON à écrire
2. **Personnalisé** : Le workflow proposé dépend du type de projet
3. **Éducatif** : L'utilisateur comprend le concept en le construisant
4. **Actionnable immédiatement** : À la fin de l'onboarding, le workflow est fonctionnel

### 2.6 User Stories — Workflow Editor

#### US5 : Configuration visuelle du workflow
```
En tant que product engineer,
Je veux configurer mon pipeline d'agents visuellement,
Afin de comprendre d'un coup d'œil l'ordre d'exécution et le parallélisme.
```

#### US6 : Modification par chat
```
En tant qu'utilisateur,
Je veux modifier mon workflow en langage naturel,
Afin de ne pas avoir à naviguer dans l'interface graphique pour des changements simples.
```

#### US7 : Synchronisation bidirectionnelle
```
En tant qu'utilisateur,
Quand je modifie le workflow dans le builder,
Je veux que le chat affiche ce que j'ai changé (comme un log conversationnel),
Afin de garder un historique lisible de mes modifications.
```

#### US8 : Ajout de connecteur proactif
```
En tant qu'utilisateur,
Quand je configure un agent,
Je veux que MnM me propose des connecteurs pertinents basés sur mon repo/contexte,
Afin de découvrir des intégrations utiles sans les chercher.
```

#### US9 : Onboarding conversationnel
```
En tant que nouvel utilisateur,
Je veux que MnM me guide pour créer mon premier workflow via conversation,
Afin de démarrer sans lire de documentation.
```

### 2.7 Flows Détaillés

#### Flow : Création de Workflow (Nouvel Utilisateur)

```
1. Ouvre MnM pour la première fois
2. Chat de bienvenue avec questions contextuelles
3. MnM propose un workflow template basé sur les réponses
4. Utilisateur accepte ou modifie (chat ou builder)
5. MnM configure les connecteurs suggérés
6. Workflow sauvegardé et prêt à l'exécution
```

#### Flow : Modification de Workflow (Utilisateur Existant)

```
1. Ouvre le Workflow Editor
2. Vue builder : tous les agents et leurs connexions
3. Option A : Drag-drop pour modifier
   → Chat affiche "Tu as connecté Agent A à Agent B"
4. Option B : Chat "Ajoute un agent de documentation après le code review"
   → Builder affiche le nouveau node instantanément
5. Sauvegarde automatique ou manuelle
```

#### Flow : Configuration d'un Agent

```
1. Click sur un agent dans le builder (ou "Configure l'agent X" dans le chat)
2. Panel latéral avec :
   - Rôle (dropdown ou custom)
   - Instructions (textarea avec suggestions)
   - Outils (checkboxes)
   - Connecteurs (liste avec "+" pour ajouter)
3. Modifications reflétées en temps réel dans le builder
4. Chat log : "Agent X maintenant connecté à Linear"
```

### 2.8 Edge Cases — Workflow Editor

| Situation | Comportement Attendu |
|-----------|---------------------|
| **Cycle dans le workflow** | Détection et warning : "Boucle détectée entre A → B → A. C'est intentionnel ?" |
| **Agent sans input** | Warning : "Agent X n'a pas d'input. Il ne sera jamais déclenché." |
| **Connecteur non configuré** | Empêcher l'exécution : "Configure les credentials pour Linear avant de lancer" |
| **Conflit de modification** | Si builder et chat modifient en même temps → dernier écrit gagne + notification |
| **Workflow vide** | Proposer un template : "Tu n'as pas d'agents. Veux-tu partir d'un template ?" |
| **Agent supprimé avec dépendances** | Warning : "Supprimer Agent X va déconnecter Agent Y et Z. Continuer ?" |

### 2.9 Questions Ouvertes — Workflow Editor

| Question | Implications |
|----------|--------------|
| **Versioning des workflows ?** | Peut-on rollback un workflow ? Git-like history ? |
| **Partage entre équipes ?** | Export/import de workflows ? Templates communautaires ? |
| **Exécution partielle ?** | Lancer uniquement une partie du workflow pour debug ? |
| **Monitoring en temps réel ?** | Pendant l'exécution, quels visuels dans le builder ? Nodes qui "pulsent" ? |
| **Logs par agent ?** | Où voir les logs détaillés de chaque agent ? Panel séparé ? |
| **Mode "expert" ?** | Pour les power users, accès au JSON/YAML sous-jacent ? |

### 2.10 Risques Identifiés — Workflow Editor

1. **Complexité visuelle** : Trop de nodes → illisible. Besoin de grouping/folding.
2. **Sync bidirectionnelle = état partagé** : Bugs potentiels si le state diverge.
3. **Apprentissage du chat** : Si le LLM comprend mal "ajoute un agent", l'utilisateur perd confiance.
4. **Performance sur gros workflows** : Rendering de 50+ agents avec animations ?
5. **Dépendance au LLM pour onboarding** : Si le LLM est down, l'onboarding est bloqué ?

---

## 3. Intégration des Deux Features

### 3.1 Synergie Naturelle

Le **Drift Detection Cross-Document** et le **Workflow Editor** se renforcent mutuellement :

- **Dans le Workflow Editor**, on peut configurer **quand** le Compliance Check se déclenche (événements du workflow)
- **Les alertes de drift** peuvent être des **inputs** pour des agents (ex: agent "Drift Resolver")
- **Le chat du Workflow Editor** peut signaler des drifts pendant la configuration : "Tu configures cet agent pour websocket mais ton Product Brief dit SSE"

### 3.2 Workflow Type avec Drift Detection

```
[Story Spec] → [Compliance Check] → [Test Writer] → [Dev] → [Code Review]
                      ↓                                          ↓
               (drift détecté?)                          [Compliance Check]
                      ↓                                          ↓
              [Drift Resolver]                           (drift détecté?)
                      ↓                                          ↓
              (humain décide)                            [Drift Resolver]
```

### 3.3 Notification Cross-Feature

Quand un drift est résolu :
1. Le **Workflow Editor** peut proposer de mettre à jour les instructions des agents impactés
2. Les **connecteurs** (Linear, GitHub) peuvent créer des tickets/issues automatiquement
3. Le **chat** log l'événement pour l'équipe

---

## 4. Impact sur le Product Brief Existant

### 4.1 Éléments à Mettre à Jour

| Section | Modification |
|---------|--------------|
| **Executive Summary** | Ajouter Workflow Editor comme feature centrale |
| **Spec Drift Detection** | Étendre à "Cross-Document Drift Detection" |
| **MVP Scope** | Réévaluer si Workflow Editor est MVP ou post-MVP |
| **Target Users** | Valider que les personas couvrent ces use cases |
| **Unique Differentiators** | Ajouter "Workflow Editor with bidirectional sync" |

### 4.2 Nouvelles Sections à Créer

- **Workflow Editor** : Vision, features, UX
- **Cross-Document Drift** : Extension du drift detection
- **Connecteurs & MCP** : Architecture d'intégration

---

## 5. Prochaines Étapes Recommandées

1. **Validation Tom** : Ce brainstorming explore-t-il les bonnes directions ?
2. **Priorisation** : Workflow Editor en MVP ou v2 ?
3. **Prototypage UX** : Maquettes du Workflow Editor (builder + chat sync)
4. **POC Technique** : Faisabilité du drift detection cross-document avec LLM
5. **Mise à jour Product Brief** : Intégrer les éléments validés

---

## 6. Résumé

| Feature | Value Proposition | Complexité | Priorité Suggérée |
|---------|-------------------|------------|-------------------|
| **Cross-Document Drift** | Évite la pollution de contexte qui coûte du temps | Moyenne | Haute (core value) |
| **Workflow Editor** | Centre l'expérience, simplifie l'onboarding | Haute | Haute (UX critique) |
| **Sync Bidirectionnelle** | Différenciation vs concurrents | Haute | Moyenne (nice-to-have pour MVP) |
| **Connecteurs MCP** | Extensibilité et intégrations | Moyenne | Moyenne (post-MVP OK) |

**Bottom line** : Ces deux features transforment MnM d'un "IDE avec drift detection" en une **plateforme de développement agentique product-first** — exactement le positionnement différenciant visé.
