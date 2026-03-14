# PRD B2B — MnM : Tour de Contrôle IA Enterprise
## Sections 1-4 par John le PM

---

## 1. Executive Summary

### 1.1 Contexte

En mars 2026, le marché de l'orchestration IA atteint 13,5 milliards USD avec un CAGR de 22,3%, tandis que le marché des agents IA autonomes explose à 8,5 milliards USD (CAGR 49,6%). Les entreprises déploient massivement des outils IA — Cursor ($29,3 Mrd de valorisation, $1 Mrd ARR), Windsurf ($30M ARR enterprise), agents dans Jira — mais font face à un paradoxe critique : **aucun moyen de les orchestrer, contrôler et auditer à l'échelle de l'organisation**.

Trois forces convergent simultanément :
1. **La maturité des agents IA** — capables d'exécuter des tâches complexes, mais leur fiabilité dépend de garde-fous que personne ne fournit encore. Le CTO de CBA l'a constaté au hackathon de mars 2026 : des agents qui sautent des étapes, ne chargent pas les bons fichiers, dérivent sans contrôle (Vérité #45).
2. **La pression de gouvernance** — déployer de l'IA sans orchestration déterministe et audit trail, c'est comme déployer du cloud sans sécurité. Les plateformes leaders seront celles qui traduisent les intentions en actions step-by-step liées à des politiques.
3. **L'échec structurel des outils existants** — Jira = tracking passif (pas d'orchestration), Cursor = développeur individuel (pas multi-rôle), CrewAI = librairie technique (pas de produit enterprise). Aucun ne combine vision transversale + orchestration d'agents + audit enterprise.

### 1.2 Problème

Dans une entreprise tech en transformation digitale, l'information se dégrade à chaque passage de relais entre rôles (PPT → Epic → Story → Code → Tests). Les contrats inter-rôles ne sont jamais respectés. Les décisions critiques disparaissent. Le savoir tribal reste dans les têtes. Et le coût de la coordination synchrone est colossal — pattern récurrent validé chez CBA : malentendu → dev → découverte du malentendu → re-réunion → re-dev.

Les 8 faits terrain validés chez CBA (mars 2026) confirment que ce problème est structurel, pas accidentel :
1. L'information se dégrade à chaque handoff (Vérité #1)
2. Les contrats inter-rôles sont aspirationnels, jamais appliqués (Vérité #2)
3. Des décisions non-documentées se prennent en permanence (Vérité #3)
4. Le savoir critique est partiellement tacite (Vérité #5)
5. La boucle de feedback est structurellement trop longue (Vérité #6)
6. L'alignement inter-équipe est un goulot d'étranglement synchrone (Vérité #13)
7. L'information de pilotage n'existe nulle part de manière unifiée (Vérité #15)
8. Les workflows actuels CRÉENT des problèmes qui n'existeraient pas sans eux (Vérité #23)

### 1.3 Solution

**MnM** est une plateforme B2B d'orchestration d'agents IA déterministe, conçue pour être la **Tour de Contrôle IA Enterprise**. À l'intersection de trois océans rouges saturés (gestion de projet, IDE IA, frameworks agentiques), MnM occupe un white space unique : **orchestration déterministe + supervision multi-rôle pour l'ensemble de l'organisation**.

MnM est à l'orchestration d'agents IA ce que Kubernetes est à l'orchestration de containers : une couche de contrôle indispensable entre l'humain et l'exécution.

MnM se structure autour de 5 noyaux de valeur :
- **Noyau A — Orchestrateur Déterministe** : L'agent fait EXACTEMENT ce qu'on lui dit. Workflows imposés algorithmiquement, pas suggérés. Gestion de compaction au niveau plateforme (kill+relance ou réinjection). Drift detection.
- **Noyau B — Observabilité & Audit** : Voir tout, tracer tout, prouver tout. Résumé LLM temps réel, audit centralisé, containerisation des agents avec credential proxy.
- **Noyau C — Onboarding Cascade** : Du CEO au dev, chaque niveau configure son périmètre. Dual-mode oral/visuel. Import intelligent depuis Jira/Linear/ClickUp.
- **Noyau D — Agent-to-Agent + Permissions** : Communication inter-agents avec permissions human-in-the-loop. Query directe du contexte inter-agents. Connecteurs auto-générés.
- **Noyau E — Dual-Speed Workflow** : Vitesse humaine (réflexion) + vitesse machine (exécution) en parallèle. Curseur d'automatisation individuel (manuel → assisté → automatique).

### 1.4 Scope du PRD

Ce PRD couvre la transformation complète de MnM : d'un cockpit mono-utilisateur de supervision d'agents IA en une plateforme B2B enterprise. Il spécifie les 9 blocs fonctionnels (FR-MU, FR-RBAC, FR-ORCH, FR-OBS, FR-ONB, FR-A2A, FR-DUAL, FR-CHAT, FR-CONT), les requirements non-fonctionnels, les user journeys par persona, le domain model, et la stratégie de test.

### 1.5 Timeline

Le plan d'implémentation se décompose en 4 phases séquentielles :
- **Phase 1 — Multi-user livrable** (~1 semaine) : invitations humaines, page membres, sign-out, PostgreSQL externe
- **Phase 2 — RBAC métier** (~2 semaines) : rôles admin/manager/contributor/viewer, 9 nouvelles clés de permissions, UI admin
- **Phase 3 — Scoping par projet** (~2-3 semaines) : project memberships, filtrage par scope JSONB, UI d'accès par projet
- **Phase 4 — Enterprise-grade** (~3-4 semaines) : SSO SAML/OIDC, audit complet, multi-tenant, dashboards par rôle

**Total estimé : ~8-10 semaines** pour atteindre un produit B2B vendable, avec démonstration CBA en juin 2026.

---

## 2. Classification

### 2.1 Type de produit

**Plateforme B2B d'orchestration d'agents IA déterministe** — Catégorie nouvelle ("Tour de Contrôle IA Enterprise"). Positionnée à l'intersection de la gestion de projet, des IDE IA, et des frameworks agentiques sans appartenir à aucune de ces catégories.

### 2.2 Plateforme cible

| Plateforme | Priorité | Détail |
|------------|----------|--------|
| **Web (React + Vite)** | P0 — MVP | Application web responsive, UI principale |
| **API REST + WebSocket** | P0 — MVP | Backend Express + tsx, API ouverte, temps réel bidirectionnel |
| **Desktop (Electron)** | P2 — Futur | Client desktop natif pour expérience hors-ligne et performance |
| **CLI** | P2 — Futur | Interface ligne de commande pour développeurs avancés |

### 2.3 Stack technique

| Couche | Technologie | Maturité actuelle |
|--------|------------|-------------------|
| **Monorepo** | pnpm workspaces | Mature — `packages/shared`, `packages/db`, `server`, `ui` |
| **Frontend** | React 18 + Vite, React Query, Tailwind CSS, shadcn/ui | Mature |
| **Backend** | Express + tsx, Node.js | Mature |
| **Base de données** | PostgreSQL (Drizzle ORM), 38 tables existantes | Mature |
| **Temps réel** | WebSocket (ws) + EventEmitter interne | Fonctionnel (read-only → à rendre bidirectionnel) |
| **Auth** | Better Auth (email+password, sessions DB) | Complet |
| **Agents** | 8 types d'adapters (claude_local, codex, openclaw, etc.) | Extensible |
| **Secrets** | Versionnés, 4 providers (local, AWS, GCP, Vault) | Avancé |
| **Containerisation** | Docker (dockerode) — à implémenter | Planifié |

### 2.4 Modèle de licence — Open-core

| Tier | Cible | Prix | Contenu |
|------|-------|------|---------|
| **Open Source** | Dev solo, freelance, small team (<5) | Gratuit | Orchestrateur déterministique complet, workflows personnalisables, observabilité basique. Auto-hébergement uniquement. |
| **Team** | Équipe 5-50, startups, PME tech | ~50€/utilisateur/mois | Multi-users, RBAC métier, scoping par projet, import intelligent, chat temps réel, containerisation. Cloud managed ou self-hosted. |
| **Enterprise** | Grande entreprise 100+ users | ~200€/utilisateur/mois + support | SSO SAML/OIDC, audit log complet, drift detection avancée, multi-tenant, dashboards par rôle, credential isolation, SLA garanti + CSM. |
| **On-Premise** | Secteurs réglementés (banque, santé, défense) | Licence annuelle sur mesure | Déploiement complet chez le client, zero data exfiltration, connecteurs custom. |

**Projection revenus :** Année 1 ~100k€ ARR, Année 2 ~800k€, Année 3 ~3M€.

### 2.5 Audiences cibles — 9 personas

1. **CEO** — Pilote stratégique (mode oral). Consomme des synthèses, dicte sa stratégie conversationnellement.
2. **CTO / DSI** — Garant technique (mode visuel). Dashboards drift detection, monitoring agents, config SSO.
3. **DPO** — Chef d'orchestre produit (mode board). Vue inter-équipes, détection conflits roadmap.
4. **PM** — Stratège produit (mode board + oral). Brainstorm assisté → output structuré exploitable.
5. **PO** — Traducteur de besoins (mode board). Agents écrivent les stories, le PO valide.
6. **Designer** — Architecte de l'expérience (mode visuel). Notification dans le workflow, lien maquettes→stories.
7. **Développeur** — Artisan du code (mode code). Agent personnel avec contexte complet, dialogue temps réel.
8. **QA / Testeur** — Gardien de la qualité (mode test). Capture progressive du savoir tacite, shift-left.
9. **Lead Tech** — Gardien de l'architecture (mode code + visuel). Monitoring dette/dépendances, reviews augmentées.

---

## 3. Success Criteria

Les critères de succès sont structurés selon les 5 noyaux de valeur et les KPIs business transverses, avec des cibles progressives à 3 mois (MVP déployé chez CBA) et 12 mois (produit commercial). Chaque critère est numéroté, mesurable, et traçable vers le Product Brief.

### 3.1 Noyau A — Orchestrateur Déterministe

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-A1** | Taux de respect workflows | % d'exécutions d'agents suivant le workflow sans déviation | >90% | >98% | Comptage auto : runs conformes / total runs via logs moteur orchestration |
| **SC-A2** | Temps de détection drift | Délai entre déviation agent et alerte utilisateur | <15 min | <2 min | Timestamp diff : événement drift logs → notification UI/webhook |
| **SC-A3** | Réinjection contexte réussie | % de compactions avec restauration réussie du contexte critique | >85% | >95% | Test auto : après compaction, vérifier reprise workflow bonne étape + bons fichiers |
| **SC-A4** | Workflows actifs | Nombre de workflows configurés et utilisés activement | 10+ | 50+ | Count distinct workflows avec >= 1 run dans les 7 derniers jours |
| **SC-A5** | Fiabilité compaction | % de sessions agent survivant à une compaction sans perte de progression | >80% | >95% | Monitoring : sessions pre/post compaction avec résultat identique |

### 3.2 Noyau B — Observabilité & Audit

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-B1** | Couverture d'audit | % des actions agent/humain générant un audit log | 100% runs | 100% runs | Comparer événements loggés vs actions moteur d'exécution |
| **SC-B2** | Latence observabilité | Délai action agent → affichage dashboard | <5s | <2s | Mesure E2E : timestamp action → timestamp rendu UI (WebSocket + rendering) |
| **SC-B3** | Réduction MTTR | Réduction du temps moyen de résolution problèmes agents | -40% | -70% | Baseline CBA avant MnM vs après. Temps alerte → résolution confirmée |
| **SC-B4** | NPS transparence agent | Satisfaction utilisateurs sur lisibilité actions agents | >25 | >50 | Enquête in-app trimestrielle (échelle 0-10 NPS) |
| **SC-B5** | Isolation container | % d'agents enterprise exécutés dans un container isolé | >90% | 100% | Count agents containerisés / total agents en mode Enterprise |

### 3.3 Noyau C — Onboarding Cascade

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-C1** | Temps onboarding company | Durée création company → premier workflow actif | <1 semaine | <2 jours | Timestamp diff : création company → premier workflow run |
| **SC-C2** | Taux complétion onboarding | % d'utilisateurs invités complétant leur configuration | >70% | >90% | Funnel : invitation → profil → premier agent → premier workflow |
| **SC-C3** | Temps import initial | Durée d'import depuis Jira/Linear/ClickUp | <3 jours | <1 jour | Mesure auto du temps import (début → fin, incluant mapping + validation) |
| **SC-C4** | Cascade hiérarchique activée | % de companies avec >= 3 niveaux hiérarchiques configurés | >50% | >80% | Count companies avec CEO + manager + contributeur actifs |

### 3.4 Noyau D — Agent-to-Agent & Permissions

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-D1** | Queries inter-agents/semaine | Volume communications entre agents d'utilisateurs différents | 50+ | 500+ | Count requêtes A2A dans les logs, par semaine |
| **SC-D2** | Réduction temps handoff | Réduction délai production artefact → consommation rôle suivant | -30% | -70% | Baseline CBA vs MnM : timestamp artefact produit → consommé |
| **SC-D3** | Connecteurs auto-générés | Connecteurs vers outils externes créés par les agents | 0 (MVP) | >5 par client | Count connecteurs table Connector avec flag auto_generated |
| **SC-D4** | Taux validation humaine A2A | % des requêtes inter-agents passant par validation humaine | 100% | >80% (reste configurable) | Count requêtes validées / total requêtes A2A |

### 3.5 Noyau E — Dual-Speed Workflow

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-E1** | Ratio exécution/réflexion | Proportion temps exécution mécanique vs réflexion stratégique | 60/40 | 20/80 | Enquête mensuelle + tracking : temps mode "exécution agent" vs "brainstorm/validation" |
| **SC-E2** | Position moyenne curseur | Position moyenne curseur d'automatisation par utilisateur | 1.5 | 2.5 | Moyenne pondérée (1=manuel, 2=assisté, 3=auto) sur users actifs |
| **SC-E3** | Savoir tacite capturé | Volume connaissances formalisées dans MnM | 100 items | 1000+ items | Count knowledge items (prompts perso, règles validation, edge cases formalisés) |
| **SC-E4** | Adoption chat temps réel | % d'utilisateurs actifs utilisant le chat agent au moins 1x/semaine | >40% | >70% | WAU chat / WAU total |

### 3.6 KPIs Business Transverses

| # | Critère | Description | Cible 3 mois | Cible 12 mois | Méthode de mesure |
|---|---------|-------------|-------------|--------------|-------------------|
| **SC-BIZ-1** | Premier client pilote | CBA comme design partner | POC signé | Production + case study | Contrat → déploiement → métriques → case study publiée |
| **SC-BIZ-2** | ARR | Chiffre d'affaires récurrent annuel | 10-30k€ | 200k€ | Comptabilité : MRR x 12 |
| **SC-BIZ-3** | Rôles non-dev actifs | % d'utilisateurs actifs non-développeurs | >30% | >40% | (Users actifs rôle non-dev / total users actifs) x 100 |
| **SC-BIZ-4** | Rétention 90 jours | % d'utilisateurs actifs 90j après onboarding | >70% | >85% | Cohorte : users avec action dans les 7 derniers jours / total cohorte 90j |
| **SC-BIZ-5** | Adoption multi-tier | Flywheel OSS → Team → Enterprise | 500 MAU OSS | 5000 MAU OSS, 25 Team, 5 Enterprise | Tracking par tier dans DB instances |
| **SC-BIZ-6** | Time-to-value | Temps entre premier login et première valeur perçue | <2h | <30min | Timestamp login → première action "valeur" (workflow run, insight dashboard) |
| **SC-BIZ-7** | Satisfaction globale | CSAT des utilisateurs actifs | >3.5/5 | >4.2/5 | Enquête in-app trimestrielle |

**Total : 26 critères mesurables** (5 + 5 + 4 + 4 + 4 + 7 par section).

---

## 4. Scoping

### 4.1 In Scope — Les 9 blocs fonctionnels MVP

Les 9 blocs fonctionnels couvrent l'intégralité de la transformation B2B de MnM. Chacun correspond à un domaine fonctionnel distinct avec ses propres requirements, numérotés et traçables vers les REQ du Product Brief.

| Bloc | Code | Description | Noyau | REQ sources |
|------|------|-------------|-------|-------------|
| Multi-user & Auth | **FR-MU** | Invitations humaines, page membres, sign-out, profil user, désactivation signup libre, migration PostgreSQL externe | Prérequis | — |
| Rôles & Permissions | **FR-RBAC** | 4 rôles métier (admin, manager, contributor, viewer), presets de permissions, enforcement dans chaque route, UI admin | Prérequis | REQ-ENT-01, REQ-ENT-02 |
| Orchestrateur déterministique | **FR-ORCH** | Enforcement algorithmique des workflows, gestion de compaction (kill+relance ou réinjection), injection de contexte par étape, drift detection v1 | A | REQ-ORCH-01 à 05 |
| Observabilité & Audit | **FR-OBS** | Résumé LLM temps réel, audit log centralisé, dashboards management agrégés (jamais individuels), traçage décisionnel | B | REQ-OBS-01 à 04 |
| Onboarding cascade | **FR-ONB** | Onboarding hiérarchique (CEO → CTO → Leads → opérationnels), dual-mode (oral/visuel), import intelligent Jira/Linear/ClickUp | C | REQ-ONB-01 à 04 |
| Agent-to-Agent + Permissions | **FR-A2A** | Communication inter-agents avec validation humaine, query de contexte inter-agents, base pour connecteurs auto-générés | D | REQ-A2A-01, 02, 04 |
| Dual-speed workflow | **FR-DUAL** | Curseur d'automatisation (manuel/assisté/auto) par action/agent/projet/entreprise, distinction tâches mécaniques vs jugement, brainstorm comme point d'entrée | E | REQ-DUAL-01 à 04 |
| Chat temps réel avec agents | **FR-CHAT** | WebSocket bidirectionnel humain-agent, dialogue pendant l'exécution, pilotage temps réel des agents | E + B | REQ-DUAL-03 |
| Containerisation | **FR-CONT** | Docker containers éphémères `--rm`, credential proxy HTTP, mount allowlist tamper-proof, shadow `.env` `/dev/null`, 5 couches de défense en profondeur | B (sécurité) | — |

### 4.2 Out of Scope — Explicitement hors MVP

Les 12 éléments suivants sont **intentionnellement exclus** du scope MVP. Chacun est identifié comme important mais reporté pour des raisons de focus, complexité technique, ou dépendance à des validations terrain.

| # | Élément | Raison d'exclusion | Horizon envisagé |
|---|---------|-------------------|-----------------|
| 1 | **Client desktop Electron** | Le web couvre 100% des cas d'usage MVP. Desktop = optimisation, pas nécessité. | Post-MVP (Année 2) |
| 2 | **Mode offline** | Architecture sync/conflict resolution complexe. La cible B2B a une connexion stable. | Post-MVP (Année 2) |
| 3 | **Marketplace de templates workflows** | Trop peu de workflows en production pour justifier un marketplace. Templates intégrés d'abord. | Année 2 quand flywheel actif |
| 4 | **IA de suggestion proactive de workflows** | Nécessite un volume de données d'usage significatif. MnM doit d'abord CAPTURER ces données (Vérité #9). | Post-MVP, quand >1000 workflows actifs |
| 5 | **Connecteurs auto-générés par agents** | Possible via MCP/codegen, mais risque sécurité trop élevé sans containerisation robuste. | Phase 4+ quand FR-CONT mature |
| 6 | **Multi-langue (i18n)** | MVP en français (cible CBA). Internationalisation après validation PMF. | Avant scale international (Année 2) |
| 7 | **App mobile native** | UI responsive suffit. Le cockpit MnM est une expérience desktop-first. | Non planifié |
| 8 | **Intégration CI/CD native** | Les agents MnM interagissent avec le code, pas avec les pipelines CI/CD directement. | À évaluer post-MVP |
| 9 | **Facturation/paiement intégré** | MVP = design partner (CBA). Stripe/billing = go-to-market commercial. | Phase commerciale (T3 2026) |
| 10 | **Drift detection avancée (ML)** | V1 = règles heuristiques. ML = quand assez de données. Non-bloquant MVP (risque R4). | Année 2 |
| 11 | **MnM modifiable par ses propres agents** | Vision long terme fascinante (REQ-A2A-03), mais risque sécurité et complexité trop élevés. | Recherche (Année 2+) |
| 12 | **Assignation dynamique de tâches** | Utopique à court terme (What If #1). Nécessite compréhension fine des compétences individuelles. | Vision long terme |

### 4.3 Assumptions — Hypothèses sur lesquelles le PRD repose

#### Hypothèses marché (H-M)

| # | Hypothèse | Risque si fausse | Validation prévue |
|---|-----------|-----------------|-------------------|
| **H-M1** | Les entreprises en transformation digitale ont besoin d'orchestrer leurs agents IA de manière déterministe, pas seulement de les déployer | MnM résout un problème inexistant | POC CBA — observer si le déterminisme est utilisé ou contourné |
| **H-M2** | Le multi-rôle (CEO → Dev dans un seul outil) est un différenciateur vendable, pas une complexité repoussante | Trop de personas = produit confus | Tester l'onboarding avec les 3 premiers rôles (CEO, CTO, Dev) avant d'élargir |
| **H-M3** | Le modèle open-core génère un flywheel d'adoption Dev solo → Team → Enterprise | L'OSS ne convertit pas en payant | Tracker le funnel OSS → Team précisément dès le lancement |
| **H-M4** | CBA est représentatif des entreprises cibles (PME tech en transformation) | CBA est un cas particulier non-généralisable | Valider avec 2-3 early adopters hors CBA avant de scaler |

#### Hypothèses produit (H-P)

| # | Hypothèse | Risque si fausse | Validation prévue |
|---|-----------|-----------------|-------------------|
| **H-P1** | Le curseur d'automatisation (manuel → assisté → auto) est compris et adopté par les utilisateurs | UX trop conceptuelle, personne ne l'utilise | Tests utilisateur dès Phase 2 — observer si les users déplacent le curseur |
| **H-P2** | L'onboarding conversationnel (mode oral) est accepté par les CEO/DSI | Le CEO veut un formulaire classique, pas un chat | A/B test : onboarding chat vs formulaire chez CBA |
| **H-P3** | L'import Jira/Linear est le "moment de vérité" pour l'adoption B2B | Import trop complexe ou données trop sales | Prototype import avec données réelles CBA avant implémentation complète |
| **H-P4** | Les dashboards agrégés (jamais individuels) suffisent à convaincre les managers SANS effrayer les opérationnels (Vérité #20) | Managers veulent du granulaire, opérationnels ne font pas confiance | Feedback loops avec les deux populations chez CBA |

#### Hypothèses techniques (H-T)

| # | Hypothèse | Risque si fausse | Validation prévue |
|---|-----------|-----------------|-------------------|
| **H-T1** | La gestion de compaction est réalisable au niveau plateforme (kill+relance ou réinjection de pré-prompts) | C'est le risque R1 — le plus critique du projet | Spike technique de 1 semaine avant engagement |
| **H-T2** | Le schéma DB existant (38 tables, Drizzle) absorbe la transformation B2B sans ré-architecture | Migration massive nécessaire, retard significatif | Analyse Winston (section Domain Model PRD) — tables `scope` JSONB déjà en place |
| **H-T3** | La containerisation Docker offre un ratio sécurité/performance acceptable pour agents temps réel | Overhead Docker trop élevé | Benchmark : latence container vs processus direct |
| **H-T4** | Le WebSocket bidirectionnel supporte 100+ agents simultanés par instance | Goulot d'étranglement performance | Load test dès Phase 3 |

#### Hypothèses organisationnelles (H-O)

| # | Hypothèse | Risque si fausse | Validation prévue |
|---|-----------|-----------------|-------------------|
| **H-O1** | Le split cofondateurs (Tom = Noyaux B+C, Cofondateur = Noyaux A+D) permet un travail parallèle efficace | Dépendances croisées bloquent le parallélisme | Revue de dépendances hebdomadaire |
| **H-O2** | Un cofondateur technique sera recruté dans les 4 prochaines semaines | Tom doit tout faire seul → timeline x2 | Plan B : freelance senior pour le Noyau A |
| **H-O3** | CBA accepte d'être design partner avec accès privilégié et feedback structuré | Pas de terrain de validation réel | Pitcher le CTO de CBA immédiatement (action n°1 Product Brief) |

**Total : 15 hypothèses** (4 marché + 4 produit + 4 technique + 3 organisationnelle).

---

*Section produite par John le PM — ~3500 mots, format PRD professionnel, traçabilité complète vers le Product Brief B2B v2.0 et les 57 vérités fondamentales du brainstorming cofondateurs.*
