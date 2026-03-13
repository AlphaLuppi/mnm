---
stepsCompleted: [1, 2]
inputDocuments: ['docs/B2B-enterprise-roadmap.md']
session_topic: "MnM comme plateforme unique d'orchestration inter-rôles avec automatisation progressive par IA"
session_goals: "Clarifier la direction stratégique de MnM — comment unifier le travail de tous les rôles (CEO, DSI, DPO, PM, PO, Designer, Dev, QA, Lead Tech) dans une seule interface, avec des agents IA qui augmentent puis remplacent progressivement certains rôles"
selected_approach: 'ai-recommended-progressive-flow'
techniques_used: []
ideas_generated: []
context_file: 'docs/B2B-enterprise-roadmap.md'
current_phase: 1
current_technique: 'first-principles-thinking'
phase_status:
  phase1: 'pending'
  phase2: 'pending'
  phase3: 'pending'
  phase4: 'pending'
---

# Brainstorming Session — MnM Vision Stratégique

**Facilitateur:** Gabri (Tom)
**Date:** 2026-03-12
**Approche:** AI-Recommended Progressive Flow (mix 2+4)

---

## Session Overview

**Sujet:** MnM comme plateforme unique d'orchestration inter-rôles avec automatisation progressive par IA

**Contexte terrain (CBA):**
Tom travaille à CBA et connait les pain points de chaque rôle :
- **CEO** : veut voir l'avancée de chaque équipe, faire des POC, veille forums utilisateurs, détecter les pain points hotline, driver les devs sur les bons bugs
- **DSI** : suivre l'avancée des équipes, remonter les infos au CEO et COMEP
- **DPO** : manager les équipes produit, créer des roadmaps, aligner les roadmaps PM, détecter conflits/consonances, trouver des idées de features impactantes
- **PM** : recherche utilisateur, data d'usage, prioriser les features
- **PO** : transformer besoins en epics/stories, s'appuyer sur les reco UX/UI et maquettes du designer
- **Designer** : maquettes, reco UX/UI
- **Dev** : challenger stories/epics des PO, développer, corriger bugs, tests de story
- **QA/Testeur** : tests E2E, enrichir stories avec vision tests, définir contraintes techniques pour compatibilité framework E2E
- **Lead Tech** : monitorer dette technique, refacto, montées de versions, monitorer dépendances

**Problème central :** Ces rôles n'arrivent pas à bien travailler ensemble ni à s'orchestrer, encore moins ENTRE équipes. Ruptures dans le workflow bout-en-bout.

**Vision :** Une seule interface où tout le monde travaille ensemble, alignement inter-rôles augmenté, agents IA pour automatiser le travail de chacun, et progressivement "faire péter" certains rôles.

**Goals :**
1. Clarifier quelle interface/expérience permettrait cette orchestration unifiée
2. Explorer quels rôles sont les premiers candidats à l'automatisation progressive
3. Définir comment MnM se différencie des outils existants (Jira, Linear, Notion...)
4. Trouver la bonne direction stratégique pour ne pas se disperser

---

## Journey Map — 4 Phases

### Phase 1 : DECONSTRUCTION — "C'est quoi le vrai problème ?"
- **Techniques :** First Principles Thinking + Role Playing
- **Objectif :** 30+ pain points bruts, classés par rôle et interaction inter-rôle
- **Statut :** TERMINÉE — 29 vérités

### Phase 2 : EXPLORATION CRÉATIVE — "Et si on cassait les règles ?"
- **Techniques :** What If Scenarios + Cross-Pollination + Brainstorm cofondateur + Retours hackathon
- **Objectif :** 40+ idées folles de workflows, fusions de rôles, interfaces unifiées
- **Statut :** TERMINÉE — 25 vérités supplémentaires (total : 54)

### Phase 3 : PATTERN RECOGNITION — "Qu'est-ce qui émerge ?"
- **Techniques :** Morphological Analysis + Constraint Mapping
- **Objectif :** Identifier les 3-5 "noyaux de valeur" de MnM
- **Statut :** EN COURS

### Phase 4 : VISION ACTIONNABLE — "Par où on commence ?"
- **Techniques :** Decision Tree Mapping + Future Self Interview
- **Objectif :** Un axe stratégique clair + 2-3 premières actions concrètes
- **Statut :** À venir

---

## Phase 1 : DECONSTRUCTION

### Technique 1A : First Principles Thinking

**Question de départ :** Quelles sont les vérités fondamentales sur la collaboration inter-rôles dans une entreprise tech ?

#### Échange facilitateur ↔ Gabri

**Q1 (Facilitateur) :** Si on oublie tous les outils, process et habitudes — c'est quoi fondamentalement le "travail" que chaque rôle produit et que le rôle suivant consomme ? La chaîne de production/consommation réelle, pas théorique.

**R1 (Gabri) — La chaîne réelle chez CBA :**

**PM → PO :**
- PM produit des PowerPoints d'analyse marché/utilisateurs (parfois avec l'UXR)
- PM crée des "epics" de grosses features
- PM assure le suivi des epics pour créer une roadmap cohérente

**PO → Dev/QA/Lead :**
- PO met au propre les epics
- PO crée les user stories pour les devs
- PO organise les groomings pour présenter epics/stories aux devs/lead/QA
- PO redécoupe parfois les stories pour matcher l'orga sprint/tech
- Au poker planning, PO représente les stories, vérifie la Definition of Ready — **mais jamais le temps, jamais respectée**, on avance quand même en augmentant la "complexité" du ticket

**QA en début de sprint :**
- Écrit tous les tests manuels format checklist pour chaque story du sprint

**Dev consomme les stories :**
- Développe
- Vérifie manuellement que les tests écrits par QA sont respectés
- Démo en local au PO + testeur + lead
- Si pas OK :
  - Faute du dev (c'était dans la story) → il corrige
  - Pas noté dans la story + pas complexe → il fait vite fait **mais noté nulle part**
  - Gros truc pas noté → PO doit faire une évolution pour un autre sprint

**Dev → Lead (Code Review) :**
- Envoi en Merge Request
- Lead/Senior review
- Si retours trop gros → on peut quand même approuver + le dev crée un ticket technique pour un autre sprint

**QA reçoit la story après dev :**
- Build sur serveur de test
- Rejoue les tests manuels écrits pour le dev
- **+ run des tests "dans sa tête"** pour bien valider l'US
- Puis ça part dans une version

---

#### Analyse First Principles — Vérités fondamentales extraites

**Vérité #1 — L'information se dégrade à chaque handoff**
Chaque rôle re-interprète l'output du précédent dans son propre format (PPT → Epic → Story → Code → Tests). À chaque traduction, du sens se perd.

**Vérité #2 — Le contrat inter-rôles (DoR) est aspirationnel, jamais appliqué**
On avance quand même, et la complexité est "gonflée" comme rustine. Le vrai coût se paie plus tard.

**Vérité #3 — Des décisions non-documentées se prennent en permanence**
Le dev qui "fait vite fait un truc pas noté dans la story" = de la connaissance qui disparaît. Pas de trace, pas de capitalisation.

**Vérité #4 — La dette technique est déférée par design**
MR approuvée avec gros retours → "crée un ticket technique pour un autre sprint" = dette acceptée structurellement.

**Vérité #5 — Le savoir QA est partiellement dans les têtes**
Tests écrits en checklist + tests "dans la tête" du testeur = une partie critique du contrôle qualité est non-formalisée.

**Vérité #6 — La boucle de feedback est longue et lossy**
Démo → retour → soit correction immédiate (non-tracée), soit report à un autre sprint. Semaines de latence.

**⚠️ CADRAGE IMPORTANT (Gabri) :** CBA = cas d'étude pour comprendre les pain points terrain, mais MnM doit être **agnostique** — s'adapter à n'importe quelle entreprise/workflow, pas être un outil "pour CBA". L'objectif est de transformer CBA ET d'être vendable partout.

---

#### First Principles — Niveau 2 : Abstraction au-delà de CBA

**Vérités fondamentales abstraites (universelles, pas CBA-spécifiques) :**
1. Toute organisation est une chaîne de transformation d'information
2. À chaque handoff, l'information change de format ET de contexte → perte de sens
3. Les "contrats" inter-rôles existent sur le papier mais pas en pratique
4. Des décisions se prennent "hors système" en permanence et ne sont jamais capitalisées
5. Le savoir critique est partiellement tacite (dans les têtes)
6. La boucle de feedback est structurellement trop longue

**Q2 (Facilitateur) :** Si MnM est agnostique, qu'est-ce qu'il modélise fondamentalement ? Vision (A) config manuelle, (B) templates métier, (C) observe et apprend le workflow réel ?

**R2 (Gabri) — Vision C : Agent d'onboarding intelligent**
- Comme l'étape "onboarding d'un projet" actuelle de MnM
- Un agent qui **scanne l'existant** : accès Chrome MCP pour scanner les sites/outils de l'entreprise, OU pose des questions à l'utilisateur (style interview) jusqu'à avoir une vision d'ensemble des process
- Ensuite **chaque utilisateur** setup son propre workflow et ses propres agents
- Le manager/CEO a une **vue d'ensemble** de ce que chaque personne fait → peut organiser formations/hackathons pour aider à la transformation
- Ex : si le PO n'utilise qu'un agent pour brainstorm mais pas pour écrire ses stories → le manager le voit et peut l'aider
- **MnM doit être proactif** sur ce point : suggérer des améliorations de workflow aux utilisateurs

**Insight clé :** Tout est centralisé et atomique — juste des **tâches, des agents, des workflows et des dashboards** qui s'adaptent à tout ça.

**Vérité #7 — Le modèle de données est ultra-simple : tâches + agents + workflows + dashboards**
Tout le reste (rôles, artefacts, process) est une configuration au-dessus de ces 4 primitives.

**Vérité #8 — L'adoption se fait bottom-up (chaque user setup son workflow) mais la valeur se lit top-down (le manager voit l'ensemble)**
Double direction : autonomie individuelle + visibilité collective.

**Vérité #9 — MnM doit être proactif, pas passif**
L'outil ne se contente pas de tracer — il détecte les sous-utilisations, les opportunités d'automatisation, et les suggère activement.

---

**Q3 (Facilitateur) :** Direction A — Les rôles "hors chaîne" (Designer, CEO/DSI, Lead Tech, DPO) se branchent où ? Direction B — Les ruptures entre équipes ?

**R3 (Gabri) :**

**Direction A :**

1. **Designer** : sollicité pendant la conception feature PO/PM pour avis et recos, puis fait des maquettes ultra précises "ready to dev"

2. **CEO/DSI** : consomment via réunions, excels, dashboards ClickUp, Trello, PPT de review, blocs-notes de rétro. Quand décision prise → redescend par mail ou au lead qui tente de s'adapter et réorganiser roadmap/sprint

3. **Lead Tech** : travail continu en background (dette, refacto, montées de version), essaie de s'insérer dans les sprints/versions avec le Lead Dev/PO

4. **DPO** : nouveau chez CBA, utilise ClickUp pour essayer d'avoir les infos et les Trello des PM

**Direction B — Ruptures inter-équipes :**
- Réunions entre PM/PO/Leads (2 ou 3 selon les sujets)
- **Ça prend des plombes** — l'équipe back comprend un truc, dev, puis l'équipe front regarde, veut faire son truc, et là → "faut refaire un point avec le back pour qu'ils redev car ça répond pas au besoin/maquettes"
- Globalement **une réunion par semaine** de coordination inter-équipe
- Pattern : malentendu → dev → découverte du malentendu → re-réunion → re-dev

---

#### Analyse First Principles — Vérités fondamentales extraites (suite)

**Vérité #10 — Les rôles "hors chaîne" sont des nœuds d'input/output asynchrones**
Le Designer, CEO, DSI, Lead Tech ne sont pas dans la chaîne linéaire — ils injectent de l'information (maquettes, décisions, contraintes tech) ou en consomment (dashboards, reporting) à des moments non-prédictibles.

**Vérité #11 — Le top management consomme de l'info multi-format non-unifiée**
CEO/DSI piochent dans ClickUp + Trello + Excel + PPT + rétro + réunions pour construire leur vision. Aucune source unique de vérité.

**Vérité #12 — Les décisions top-down sont des "événements" qui perturbent la chaîne**
Quand le CEO décide, ça redescend par mail/oral et c'est au lead de "s'adapter" — pas de mécanisme structuré de propagation de décision dans le workflow.

**Vérité #13 — L'alignement inter-équipe est un goulot d'étranglement synchrone**
1 réunion/semaine, et le pattern récurrent : malentendu → dev → découverte du malentendu → re-réunion → re-dev. Le coût de la coordination synchrone est énorme.

**Vérité #14 — La dette technique est un "flux parallèle" sans priorité formelle**
Le Lead Tech essaie de "s'insérer" dans les sprints — il négocie sa place plutôt que d'avoir un droit structurel.

**Vérité #15 — L'information de pilotage n'existe nulle part de manière unifiée**
Le DPO doit aller chercher manuellement les infos dans les outils de chaque PM. Pas d'agrégation automatique.

---

**Q4 (Facilitateur) :** Comment les workflows individuels se connectent entre eux ? Connexion explicite par l'user, détection auto par MnM, ou orchestration par un admin ?

**R4 (Gabri) — Réflexion en cours, tension identifiée :**
- Phase d'onboarding : une personne dans l'entreprise mène des interviews avec tous les rôles, guidée par l'agent d'onboarding MnM (sur plusieurs jours) → MnM propose des workflows de base
- Ensuite, toute modification par un utilisateur doit passer par un **agent global d'orchestration** qui a la vision d'ensemble et peut discuter avec l'utilisateur : légitimité de la demande, impacts sur les autres, etc.
- **Tension exprimée :** "Dans ma vision c'est MnM qui propose et force le workflow, mais je pense pas que ça passe en réalité dans les entreprises"
- Gabri est un peu perdu à ce niveau — sujet à creuser

#### Analyse First Principles — Vérité #16 et réflexion

**Vérité #16 — Il y a 3 niveaux de workflow, pas 1**
- **Niveau entreprise** : le flux global entre rôles (onboarding → proposé par MnM)
- **Niveau individuel** : le workflow perso de chaque user avec ses agents
- **Niveau connexion** : comment les workflows individuels s'interconnectent
→ La tension est entre autonomie individuelle et cohérence collective. C'est LE problème fondamental de toute organisation.

**Vérité #17 — L'agent d'orchestration global est le "système nerveux" de MnM**
Un agent qui a la vision d'ensemble, qui est consulté pour tout changement de workflow, et qui peut anticiper les impacts. C'est le différenciateur clé.

**🔴 POINT OUVERT À RÉSOUDRE :** Quel degré d'autorité pour l'agent d'orchestration ? Propose vs. impose vs. négocie ? À creuser en Phase 2/3.

---

### Technique 1B : Role Playing

**Objectif :** Incarner chaque rôle face à MnM pour identifier les résistances, peurs, et leviers d'adoption réels.

#### Rôle 1 : Le Dev Senior

**Mise en scène :** On annonce MnM en réunion — centralisation, agents IA perso, visibilité management.

**Réaction Dev (Gabri) :**
- "À quoi mon taff va ressembler au quotidien ? Actuellement je prends des story/bug dans le backlog, je les code (avec IA parfois sans) — ça va être quoi avec cet outil ?"
- "Et WTF comment ça les managers voient tout ce qu'on fait ? Ça veut dire quoi et ce sera quoi l'impact ?"

**2 réactions clés identifiées :**
1. **Peur du changement de workflow quotidien** — "mon flux actuel marche, pourquoi changer ?"
2. **Peur de la surveillance** — "visibilité management = flicage ?"

**Réponse MnM (facilitateur) :** Pitch en 2 points — quotidien quasi inchangé au début (tout le contexte centralisé + agents perso), visibilité management = dashboards agrégés pas du flicage individuel.

**Contre-réaction Dev (Gabri) :**
1. **Le contexte centralisé = crédible.** Mais "ton quotidien change pas" = **bullshit**, forcément ça va changer et surtout → **"j'ai l'impression qu'au fur et à mesure je vais être remplacé"**. Et côté management → **"j'y crois pas que ça servira pas à identifier les devs moins bons"**
2. **Point de bascule :** ce serait de **donner une nouvelle dimension au taff**. "Ok je fais peut-être plus une ligne de code, mais voilà ce que ça améliore pour moi, à quoi ressemble mon rôle demain et dans 1 mois"
3. **Limite du role play :** Gabri est lead/focus produit, pas dev tech pure → avis biaisé sur ce point

**Vérité #18 — La peur n°1 des opérationnels face à MnM c'est le remplacement, pas le changement d'outil**
Ce n'est pas "encore un nouvel outil" qui fait peur, c'est "est-ce que cet outil me rend obsolète ?"

**Vérité #19 — MnM doit montrer l'évolution du rôle, pas la disparition**
Le point de bascule c'est : "voilà à quoi TON rôle ressemble demain avec MnM" — une montée en compétence, pas une mise au placard. MnM doit avoir un discours d'élévation par rôle.

**Vérité #20 — La transparence managériale est un deal-breaker si mal gérée**
Si les devs pensent que les dashboards servent au management pour les comparer/noter, l'adoption est morte. MnM doit avoir des garanties structurelles (agrégation, pas d'individualisation visible par le management).

**Précision rôle Gabri :** Lead Dev chez CBA = Lead Tech + Scrum Master + gestion de versions + management d'équipe. Rôle hybride multi-casquettes.

**Vérité #21 — Les rôles réels sont des combinaisons de rôles théoriques**
Un "Lead Dev" en vrai c'est 4 rôles en un. MnM doit modéliser des rôles composites, pas des rôles purs. Renforce la vérité que MnM doit être agnostique et configurable.

#### Rôle 2 : Le Lead Dev (Tom pour de vrai)

**Q5 (Facilitateur) :** Tes galères quotidiennes, ton problème n°1 à résoudre, ce que tu déléguerais/lâcherais jamais ?

**R5 (Gabri) :**

**Galères quotidiennes :**
- **Scrum + versions = le pire** : gestion de qui fait quoi, prépa sprints, coordination inter-équipe, s'assurer que tout le monde comprenne tout
- **Code review + qualité de code = saoulant** : être responsable de toutes les reviews
- **Pas la main sur le produit** : fait des retours UX/UI → "c'est pas ton rôle, 4 personnes y ont pensé sans toi"
- **Ce qu'il adore :** management d'équipe, accompagner les gens

**Problème n°1 :**
- Réponse viscérale : "virer les PO et être respo de mes features" (mais conscient d'être biaisé — product engineer/thinker plus que lead dev pur)
- Réponse réfléchie : automatiser code reviews, gestion de versions, priorisation des tâches, agents en background qui analysent
- **Insight clé :** "C'est en tentative d'adaptation à nos workflows actuels qui sont chiants. Je pense qu'avec l'IA on peut vraiment simplifier toute cette chaîne et que du coup j'ai plus ces problématiques"

**Ce qu'il lâcherait jamais :**
- Discuter avec les gens : brainstorm d'idées/features, discuter de leur vision du futur, réfléchir ensemble à la transformation, apporter son point de vue pour les guider vers un endroit qui leur correspond

---

#### Vérités fondamentales extraites du Role Playing

**Vérité #22 — Dans chaque rôle il y a du "process mécanique" et de "l'humain irremplaçable"**
Tom : code review/scrum/versions = automatisable. Accompagnement/vision/brainstorm = irremplaçable. Cette dichotomie existe dans CHAQUE rôle. MnM doit automatiser le mécanique pour libérer l'humain.

**Vérité #23 — Les workflows actuels CRÉENT des problèmes qui n'existeraient pas sans eux**
"C'est en tentative d'adaptation à nos workflows actuels qui sont chiants" → Les process scrum/sprint/versioning sont des solutions à des problèmes d'un monde pré-IA. Avec l'IA, certains problèmes disparaissent et les process qui les traitaient deviennent du poids mort.

**Vérité #24 — Le cloisonnement des rôles frustre les profils transversaux**
Un lead dev qui a des bonnes idées produit/UX mais "c'est pas ton rôle" = intelligence gaspillée. MnM pourrait valoriser les contributions cross-rôles au lieu de les bloquer.

**Vérité #25 — Ce que les gens veulent garder = les interactions humaines à haute valeur**
Brainstorm, accompagnement, vision, réflexion collective. Personne ne veut garder le reporting, la coordination mécanique, la priorisation de backlog. Le cœur de valeur humaine est dans la **conversation et la co-construction**.

---

### Pivot terrain : Hackathon CBA en cours !

Gabri est en hackathon IA à CBA avec Claude Code illimité. Opportunité unique de poser des questions aux vrais rôles.

**Questions préparées pour interviews terrain :**

#### Pour le PO :
1. "Si t'avais un agent IA qui pouvait écrire tes user stories à partir des epics du PM et des maquettes du designer — tu ferais quoi de ton temps libéré ?"
2. "Dans ton taf quotidien, c'est quoi le truc mécanique qui te saoule, et c'est quoi le truc où tu te sens irremplaçable ?"
3. "Si on centralisait tout dans un seul outil — stories, maquettes, tests QA, roadmap — ça changerait quoi concrètement ?"

#### Pour le QA :
1. "Quand tu testes, tu fais les tests checklist + des trucs 'dans ta tête'. C'est quoi ces trucs en plus ? Tu pourrais les formaliser ?"
2. "Si une IA écrivait les cas de test à partir de la story et des maquettes, tu lui ferais confiance ? Qu'est-ce qu'elle raterait ?"
3. "Si tu pouvais intervenir plus tôt ou différemment dans le cycle, tu changerais quoi ?"

#### Pour le CEO/DSI/DPO :
1. "Un dashboard unique temps réel de toutes les équipes/projets/roadmaps sans reporting manuel — ça changerait quoi dans tes décisions ?"
2. "Quand tu changes de priorité stratégique, ça met combien de temps avant que ce soit appliqué terrain ? Pourquoi si long ?"
3. "Pendant ce hackathon IA, qu'est-ce qui t'impressionne le plus et qu'est-ce qui te fait le plus peur ?"

#### Role Play Gabri — Réponses biaisées mais éclairantes

**PO (vue de Gabri) :**
- Vraie plus-value : savoir tribal sur le contexte métier + temps de se poser les bonnes questions sur les besoins pour les inscrire de la meilleure façon dans le produit
- MAIS : "les devs pourraient le faire si on leur donnait plus de responsabilité"
- → Le PO = un intermédiaire dont la valeur vient de la connaissance contextuelle, pas du rôle lui-même

**QA (vue de Gabri) :**
- Phase transition : les testeurs expliquent leurs tests manuels à MnM qui les automatise
- Vraie plus-value : connaissance produit ultra-profonde (testent manuellement depuis longtemps), edge cases tricky que personne d'autre ne voit
- Exemple concret : "vous avez pensé au cas où l'utilisateur est remplaçant d'une infirmière, et qu'il soigne un patient ALD + diabétique avec une mutuelle en Meurthe-et-Moselle ?"
- **"Si demain toute la chaîne est SUPER propre et IA boostée, effectivement ils perdraient leur utilité"**

**CEO/DSI (vue de Gabri) :**
- Le pitch qui marche : "dashboard customisé à vos besoins, évolutif, avec des agents qui ont la vision sur TOUTE la chaîne complète, qui peuvent tout query et vous obtenir des insights sans attendre de retours des équipes"
- Gabri admet : "j'en sais rien je suis pas à leur place"

---

#### Vérités fondamentales extraites

**Vérité #26 — La vraie valeur de certains rôles c'est le savoir tribal/contextuel, pas le rôle en soi**
PO et QA ont de la valeur parce qu'ils connaissent le métier/produit sur le bout des doigts. Si cette connaissance était capturée et accessible, le rôle-enveloppe devient questionnable.

**Vérité #27 — L'edge case métier est la dernière forteresse humaine**
"Patient ALD + diabétique + mutuelle Meurthe-et-Moselle" = connaissance tellement contextuelle et combinatoire que seule l'expérience humaine la détecte. Mais une fois formalisée, l'IA peut l'apprendre.

**Vérité #28 — La capture de savoir tacite est la clé de la transformation**
Si MnM capture progressivement le savoir tribal (tests dans la tête du QA, contexte métier du PO), il accumule un actif qui rend les rôles-intermédiaires progressivement remplaçables. C'est le mécanisme de "faire péter les rôles".

**Vérité #29 — Le CEO/DSI achète l'accès direct à l'information, sans intermédiaire humain**
"Poser une question et avoir une réponse sans attendre de retour des équipes" = supprimer la latence humaine dans la chaîne de reporting.

**🔴 POINT OUVERT :** Comment MnM gère éthiquement la disparition progressive de rôles ? C'est un argument de vente pour le CEO mais une menace pour le PO/QA. À creuser en Phase 2.

---

**Statut Phase 1 :** TERMINÉE — 29 vérités fondamentales extraites.
**Fichier questions terrain :** `_bmad-output/brainstorming/interview-questions-hackathon.md`
**Fichier DM prêts :** `_bmad-output/brainstorming/dm-hackathon.md`

---

## Phase 2 : EXPLORATION CRÉATIVE — "Et si on cassait les règles ?"

### Technique 2A : What If Scenarios

#### What If #1 — Et si les rôles n'existaient plus ?

**Scénario :** Plus de rôles fixes. Chaque personne = "contributeur" avec compétences/appétences. MnM assigne dynamiquement les tâches.

**Réponse Gabri :**
- Génial mais utopique : pour savoir qui apporte le bon truc au bon moment, il faudrait un manager qui connaît tout le monde (faux, la majorité sont mauvais) ou que les gens sachent où ils sont le mieux placés (la majorité ne sait pas non plus)
- **Sa vraie vision, en 2 étapes :**
  1. **D'abord :** Rendre frictionless le métier de chacun. Chacun configure son workflow + ses agents perso pour automatiser son taff. L'humain n'est plus que le **cerveau décisionnaire/critique/penseur**, plus l'exécutant.
  2. **Ensuite :** Les agents de chaque personne peuvent **query le contexte complet** des agents de leurs "collègues". Plus de "il a mal compris ce que je voulais dire" → c'est de la query pure dans le contexte/workflow de l'autre. Pas de dialogue humain lossy, de la requête machine précise.

**Idées générées :**

**[WhatIf #1]**: Agents comme proxys de communication
_Concept_: L'agent du dev peut directement query l'agent du PO pour obtenir le contexte exact d'une story, sans passer par un humain qui reformule/interprète. La communication inter-rôles devient machine-to-machine avec l'humain en superviseur.
_Novelty_: On ne remplace pas le dialogue humain — on le rend inutile pour le transfert d'information facturelle. L'humain ne parle que pour les décisions, pas pour la transmission.

**[WhatIf #2]**: L'humain comme cerveau, pas comme bras
_Concept_: Chaque rôle garde son expertise décisionnelle/critique/créative mais délègue 100% de l'exécution à ses agents. Le PO pense les besoins mais n'écrit plus de stories. Le QA pense les scénarios mais n'écrit plus de tests.
_Novelty_: Ça inverse le ratio temps — aujourd'hui 80% exécution / 20% réflexion → demain 20% supervision / 80% réflexion stratégique.

**[WhatIf #3]**: La fin du malentendu structurel
_Concept_: Le problème inter-équipe (back comprend un truc, dev, front découvre que c'est pas ça) disparaît car les agents partagent un contexte commun queryable. Le "malentendu" n'existe plus car l'information n'est plus traduite/interprétée par des humains.
_Novelty_: On ne résout pas le problème de communication — on le supprime en retirant la communication humaine de la boucle de transmission d'info.

---

#### What If #2 — Et si les sprints n'existaient plus ?

**Scénario :** Plus de batch/sprint. Les agents se coordonnent en continu. Le travail devient un flux continu, les dépendances se résolvent automatiquement.

**Réponse Gabri :**
- Oui, flux continu pour **le code / l'exécution**
- Mais pas forcément pour les **idées, la réflexion, le brainstorm** — ça c'est humain et ça a son propre rythme
- Le flow : chaque rôle se pose, brainstorm avec agents ou humains, donne le résultat aux agents → exécution 100x plus vite
- **Distinction clé : 2 vitesses dans le workflow**
  - Vitesse humaine : réflexion, idéation, décision (asynchrone, à son rythme)
  - Vitesse machine : exécution, coordination, transmission (continu, temps réel)

**Idées générées :**

**[WhatIf #4]**: Le dual-speed workflow
_Concept_: MnM gère 2 flux parallèles — un flux "pensée" (humain, asynchrone, brainstorm/décision) et un flux "exécution" (machine, continu, code/tests/deploy). L'humain injecte des décisions dans le flux machine quand il est prêt, pas quand le sprint l'exige.
_Novelty_: On ne force plus les humains à penser au rythme du sprint. Les machines n'attendent plus les humains pour exécuter. Chacun va à sa vitesse naturelle.

**[WhatIf #5]**: La mort du planning poker
_Concept_: Si l'exécution est machine et continue, la notion de "complexité" d'un ticket et de "vélocité" d'une équipe n'a plus de sens. L'IA sait combien de temps ça prend parce qu'elle l'exécute. Le planning devient de la priorisation pure, pas de l'estimation.
_Novelty_: On supprime toute la cérémonie d'estimation (poker planning, DoR, sizing) qui est un aveu que les humains sont mauvais pour prédire. L'IA n'a pas besoin de prédire, elle exécute.

**[WhatIf #6]**: Le brainstorm comme seul "événement" humain
_Concept_: Si toute l'exécution est automatisée, les seuls moments où les humains se réunissent c'est pour penser ensemble — brainstorm, décision stratégique, arbitrage. Plus de daily, plus de grooming, plus de rétro sur le process. Juste des sessions de réflexion collective quand il y a un vrai sujet.
_Novelty_: Les réunions ne sont plus des cérémonies de coordination — elles deviennent des sessions de création pure. On ne se réunit plus par obligation mais par besoin de penser ensemble.

---

#### What If #3 / Cross-Pollination — MnM comme architecture event-driven pour humains

**Scénario :** Chaque rôle = un microservice autonome. Communication via événements (pas de réunions synchrones). Agent d'orchestration = event bus.

**Réponse Gabri — Vision réaliste en 3 phases d'adoption :**

**Phase 1 (aujourd'hui) — Event-driven MANUEL :**
- Le Designer se connecte, voit que le PO a publié une epic
- Il lance manuellement un agent pour réfléchir à l'UX / faire les maquettes
- Les gens ne sont pas prêts pour du full auto
- **Raison clé : si c'est tout auto, personne ne valide/approuve** → l'humain doit rester dans la boucle de décision

**Phase 2 (demain) — Event-driven ASSISTÉ :**
- MnM notifie et propose des actions, l'humain approuve en 1 clic

**Phase 3 (après-demain) — Event-driven AUTO :**
- Full auto avec l'humain qui supervise les exceptions

**Insight fondamental sur le workflow réel :**
- Tout le monde se met dans une salle, brainstorme ensemble (avec un agent brainstorm)
- L'output du brainstorm part directement aux agents dev
- Les agents dev codent, testent, et ça part en prod
- **Le workflow complet = brainstorm humain → output → agents → prod**

**Idées générées :**

**[CrossPol #1]**: L'adoption progressive event-driven (manuel → assisté → auto)
_Concept_: MnM ne force pas l'automatisation. Phase 1 : l'utilisateur voit les événements et agit manuellement. Phase 2 : MnM propose des actions, l'humain approuve. Phase 3 : full auto avec supervision. Chaque utilisateur avance à son rythme sur ce spectre.
_Novelty_: Résout la tension "propose vs. impose" (point ouvert #16). C'est ni l'un ni l'autre — c'est un curseur que chaque utilisateur déplace quand il est prêt.

**[CrossPol #2]**: Le brainstorm comme point d'entrée de toute la chaîne
_Concept_: Le workflow ne commence plus par "le PM écrit une epic" mais par "des gens se mettent dans une salle et brainstorment avec un agent". L'output structuré du brainstorm EST l'input de toute la chaîne d'exécution. Plus de traduction PPT → Epic → Story → Code. C'est : brainstorm → output structuré → agents → prod.
_Novelty_: On compresse toute la chaîne PM → PO → Dev → QA → Deploy en : humains pensent → machines exécutent. Les étapes intermédiaires de traduction disparaissent.

**[CrossPol #3]**: L'humain comme validateur, pas comme exécutant
_Concept_: À chaque étape de la chaîne automatisée, l'humain n'exécute pas — il valide/approuve/redirige. Le Designer ne dessine pas la maquette — il valide celle que l'agent a générée. Le QA n'écrit pas les tests — il valide ceux que l'agent a produits. L'humain est le "gate" de qualité, pas la "machine" de production.
_Novelty_: Ça redéfinit chaque rôle : de "producteur d'artefacts" à "gardien de qualité et de pertinence". La compétence clé n'est plus "savoir faire" mais "savoir juger".

**Vérité #30 — L'adoption de l'automatisation est un curseur individuel, pas un switch global**
Chaque user avance à son rythme : manuel → assisté → auto. MnM doit supporter les 3 modes simultanément dans la même entreprise.

**Vérité #31 — Le brainstorm collectif est le vrai point d'entrée du workflow**
Pas l'epic, pas la story, pas le ticket. Le brainstorm. Tout le reste est de l'exécution.

**Vérité #32 — Le rôle humain se transforme de "producteur" à "juge"**
Savoir faire → savoir juger. Savoir écrire une story → savoir évaluer si la story générée est bonne.

---

#### What If #4 — Et si MnM brainstormait seul ?

**Scénario :** MnM a accumulé assez de savoir tribal, data d'usage, historique de décisions pour détecter les problèmes, brainstormer des solutions, simuler l'impact, et proposer au CEO un top 3 avec recommandation d'exécution. L'humain n'est plus que le "go / no-go".

**Réponse Gabri :** "C'est exactement ça le futur."

**Vérité #33 — La vision long terme de MnM = l'entreprise autonome avec l'humain en go/no-go**
Le end-game n'est pas "aider les gens à mieux travailler" — c'est "l'IA fait tourner l'entreprise et l'humain décide de la direction". MnM accumule le savoir, détecte les opportunités, propose des plans, exécute après validation.

**Vérité #34 — MnM est une machine à capturer et capitaliser le savoir organisationnel**
Chaque brainstorm, chaque décision, chaque retour utilisateur, chaque edge case du QA = de la data qui rend MnM plus intelligent. Plus l'entreprise utilise MnM, plus MnM peut remplacer des étapes humaines. C'est un flywheel.

---

#### Récapitulatif Phase 2 — Chaîne d'évolution de MnM

**Aujourd'hui (Phase 1 adoption) :**
Humain fait + humain coordonne + outils passifs
→ MnM centralise, chaque user configure son workflow/agents manuellement

**Demain (Phase 2 adoption) :**
Humain pense + machine exécute + agents se coordonnent
→ Brainstorm humain → output → agents → humain valide → prod

**Après-demain (Phase 3 adoption) :**
Machine détecte + machine propose + machine exécute + humain go/no-go
→ MnM brainstorme seul, propose au décideur, exécute si validé

**C'est le pitch de MnM en 3 lignes.**

---

#### Brainstorm cofondateur — 6 insights fondamentaux

**Source :** Discussion entre Gabri (Tom) et son cofondateur pendant le hackathon.

**Insight #1 — Onboarding top-down en cascade hiérarchique**
- Le directeur définit la chaîne de workflow et les rôles de son entreprise
- Il invite chaque personne et les assigne à leurs agents/rôles
- **Chaque niveau hiérarchique définit le niveau inférieur** :
  - CEO → définit qu'il y a un CTO, des PO, 3 produits, 4 projets
  - CTO → définit la stratégie de dev de ses équipes
  - Directeur produit → définit PM, PO, Designers, marketing
  - Directeur marketing → définit la stratégie de ses équipes
- Chaque "étage" discute entre eux (intelligence collective entre directeurs) pour que les workflows soient cohérents dès la définition initiale
- Possible session "tous ensemble" pour valider la cohérence globale

**Insight #2 — Workflows déterministiques, pas confiés aux agents**
- Contrairement à BMAD qui charge les workflows et laisse l'agent les gérer...
- **MnM inscrit les workflows de manière déterministique et algorithmique**
- L'agent n'a PAS la responsabilité de suivre le workflow — MnM l'impose
- Exemple : "workflow de développement d'une story" = script/pattern défini en amont qui détermine quel agent, quel prompt, quel contexte charger selon le langage/framework
- Peut être un LLM, un script, ou un tool qui détermine le bon agent et la bonne config

**Insight #3 — Gestion de contexte = feature critique**
- Problème identifié : quand un agent a trop de workflow en contexte et compacte, il perd la définition du workflow → skip des étapes, bypass des règles
- **Solution MnM :** après chaque compaction, réinjecter en dur les pré-prompts et informations critiques du workflow
- MnM surveille les agents et s'assure qu'ils adhèrent au workflow
- Si un agent compacte et ne produit pas le résultat attendu → c'est documenté, le manager voit la tâche, peut en discuter avec le lead tech, et décider de découper (ex: 2 sous-agents au lieu d'1 — un pour le dev, un pour la code review)

**Insight #4 — Dialogue humain-agent pendant l'exécution**
- Aujourd'hui MnM est full auto : mission → exécution → résultat → report
- **Manque identifié :** le dev veut pouvoir voir son agent en live, l'arrêter, le guider, lui dire "là tu te plantes, fais plutôt ça"
- L'humain doit pouvoir dialoguer avec son agent pendant qu'il travaille
- Pas juste "lancer et attendre" mais "conduire" l'agent

**Insight #5 — Observabilité simplifiée (Langfuse/LangChain)**
- Aujourd'hui : historique tools, thinking, logs bruts → illisible, il faut se taper tous les logs
- **Vision :** couche d'observabilité type Langfuse qui trace et simplifie
  - Au lieu de voir chaque appel fichier → "il a 5 fichiers en contexte"
  - LLM qui analyse les traces en temps réel et résume simplement ce qui se passe
- **Audit log centralisé :** si un dev fait une erreur, on peut remonter à quel moment l'agent s'est planté, sans aller lire les logs sur l'ordi de la personne
- Traçabilité pour debug, accountability, amélioration continue

**Insight #6 — La hiérarchie ne descend pas jusqu'aux opérationnels**
- Le CEO ne définit pas le workflow du dev individuel
- Il définit la structure (rôles, équipes, produits, projets)
- Chaque manager définit son niveau
- L'opérationnel (dev, designer, QA) configure son propre workflow/agents dans le cadre défini par son manager

---

#### Nouvelles vérités extraites du brainstorm cofondateur

**Vérité #35 — L'onboarding est une cascade hiérarchique, pas un setup unique**
Chaque niveau définit le suivant. Le CEO ne configure pas le workflow du dev — il définit la structure que le CTO raffine, que le Lead raffine, etc.

**Vérité #36 — Les workflows sont déterministiques, PAS confiés à l'IA**
C'est la différence fondamentale entre MnM et un "agent wrapper". L'agent n'interprète pas le workflow — MnM l'impose algorithmiquement. L'IA est contrainte par le système, pas l'inverse.

**Vérité #37 — La gestion de contexte est l'avantage technique différenciateur**
Le problème de compaction = le problème technique n°1 des agents IA longs. MnM qui réinjecte les pré-prompts critiques après compaction = avantage technique défendable.

**Vérité #38 — L'agent doit être "conduisible", pas juste "lançable"**
L'humain veut piloter son agent en temps réel : voir, arrêter, guider, corriger. Pas du fire-and-forget.

**Vérité #39 — L'observabilité simplifiée est un prérequis de confiance**
Personne ne fera confiance à un agent dont on ne peut pas comprendre les actions. Langfuse + résumé LLM = rendre l'agent transparent et debuggable.

**Vérité #40 — L'audit centralisé des agents est un argument B2B enterprise**
"Si quelque chose merde, on sait exactement où et quand l'agent s'est planté, sans aller sur l'ordi de la personne" = compliance, accountability, confiance managériale.

---

#### Retour hackathon — Feedback terrain + approfondissements cofondateur

**Feedback CTO hackathon :**
- Le CTO était très critique sur les résultats IA — il ne comprenait pas pourquoi les agents n'avaient pas chargé tel ou tel skill/fichier en contexte
- **Validation directe de la vérité #36 :** avec MnM, le CTO pourrait dire "cet agent, obligatoirement, charge CE fichier en contexte" — injecté dans le prompt de base de l'agent et du workflow, pas laissé au choix de l'IA

**Stratégies de gestion de compaction (approfondissement #37) :**
- **Option A :** Au moment de la compaction → kill l'agent, lui demander de poster son résultat, lancer un nouvel agent avec le résultat du premier + re-prompt workflow complet
- **Option B :** Après compaction → réinjecter le workflow MnM pour s'assurer que l'agent a toujours le workflow en tête
- À investiguer techniquement quelle option est la plus fiable

**Insight #7 — Dual-mode de configuration (oral vs. visuel)**
- **Mode oral/chat (CEO-like) :** découverte conversationnelle, le CEO définit les rôles et la structure à l'oral, MnM structure derrière
- **Mode visuel/manuel (CTO-like) :** édition précise des agents, fichiers en contexte, workflows, prompts — configuration critique et technique
- Les 2 modes doivent coexister — chaque persona a sa façon naturelle de configurer
- Le CEO ne veut pas éditer des prompts, le CTO ne veut pas "parler" à un chat pour configurer

**Insight #8 — MnM comme source unique de vérité (Single Source of Truth)**
- **Vision :** une fois MnM déployé, TOUTES les tâches et features sont développées VIA MnM
- L'avancée d'un projet, d'une feature, d'une équipe, le travail restant → directement dans MnM via le système de tâches/issues
- **Import initial :** mapping intelligent depuis Jira/Linear/ClickUp vers le modèle MnM
- **Après l'import :** MnM fige les premières briques atomiques. Tout vit dans MnM.
- **Plus de double tracking :** pas de dashboard MnM d'un côté + fichiers markdown/sprint board de l'autre
- Pas besoin de "découverte générique de codebase" car tout le contexte est dans la DB MnM
- L'import + le mapping = le moment où MnM "avale" l'existant et devient le système de référence

---

#### Nouvelles vérités extraites

**Vérité #41 — MnM doit offrir 2 modes de configuration : oral (CEO) et visuel (CTO)**
Pas un choix produit — c'est une nécessité d'adoption. Chaque persona a un mode naturel. Forcer un mode unique = perdre la moitié des utilisateurs.

**Vérité #42 — MnM est la source unique de vérité, pas un dashboard au-dessus d'autres outils**
MnM ne se branche pas "par-dessus" Jira — il le REMPLACE. Import initial intelligent, puis tout vit dans MnM. Pas de synchronisation, pas de double tracking.

**Vérité #43 — L'import/mapping initial est le moment critique d'adoption B2B**
C'est le "moment de vérité" : si l'import depuis Jira/Linear/ClickUp est fluide et fidèle, l'entreprise bascule. Si c'est douloureux, c'est mort. L'import intelligent = feature stratégique.

**Vérité #44 — La compaction est un problème à résoudre au niveau plateforme, pas au niveau agent**
L'agent ne doit pas gérer sa propre mémoire. MnM le fait : soit en killant/relançant avec contexte frais, soit en réinjectant post-compaction. C'est une responsabilité système.

**Vérité #45 — Le feedback terrain (hackathon CTO) valide que le contrôle déterministique est un vrai besoin**
Ce n'est pas théorique — le CTO a été frustré EN VRAI par des agents qui ne chargeaient pas les bons fichiers. Le workflow déterministique MnM résout un pain point observé cette semaine.

---

#### Retour hackathon — Interview Directeur Produit

**Comment le Directeur Produit travaille aujourd'hui (sans MnM) :**
- Un repo git sur VS Code = sa "base de connaissances perso"
- Spawne des sessions Claude Code dans VS Code
- Alimente Claude avec : fichiers audio, Excel, CSV, data Intercom (sondages utilisateurs)
- Claude garde tout en mémoire dans le projet git
- Au fil des années → énorme base locale sur son PC
- Il pose des questions à Claude sur toute cette data accumulée → insights
- Claude lui fait des dashboards, des présentations, des synthèses
- **C'est un workflow bricolé mais puissant** : accumulation progressive de savoir + interrogation IA

**Ce que MnM doit remplacer :**
- Le bricolage git + VS Code + Claude Code = un workspace MnM structuré
- Workflows définis : ex. "extraction audio → synthèse → résumé" = un workflow MnM avec un agent dédié
- Upload fichier audio → agent exécute le workflow → fichier final créé
- Stockage : push git OU data lake entreprise OU base de données MnM
- Ensuite d'autres agents peuvent consommer cette data/ces fichiers

**Insight #9 — Le partage inter-agents avec permission**
- Scénario concret : quelqu'un demande "c'est quoi le résultat du compte-rendu de la réunion avec le directeur produit ?"
- Son agent détecte que le directeur produit a fait un compte-rendu via un de ses agents
- L'agent trouve le fichier et **envoie une demande de permission** au directeur produit : "est-ce qu'on peut partager ce fichier avec cette personne ?"
- Si le directeur dit oui → le fichier est partagé dans le contexte des agents de l'autre personne
- **C'est un système de permissions agent-to-agent avec validation humaine**

---

#### Nouvelles vérités extraites

**Vérité #46 — MnM remplace les "bricolages IA individuels" par des workflows structurés**
Aujourd'hui les power users bricolent (git + Claude Code + fichiers locaux). MnM formalise ces bricolages en workflows réutilisables, partageables, et auditables. Le directeur produit n'a plus besoin d'être tech pour avoir son pipeline de data.

**Vérité #47 — MnM est aussi un data lake organisationnel alimenté par les agents**
Les agents produisent des artefacts (résumés, comptes-rendus, analyses, dashboards) qui s'accumulent dans MnM. Cette data est queryable par d'autres agents. L'entreprise construit un capital de connaissances collectif sans effort manuel.

**Vérité #48 — Le partage d'information inter-agents nécessite un système de permissions humain-in-the-loop**
Les agents ne partagent pas tout automatiquement. Un agent peut demander l'accès à un artefact d'un autre agent, mais le propriétaire humain valide. Ça résout confidentialité + contrôle tout en gardant la fluidité agent-to-agent.

**Vérité #49 — Chaque utilisateur de MnM accumule progressivement un "cerveau augmenté" personnel**
Comme le directeur produit avec son git + Claude, mais structuré et connecté aux autres. Au fil du temps, chaque user a une base de connaissances riche que ses agents exploitent. Plus tu utilises MnM, plus tes agents sont pertinents.

**Vérité #50 — Le use case du directeur produit montre que MnM n'est pas qu'un outil de dev — c'est un outil de travail universel**
Audio, Excel, CSV, sondages, présentations, dashboards... Le directeur produit ne code pas. Il a besoin d'organiser de la data, d'en tirer des insights, de partager des synthèses. MnM doit servir des profils non-techniques aussi bien que des devs.

---

#### Correction de cap — MnM n'est PAS un data lake

**Cadrage Gabri :**
- MnM ne DEVIENT PAS un data lake
- MnM est un **connecteur** vers les data lakes existants (si l'entreprise le décide)
- Connecteurs possibles : data lake local, SharePoint, Slack, Teams, DMs via agents, etc.
- **Les agents MnM créent LEURS PROPRES connecteurs** : le CEO donne le code source d'un outil interne → un agent MnM crée un connecteur pour s'interfacer avec

**Philosophie core : MnM = OpenClaw, pas NanoClaw**
- Atomique, léger, facilement customisable
- La personne responsable de MnM dans l'entreprise peut itérer et modifier la structure même de MnM avec des agents
- MnM ne fait pas tout — il orchestre tout

**Le vrai produit MnM (définition affinée) :**
1. **Orchestrateur d'agents** avec workflows déterministiques
2. **Assurance/sécurité** que les workflows et agents opèrent de manière plus déterministique qu'aujourd'hui
3. **Drift detection** (futur) — détecter quand un agent dévie de son workflow
4. **Expertise d'audit** — aider les entreprises à setup leurs workflows et agents (observabilité, traçabilité)
5. **Connecteurs extensibles** — les agents créent eux-mêmes leurs connecteurs vers les outils de l'entreprise

---

#### Vérités corrigées et nouvelles

**Vérité #47 (CORRIGÉE) — MnM est un orchestrateur-connecteur, pas un data lake**
MnM ne stocke pas toute la data — il se connecte aux systèmes existants (data lake, SharePoint, Slack, Teams). La valeur de MnM c'est l'orchestration et la connexion, pas le stockage.

**Vérité #51 — Les agents MnM doivent pouvoir créer leurs propres connecteurs**
Le CEO donne le code source d'un outil interne → un agent crée le connecteur → MnM s'interface. L'extensibilité n'est pas un catalogue de plugins — c'est une capacité native de création.

**Vérité #52 — MnM doit être modifiable de l'intérieur par ses propres agents**
La personne responsable de MnM dans l'entreprise peut utiliser des agents MnM pour modifier MnM lui-même. C'est un outil qui s'auto-améliore et s'adapte via ses propres capacités.

**Vérité #53 — Le produit MnM se résume en 1 phrase : orchestrateur d'agents déterministique avec audit et connecteurs auto-générés**
Pas un IDE, pas un data lake, pas un Jira killer. Un orchestrateur qui garantit que les agents respectent les workflows, avec la capacité de se connecter à tout et de se modifier lui-même.

**Vérité #54 — La drift detection est le futur argument de vente enterprise**
"Votre agent a dévié du workflow défini à l'étape 3" = le genre de monitoring que les CTO/DSI veulent pour faire confiance à l'IA en production. C'est comme le monitoring d'uptime mais pour les agents.

---

## Phase 3 : PATTERN RECOGNITION

### Morphological Analysis — 5 Noyaux de Valeur de MnM

**NOYAU 1 — L'Orchestrateur Déterministique** (vérités #36, #37, #44, #45, #54)
Le moteur technique. MnM impose les workflows aux agents. Gestion de compaction, réinjection de contexte, drift detection. Différenciateur technique défendable.

**NOYAU 2 — L'Observabilité & Audit** (vérités #39, #40, #45, #54)
La couche de confiance. Traçabilité Langfuse, résumé LLM temps réel, audit centralisé. L'argument qui fait signer les décideurs enterprise.

**NOYAU 3 — L'Onboarding en Cascade & Configuration Duale** (vérités #35, #41, #43, #7, #8, #16)
L'expérience de mise en place. Onboarding hiérarchique, dual-mode (oral/visuel), import intelligent Jira/Linear/ClickUp. Le moment de vérité de l'adoption.

**NOYAU 4 — La Communication Agent-to-Agent avec Permissions** (vérités #48, #51, #52, #47, WhatIf #1, #3, CrossPol #1)
Le système nerveux. Query inter-agents, permissions humain-in-the-loop, connecteurs auto-générés, MnM modifiable de l'intérieur. Résout la perte d'info aux handoffs.

**NOYAU 5 — Le Dual-Speed Workflow & Curseur d'Automatisation** (vérités #22, #25, #30, #31, #32, #33, #34, WhatIf #4-6, CrossPol #2-3)
La philosophie produit. Vitesse humaine (brainstorm) + vitesse machine (exécution). Curseur manuel → assisté → auto. L'humain de producteur à juge. Le "pourquoi" de MnM.

### Constraint Mapping — Validé par Gabri

| Contrainte | Statut | Note |
|---|---|---|
| Gestion de compaction techniquement dure | RÉELLE | 2 options à investiguer |
| Les gens pas prêts pour le full auto | RÉELLE temporaire | Le curseur d'automatisation résout |
| Import Jira/Linear complexe | RÉELLE | Vrai travail d'ingénierie |
| MnM doit tout stocker | IMAGINÉE | MnM = connecteur, pas data lake |
| Agents ne peuvent pas créer leurs connecteurs | IMAGINÉE | Techniquement possible (MCP, codegen) |
| CEO ne voudra pas configurer via chat | IMAGINÉE | Le directeur produit le fait déjà |
| Drift detection trop complexe | RÉELLE non-bloquante | Futur, pas prérequis de lancement |
| Entreprises ne quitteront jamais Jira | PARTIELLEMENT IMAGINÉE | Migration progressive via import intelligent |
| Faire péter les rôles = éthiquement problématique | RÉELLE | Pitch = "élévation", pas "remplacement" |

**Statut Phase 3 :** TERMINÉE

---

## Phase 4 : VISION ACTIONNABLE

### Decision Tree Mapping — Chemins stratégiques

**4 chemins identifiés par noyau de valeur :**
- A = Orchestrateur Déterministique (moteur technique)
- B = Onboarding + Import (expérience d'adoption)
- C = Dual-Speed Workflow (philosophie produit / wow effect)
- D = Observabilité & Audit (couche de confiance)

**Décision Gabri — Split naturel cofondateurs :**
- **Tom (Gabri) → Chemin B + D** : Onboarding en cascade, import intelligent, dual-mode config, observabilité Langfuse, audit centralisé
- **Cofondateur → Chemin A + D** : Orchestrateur déterministique, gestion compaction, réinjection contexte, drift detection, + observabilité
- **D est partagé** : les deux y contribuent, c'est la couche transverse
- **C (Dual-Speed Workflow) = émerge naturellement** une fois A + B en place — pas un chantier séparé mais une conséquence des autres noyaux

**Pourquoi ce split fonctionne :**
- Aligne les intérêts naturels de chaque cofondateur (discussions hackathon = preuve)
- Tom = focus produit/UX/adoption (cohérent avec son profil product engineer)
- Cofondateur = focus technique/moteur/fiabilité
- D en commun = les deux ont besoin de l'observabilité pour leurs parties respectives
- Pas de dépendance bloquante entre A et B au démarrage — développement parallèle possible

