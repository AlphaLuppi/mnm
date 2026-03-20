# Product Brief B2B — MnM : Tour de Contrôle IA Enterprise

> **MnM = orchestrateur d'agents déterministe avec audit, drift detection, et connecteurs auto-générés. Atomique, léger, extensible de l'intérieur.**

**Date :** 2026-03-13
**Auteurs :** Équipe BMAD (Mary l'Analyste, John le PM, Victor le Stratège, Carson le Coach, Sally la Designer, Winston l'Architecte, Bob le Scrum Master) — Orchestré par le Lead
**Version :** 2.0 — Agent Team Product Brief
**Sources :** 57 vérités fondamentales (brainstorming cofondateurs), B2B Enterprise Roadmap, Analyse Nanoclaw, Exploration code MnM (38 tables, 31 services, 22 routes)

---

## Table des matières

1. [Analyse Marché B2B & Paysage Concurrentiel](#1-analyse-marché-b2b--paysage-concurrentiel)
2. [Vision Produit, Problem Statement & 9 Personas](#2-vision-produit-problem-statement--9-personas)
3. [Les 5 Noyaux de Valeur & Synthèse Créative](#3-les-5-noyaux-de-valeur--synthèse-créative)
4. [Positionnement Stratégique & Business Model](#4-positionnement-stratégique--business-model)
5. [Experience Strategy Multi-Rôle & Curseur d'Automatisation](#5-experience-strategy-multi-rôle--curseur-dautomatisation)
6. [Faisabilité Technique & Contraintes Architecturales](#6-faisabilité-technique--contraintes-architecturales)
7. [Scope MVP, Risques & Priorisation](#7-scope-mvp-risques--priorisation)
8. [Requirements Business Formels](#8-requirements-business-formels)
9. [Modèle de Domaine Conceptuel](#9-modèle-de-domaine-conceptuel)
10. [Risques Concurrentiels](#10-risques-concurrentiels)
11. [Conclusion & Prochaines Actions](#11-conclusion--prochaines-actions)

---

## 1. Analyse Marché B2B & Paysage Concurrentiel

*Section par Mary l'Analyste 📊*

### 1.1 Taille du marché et projections

Le marché de l'orchestration IA connaît une croissance explosive :

| Segment | 2025 | 2026 (estimé) | 2030 (projeté) | CAGR |
|---------|------|---------------|----------------|------|
| **Marché de l'orchestration IA** | 11,02 Mrd USD | ~13,5 Mrd USD | 30,23 Mrd USD | 22,3% |
| **Marché des agents IA** | 7,63 Mrd USD | 10,91 Mrd USD | ~65 Mrd USD | 49,6% |
| **Agents IA autonomes** | ~5 Mrd USD | 8,5 Mrd USD | 35 Mrd USD | ~45% |

**Projection Gartner :** Les agents IA commanderont 15 000 milliards USD en achats B2B d'ici 2028 — signalant que l'agent IA devient un acteur économique à part entière.

### 1.2 Tendances structurantes (mars 2026)

**Tendance 1 — Du chatbot à l'agent exécutant.** Le marché passe des assistants conversationnels aux agents qui exécutent des actions dans les systèmes live. C'est exactement le positionnement de MnM (vérité #33 : "l'entreprise autonome avec l'humain en go/no-go").

**Tendance 2 — La gouvernance comme différenciateur.** Les plateformes leaders sont celles qui traduisent les intentions en **actions step-by-step, liées à des politiques**, avec audit trail. C'est le noyau 1 de MnM (orchestrateur déterministique) + le noyau 2 (observabilité & audit).

**Tendance 3 — Multi-agent plutôt que mono-agent.** L'industrie converge vers des architectures où plusieurs agents spécialisés collaborent via des protocoles standardisés (A2A de Google, MCP d'Anthropic). MnM est nativement multi-agent avec communication inter-agents.

**Tendance 4 — Human-in-the-loop obligatoire en enterprise.** Les entreprises exigent des points de validation humaine dans les workflows automatisés. Le curseur d'automatisation de MnM (manuel → assisté → auto, vérité #30) répond directement à cette exigence.

**Tendance 5 — L'ère de l'IDE agentique.** Cursor ($29,3 Mrd de valorisation, $1 Mrd ARR) et Windsurf ($30M ARR enterprise) prouvent que les développeurs adoptent massivement les outils IA. Mais ces IDE restent du dev-only — ils ne connectent pas le dev au reste de l'organisation.

### 1.3 Maturité du marché — Analyse par segment

| Segment | Maturité | Leaders | Gap MnM |
|---------|----------|---------|---------|
| **IDE IA (dev)** | Mature | Cursor, Windsurf, Claude Code | MnM n'est PAS un IDE — il orchestre les IDE |
| **Gestion de projet** | Mature (+ IA naissante) | Jira, Linear, ClickUp | MnM remplace la couche workflow, pas les tickets |
| **Frameworks d'agents** | Émergent | CrewAI, LangGraph, AutoGen/MS Agent | MnM est au-DESSUS des frameworks — il les contrôle |
| **Orchestration déterministique** | Quasi-inexistant | — | **C'est le white space de MnM** |
| **Supervision multi-rôle** | Inexistant | — | **C'est le blue ocean de MnM** |

### 1.4 Paysage concurrentiel détaillé

#### Outils de Gestion de Projet

**Jira (Atlassian)** — Standard enterprise pour le suivi de projet. Février 2026 : lancement "Agents in Jira" — assigner des tâches à des agents IA. Score IA : 30/50. **Ce qu'il ne fait PAS :** workflows déterministiques, orchestration inter-rôles CEO→Dev, drift detection, dual-speed workflow, capture du savoir tacite.

**Linear** — UX rapide, triage IA automatique, génération de sous-issues. **Ce qu'il ne fait PAS :** multi-rôle (dev-only), agents d'exécution, workflows hiérarchiques, mode oral vs visuel, connecteurs auto-générés.

**ClickUp** — Suite tout-en-un avec ClickUp Brain. Score IA : 32/50 (meilleur actuel). **Ce qu'il ne fait PAS :** orchestration déterministique, containerisation/isolation, audit trail des agents, permissions agent-to-agent, compaction management.

#### IDE IA

**Cursor (Anysphere)** — $29,3 Mrd valorisation, $1 Mrd+ ARR, 50% Fortune 500. **Ce qu'il ne fait PAS :** multi-rôle, workflow orchestration, visibilité managériale, workflows déterministiques, coordination inter-agents, audit centralisé.

**Windsurf (Cognition AI)** — Enterprise-first (FedRAMP, HIPAA), $30M ARR. **Ce qu'il ne fait PAS :** connexion dev↔PM/PO/QA, supervision multi-agent, capture du savoir tribal.

#### Frameworks d'Agents

**CrewAI** — Framework open source role-based, 40% plus rapide que LangGraph. **Ce qu'il ne fait PAS :** pas de UI, pas de déterminisme imposé, pas d'onboarding enterprise, pas d'observabilité intégrée, pas de gestion de compaction.

**Microsoft Agent Framework** — RC février 2026, graph-based workflows, A2A+MCP. **Le plus menaçant**, mais building block pas produit fini. Lock-in Azure. Pas de UI, drift detection, curseur d'automatisation.

**LangGraph** — 30-40% meilleure latence, durable execution. **Ce qu'il ne fait PAS :** pas de UI, pas de modèle multi-rôle, pas de containerisation, pas d'import/migration.

### 1.5 Matrice de synthèse concurrentielle

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

### 1.6 White space identifié

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

---

## 2. Vision Produit, Problem Statement & 9 Personas

*Section par John le PM 📋*

### 2.1 Vision Produit — Pourquoi MnM, Pourquoi Maintenant

En mars 2026, les entreprises vivent un paradoxe : elles déploient massivement des outils IA mais n'ont **aucun moyen de les orchestrer, contrôler et auditer** à l'échelle de l'organisation. Chaque collaborateur bricole son propre usage — le directeur produit accumule des fichiers dans un repo git avec Claude Code, le dev utilise Cursor en solo, le CEO demande des analyses à ChatGPT — mais personne ne capitalise, personne ne coordonne, et personne ne trace.

Trois forces convergent en 2026 :

1. **La maturité des agents IA** — Capables d'exécuter des tâches complexes, mais leur fiabilité dépend des garde-fous. Le CTO de CBA l'a constaté au hackathon de mars 2026 (Vérité #45).

2. **La pression de transformation digitale** — Déployer de l'IA sans gouvernance, c'est comme déployer du cloud sans sécurité. Le besoin d'un "cockpit de contrôle" est imminent.

3. **L'échec des outils existants à évoluer** — Jira = tracking, pas orchestration. Cursor = développeur individuel, pas équipe multi-rôles. Aucun ne combine vision transversale + orchestration d'agents + audit enterprise.

> **L'insight fondamental :** Les entreprises n'ont pas besoin d'un meilleur Jira ou d'un meilleur Cursor. Elles ont besoin d'un **cockpit d'orchestration** où chaque partie prenante — du CEO au développeur — pilote ses agents IA dans un cadre déterministe, auditable, et collaboratif.

### 2.2 Problem Statement

**Le problème :** Dans une entreprise tech en transformation digitale, l'information se dégrade à chaque passage de relais entre rôles (PPT → Epic → Story → Code → Tests). Les contrats inter-rôles ne sont jamais respectés. Les décisions critiques disparaissent. Le savoir critique reste dans les têtes des experts. Et le coût de la coordination synchrone est colossal.

**Les 8 faits terrain (validés chez CBA, mars 2026) :**

1. L'information se dégrade à chaque handoff (Vérité #1)
2. Les contrats inter-rôles sont aspirationnels, jamais appliqués (Vérité #2)
3. Des décisions non-documentées se prennent en permanence (Vérité #3)
4. Le savoir critique est partiellement tacite (Vérité #5)
5. La boucle de feedback est structurellement trop longue (Vérité #6)
6. L'alignement inter-équipe est un goulot d'étranglement synchrone (Vérité #13)
7. L'information de pilotage n'existe nulle part de manière unifiée (Vérité #15)
8. Les workflows actuels CRÉENT des problèmes qui n'existeraient pas sans eux (Vérité #23)

### 2.3 Les 9 Personas

#### Persona 1 : Le CEO — Le Pilote Stratégique

**Pain points :** Consomme de l'info multi-format non-unifiée. Quand il change de priorité stratégique, ça met des semaines à s'appliquer terrain. Pas de visibilité temps réel sans intermédiaires.

**Ce que MnM apporte :** Dashboard avec agents qui ont la vision sur TOUTE la chaîne. Onboarding conversationnel. Propagation structurée des décisions.

> *"Aujourd'hui je passe 2h/semaine à compiler des infos de 5 outils. Avec MnM, j'ouvre un dashboard et je pose une question."*

#### Persona 2 : Le CTO / DSI — Le Garant Technique

**Pain points :** Agents qui ne chargent pas les bons fichiers (feedback hackathon CBA). Aucune traçabilité centralisée. Pas de moyen d'imposer des standards automatiquement.

**Ce que MnM apporte :** Workflows déterministiques. Audit centralisé. Drift detection. Gestion de compaction plateforme.

> *"Au hackathon, j'ai vu des agents qui sautaient des étapes. Avec MnM, je définis le workflow une fois et si l'agent dévie, je le sais en 5 minutes."*

#### Persona 3 : Le DPO — Le Chef d'Orchestre Produit

**Pain points :** Agrégation manuelle des infos PM. Pas de vue d'ensemble roadmaps. Bricolage local puissant mais fragile.

**Ce que MnM apporte :** Workflows structurés. Base de connaissances personnelle connectée. Vue inter-équipes avec détection de conflits.

> *"Mon repo git perso avec des années de data — si je pars, tout est perdu. Avec MnM, c'est un capital collectif."*

#### Persona 4 : Le PM — Le Stratège Produit

**Pain points :** PowerPoints re-interprétés au handoff. 80% exécution / 20% réflexion. Pas de lien direct entre recherche et exécution.

**Ce que MnM apporte :** Brainstorm assisté → output structuré exploitable. Ratio inversé : 20% supervision / 80% réflexion.

> *"Je brainstorme avec un agent, l'output part directement dans le workflow. Plus de téléphone arabe."*

#### Persona 5 : Le PO — Le Traducteur de Besoins

**Pain points :** 80% d'exécution mécanique. Definition of Ready jamais respectée. Savoir tribal non-documenté.

**Ce que MnM apporte :** Agents écrivent les stories, le PO valide. Savoir tribal progressivement capturé. Communication inter-agents.

> *"80% de mon temps c'est de la mise en forme. Avec MnM, je me concentre sur comprendre le métier."*

#### Persona 6 : Le Designer — L'Architecte de l'Expérience

**Pain points :** Sollicité de manière ad-hoc. Recos arrivent trop tard dans le cycle. Pas de lien direct maquettes→code.

**Ce que MnM apporte :** Notification automatique dans le workflow. Maquettes directement liées aux stories et agents dev.

> *"On me demande une maquette en urgence parce que le dev a déjà commencé. Avec MnM, je suis notifié dès l'epic."*

#### Persona 7 : Le Développeur — L'Artisan du Code

**Pain points :** IA utilisée individuellement sans orchestration. Peur du remplacement. Contributions cross-rôles bloquées.

**Ce que MnM apporte :** Agent personnel avec contexte complet. Dialogue temps réel pendant l'exécution. Vision d'évolution du rôle. Curseur d'automatisation personnel.

> *"Mon agent connaît le contexte du projet. Je peux le guider en live. C'est un junior ultra-rapide que je supervise."*

#### Persona 8 : Le QA / Testeur — Le Gardien de la Qualité

**Pain points :** Tests manuels répétitifs. Edge cases "dans la tête" que personne ne connaît. Peur de l'obsolescence.

**Ce que MnM apporte :** Capture progressive du savoir tacite. De testeur-exécutant à architecte de qualité. Shift-left.

> *"J'ai 8 ans d'expérience. Je formalise ce savoir et les agents l'exécutent. Je me concentre sur les nouveaux edge cases."*

#### Persona 9 : Le Lead Tech — Le Gardien de l'Architecture

**Pain points :** Travail continu en background qui négocie sa place dans les sprints. Code reviews chronophages. Scrum + versions = "le pire".

**Ce que MnM apporte :** Monitoring automatique dette/dépendances. Code reviews augmentées. Workflows dédiés pour la dette technique.

> *"60% de mon temps sur du scrum et des code reviews. MnM automatise le mécanique et me donne du temps pour ce qui compte."*

### 2.4 Métriques de Succès par Noyau de Valeur

#### Orchestrateur Déterministique

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Taux de respect des workflows | >90% | >98% |
| Temps de détection drift | <15 min | <2 min |
| Taux de réinjection contexte réussie | >85% | >95% |
| Workflows déterministiques actifs | 10+ | 50+ |

#### Observabilité & Audit

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Couverture d'audit | 100% des runs | 100% des runs |
| Latence observabilité | <5s | <2s |
| Réduction MTTR | -40% | -70% |
| NPS transparence agent | >25 | >50 |

#### Onboarding Cascade

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Temps d'onboarding company | <1 semaine | <2 jours |
| Taux de complétion onboarding | >70% | >90% |
| Temps d'import initial | <3 jours | <1 jour |

#### Agent-to-Agent & Permissions

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Queries inter-agents par semaine | 50+ | 500+ |
| Réduction temps de handoff | -30% | -70% |
| Connecteurs auto-générés | 0 | >5 par client |

#### Dual-Speed Workflow

| Métrique | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Ratio exécution mécanique / réflexion | 60/40 | 20/80 |
| Position moyenne curseur | 1.5 | 2.5 |
| Savoir tacite capturé | 100 items | 1000+ items |

#### KPIs Business Transverses

| Objectif | Cible 3 mois | Cible 12 mois |
|---|---|---|
| Premier client pilote (CBA) | POC signé | Production + case study |
| ARR | 10-30k€ | 200k€ |
| Rôles non-dev actifs | >30% | >40% |
| Rétention 90 jours | >70% | >85% |

---

## 3. Les 5 Noyaux de Valeur & Synthèse Créative

*Section par Carson le Coach 🧠*

Les 57 vérités extraites du brainstorming convergent vers 5 piliers structurants qui définissent l'ADN de MnM.

### NOYAU A : L'Orchestrateur Déterministe — "L'agent fait EXACTEMENT ce qu'on lui dit"

C'est la décision architecturale la plus audacieuse du projet. Contrairement à tous les "agent wrappers" du marché qui chargent un workflow dans le contexte d'un LLM et espèrent qu'il le suive, MnM **impose** les workflows de manière algorithmique et déterministe. L'agent n'interprète pas le workflow — MnM l'exécute pour lui, étape par étape, avec les fichiers obligatoires, les prompts injectés, et le contexte contrôlé.

La gestion de la compaction est au cœur de ce noyau. Quand un agent dépasse sa fenêtre de contexte et compacte, il perd potentiellement la définition du workflow. MnM résout ça au niveau plateforme : kill/relance avec contexte frais + résultats intermédiaires, ou réinjection des pré-prompts critiques après compaction.

Et la drift detection — détecter quand un agent dévie de son workflow — c'est le futur argument de vente enterprise qui transforme MnM de "pratique" à "indispensable".

**Vérités sources :** #36, #37, #44, #45, #54
**Ce qui le rend unique :** Aucun outil du marché ne propose de l'orchestration d'agents déterministe. Cursor, Windsurf, Devin — tous laissent l'IA interpréter. MnM traite le workflow comme un contrat algorithmique, pas une suggestion.

### NOYAU B : Observabilité & Audit — "Voir tout, tracer tout, prouver tout"

L'observabilité est la couche de confiance qui rend tout le reste vendable aux entreprises. MnM propose une observabilité simplifiée inspirée de Langfuse : au lieu de logs bruts illisibles, un LLM analyse les traces en temps réel et résume simplement ce que l'agent fait ("il a 5 fichiers en contexte", "il est à l'étape 3 du workflow").

L'audit centralisé est l'argument B2B massue : "si quelque chose merde, on sait exactement où et quand l'agent s'est planté, sans aller sur l'ordi de la personne." Compliance, accountability, confiance managériale — c'est le tiercé gagnant des ventes enterprise.

La containerisation des agents (pattern validé par Nanoclaw) renforce ce noyau : containers Docker éphémères, credential proxy HTTP, mount allowlist tamper-proof, 5 couches de défense en profondeur.

**Vérités sources :** #39, #40, #45, #54
**Ce qui le rend unique :** Les outils d'observabilité IA existent (Langfuse, LangSmith), mais comme couches ajoutées après-coup. Chez MnM, l'observabilité est native, intégrée dans l'orchestration elle-même.

### NOYAU C : Onboarding Cascade — "Du CEO au dev, chacun configure son périmètre"

L'onboarding MnM n'est pas un setup unique où un admin configure tout. C'est une cascade hiérarchique : le CEO définit la structure (rôles, équipes, produits, projets), le CTO raffine la stratégie technique, chaque manager définit son niveau, et l'opérationnel configure ses propres workflows et agents dans le cadre défini. Chaque niveau "définit le niveau inférieur", et les gens d'un même niveau discutent entre eux pour assurer la cohérence.

Le dual-mode de configuration est essentiel : mode oral/chat pour le CEO qui définit sa structure conversationnellement, et mode visuel/technique pour le CTO qui édite précisément les prompts, fichiers, paramètres. Et l'import intelligent depuis Jira/Linear/ClickUp est le "moment de vérité" de l'adoption B2B.

**Vérités sources :** #35, #41, #43, #7, #8, #16
**Ce qui le rend unique :** Les outils B2B font du RBAC classique (admin, manager, user). MnM fait de la délégation structurelle en cascade avec cohérence collective. C'est une innovation d'expérience, pas juste de permissions.

### NOYAU D : Agent-to-Agent + Permissions — "Les agents collaborent avec des droits granulaires"

Les agents de chaque personne peuvent query le contexte complet des agents de leurs collègues. La communication inter-rôles devient machine-to-machine avec l'humain en superviseur. Mais cette fluidité est contrôlée par un système de permissions human-in-the-loop : un agent peut demander l'accès à un artefact d'un autre agent, mais le propriétaire humain valide.

Les agents MnM peuvent créer leurs propres connecteurs vers les outils de l'entreprise. Et MnM est modifiable de l'intérieur par ses propres agents — l'outil s'auto-améliore.

**Vérités sources :** #48, #51, #52, WhatIf #1, WhatIf #3, CrossPol #1
**Ce qui le rend unique :** Communication agent-to-agent avec permissions human-in-the-loop ET connecteurs auto-générés. C'est un système vivant, pas un produit figé.

### NOYAU E : Dual-Speed Workflow — "Mode rapide (dev) + mode gouverné (enterprise)"

Il y a deux vitesses dans tout workflow : la **vitesse humaine** (réflexion, idéation, brainstorm, décision — asynchrone, à son rythme) et la **vitesse machine** (exécution, coordination, transmission — continu, temps réel). MnM gère ces deux flux en parallèle. L'humain injecte des décisions dans le flux machine quand il est prêt, pas quand le sprint l'exige.

Le curseur d'automatisation est la clé de l'adoption : manuel → assisté → automatique. Les 3 modes coexistent dans la même entreprise. L'évolution des rôles est au cœur : de "producteur d'artefacts" à "gardien de qualité et de pertinence." Le PO ne rédige plus de stories — il évalue si celles générées sont bonnes. Savoir faire devient savoir juger.

**Vérités sources :** #22, #25, #30, #31, #32, #33, #34, WhatIf #4, #5, #6, CrossPol #2, #3
**Ce qui le rend unique :** Les outils sont soit "tout manuel" (Jira) soit "tout auto" (Devin). MnM est le seul à proposer un curseur continu entre les deux, personnalisé par utilisateur.

### 3.6 Idées WhatIf & CrossPol — Les possibilités qui font rêver

**WhatIf #1 — Agents comme proxys de communication :** L'agent du dev query directement l'agent du PO pour le contexte exact d'une story. Plus jamais de "il a mal compris ce que je voulais dire."

**WhatIf #4 — Le dual-speed workflow :** Deux flux parallèles — un flux "pensée" (humain) et un flux "exécution" (machine). L'humain injecte des décisions quand il est prêt. C'est la fin de la tyrannie du calendrier sprint sur la pensée créative.

**WhatIf #5 — La mort du planning poker :** L'IA n'a pas besoin d'estimer — elle exécute. Le planning devient de la priorisation pure.

**CrossPol #2 — Le brainstorm comme point d'entrée :** Le workflow ne commence plus par "le PM écrit une epic." Il commence par "des gens brainstorment avec un agent." L'output structuré EST l'input de la chaîne d'exécution.

**CrossPol #3 — L'humain comme validateur :** À chaque étape, l'humain ne "fait" pas — il valide, approuve, redirige. La compétence clé n'est plus "savoir faire" mais "savoir juger."

### 3.7 Croisements entre noyaux

Le croisement **Onboarding Cascade (C) + Curseur d'Automatisation (E)** résout le plus grand défi de l'adoption B2B : comment déployer un outil transformant dans une organisation où les gens avancent à des vitesses différentes ? Chaque niveau hiérarchique définit le cadre, chaque individu choisit son degré d'automatisation.

Le croisement **Orchestration Déterministe (A) + Observabilité (B)** crée un système où chaque déviation d'un agent est non seulement détectée, mais tracée, attribuée, et replayable. C'est du monitoring d'uptime... mais pour des agents IA.

Le croisement **Permissions Agent-to-Agent (D) + Capture de savoir tacite** ouvre une possibilité fascinante : le savoir tribal (tests du QA, contexte métier du PO) devient queryable par d'autres agents — avec permission. L'entreprise construit un capital de connaissances collectif sans effort manuel.

### 3.8 Ce qui rend MnM unique — Le pitch en 3 temps

**Aujourd'hui :** MnM centralise et automatise le mécanique. Chaque user configure son workflow et ses agents. Le management voit l'ensemble.

**Demain :** Brainstorm humain → agents exécutent → humain valide → prod. Les étapes intermédiaires disparaissent. Le workflow complet en quelques heures au lieu de quelques sprints.

**Après-demain :** MnM détecte les opportunités, brainstorme des solutions, simule l'impact, propose au décideur. L'humain est le go/no-go final. L'entreprise est augmentée.

---

## 4. Positionnement Stratégique & Business Model

*Section par Victor le Stratège ⚡*

### 4.1 Positionnement Blue Ocean — La "Tour de Contrôle IA Enterprise"

Le marché est structuré en 3 océans rouges saturés :

**Océan Rouge 1 — Gestion de projet (Jira, Linear, ClickUp)** : outils de tracking passif. Enregistrent ce que les humains font, mais ne dirigent rien. Aucun ne gère d'agents IA.

**Océan Rouge 2 — IDE IA (Cursor, Windsurf, Copilot)** : terminaux améliorés pour développeurs individuels. Pas de vision globale projet. Totalement inaccessible aux non-devs.

**Océan Rouge 3 — Frameworks agentiques (CrewAI, AutoGen, LangGraph)** : librairies pour développeurs. Le CEO ne va pas écrire du Python pour orchestrer ses équipes. Pas d'UI, pas de RBAC, pas de drift detection.

```
                    Gestion de Projet
                    (Jira, Linear)
                         |
                         |  Tracking passif
                         |  Pas d'agents IA
                         |
    IDE IA ----------- [MnM] ----------- Frameworks Agentiques
    (Cursor, Windsurf)    ^               (CrewAI, AutoGen)
    Dev individuel        |               Librairies techniques
    Pas de vision globale |               Pas de produit enterprise
                          |
                   TOUR DE CONTRÔLE
                   IA ENTERPRISE
```

**MnM est à l'orchestration d'agents IA ce que Kubernetes est à l'orchestration de containers — une couche de contrôle indispensable entre l'humain et l'exécution.**

### 4.2 Business Model — 4 Tiers

#### Tier 1 : Open Source (Gratuit)
**Cible :** Développeur solo, freelance, small team (<5). Orchestrateur déterministique complet, workflows personnalisables, observabilité basique. Auto-hébergement uniquement.
**Stratégie :** Nourrit le flywheel d'adoption — chaque dev solo est un futur évangéliste.

#### Tier 2 : Team (~50€/utilisateur/mois)
**Cible :** Équipe 5-50 personnes, startups, PME tech. Multi-users, RBAC métier, scoping par projet, import intelligent, chat temps réel, containerisation. Cloud managed ou self-hosted.
**Stratégie :** 20-30% moins cher qu'un seat Jira Premium + Confluence + outil IA. Seuil d'approbation CTO sans validation C-level.

#### Tier 3 : Enterprise (~200€/utilisateur/mois + support)
**Cible :** Grande entreprise 100+ users. SSO SAML/OIDC, audit log complet, drift detection avancée, multi-tenant, dashboards par rôle, credential isolation, SLA garanti + CSM.
**Stratégie :** Comparable à Datadog/PagerDuty enterprise. L'argument : "Combien vous coûte un agent IA qui dévie en production sans que personne ne le détecte ?"

#### Tier 4 : On-Premise (Licence annuelle, prix sur mesure)
**Cible :** Secteurs réglementés (banque, santé, défense). Déploiement complet chez le client, zero data exfiltration, connecteurs custom.
**Stratégie :** Part disproportionnée des budgets IT. Le plus défensible : switching cost énorme.

#### Projection de revenus

| Métrique | Année 1 | Année 2 | Année 3 |
|---|---|---|---|
| Open Source (MAU) | 500 | 5 000 | 25 000 |
| Team (clients) | 5 | 25 | 80 |
| Enterprise | 1 (CBA) | 5 | 15 |
| **ARR estimé** | ~100k€ | ~800k€ | ~3M€ |

### 4.3 Go-to-Market — Le Flywheel

**Phase 1 — CBA comme Design Partner (T1-T2 2026)** : Tom travaille à CBA, connaît les pain points de chaque rôle. Pitcher le CTO ("Tu te rappelles quand tu disais que les agents chargeaient pas les bons fichiers ? On a un outil qui résout exactement ça."). Déployer sur un projet pilote, itérer en temps réel, documenter les résultats.

**Phase 2 — Early Adopters (T3-T4 2026)** : Open source d'abord → Product Hunt ("Kubernetes for AI Agents") → Hacker News (article technique sur la compaction) → Content marketing.

**Le flywheel :**
```
Dev solo essaie (gratuit) → Configure ses agents → En parle à son équipe
→ Tier Team → CTO veut scaler → Enterprise deal → Case study → Cycle se répète
```

**Phase 3 — Scale B2B (2027+)** : Premier Sales Engineer, cibler les entreprises en "hackathon IA", partenariats intégrateurs (Capgemini, Accenture), conférences (VivaTech, KubeCon), programme de certification.

### 4.4 Moat Défensif — 4 Fossés Durables

**Fossé 1 : Compaction Intelligence** — MnM apprend quels éléments de contexte sont essentiels pour chaque type de workflow. Plus d'agents en production → meilleure stratégie de compaction. Données propriétaires par design.

**Fossé 2 : Drift Detection IP** — Signatures comportementales spécifiques à chaque type de workflow, enrichies par chaque drift détecté et confirmé/infirmé. Le taux de faux positifs diminue avec le temps.

**Fossé 3 : Flywheel Données** — Plus d'utilisateurs → plus de workflows → meilleures recommandations → meilleure expérience → plus d'utilisateurs. Templates enrichis, benchmarks par secteur, suggestions intelligentes.

**Fossé 4 : Switching Cost** — Workflows configurés + savoir tribal capturé + intelligence de compaction + signatures de drift + connecteurs custom + historique d'audit. Croissance organique avec l'usage.

Les 4 fossés se renforcent mutuellement :
```
Compaction Intelligence ←→ Drift Detection IP
        ↕                          ↕
 Flywheel Données    ←→    Switching Cost
```

---

## 5. Experience Strategy Multi-Rôle & Curseur d'Automatisation

*Section par Sally la Designer 🎨*

### 5.1 Philosophie UX : Une Interface, Cinq Modes

MnM repose sur un principe fondateur : **une plateforme unique qui s'adapte à chaque rôle**, pas un outil générique qui force tout le monde dans le même moule.

| Mode | Persona primaire | Expérience | Principe directeur |
|------|-----------------|------------|-------------------|
| **ORAL** | CEO, DSI, DPO | Conversation naturelle avec un agent d'interface. Dicte sa stratégie, pose des questions, reçoit des synthèses structurées. | "Je parle, MnM structure" |
| **VISUEL** | CTO, Lead Tech, DSI | Dashboards temps réel, graphes de dépendances, monitoring de drift, métriques d'avancement. | "Je vois tout d'un coup d'œil" |
| **CODE** | Dev, Lead Tech | Intégration IDE native, terminal intégré, git embarqué, agent pilotable en temps réel. | "Mon workflow de dev, augmenté" |
| **BOARD** | PM, PO, DPO | Kanban, roadmap, priorisation drag-and-drop, epics, stories, suivi sprint. | "Mon backlog, orchestré" |
| **TEST** | QA, Lead Tech | Suites de tests, couverture, rapports de régression, historique de bugs. | "Mes tests, capitalisés" |

Ces modes ne sont pas des "pages" séparées. Ils coexistent dans le même cockpit. Un Lead Dev active les modes CODE + BOARD + VISUEL simultanément. Le mode est un **filtre sur la même réalité partagée**, pas un silo.

### 5.2 User Journeys par Persona

#### Journey 1 : Onboarding CEO — Du lancement à la première vision globale

| Étape | Action CEO | Réponse MnM | Mode |
|-------|-----------|-------------|------|
| Premier lancement | Se connecte | Agent d'onboarding : "Décrivez votre entreprise..." | ORAL |
| Définition structure | Dicte : "On a 3 BU — France, USA, Transverse..." | MnM crée companies, propose rôles, génère l'organigramme | ORAL → VISUEL |
| Cascade hiérarchique | Valide la structure | Invitations générées avec contexte pré-configuré | ORAL |
| Import existant | "On utilise Jira" | Agent scanne Jira, propose mapping vers MnM | ORAL |
| Premier dashboard | Après 48h | Avancement par BU, agents actifs, alertes de drift, KPIs | VISUEL + ORAL |

**Insight UX :** Le CEO ne touche jamais à un prompt, ne configure jamais un agent, ne voit jamais une ligne de code. Il parle, valide, et supervise.

#### Journey 2 : Configuration CTO

| Étape | Action CTO | Réponse MnM | Mode |
|-------|-----------|-------------|------|
| Acceptation invite | Clique le lien | Voit son périmètre technique | VISUEL |
| Config SSO | Configure SAML/OIDC | Interface formulaire technique | VISUEL |
| Définition workflows | Crée "Dev Story" : brief → code → review → test → merge | Drag-and-drop, édition prompts, sélection fichiers | VISUEL + CODE |
| Monitoring agents | Dashboard drift detection | Déviations détectées, traçables, intervention possible | VISUEL |

#### Journey 3 : Quotidien Dev

| Étape | Action Dev | Réponse MnM | Mode |
|-------|-----------|-------------|------|
| Check inbox | Ouvre MnM | 2 stories, 1 review, 1 bug urgent | BOARD |
| Lancement agent | Sélectionne la story | Agent se lance avec workflow déterministe et contexte complet | CODE |
| Pilotage temps réel | "Utilise plutôt le pattern X" | Chat temps réel, l'agent s'adapte sans perdre le contexte | CODE |
| Review + Merge | Valide le code | MR créée, agent QA a généré les tests, audit trace tout | CODE |

#### Journey 4 : Workflow PO

| Étape | Action PO | Réponse MnM | Mode |
|-------|----------|-------------|------|
| Réception besoin | PM a créé une epic | Contexte complet : analyse marché, maquettes, contraintes | BOARD |
| Décomposition stories | Brainstorme avec agent | Stories structurées s'appuyant sur maquettes ET contexte technique | BOARD + ORAL |
| Suivi sprint | Dashboard temps réel | Stories en cours, bloquées, terminées, alertes drift | BOARD + VISUEL |

### 5.3 Le Curseur d'Automatisation — Concept UX Central

Issu de la vérité #30 : "L'adoption de l'automatisation est un curseur individuel, pas un switch global."

#### Les 3 positions

```
[MANUEL] -------- [ASSISTÉ] -------- [AUTOMATIQUE]
  |                   |                    |
  L'humain fait      L'agent propose     L'agent exécute
  L'agent observe    L'humain valide     L'humain supervise
```

**MANUEL** : L'utilisateur exécute, l'agent observe et propose des suggestions non-intrusives.

**ASSISTÉ** : L'agent propose des actions, l'utilisateur valide en 1 clic. L'humain reste le "gate" de qualité.

**AUTOMATIQUE** : L'agent exécute, l'humain supervise les exceptions. Intervention uniquement sur anomalies.

#### Application multi-dimensionnelle

| Niveau | Exemple | Qui le règle |
|--------|---------|-------------|
| **Par action** | "Génération de tests = auto, code review = assisté" | L'utilisateur |
| **Par agent** | "Agent reporting = auto, agent brainstorm = manuel" | L'utilisateur |
| **Par projet** | "Projet legacy = assisté, nouveau projet = auto" | Le manager/CTO |
| **Par entreprise** | "Plafond global : aucun merge sans validation humaine" | Le CEO/CTO |

**La hiérarchie l'emporte** : le CEO peut imposer un plafond que les niveaux inférieurs ne peuvent pas dépasser.

#### L'évolution naturelle

1. **Semaine 1-2** : Tout en MANUEL. Découverte.
2. **Mois 1** : Tâches répétitives en ASSISTÉ.
3. **Mois 3+** : Tâches maîtrisées en AUTOMATIQUE. Tâches stratégiques/créatives en MANUEL par choix.

C'est le mécanisme de transformation éthique des rôles : on ne supprime pas le rôle, on l'élève progressivement.

### 5.4 Garanties de Confiance UX

**Pour les opérationnels :** Transparence totale, contrôle personnel du curseur, pas de flicage (métriques agrégées, jamais individuelles — vérité #20).

**Pour le management :** Audit centralisé, drift detection, plafond d'automatisation.

**Pour l'entreprise :** Traçabilité compliance, import progressif, chaque équipe avance à son rythme.

---

## 6. Faisabilité Technique & Contraintes Architecturales

*Section par Winston l'Architecte 🏗️ — basée sur l'exploration directe du code MnM*

### 6.1 État technique actuel

| Couche | Technologie | Maturité |
|--------|------------|----------|
| **Frontend** | React 18 + Vite, React Query, Tailwind CSS, shadcn/ui | Mature |
| **Backend** | Express + tsx, Node.js | Mature |
| **Base de données** | PostgreSQL (Drizzle ORM), **38 tables** | Mature |
| **Temps réel** | WebSocket (ws), EventEmitter interne | Fonctionnel |
| **Auth** | Better Auth (email+password, sessions DB) | Complet |
| **Agents** | 8 types d'adapters (claude_local, codex, openclaw, etc.) | Extensible |
| **Secrets** | Versionnés, 4 providers (local, AWS, GCP, Vault) | Avancé |

Le schéma comprend 38 tables couvrant : companies, agents (11 rôles), projects, issues (7 statuts), goals (4 niveaux), workflows déterministiques avec stages, heartbeat runs, events granulaires, sessions persistantes, secrets versionnés (4 providers), contrôle d'accès avec scope JSONB, et activity log.

### 6.2 Ce qui existe vs ce qui manque

| Feature B2B | Statut | Effort estimé |
|-------------|--------|---------------|
| Auth (login/signup/sessions) | **EXISTE — Complet** | — |
| Multi-company avec isolation | **EXISTE — Complet** | — |
| Invitations (backend) | **EXISTE — Complet** | UI: 2-3j |
| Permissions admin (6 clés) | **EXISTE — Partiel** | — |
| Gestion de secrets versionnés | **EXISTE — Avancé** | — |
| WebSocket temps réel | **EXISTE — Read-only** | 2-3 sem |
| Workflows déterministiques | **EXISTE — Structure** | Enforcement |
| Activity log | **EXISTE — Basique** | 2-3 sem |
| Drift detection | **EXISTE — En cours** | À compléter |
| RBAC rôles métier humains | **MANQUE** | 2 sem |
| Scoping sous-company | **MANQUE** | 2-3 sem |
| Chat temps réel humain-agent | **MANQUE** | 2-3 sem |
| Containerisation agents | **MANQUE** | 3-5 sem |
| Credential proxy | **MANQUE** | 1-2 sem |
| SSO SAML/OIDC | **MANQUE** | 3-4j |
| UI d'administration | **MANQUE** | 1 sem |
| Import Jira/Linear | **MANQUE** | 2-3 sem |

**Analyse :** Le modèle de données est remarquablement complet. Le trou critique : RBAC et scoping — les tables existent (`principalPermissionGrants.scope`), mais `hasPermission()` ne lit jamais le champ `scope`. Le trou stratégique : chat temps réel et containerisation.

### 6.3 Patterns Nanoclaw à adopter

| Pattern | Adaptation MnM | Priorité |
|---------|----------------|----------|
| **Credential Proxy HTTP** | Express proxy + synergie `secrets.ts` existant | P1 |
| **Container éphémère `--rm`** | `ContainerManager` + `dockerode` + images par profil | P1 |
| **Mount allowlist tamper-proof** | Config PostgreSQL + fichier local self-hosted | P1 |
| **Shadow `.env` avec `/dev/null`** | Identique | P1 |
| **MessageStream AsyncIterable** | WebSocket → stdin pipe. Latence ~0ms (vs 500ms Nanoclaw) | P2 |
| **Timeout avec reset sur output** | Adapter dans `heartbeat.ts` | P2 |

**Avantage structurel MnM sur Nanoclaw :** WebSocket (vs file-based IPC), PostgreSQL (vs SQLite), UI React (vs headless), monorepo (vs monolithe), secrets versionnés (vs env vars plates).

### 6.4 Contraintes structurantes

1. **Le RBAC doit précéder le scoping** — Définir QUI peut faire quoi avant de limiter QUI voit quoi.
2. **La containerisation doit précéder le chat en production** — En multi-tenant, agents isolés AVANT injection de messages.
3. **Le credential proxy est un prérequis B2B** — Aucune entreprise n'acceptera des clés API visibles par les agents.
4. **PostgreSQL embarqué → externe** — Prérequis de déploiement.
5. **WebSocket → bidirectionnel** — Infrastructure solide, ajouter un handler de messages entrants.

### 6.5 Choix architecturaux

1. **Docker** comme runtime d'isolation (pas WASM, pas nsjail)
2. **PostgreSQL row-level security** pour le multi-tenant
3. **WebSocket bidirectionnel** (pas SSE, pas long-polling)
4. **Adapter pattern** pour containerisation (`docker_local`, futur `k8s_managed`)
5. **Credential proxy comme service MnM** (pas sidecar)

### 6.6 Conclusion technique

**Aucune ré-architecture drastique n'est nécessaire.** Le schéma existant est remarquablement bien pensé pour le B2B. Les principaux chantiers sont de l'implémentation de logique manquante sur des structures déjà en place.

**MVP B2B vendable :** ~6-8 semaines (RBAC + containerisation en parallèle).
**Product B2B enterprise-grade :** ~12-16 semaines additionnelles.

---

## 7. Scope MVP, Risques & Priorisation

*Section par Bob le Scrum Master 🏃*

### 7.1 Scope MVP — 4 Phases

#### Phase 1 — Multi-user Livrable (~1 semaine)

| Tâche | Effort | Impact |
|-------|--------|--------|
| Bouton "Inviter un membre" | 1j | Critique — débloque le multi-user |
| Page "Membres" par company | 1j | Élevé — administration basique |
| Bouton sign-out | 0.5j | Élevé — signal de maturité |
| Désactiver signup libre | 0.5j | Élevé — sécurité enterprise |
| Page profil user | 1j | Moyen — basique attendu |
| Migration PostgreSQL externe | 1j | Critique — production-ready |

#### Phase 2 — RBAC Métier (~2 semaines)

| Tâche | Effort |
|-------|--------|
| Rôles métier (admin, manager, contributor, viewer) | 1j |
| Étendre PERMISSION_KEYS (9 nouvelles clés) | 2j |
| Presets de permissions par rôle | 1j |
| Brancher `access.canUser()` dans chaque route | 3j |
| UI sélecteur de rôle + page admin permissions | 2j |
| Masquer navigation selon permissions | 1j |

#### Phase 3 — Scoping par Projet (~2-3 semaines)

| Tâche | Effort |
|-------|--------|
| Table `project_memberships` | 1j |
| Modifier `hasPermission()` pour `scope` | 2j |
| Filtrer routes `list` par project membership | 3-4j |
| Scoping agents et workflows | 3j |
| UI page "Accès" par projet + filtrage sidebar | 4j |

#### Phase 4 — Enterprise-grade (~3-4 semaines)

| Tâche | Effort |
|-------|--------|
| SSO SAML/OIDC | 3-4j |
| Audit log complet | 3j |
| Rate limiting + throttling | 2j |
| Dashboards par rôle | 3-5j |
| Multi-tenant SaaS | 3-5j |
| Email transactionnel + backup + doc admin | 6-8j |

### 7.2 Risques et Contraintes

#### 6 Risques RÉELS

| # | Risque | Prob. | Impact | Mitigation |
|---|--------|-------|--------|------------|
| R1 | Gestion de compaction techniquement dure | Élevée | Critique | Kill+relance ou réinjection. Problème plateforme. |
| R2 | Gens pas prêts pour le full auto | Élevée | Élevé | Curseur d'automatisation. Risque temporaire. |
| R3 | Import Jira/Linear complexe | Élevée | Critique | Import basique d'abord, enrichir ensuite. |
| R4 | Drift detection trop complexe | Moyenne | Moyen | Non-bloquant MVP. Implémentation progressive. |
| R5 | Résistance au changement (Jira) | Moyenne | Élevé | Migration progressive, coexistence temporaire. |
| R6 | "Faire péter les rôles" = éthique | Élevée | Critique | Pitch "élévation". Métriques agrégées. |

#### 3 Risques IMAGINÉS

| # | "Risque" | Pourquoi c'est imaginé |
|---|----------|----------------------|
| I1 | MnM doit être un data lake | MnM = orchestrateur-connecteur (correction brainstorming). |
| I2 | Agents ne peuvent pas créer de connecteurs | Possible via MCP et codegen. |
| I3 | CEO ne voudra pas configurer via chat | Le DPO de CBA le fait DÉJÀ avec Claude Code. |

### 7.3 Matrice de Priorisation

```
                        IMPACT
                 Faible          Élevé
              ┌─────────────┬─────────────┐
   Faible     │  FILL LATER │  QUICK WINS │
   Effort     │  Sign-out   │  Invitations│
              │  Profil     │  Page Membres│
              │  Disable    │  PG externe │
              │  signup     │             │
              ├─────────────┼─────────────┤
   Élevé      │  ÉVITER     │  STRATEGIC  │
   Effort     │  Email      │  RBAC       │
              │  transac.   │  Scoping    │
              │  Backup     │  SSO, Audit │
              │             │  Orchestrat.│
              │             │  Import Jira│
              └─────────────┴─────────────┘
```

### 7.4 Split Cofondateurs — Travail en Parallèle

| Cofondateur | Noyaux | Profil |
|-------------|--------|--------|
| **Tom (Gabri)** | B (Onboarding) + D (Observabilité) | Product engineer — UX/adoption, import, dual-mode, Langfuse, audit |
| **Cofondateur** | A (Orchestrateur) + D (Observabilité) | Ingénieur système — moteur, compaction, state machine, drift |
| **Partagé** | D (Observabilité & Audit) | Couche transverse |

**Noyau E (Dual-Speed)** : émerge naturellement une fois A + B en place.

```
SEMAINE 1-2                    SEMAINE 3-4
┌──────────────────┐           ┌──────────────────┐
│ TOM              │           │ TOM              │
│ Phase 1: Multi-  │           │ Import + Onboard.│
│ user UI          │           │ Observabilité    │
└──────────────────┘           └──────────────────┘
        ║ Pas de dépendance            ║
┌──────────────────┐           ┌──────────────────┐
│ COFONDATEUR      │           │ COFONDATEUR      │
│ Orchestrateur v1 │           │ Compaction +     │
│ State machine    │           │ Drift detect. v1 │
└──────────────────┘           └──────────────────┘
```

### 7.5 Timeline

```
Mars 2026              Avril 2026             Mai 2026              Juin 2026
S1    S2    S3    S4   S1    S2    S3    S4   S1    S2    S3    S4  S1    S2
┌─────┬─────┬─────┬────┬─────┬─────┬─────┬────┬─────┬─────┬─────┬────┬─────┬─────┐
│Ph.1 │ Phase 2 — RBAC│ Phase 3 — Scoping    │ Phase 4 — Enterprise │ DEMO│VENTE│
│ 1s  │    2 sem       │     2-3 sem          │      3-4 sem         │ CBA │     │
└─────┴─────┴─────┴────┴─────┴─────┴─────┴────┴─────┴─────┴─────┴────┴─────┴─────┘
```

**Total estimé : ~8-10 semaines** pour passer de "outil perso" à "produit B2B vendable."

---

## 8. Requirements Business Formels

*23 requirements extraits des 57 vérités par Mary l'Analyste*

### Orchestration (REQ-ORCH)

- **REQ-ORCH-01** : Le système DOIT imposer algorithmiquement les étapes d'un workflow aux agents.
- **REQ-ORCH-02** : Le système DOIT réinjecter les pré-prompts critiques après chaque compaction.
- **REQ-ORCH-03** : Le système DOIT fournir 2 stratégies de compaction : kill+relance ou réinjection.
- **REQ-ORCH-04** : L'administrateur DOIT pouvoir définir les fichiers/prompts obligatoires par étape.
- **REQ-ORCH-05** : Le système DOIT détecter et alerter quand un agent dévie (drift detection).

### Observabilité & Audit (REQ-OBS)

- **REQ-OBS-01** : Résumé LLM temps réel des actions de chaque agent.
- **REQ-OBS-02** : Logs centralisés avec traçabilité complète (qui, quoi, quand, dans quel workflow).
- **REQ-OBS-03** : Dashboards management avec données agrégées, JAMAIS individuelles.
- **REQ-OBS-04** : Traçage automatique des décisions prises pendant l'exécution.

### Onboarding & Configuration (REQ-ONB)

- **REQ-ONB-01** : Onboarding en cascade : CEO → CTO → Leads → opérationnels.
- **REQ-ONB-02** : 2 modes de configuration : conversationnel et visuel.
- **REQ-ONB-03** : Import intelligent depuis Jira, Linear, ClickUp.
- **REQ-ONB-04** : Après import, MnM = source unique de vérité.

### Agent-to-Agent & Permissions (REQ-A2A)

- **REQ-A2A-01** : Accès inter-agents avec validation humaine.
- **REQ-A2A-02** : Agents capables de générer des connecteurs vers systèmes externes.
- **REQ-A2A-03** : MnM modifiable par ses propres agents.
- **REQ-A2A-04** : Query directe du contexte inter-agents pour les faits.

### Dual-Speed & Automatisation (REQ-DUAL)

- **REQ-DUAL-01** : Curseur d'automatisation individuel (manuel, assisté, automatique).
- **REQ-DUAL-02** : Distinction tâches mécaniques vs tâches de jugement humain.
- **REQ-DUAL-03** : Dialogue avec l'agent PENDANT l'exécution.
- **REQ-DUAL-04** : Brainstorm comme point d'entrée de workflow.

### Enterprise (REQ-ENT)

- **REQ-ENT-01** : Rôles composites (combinaisons de permissions).
- **REQ-ENT-02** : 3 niveaux de workflow (global, individuel, interconnexion).
- **REQ-ENT-03** : Interface présentant l'automatisation comme élévation.
- **REQ-ENT-04** : CEO/DSI interrogent directement les agents pour les insights.

---

## 9. Modèle de Domaine Conceptuel

*Par Mary l'Analyste — 12 entités, 5 invariants*

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

**12 entités :** Instance, Company, User, Role, Permission, Project, Agent, Workflow, WorkflowInstance, Task, AuditLog, Connector

**5 invariants du domaine :**
1. **Isolation Company** : Aucun accès cross-company sans membership.
2. **Déterminisme Workflow** : Agent toujours contraint par son Workflow.
3. **Audit Total** : Toute mutation génère un AuditLog.
4. **Permission Scope** : Sans scope = toute la Company ; avec scope = Projects spécifiés.
5. **Curseur Individuel** : Automatisation configurable par propriétaire, dans les limites du Role.

---

## 10. Risques Concurrentiels

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Jira ajoute des workflows déterministiques | Moyenne | Legacy massif, dette technique. MnM est natif-agent. |
| Cursor/Windsurf s'étendent au multi-rôle | Faible | Leur ADN est le code. S'étendre au CEO/PM/QA = pivot majeur. |
| CrewAI ajoute une UI | Moyenne | Framework → produit = réécriture. First-mover advantage. |
| **Microsoft sort un produit fini** | **Haute** | Building block → produit possible. Mitigation : agilité + open source. |
| Nouveau concurrent | Haute | Marché jeune. Mitigation : vitesse, CBA, communauté. |

---

## 11. Conclusion & Prochaines Actions

### Pourquoi les concurrents ne peuvent pas copier MnM

1. **Le déterminisme est architectural** — On ne peut pas l'ajouter après coup.
2. **L'onboarding cascade est un modèle d'adoption** — Pas une feature.
3. **Le curseur d'automatisation résout un problème non-identifié** — Les concurrents pensent "tout auto" ou "tout manuel."
4. **Le flywheel est exponentiel** — Plus d'usage = meilleur produit.
5. **La containerisation + credential proxy = sécurité native** — Security-by-design.

### Actions immédiates

1. **Pitcher le CTO de CBA** — Action n°1, immédiate
2. **Lancer le développement Phase 1** — Multi-user livrable en 1 semaine
3. **Recruter le cofondateur technique** — Split A/D validé
4. **Préparer le PRD B2B** — Étape 2 du pipeline BMAD (ce document)

---

*Product Brief B2B v2.0 — Produit par l'équipe BMAD Agent Team : 7 personas, 57 vérités fondamentales, 23 requirements formels, 12 entités de domaine, 4 phases de développement, 4 tiers de pricing, 4 fossés défensifs. ~12 000 mots.*
