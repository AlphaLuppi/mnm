---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain-skipped, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
workflow_completed: true
classification:
  projectType: desktop_app
  domain: developer_tools
  complexity: medium
  projectContext: greenfield
inputDocuments:
  - planning-artifacts/product-brief-mnm-2026-02-22.md
  - brainstorming/brainstorm-nikou.md
  - brainstorming/brainstorm-tom-2026-02-19.md
  - brainstorming/brainstorming-session-gab-2026-02-21.md
workflowType: 'prd'
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 3
  projectDocs: 0
---

# Product Requirements Document - MnM

**Author:** Gabri
**Date:** 2026-02-22

## Executive Summary

MnM est un IDE desktop open-source qui remplace le paradigme "Write → Run → Debug" par "Describe → Review → Approve" pour les équipes développant via des agents IA. L'interface centrale n'est pas un éditeur de code mais un cockpit de supervision à trois volets (Contexte / Agents / Tests) avec une timeline d'activité temps réel remplaçant le terminal.

Le produit résout cinq problèmes concrets vécus par ses créateurs (équipe de 3 développeurs utilisant Claude Code + BMAD au quotidien) : l'opacité de l'activité des agents, l'invisibilité du contexte qu'ils consomment, le drift silencieux entre documents de spécification, l'illisibilité des workflows (fichiers XML), et l'absence de vue d'ensemble sur l'état opérationnel du projet.

Le MVP couvre trois blocs : visibilité (timeline agents + visualisation du contexte), supervision (drift detection cross-document + dashboard cockpit + layout 3 volets), et puissance (workflow editor visuel + tests hiérarchiques + context management interactif). L'application sera construite comme une app desktop basée sur des technologies web (Electron ou Tauri) pour accéder au filesystem local, aux process agents, et à Git.

### What Makes This Special

**Renversement d'hypothèse fondamental :** Tous les IDEs existants (Cursor, Zed, VSCode, IntelliJ) partent du principe que l'humain écrit du code. MnM part du principe inverse — l'humain supervise l'alignement specs/tests/code, le code est un artefact dérivé consultable à la demande.

**Chaîne de confiance déléguée :** La confiance dans le code ne vient pas de sa relecture mais de la vérification que (1) les specs sont cohérentes entre elles, (2) les tests couvrent les specs, (3) le code passe les tests. MnM matérialise cette chaîne avec la drift detection cross-document et les tests hiérarchiques miroir des specs.

**Cockpit vs éditeur :** Le layout n'est pas un éditeur de texte avec un chat IA à côté. C'est un cockpit de supervision inspiré de l'aviation moderne — indicateurs de santé agents, plan de vol, timeline d'activité, alertes de drift actionnables.

## Project Classification

- **Type :** Application desktop (technologies web — Electron/Tauri)
- **Domaine :** Developer tools / IDE
- **Complexité :** Medium (pas de contraintes réglementaires, mais technologie innovante : interception d'agents IA, drift detection sémantique, visualisation temps réel)
- **Contexte :** Greenfield — aucun code existant
- **Licence :** Open source
- **Utilisateurs cibles :** 3 développeurs (les créateurs), partage communautaire si adoption organique

---

## Success Criteria

### User Success

- **Visibilité immédiate** — En ouvrant MnM, l'utilisateur sait en moins de 5 secondes où en est son projet : quels agents tournent, lesquels sont bloqués, s'il y a des alertes de drift.
- **Zéro terminal** — L'utilisateur n'a jamais besoin d'ouvrir un terminal pour savoir ce qu'un agent fait, quel contexte il utilise, ou où il en est dans son workflow.
- **Confiance sans relecture** — L'utilisateur fait confiance à la chaîne specs → tests → code sans relire le code, grâce aux alertes de drift et aux tests hiérarchiques.
- **Workflows lisibles** — L'utilisateur comprend un workflow en le regardant dans l'éditeur visuel, sans ouvrir le fichier XML/YAML source.

### Business Success

N/A — Projet open-source interne. Le seul indicateur business est : les 3 créateurs utilisent MnM au quotidien et ne retournent pas à leur ancien setup.

### Technical Success

- **Architecture événementielle** — La timeline se met à jour par événements (agent terminé, fichier modifié, drift détecté), pas par polling. Réactivité temps réel.
- **Drift detection avec seuil de confiance** — Le LLM produit un score de confiance pour chaque drift détecté. Un seuil configurable filtre le bruit (les alertes en dessous du seuil ne sont pas surfacées). Le seuil et les détails seront définis lors de la phase architecture.
- **Accès système fiable** — L'app accède au filesystem, aux process agents, et à Git de manière stable et performante.
- **Critères techniques détaillés** — Reportés à la phase architecture pour être définis avec la stack technique choisie.

### Measurable Outcomes

| Critère | Mesure | Cible |
|---------|--------|-------|
| Adoption quotidienne | Les 3 créateurs utilisent MnM comme outil principal | 100% (3/3) |
| Élimination du terminal | Nombre de fois où l'utilisateur ouvre un terminal pour superviser un agent | 0 par session |
| Temps de compréhension projet | Temps entre l'ouverture de MnM et la compréhension de l'état du projet | < 5 secondes |
| Drift détecté vs manqué | Drifts réels non détectés par MnM | 0 (zéro drift manqué, faux positifs tolérés si rares) |
| Compréhension workflow | L'utilisateur comprend un workflow sans lire le fichier source | 100% des workflows |

---

## Product Scope

### MVP — Minimum Viable Product

**Bloc 1 — Visibilité (fondation) :**
- Timeline d'activité des agents — événementielle, temps réel, indicateurs de santé (vert/orange/rouge), navigation vers le chat agent au clic
- Visualisation du contexte des agents — quels fichiers chaque agent consulte, en temps réel

**Bloc 2 — Supervision (usage quotidien) :**
- Drift detection cross-document — hiérarchie Product Brief → PRD → Architecture → Stories → Code, alertes actionnables avec seuil de confiance
- Dashboard cockpit — vue d'ensemble à l'ouverture (santé projet, agents actifs, stories en cours, alertes)
- Layout 3 volets — Contexte (gauche) / Agents (centre) / Tests & Validation (droite), navigation hiérarchique synchronisée

**Bloc 3 — Puissance (workflow complet) :**
- Workflow Editor visuel — visualisation graphique des workflows, édition basique
- Tests hiérarchiques — affichage miroir specs (tâche → unitaires, epic → intégration, projet → e2e)
- Context management interactif — drag & drop de contexte vers un agent

**Contrainte technique :** App desktop (Electron ou Tauri), accès filesystem + process + Git. Architecture événementielle.

### Growth Features (Post-MVP)

- Sync bidirectionnelle chat ↔ Workflow Editor
- Plugin system extensible (support OpenHands, Devin, etc.)
- Connecteurs MCP (Linear, GitHub, Slack)
- Rigueur de drift configurable par zone (story critique vs cosmétique)
- Mode inspection du code avec niveaux progressifs (specs → diff → code)

### Vision (Future)

- Marketplace de workflows communautaires
- Agents-as-Extensions (marketplace d'agents spécialisés)
- Groupes d'agents avec ordres collectifs
- Courbes de tendance et métriques projet
- Confiance déléguée niveau 3 (auto-approve sur projets matures)

---

## User Journeys

### Journey 1 : Tom — "Mon agent est bloqué et je ne le sais pas"

**Situation :** Tom travaille sur un projet avec 3 agents Claude Code en parallèle — un sur le backend API, un sur les tests d'intégration, un sur la migration de base de données. Il est en train de rédiger une story pour le prochain sprint.

**Avant MnM :** Tom alterne entre 3 onglets de terminal. Il vérifie manuellement chaque agent toutes les 10 minutes. L'agent migration est bloqué depuis 20 minutes sur une erreur de permissions — Tom ne le découvre qu'au bout de 45 minutes quand il se dit "tiens, il n'a toujours pas fini". Il a perdu 45 minutes d'attente inutile. Il ouvre le log, scroll 200 lignes pour trouver l'erreur, comprend le problème, relance l'agent. Pendant ce temps, l'agent tests d'intégration attend la migration et tourne en boucle sur des retries — consommation de tokens pour rien.

**Avec MnM :** Tom ouvre MnM. Le dashboard cockpit montre 3 agents : backend (vert), tests (orange), migration (rouge). Il voit immédiatement que la migration est bloquée. Il clique sur le voyant rouge dans la timeline — le chat de l'agent s'ouvre au moment exact du blocage. Il lit l'erreur en 5 secondes, corrige le problème de permissions, relance. L'agent tests passe automatiquement de orange à vert quand la migration reprend. Temps perdu : 30 secondes au lieu de 45 minutes.

**Moment clé :** Tom voit les 3 agents d'un coup d'oeil sans ouvrir un seul terminal. Il dit : "Enfin je sais ce qui se passe."

**Capacités révélées :** Timeline d'activité, indicateurs de santé agents, navigation temporelle dans le chat, détection de blocage.

---

### Journey 2 : Gabri — "Un agent a pollué le contexte et tout dérive"

**Situation :** Gabri supervise le développement d'un module d'authentification. Le Product Brief spécifie OAuth2 + MFA. Un agent travaille sur les stories d'auth et modifie le fichier d'architecture pour ajouter un "fallback session-based auth" qui n'était pas prévu.

**Avant MnM :** Gabri ne se rend compte de rien. L'agent suivant récupère l'architecture modifiée et implémente le fallback session. Deux jours plus tard, Tom écrit une story front qui assume du session-based auth. Gabri tombe dessus par hasard en relisant les stories : "Attends, on avait dit OAuth2 only, c'est quoi ce session-based auth ?" Il passe 2 heures à remonter la chaîne : qui a changé l'archi, quand, pourquoi. Il doit corriger l'architecture, les stories, et le code déjà produit. 2 jours de travail perdus.

**Avec MnM :** L'agent modifie le fichier d'architecture. MnM déclenche un événement de drift detection. En 3 secondes, une alerte apparaît dans le cockpit :

> "Drift détecté — Architecture vs Product Brief. L'architecture mentionne 'fallback session-based auth' mais le Product Brief spécifie 'OAuth2 + MFA uniquement'. Est-ce intentionnel ?"

Gabri voit l'alerte, clique dessus, voit le diff exact entre les deux documents, et choisit "Corriger l'architecture → supprimer le fallback session". Le drift est résolu en 30 secondes, avant qu'aucun autre agent ne consomme le contexte pollué.

**Moment clé :** Gabri n'a pas eu à vérifier manuellement. MnM l'a alerté au moment où le drift s'est produit. Il dit : "Je n'ai plus besoin de tout relire, MnM surveille pour moi."

**Capacités révélées :** Drift detection cross-document, alertes actionnables, visualisation du contexte des agents, hiérarchie documentaire.

---

### Journey 3 : Nikou — "Je veux comprendre et configurer un workflow"

**Situation :** Nikou rejoint un projet existant qui utilise un workflow BMAD de 15 étapes (brainstorming → product brief → PRD → architecture → stories → dev → tests → review → deploy). Il veut comprendre le workflow actuel et ajouter une étape de "security review" après le code review.

**Avant MnM :** Nikou ouvre le fichier workflow.yaml — 400 lignes de YAML avec des références XML imbriquées. Il comprend vaguement la structure mais ne visualise pas le flux. Il demande à Claude "ajoute une étape security review après le code review". Claude modifie le YAML. Nikou fait confiance — il ne peut pas vérifier visuellement si c'est correct. Il lance le workflow. L'étape security review se déclenche au mauvais moment (avant le code review au lieu d'après). Il debug pendant 1 heure en relisant le YAML.

**Avec MnM :** Nikou ouvre le Workflow Editor. Le workflow s'affiche comme un diagramme de flux : chaque étape est un noeud, les connexions montrent l'ordre d'exécution, les branches parallèles sont visibles. Il comprend le workflow en 10 secondes. Il clique sur le noeud "Code Review", voit un bouton "+" après, clique, tape "Security Review", configure le rôle et les instructions. Le noeud apparaît au bon endroit dans le diagramme. Il vérifie visuellement que c'est correct — c'est bien après Code Review et avant Deploy. Sauvegarde. Terminé en 2 minutes.

**Moment clé :** Nikou dit : "Je comprends enfin à quoi ressemble ce workflow. Et je peux le modifier sans prier pour que ce soit au bon endroit."

**Capacités révélées :** Workflow Editor visuel, parsing de fichiers YAML/XML, visualisation en diagramme de flux, édition graphique de noeuds.

---

### Journey Requirements Summary

| Journey | Capacités requises |
|---------|-------------------|
| **Tom — Agent bloqué** | Timeline d'activité, indicateurs de santé (vert/orange/rouge), navigation temporelle dans le chat, détection de blocage agent |
| **Gabri — Drift de contexte** | Drift detection cross-document, alertes actionnables avec diff, hiérarchie documentaire, événements temps réel sur modification de fichiers |
| **Nikou — Workflow illisible** | Workflow Editor visuel, parsing de fichiers YAML/XML, visualisation en diagramme de flux, édition graphique de noeuds |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

**1. Renversement de paradigme IDE (innovation majeure)**
MnM inverse l'hypothèse fondamentale de 40 ans d'IDEs : l'humain écrit du code. Aucun IDE existant ne part du principe que le code est un artefact dérivé et que l'interface principale est un cockpit de supervision. Ce n'est pas une amélioration incrémentale — c'est une rupture de catégorie.

**2. Drift detection cross-document (innovation technique)**
La détection de drift existe entre code et specs (linting, tests). La détection de drift *entre documents de spécification* (Product Brief vs Architecture vs Stories) est un concept nouveau. Aucun outil ne surveille la cohérence sémantique entre niveaux de la hiérarchie documentaire d'un projet.

**3. Timeline d'activité comme interface de supervision (innovation UX)**
Remplacer le terminal par une timeline visuelle est un changement d'interface profond. Le terminal est l'outil du codeur ; la timeline est l'outil du superviseur. Ce changement d'affordance signale et renforce le changement de paradigme.

**4. Chaîne de confiance déléguée (innovation conceptuelle)**
Le modèle mental "je ne relis pas le code, je vérifie que specs ↔ tests ↔ code sont alignés" est un nouveau framework de confiance pour le développement agentique. MnM est le premier outil à matérialiser cette chaîne.

### Market Context & Competitive Landscape

Le marché des IDEs IA est en pleine explosion (Cursor, Windsurf, Zed, Continue, Cody) mais tous restent dans le paradigme "humain code + IA aide". Personne ne propose un IDE "supervision-first" où le code est secondaire. La fenêtre d'opportunité est ouverte — le paradigme agentique est assez mature (Claude Code, Devin, OpenHands) mais les outils de supervision n'existent pas encore.

### Validation Approach

- **Validation par l'usage** — Les 3 créateurs utilisent le paradigme agentique quotidiennement. MnM est validé par leur propre besoin, pas par des hypothèses marché.
- **MVP itératif** — Chaque bloc du MVP (Visibilité → Supervision → Puissance) est indépendamment valuable et testable.
- **Dogfooding immédiat** — MnM sera développé via MnM dès que le bloc 1 (timeline + contexte) est fonctionnel.

### Risk Mitigation

Les risques techniques détaillés (interception Claude Code, performance Electron, drift detection lente, parsing workflows) sont documentés dans la section [Project Scoping & Phased Development > Risk Mitigation Strategy](#risk-mitigation-strategy).

**Risque d'adoption spécifique à l'innovation :**

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Le paradigme "no-code-editing" est trop radical | Les utilisateurs retournent à Cursor pour coder | Mode Inspection avec niveaux progressifs (post-MVP) |
| La drift detection produit trop de faux positifs | Les utilisateurs ignorent les alertes | Seuil de confiance configurable, tuning itératif |

---

## Desktop App Specific Requirements

### Project-Type Overview

MnM est une application desktop cross-platform construite avec des technologies web (Electron ou Tauri). Elle nécessite un accès profond au système d'exploitation pour surveiller les agents IA, manipuler le filesystem, et interagir avec Git. La connexion internet est requise pour les appels LLM (drift detection, agents IA).

### Platform Support

| Plateforme | Support MVP | Notes |
|------------|-------------|-------|
| **macOS** | Oui | Plateforme principale de développement |
| **Linux** | Oui | Cross-platform dès le MVP |
| **Windows** | Oui | Cross-platform dès le MVP |

Le choix Electron ou Tauri sera déterminé en phase architecture. Les deux supportent les 3 plateformes.

### System Integration

**Requis MVP :**
- **Filesystem** — Lecture/écriture de fichiers de contexte, specs, workflows. File watching événementiel pour détecter les modifications par les agents.
- **Process management** — Spawn et monitoring de process agents (Claude Code CLI). Interception stdout/stderr. Détection de blocage/fin.
- **Git** — Lecture de l'état du repo, historique des commits, diff entre versions. Le versioning de contexte utilise Git nativement.

**Hors scope MVP :**
- Auto-update (gestion manuelle)
- Notifications OS
- Tray icon / raccourcis globaux
- Intégrations système additionnelles

### Connectivity Requirements

- **Internet requis** — Les appels LLM (drift detection, agents Claude Code) nécessitent une connexion. MnM ne fonctionne pas offline.
- **Pas de backend serveur** — MnM est une app locale. Pas de serveur distant, pas de compte utilisateur, pas de sync cloud.

### Update Strategy

Gestion manuelle pour le MVP. Les utilisateurs mettent à jour via le gestionnaire de paquets ou un rebuild local. Un système d'auto-update pourra être ajouté post-MVP si nécessaire.

### Implementation Considerations

- **Packaging cross-platform** — Le build doit produire des binaires pour macOS (.dmg), Linux (.AppImage/.deb), et Windows (.exe/.msi)
- **Permissions filesystem** — L'app doit demander les permissions nécessaires sur chaque OS (accès fichiers, exécution de process)
- **Performance** — Voir les exigences détaillées dans [Non-Functional Requirements > Performance](#performance) (NFR1-NFR7)

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach : Problem-solving MVP**
MnM n'est pas un produit à valider sur un marché — c'est un outil dont les créateurs ont besoin maintenant. L'approche MVP est simple : construire le minimum qui résout les pain points quotidiens, dans l'ordre de priorité des douleurs.

**Resource Requirements :**
- Équipe de 3 développeurs (Gabri, Tom, Nikou)
- Pas de deadline — le projet avance au rythme de l'équipe
- MnM est développé en parallèle de l'activité principale (side project)
- Stack : technologies web (React/TypeScript) + framework desktop (Electron ou Tauri)

### MVP Feature Set (Phase 1)

**Core User Journeys Supported :**
- Tom — Visibilité sur les agents bloqués (Journey 1)
- Gabri — Détection de drift de contexte (Journey 2)
- Nikou — Compréhension et édition de workflows (Journey 3)

**Must-Have Capabilities :**

| Bloc | Feature | Justification |
|------|---------|---------------|
| Visibilité | Timeline d'activité agents | Sans ça, on retourne au terminal. C'est le coeur. |
| Visibilité | Visualisation contexte agents | Sans ça, on ne sait pas ce que l'agent "voit". |
| Supervision | Drift detection cross-document | Sans ça, les incohérences se propagent silencieusement. |
| Supervision | Dashboard cockpit | Sans ça, pas de vue d'ensemble à l'ouverture. |
| Supervision | Layout 3 volets | C'est la structure de l'interface — tout le reste en dépend. |
| Puissance | Workflow Editor visuel | Sans ça, les workflows restent des fichiers XML opaques. |
| Puissance | Tests hiérarchiques | Matérialise la chaîne de confiance specs → tests. |
| Puissance | Context management interactif | Sans ça, le contexte reste une boîte noire. |

**Ordre de développement suggéré :**
1. **Shell desktop** — App Electron/Tauri vide avec le layout 3 volets
2. **Bloc 1 : Visibilité** — Timeline + contexte agents (value immédiate, le pain point le plus aigu)
3. **Bloc 2 : Supervision** — Drift detection + cockpit (deuxième couche de valeur)
4. **Bloc 3 : Puissance** — Workflow Editor + tests hiérarchiques + context management

Chaque bloc est indépendamment utilisable. L'équipe peut commencer à utiliser MnM dès le bloc 1 terminé.

### Post-MVP Features

**Phase 2 (Growth) :**
- Sync bidirectionnelle chat ↔ Workflow Editor
- Plugin system extensible (OpenHands, Devin, etc.)
- Connecteurs MCP (Linear, GitHub, Slack)
- Rigueur de drift configurable par zone
- Mode inspection du code avec niveaux progressifs

**Phase 3 (Expansion) :**
- Marketplace de workflows communautaires
- Agents-as-Extensions
- Groupes d'agents avec ordres collectifs
- Courbes de tendance et métriques projet
- Confiance déléguée niveau 3 (auto-approve)

### Risk Mitigation Strategy

**Technical Risks :**

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Interception de Claude Code instable (changement d'API, de format de sortie) | Moyenne | Architecture multi-sources (stdout + file watching + API). Couche d'abstraction pour absorber les changements. |
| Performance Electron insuffisante avec beaucoup d'agents | Faible | Monitoring mémoire/CPU dès le bloc 1. Migration Tauri possible si nécessaire. |
| Drift detection trop lente sur gros projets | Moyenne | Commencer par LLM-as-judge pur (simple). Optimiser avec embeddings + pré-filtre post-MVP si nécessaire. |
| Parsing de workflows BMAD complexe | Faible | Les workflows BMAD ont une structure connue. React Flow + dagre sont des outils matures. |

**Resource Risks :**

| Risque | Mitigation |
|--------|------------|
| Side project = avancement lent | Chaque bloc est indépendamment valuable. Pas de "tout ou rien". |
| Un membre de l'équipe moins disponible | Les 3 blocs sont relativement indépendants, répartition possible. |
| Scope creep (envie d'ajouter des features) | MVP strict défini. Tout ajout va dans la liste post-MVP. |

---

## Functional Requirements

### Agent Monitoring & Supervision

- **FR1:** L'utilisateur peut voir la liste de tous les agents actifs avec leur statut mis à jour en continu (actif, en pause, bloqué, terminé) — latence définie par NFR1
- **FR2:** L'utilisateur peut voir l'indicateur de santé de chaque agent (vert/orange/rouge) sans navigation — visible depuis la vue principale
- **FR3:** L'utilisateur peut voir la timeline d'activité de chaque agent sous forme de frise chronologique avec des checkpoints
- **FR4:** L'utilisateur peut cliquer sur un checkpoint de la timeline pour naviguer au moment exact dans le chat de l'agent
- **FR5:** L'utilisateur peut voir quand un agent est bloqué et accéder au point de blocage en un clic
- **FR6:** L'utilisateur peut lancer un agent sur une tâche depuis MnM
- **FR7:** L'utilisateur peut arrêter un agent en cours d'exécution
- **FR8:** L'utilisateur peut voir la progression d'un agent sous forme d'étapes (tâches du todolist ou checkpoints émis par l'agent) avec distinction entre complétées et restantes

### Context Visualization & Management

- **FR9:** L'utilisateur peut voir la liste des fichiers de contexte que chaque agent consulte, mise à jour en continu — latence définie par NFR1
- **FR10:** L'utilisateur peut ajouter un fichier de contexte à un agent (drag & drop ou sélection)
- **FR11:** L'utilisateur peut retirer un fichier de contexte d'un agent
- **FR12:** L'utilisateur peut voir les fichiers de contexte sous forme de cards visuelles avec badges indiquant quel agent les utilise
- **FR13:** L'utilisateur peut être notifié quand un agent modifie un fichier de contexte

### Drift Detection

- **FR14:** Le système peut détecter automatiquement les incohérences entre documents de la hiérarchie (Product Brief → PRD → Architecture → Stories → Code)
- **FR15:** Le système peut déclencher la drift detection par événement (quand un fichier de contexte est modifié)
- **FR16:** L'utilisateur peut lancer une vérification de drift à la demande sur un ensemble de documents
- **FR17:** L'utilisateur peut voir une alerte actionnable quand un drift est détecté, avec le diff exact entre les documents concernés
- **FR18:** L'utilisateur peut résoudre un drift depuis l'alerte (corriger le document source, corriger le document dérivé, ou ignorer)
- **FR19:** Le système peut associer un score de confiance à chaque drift détecté
- **FR20:** L'utilisateur peut configurer le seuil de confiance en dessous duquel les alertes ne sont pas surfacées

### Dashboard & Project Overview

- **FR21:** L'utilisateur peut voir un dashboard cockpit à l'ouverture de MnM avec la santé globale du projet
- **FR22:** L'utilisateur peut voir le nombre d'agents actifs, leur statut, et les alertes de drift en cours depuis le cockpit
- **FR23:** L'utilisateur peut voir les stories en cours avec leur état d'avancement (ratio tâches complétées / tâches totales, source : fichiers Markdown BMAD)
- **FR24:** L'utilisateur peut naviguer du cockpit vers n'importe quel agent, alerte, ou story en un clic

### Workflow Visualization & Editing

- **FR25:** L'utilisateur peut voir un workflow BMAD sous forme de diagramme de flux visuel (noeuds et connexions)
- **FR26:** L'utilisateur peut voir l'ordre d'exécution des étapes et les branches parallèles dans le diagramme
- **FR27:** L'utilisateur peut ajouter un noeud (étape) à un workflow existant via l'éditeur visuel
- **FR28:** L'utilisateur peut supprimer un noeud d'un workflow
- **FR29:** L'utilisateur peut réorganiser les connexions entre noeuds
- **FR30:** L'utilisateur peut configurer les propriétés d'un noeud (rôle, instructions)
- **FR31:** Le système peut synchroniser les modifications visuelles avec le fichier source du workflow (YAML/XML)
- **FR32:** L'utilisateur peut voir l'exécution d'un workflow en continu (étape en cours mise en évidence visuellement) — latence définie par NFR1

### Test Visualization

- **FR33:** L'utilisateur peut voir les tests organisés en miroir de la hiérarchie des specs (tâche → unitaires, story → unitaires groupés, epic → intégration, projet → e2e)
- **FR34:** L'utilisateur peut voir le statut de chaque test (pass/fail/pending)
- **FR35:** L'utilisateur peut naviguer d'une spec vers ses tests associés et inversement
- **FR36:** L'utilisateur peut lancer l'exécution des tests associés à une spec depuis MnM

### Navigation & Layout

- **FR37:** L'utilisateur peut voir l'interface en layout 3 volets : Contexte (gauche) / Agents (centre) / Tests & Validation (droite)
- **FR38:** L'utilisateur peut naviguer dans la hiérarchie du projet (Projet → Epic → Story → Tâche) et les 3 volets se synchronisent automatiquement
- **FR39:** L'utilisateur peut redimensionner, maximiser ou masquer chaque volet
- **FR40:** L'utilisateur peut voir la timeline d'activité dans un panneau bas persistant

### File & Git Integration

- **FR41:** Le système peut détecter les modifications de fichiers par événement (file watching) — délai défini par NFR9
- **FR42:** Le système peut attribuer une modification de fichier à l'agent qui l'a produite
- **FR43:** L'utilisateur peut voir l'historique Git du projet et des fichiers de contexte
- **FR44:** L'utilisateur peut voir le contexte tel qu'il était à un commit donné (versioning de contexte via Git)

### Project & Integration

- **FR45:** L'utilisateur peut ouvrir un projet en sélectionnant un répertoire Git local
- **FR46:** Le système peut détecter automatiquement la structure BMAD dans un répertoire de projet (présence de `_bmad/`, `_bmad-output/`, fichiers de workflow)
- **FR47:** Le système peut lire l'historique Git du projet (commits, branches, diffs) sans nécessiter de privilèges élevés
- **FR48:** Le système peut parser les fichiers de workflow BMAD (YAML/Markdown) pour les restituer dans le Workflow Editor visuel

---

## Non-Functional Requirements

### Performance

- **NFR1:** Les mises à jour de la timeline d'activité doivent apparaître dans l'UI en moins de **500ms** après l'événement source (modification fichier, output agent)
- **NFR2:** Le file watching événementiel ne doit pas consommer plus de **5% CPU** au repos (aucune activité agent)
- **NFR3:** Le rendu du Workflow Editor visuel doit rester fluide (**>30 FPS**) pour des workflows jusqu'à **50 noeuds**
- **NFR4:** La drift detection sur une paire de documents doit retourner un résultat en moins de **30 secondes** (dépend du LLM, mais le pipeline local doit ajouter moins de 2s de latence)
- **NFR5:** Le démarrage de l'application (cold start) doit prendre moins de **5 secondes** jusqu'au cockpit affiché
- **NFR6:** L'application ne doit pas bloquer le thread UI plus de **100ms** pendant l'exécution simultanée de **3 agents** avec file watching et drift detection actifs
- **NFR7:** La consommation mémoire de MnM doit rester sous **500 MB** en usage normal (cockpit + 3 agents monitorés)

### Integration

- **NFR8:** MnM doit intercepter l'output de **Claude Code CLI** via stdout/stderr avec une latence inférieure à **500ms** sans modifier le comportement de l'agent
- **NFR9:** Le file watching doit détecter les modifications de fichiers dans le repo du projet dans un délai de **1 seconde**
- **NFR10:** MnM doit pouvoir spawner et monitorer des process système (agents) sans privilèges élevés (pas de sudo/admin)
- **NFR11:** Les intégrations filesystem et process doivent passer la **même suite de tests** sur **macOS, Linux et Windows** avec un taux de réussite identique
