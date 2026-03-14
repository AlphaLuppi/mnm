# Section 2 — Emotional Response Design & Defining Experiences

> **Par Maya la Design Thinker** | Date : 2026-03-14 | Version : 1.0
> Sources : PRD B2B v1.0, Product Brief B2B v2.0, UX Journeys & Requirements v1.0, 57 verites fondamentales

---

## Table des matieres

1. [Emotional Response Design par Persona](#1-emotional-response-design-par-persona)
2. [Defining Experiences — Les 5 Moments Fondateurs](#2-defining-experiences--les-5-moments-fondateurs)
3. [Inspiration & References](#3-inspiration--references)

---

## 1. Emotional Response Design par Persona

### 1.1 CEO — Le Pilote Strategique

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que cet outil va me donner la visibilite que je n'ai jamais eue ? Est-ce que c'est encore un gadget tech de plus ? Je veux une reponse en 10 secondes, pas un tutoriel." |
| **Ressent** | Impatience chronique. Frustration de compiler manuellement des infos de 5 outils. Solitude decisionnelle — il prend des decisions sans donnees unifiees. Envie de reprendre le controle sans micro-manager. |
| **Voit** | Des dashboards Jira qu'il ne comprend pas. Des PowerPoints de reporting hebdomadaire deja obsoletes. Des equipes qui bricolent chacune dans leur coin avec des IA differentes. |
| **Fait** | Demande des syntheses par email. Organise des reunions de reporting chronophages. Change de priorite strategique mais met des semaines a voir l'impact terrain. Pose des questions et attend des jours pour la reponse. |
| **Douleurs** | Information fragmentee et non-unifiee (Verite #15). Aucun moyen de savoir en temps reel ou en est un projet sans intermediaires. Le cout de la coordination synchrone est colossal. Peur d'investir dans un outil que personne n'utilisera. |
| **Gains** | "J'ouvre un dashboard et je pose une question." Propagation structuree des decisions strategiques. Visibilite temps reel sans intermediaires. Deploiement rapide grace a l'onboarding conversationnel. |

#### Arc emotionnel

```
Scepticisme      Curiosite       Surprise       Confiance       Satisfaction
("Encore un      ("C'est         ("Il a         ("Ca se         ("Je vois TOUT
 outil ?")        different")     compris du     deploie         sans rien
                                  premier        vite")          demander")
     |               |            coup")            |               |
     v               v               v              v               v
[Invitation]  [Onboarding     [Structure     [Dashboard     [Usage
              conversationnel]  generee]       J+2]           quotidien]
```

**Semaine 1** : Le scepticisme initial se transforme en curiosite des le premier echange avec l'agent d'onboarding — "C'est different d'un formulaire." La surprise arrive quand l'organigramme est genere a partir d'une simple conversation orale.

**Semaine 2** : La confiance s'installe quand le dashboard executif affiche des donnees reelles apres 48h. Le CEO pose sa premiere question strategique et recoit une synthese contextualisee en moins de 10 secondes.

**Mois 1+** : La satisfaction profonde s'ancre — "Je vois TOUT sans rien demander." Le CEO utilise MnM comme point d'entree unique pour piloter l'organisation. Les reunions de reporting disparaissent progressivement.

#### Emotions cibles

- **Confiance immediate** : l'onboarding conversationnel montre que l'outil comprend sa realite, pas un questionnaire generique
- **Controle sans effort** : le CEO ne touche jamais un prompt, ne configure jamais un agent, ne voit jamais de code
- **Satisfaction strategique** : les decisions se propagent structurellement, pas via des chaines d'emails

#### Anti-patterns emotionnels a eviter

- **Complexite technique visible** : si le CEO voit un prompt, un JSON, ou un terminal, c'est un echec
- **Latence de reponse** : une question posee qui met plus de 15 secondes a produire une synthese tue la confiance
- **Dashboard vide** : un ecran sans donnees les premiers jours provoque le desengagement. Solution : etats "en attente de donnees" avec estimations claires et indicateurs de progression du deploiement

---

### 1.2 CTO / DSI — Le Garant Technique

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que c'est techniquement solide ou c'est du marketing ? Comment je m'assure que les agents ne font pas n'importe quoi ? Est-ce que je peux integrer ca avec notre stack SSO ?" |
| **Ressent** | Mefiance technique initiale. Besoin visceral de controle et de preuve. Frustration du hackathon CBA — "les agents sautaient des etapes, ne chargeaient pas les bons fichiers" (Verite #45). Pression de gouvernance. |
| **Voit** | Des agents IA deployes sans orchestration dans son entreprise. Des logs bruts illisibles. Des developpeurs qui utilisent Cursor/Claude Code individuellement sans coordination. |
| **Fait** | Definit des standards que personne ne respecte automatiquement. Revoit du code manuellement. Fait du firefighting quand un agent devie. Compile des metriques manuellement. |
| **Douleurs** | Aucune tracabilite centralisee (Verite #39). Pas de moyen d'imposer des standards automatiquement. Les contrats inter-roles sont aspirationnels, jamais appliques (Verite #2). Compaction non-geree — l'agent perd son contexte. |
| **Gains** | Workflows deterministes — "je definis le workflow une fois et si l'agent devie, je le sais en 5 minutes." Drift detection avec diff visuel. Audit centralise prouvable. Gestion de compaction au niveau plateforme. |

#### Arc emotionnel

```
Mefiance        Verification     Flow            Maitrise        Serenite
("C'est solide  ("Config SSO     ("L'editeur     ("Je controle   ("Tout est
 sous le        OK, logs         de workflow      la severite     sous controle,
 capot ?")      detailles")      est intuitif")   du drift")     je dors bien")
     |               |               |               |               |
     v               v               v               v               v
[Invite CEO]  [Config SSO +     [Editeur        [Drift          [Monitoring
               test integre]     workflow]        detection]      quotidien]
```

**Jour 1** : La mefiance technique est naturelle. Le perimetre pre-configure par le CEO reduit le "cold start." Le formulaire SSO avec guide pas-a-pas et test integre transforme la mefiance en verification positive — "c'est pro."

**Semaine 1** : L'editeur de workflow visuel provoque le flow — drag-and-drop des etapes, edition des prompts, selection des fichiers obligatoires. Le CTO retrouve le plaisir de l'ingenierie sans le bruit operationnel.

**Mois 1+** : La serenite s'installe via le monitoring quotidien. Le dashboard technique devient le premier ecran du matin. Les drifts sont detectes, traces, et resolus methodiquement.

#### Le curseur d'automatisation comme vecteur de confiance progressive

Le CTO est le persona cle pour le curseur d'automatisation. Il definit les plafonds par projet et par entreprise. Sa confiance dans MnM evolue en 3 phases :

1. **Phase prudente (Semaines 1-2)** : Tout en mode ASSISTE. Le CTO veut voir chaque decision avant approbation.
2. **Phase de delegation (Mois 1)** : Les taches repetitives (generation de tests, brief reception) passent en AUTO. Le CTO garde le mode ASSISTE pour les etapes critiques (review, merge).
3. **Phase de confiance (Mois 3+)** : Le CTO ajuste finement les seuils de drift detection. Il connait les faux positifs, calibre la sensibilite. MnM est devenu un instrument de precision qu'il maitrise.

---

### 1.3 Developpeur — L'Artisan du Code

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Est-ce que cet agent comprend vraiment mon contexte ? Est-ce que ca va remplacer mon job ? Est-ce que je garde le controle sur mon code ?" |
| **Ressent** | Ambivalence : excitation face a la puissance de l'IA, peur du remplacement. Fierete artisanale — il veut que le code soit propre, pas juste fonctionnel. Frustration des outils sans contexte. |
| **Voit** | Un agent qui comprend la story, les specs, les maquettes, et les fichiers concernes. Du code qui se construit en temps reel devant ses yeux. Un curseur d'automatisation qu'il controle personnellement. |
| **Fait** | Lance son agent sur une story. Guide en temps reel : "Utilise le pattern Repository." Observe le code se construire en split view. Interrompt quand necessaire — "Stop, ne modifie pas ce fichier." Valide le diff et merge. |
| **Douleurs** | IA utilisee individuellement sans orchestration. Contexte perdu entre les outils. Peur du remplacement (Verite #22 — evolution des roles). Reviews chronophages. Code reviews sans contexte suffisant. |
| **Gains** | "C'est un junior ultra-rapide que je supervise." Contexte complet injecte automatiquement. Dialogue temps reel pendant l'execution. Vision d'evolution du role — de producteur a superviseur de qualite. Livraison en 2h au lieu de 6h. |

#### Arc emotionnel

```
Apprehension    Anticipation    Fascination     Collaboration   Accomplissement
("Ca va pas     ("C'est         ("Je vois le    ("C'est un      ("Livre en 2h
 casser mon     parti !")        code se         junior que      au lieu de 6h,
 workflow ?")                    construire")    je guide")      et c'est propre")
     |               |               |               |               |
     v               v               v               v               v
[Board         [Lancement       [Observation    [Pilotage       [Review +
 personnel]     agent]           live]           temps reel]     Merge]
```

**Premier contact** : L'apprehension est reelle. Le board personnel dissipe l'anxiete — "Je sais quoi faire." Les stories sont la, avec tout le contexte. C'est familier, augmente.

**Premier lancement** : L'anticipation monte quand l'agent demarre avec le workflow deterministe. La barre de progression et le terminal ouvert donnent de la visibilite.

**Observation live** : C'est LE moment de fascination. La split view — code a gauche, chat agent a droite, diff en surbrillance — provoque l'emerveilllement. Le developpeur voit le code se construire et peut intervenir a tout moment.

**Pilotage** : La collaboration s'installe. "Utilise le pattern Repository" — l'agent ajuste. "Stop" — l'agent s'arrete immediatement. Le developpeur n'est pas un spectateur passif, c'est un chef d'orchestre.

**Accomplissement** : Le diff est propre, les tests sont generes, la MR est creee automatiquement. "Livre en 2h au lieu de 6h." La peur du remplacement se transforme en vision d'evolution : mon role change, il s'eleve.

#### Anti-patterns emotionnels critiques

- **Sentiment de remplacement** : Si le dev a l'impression que l'agent fait tout et qu'il est inutile, c'est un echec fondamental. Le curseur d'automatisation personnel EST la reponse — le dev choisit son degre d'implication.
- **Perte de controle** : Le bouton "Stop" doit etre TOUJOURS visible et TOUJOURS fonctionner. L'arret doit etre immediat, pas "dans quelques secondes." Proposition de rollback automatique.
- **Code de mauvaise qualite** : Si l'agent produit du code que le dev n'aurait pas ecrit, la confiance se brise. Les patterns doivent etre respectes, les conventions suivies.

---

### 1.4 PO — Le Traducteur de Besoins

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "80% de mon temps c'est de la mise en forme. Si l'agent ecrit les stories, qu'est-ce qu'il me reste ? Est-ce que les stories generees vont etre assez precises ?" |
| **Ressent** | Epuisement operationnel — noyade dans l'execution mecanique. Frustration que la Definition of Ready ne soit jamais respectee. Peur de l'obsolescence. Envie secrete de se concentrer sur le metier. |
| **Voit** | Un agent qui decompose une epic en 5-8 stories structurees en 5 minutes au lieu de 2h. Un board Kanban ou il valide, reordonne, affine — il juge au lieu de produire. Une checklist DoR automatique. |
| **Fait** | Recoit des epics du PM. Decompose avec l'agent via chat. Affine les stories par drag-and-drop. Verifie la DoR en 1 clic. Assigne les agents et supervise la progression. |
| **Douleurs** | Execution mecanique ecrasante. Savoir tribal non-documente (Verite #5). Definition of Ready jamais respectee. Information qui se degrade a chaque handoff (Verite #1). |
| **Gains** | "Je me concentre sur comprendre le metier." De PO-redacteur a PO-validateur. Savoir tribal progressivement capture et queryable par les agents. Communication inter-agents qui elimine le telephone arabe. |

#### Arc emotionnel

```
Surcharge       Gain de temps   Maitrise        Delegation      Vue d'ensemble
("Encore une    ("En 5 min      ("C'est MON     ("Je supervise, ("Je vois tout,
 epic a         au lieu de       backlog")        je ne fais      les blocages
 decomposer")   2h")                              plus")          sont clairs")
     |               |               |               |               |
     v               v               v               v               v
[Reception     [Brainstorm      [Affinage       [Assignation    [Suivi
 epic]          decomposition]   stories]        agents]         sprint]
```

**L'emotion pivot** : Le moment ou le PO realise que "savoir juger" est plus precieux que "savoir faire." Ce basculement psychologique est le coeur de l'adoption. MnM ne remplace pas le PO — il libere le PO pour qu'il fasse ce que personne d'autre ne peut faire : comprendre le metier et juger la pertinence.

---

### 1.5 PM — Le Stratege Produit

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "Mes PowerPoints sont re-interpretes a chaque handoff. 80% de mon temps c'est de l'execution, pas de la reflexion. Comment je garde le lien entre ma pensee strategique et l'execution terrain ?" |
| **Ressent** | Frustration du telephone arabe — la vision se deforme a chaque passage de relais. Envie de brainstormer librement et que l'output soit directement exploitable. Isolement strategique. |
| **Voit** | Un agent de brainstorm qui structure, challenge, organise. Un output structure qui devient directement une epic liee au brainstorm source. Une roadmap avec dependances auto-detectees. |
| **Fait** | Brainstorme avec l'agent. Valide la synthese structuree. Transforme en epic en 1 clic. Planifie sur la timeline avec dependances automatiques. |
| **Douleurs** | PPT re-interprete au handoff (Verite #1). Ratio 80% execution / 20% reflexion. Pas de lien direct entre recherche et execution. Decisions non-documentees (Verite #3). |
| **Gains** | "Zero perte d'info entre ma pensee et l'execution." Ratio inverse : 20% supervision / 80% reflexion. Le brainstorm EST le point d'entree du workflow (CrossPol #2). |

#### Arc emotionnel

```
Stimulation     Productivite    Satisfaction    Vision
creative        ("2h de         ("Zero perte    ("Je vois
("L'agent est   brainstorm =     d'info")        l'ensemble")
 un bon          un brief
 sparring        exploitable")
 partner")
     |               |               |               |
     v               v               v               v
[Brainstorm]   [Synthese        [Creation       [Roadmap
                structuree]      epic]           planning]
```

**Emotion cle** : La stimulation creative. L'agent de brainstorm n'est pas un outil passif — il challenge, il questionne, il reorganise. Le PM retrouve le plaisir de la reflexion strategique.

---

### 1.6 Lead Tech — Le Gardien de l'Architecture

#### Empathy Map

| Dimension | Contenu |
|-----------|---------|
| **Pense** | "60% de mon temps sur du scrum et des code reviews. La dette technique negocie toujours sa place dans les sprints. Si seulement je pouvais me concentrer sur l'architecture..." |
| **Ressent** | Frustration du travail mecanique repetitif. Culpabilite de ne pas pouvoir consacrer assez de temps a l'architecture. Fatigue des code reviews chronophages. Responsabilite lourde — gardien invisible. |
| **Voit** | Un dashboard matin avec dette technique trackee, reviews pre-analysees, alertes drift, couverture tests. Des MR annotees automatiquement : patterns respectes/violes, risques securite, suggestions. |
| **Fait** | Ouvre le dashboard technique chaque matin. Traite les reviews pre-analysees en 10 min au lieu de 45 min. Lance des workflows dedies pour la dette technique. Calibre les regles de review. |
| **Douleurs** | Code reviews chronophages. Scrum + versioning = "le pire." Dette technique invisible. Travail en background qui ne rentre jamais dans les sprints. |
| **Gains** | "MnM automatise le mecanique et me donne du temps pour ce qui compte." Reviews en 10 min au lieu de 45. Monitoring automatique dette/dependances. Workflows dedies pour la dette technique. |

#### Arc emotionnel

```
Focus           Efficacite      Methode         Liberation
("Priorites     ("Review en     ("La dette est  ("Du temps
 claires des     10 min au       geree comme     pour ce qui
 le matin")      lieu de 45")    un projet")     compte")
     |               |               |               |
     v               v               v               v
[Dashboard     [Code review     [Workflow       [Architecture
 matin]         assistee]        dette]          strategique]
```

**Emotion cle** : La liberation. Le Lead Tech est le persona qui souffre le plus du mecanisme repetitif. MnM ne lui donne pas plus de travail — il lui rend son temps. L'emotion finale n'est pas "je fais plus" mais "je fais mieux."

---

## 2. Defining Experiences — Les 5 Moments Fondateurs

Ces 5 moments sont les instants ou MnM cesse d'etre un outil et devient une experience transformante. Chaque moment est concu pour provoquer une emotion specifique qui ancre l'adoption a long terme.

---

### 2.1 Premier Onboarding CEO — "C'est different d'un formulaire"

#### Contexte et declencheur

Le CEO clique sur son lien d'invitation. Il s'attend a un formulaire classique : nom, prenom, taille d'entreprise, secteur, nombre d'employes — le parcours banal de tout SaaS B2B. Au lieu de cela, un agent conversationnel le salue : "Bonjour ! Decrivez votre entreprise..."

#### Deroulement detaille (micro-interactions)

1. **Premiere seconde** : L'ecran de connexion est epure. Pas de formulaire a 15 champs. Juste un champ de creation de compte simplifie (nom, email, mot de passe). Temps de creation : <30 secondes.

2. **Apparition de l'agent** (T+30s) : Transition fluide vers un chat. L'agent salue avec le prenom du CEO. Pas de jargon technique. Premiere question : "Decrivez votre entreprise en quelques mots — sa taille, ses equipes, ses produits."

3. **Conversation structuree** (T+1min a T+5min) : L'agent pose 5-7 questions maximum (jamais plus — au-dela, l'impatience du CEO detruit l'experience). Chaque question est contextualisee par la reponse precedente. L'agent reformule pour confirmer : "Donc vous avez 3 BU — France, USA, Transverse. C'est bien ca ?"

4. **Generation de l'organigramme** (T+5min) : Micro-moment de surprise. L'agent genere un organigramme visuel interactif a partir de la conversation. Transition animee du chat vers un mode visuel. L'organigramme apparait progressivement — pas un chargement brutal, une revelation.

5. **Validation tactile** (T+6min) : Le CEO peut deplacer des blocs en drag-and-drop, renommer des roles, ajouter des equipes. Chaque modification est instantanee. Aucun bouton "Sauvegarder" — tout est auto-sauve. Le CEO sent : "C'est MOI qui decide."

6. **Cascade d'invitations** (T+8min) : "Inviter les responsables" — les emails sont pre-remplis avec le contexte specifique a chaque perimetre. Le CEO voit son organisation se deployer dans MnM en temps reel.

#### Emotion visee et comment la provoquer

**Emotion principale : Confiance immediate**

La confiance nait du contraste avec l'attendu. Le CEO s'attend a un formulaire rigide — il decouvre une conversation intelligente. Le mecanisme est psychologique : quand une premiere interaction depasse les attentes, l'utilisateur projette cette qualite sur l'ensemble du produit.

**Micro-emotions a orchestrer :**
- T+0s : Curiosite neutre (epuration de l'ecran d'accueil)
- T+30s : Interet ("C'est different d'un formulaire")
- T+5min : Surprise ("Il a compris du premier coup")
- T+6min : Controle ("C'est MOI qui decide" via le drag-and-drop)
- T+8min : Confiance ("Ca se deploie vite")

**Comment provoquer :** Le rythme est essentiel. La conversation doit etre fluide, jamais hesitante. L'agent ne dit jamais "Je ne comprends pas" — il reformule. La generation de l'organigramme doit etre quasi-instantanee (<3 secondes) pour maintenir le flow.

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Agent qui pose trop de questions | Impatience, abandon | Limiter a 5-7 echanges. Progress bar subtile "Etape 2/4." |
| Mauvaise interpretation de la structure | Frustration, perte de confiance | Bouton "Corriger" toujours visible. Reformulation systematique avant de generer. |
| Lien d'invitation expire | Echec avant meme le debut | Message d'erreur clair + renvoi automatique. Validite de 7 jours. |
| Organigramme inexact | Doute sur la fiabilite de l'IA | Drag-and-drop permissif + suggestions correctives de l'agent. |
| Invitations en spam | Deploiement bloque | Verification du domaine d'envoi. Notification in-app si invitation non-ouverte apres 24h. |

#### Metriques de succes UX

- Taux de completion de l'onboarding : >85%
- Temps moyen de l'onboarding CEO : <10 minutes
- Nombre moyen d'echanges avec l'agent : 5-7
- Taux de modification de l'organigramme genere : <40% (indicateur de qualite de comprehension)
- Score CSAT post-onboarding : >4.2/5
- Taux d'invitation cascade lancee : >70% dans les 24h

---

### 2.2 Premier Agent Lance — "Je vois le code se construire"

#### Contexte et declencheur

Un developpeur ouvre MnM pour la premiere fois apres onboarding. Son board personnel affiche ses stories assignees. Il selectionne une story, voit le contexte complet (specs, maquettes, fichiers concernes), et appuie sur "Lancer l'agent." C'est le moment ou MnM passe de "outil de gestion" a "outil de creation."

#### Deroulement detaille (micro-interactions)

1. **Selection de la story** (T+0) : Le contexte complet s'affiche. Pas de navigation entre 5 onglets — tout est la : specs techniques, maquettes liees, fichiers concernes, criteres d'acceptance. Le developpeur sent : "Tout le contexte est la."

2. **Bouton "Lancer l'agent"** (T+1min) : Animation subtile de lancement. Spinner avec estimation "~15s." Le workflow deterministe demarre — la barre de progression affiche les etapes : Brief > Code > Review > Test > Merge.

3. **Premiere etape — Brief** (T+15s) : L'agent analyse la story, identifie les fichiers, propose un plan d'implementation. Le developpeur voit le plan AVANT que le code ne soit ecrit. Il peut modifier, approuver, ou demander des ajustements.

4. **Transition vers le Code — le moment magique** (T+2min) : La split view apparait. Code a gauche, chat agent a droite. Le code commence a s'ecrire en temps reel. Diff en surbrillance — les lignes ajoutees sont visibles instantanement. Le terminal en bas affiche les logs.

5. **Premier echange de pilotage** (T+3min) : Le developpeur tape : "Utilise le pattern Repository pour le data access." L'agent repond : "Compris. J'ajuste le plan pour utiliser le pattern Repo existant dans core/repo.ts." Le code s'adapte en temps reel. Le developpeur n'a pas touche a un fichier — mais il a dirige l'execution.

6. **Premier "Stop"** (T+5min, si necessaire) : Le dev tape "Stop." L'agent s'arrete immediatement. Pas dans 5 secondes — immediatement. Proposition de rollback. Le dev sent qu'il a le pouvoir absolu.

#### Emotion visee et comment la provoquer

**Emotion principale : Fascination + Controle**

La fascination vient du spectacle visuel — voir du code s'ecrire en temps reel, guide par une intelligence qui comprend le contexte. Le controle vient de la capacite d'intervenir a tout moment. La combinaison des deux est unique : fascinant ET maitrise.

**Comment provoquer :**
- La split view doit etre immersive — pas de distractions, pas de notifications parasites pendant l'execution
- Le diff en surbrillance doit etre elegamment colore (vert pour ajouts, pas de rouge agressif)
- La barre de progression du workflow doit etre visible en permanence pour ancrer le sentiment de progression deterministe
- Le chat agent doit repondre en <2 secondes pour maintenir le flow conversationnel
- Le bouton "Stop" doit etre rouge, toujours visible, et la reaction doit etre instantanee

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Agent lent a demarrer | Perte d'anticipation | Spinner avec estimation. Pre-chargement du contexte pendant la lecture de la story. |
| Code de mauvaise qualite | Perte de confiance definitive | Templates de patterns par projet. Le CTO definit les standards en amont. |
| Agent ignore une directive | Frustration, sentiment d'impuissance | Alerte explicite : "L'agent n'a pas integre votre directive. Reformuler ?" Escalade possible. |
| Trop de bruit dans les logs | Surcharge cognitive | Filtre "Actions principales uniquement" active par defaut. Mode verbose optionnel. |
| Rollback incomplet apres "Stop" | Anxiete sur l'integrite du code | Confirmation avant chaque rollback. Snapshot automatique avant lancement. |

#### Metriques de succes UX

- Taux de completion du premier lancement agent : >90%
- Temps moyen jusqu'au premier pilotage (chat) : <5 minutes
- Taux d'utilisation du bouton "Stop" au premier lancement : <15% (indique que l'agent est bien calibre)
- Score de fascination (enquete post-session) : >4/5
- Taux de relancement d'un agent dans les 24h : >80%

---

### 2.3 Premiere Alerte Drift — "Je sais quoi faire"

#### Contexte et declencheur

Le CTO recoit une notification : "Drift detecte sur US-142 a l'etape Code." Un agent a modifie des fichiers hors du scope prevu par la story. C'est le premier test de confiance enterprise — la plateforme detecte un probleme ET propose une resolution.

#### Deroulement detaille (micro-interactions)

1. **Notification** (T+0) : Toast rouge en haut a droite. Texte concis : "Drift detecte — US-142 — Etape Code." Son subtil (configurable). Badge rouge sur l'etape concernee dans le pipeline de workflow.

2. **Clic sur la notification** (T+2s) : Le panneau de drift s'ouvre. Comparaison immediate : "Attendu" vs "Observe." Pas de jargon — un diff visuel clair. Les fichiers non-prevus sont marques [!!]. Les fichiers prevus et modifies sont marques [OK].

3. **Evaluation de la severite** (T+10s) : Indicateur de severite : Info / Warning / Critical. Explication en langage naturel : "L'agent modifie des fichiers hors du scope prevu par la story." Le CTO comprend immediatement la situation sans lire des logs.

4. **Actions proposees** (T+15s) : Trois boutons clairs — Ignorer (avec justification obligatoire), Recharger le contexte, Kill+Relance. Pas de doute sur quoi faire. Chaque action a une description tooltip de son effet.

5. **Resolution** (T+30s) : Le CTO choisit "Recharger le contexte." L'agent reprend avec les fichiers corrects. Le drift est archive dans l'audit trail. Le CTO recoit une confirmation : "Contexte recharge. L'agent a repris l'etape Code."

6. **Feedback loop** (T+1min) : Si le CTO choisit "Ignorer," il doit justifier. Cette justification enrichit le modele de drift detection — le systeme apprend des faux positifs.

#### Emotion visee et comment la provoquer

**Emotion principale : Urgence maitrisee**

Le drift provoque naturellement de l'anxiete — un agent a devie. MnM transforme cette anxiete en maitrise en 3 etapes :
1. **Detection rapide** — "Le probleme est identifie, pas cache"
2. **Comprehension immediate** — "Je comprends ce qui s'est passe"
3. **Resolution claire** — "Je sais quoi faire, et ca prend 30 secondes"

**Comment provoquer :** Le panneau de drift doit etre structure comme un rapport d'incident militaire — situation, analyse, actions. Pas de longues explications. Le diff visuel remplace les mots. Les boutons d'action sont gros, clairs, et colores par niveau de risque.

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Trop de faux positifs | Fatigue d'alerte, on ignore les vrais drifts | Recommandation automatique du seuil. Calibration progressive. |
| Pas assez de contexte pour decider | Paralysie decisionnelle | Toujours montrer le diff complet + explication en langage naturel. |
| Resolution qui casse quelque chose | Perte de confiance dans la plateforme | Snapshot avant chaque action de resolution. Rollback toujours possible. |
| Notification manquee | Drift non-traite qui s'aggrave | Escalade automatique apres 15 minutes sans action. Email + notification in-app. |

#### Metriques de succes UX

- Temps entre notification et ouverture du panneau drift : <30 secondes
- Temps moyen de resolution : <2 minutes
- Taux de resolution au premier clic (sans escalade) : >80%
- Taux de faux positifs signales : <15%
- Score de confiance post-drift (enquete) : >3.8/5

---

### 2.4 Premiere Communication Agent-to-Agent — "Mes agents collaborent"

#### Contexte et declencheur

L'agent du developpeur a besoin du contexte exact d'une story pour implementer correctement un composant. Au lieu de demander au PO par Slack (delai : heures), l'agent du dev query directement l'agent du PO. Le PO recoit une demande de permission. C'est le moment ou l'entreprise decouvre la collaboration machine-to-machine supervisee par l'humain.

#### Deroulement detaille (micro-interactions)

1. **Besoin identifie** (T+0) : L'agent du dev detecte une ambiguite dans la story US-142. Il identifie que l'agent du PO possede le contexte detaille de l'epic source.

2. **Demande de permission** (T+1s) : Le PO recoit une notification : "L'agent d'Alice (dev) demande acces au contexte de l'epic EP-045." La demande est claire : quel agent demande, quel artefact, pourquoi. Le PO voit un apercu de ce qui sera partage.

3. **Validation du PO** (T+10s) : Le PO approuve en 1 clic. Ou refuse avec raison. Ou approuve avec restriction ("partage les criteres, pas les maquettes confidentielles"). Le controle humain est explicite et granulaire.

4. **Transfert de contexte** (T+11s) : L'agent du dev recoit le contexte instantanement. Le developpeur voit dans son chat : "Contexte recu de l'agent PO — criteres d'acceptance detailles pour EP-045." L'ambiguite est levee sans qu'aucun humain n'ait eu a reformuler quoi que ce soit.

5. **Trace dans l'audit** (T+12s) : L'echange est trace : qui a demande, qui a approuve, quoi a ete partage, quand. Compliance assuree. Le CTO peut voir tous les echanges inter-agents dans son dashboard.

6. **Apprentissage** (T+ongoing) : Si le meme type de query se repete 3 fois avec approbation, MnM propose d'automatiser : "Autoriser automatiquement les queries de criteres d'acceptance entre agents dev et PO ?" Le curseur d'automatisation inter-agents evolue avec la confiance.

#### Emotion visee et comment la provoquer

**Emotion principale : Puissance organisationnelle**

C'est le moment ou l'utilisateur realise que MnM n'est pas un outil individuel — c'est un systeme nerveux organisationnel. Les agents collaborent, les humains supervisent, l'information circule sans degradation (resolution directe de la Verite #1).

**Comment provoquer :**
- La notification au PO doit etre concise et non-intrusive — pas un popup modal qui interrompt
- L'apercu du contenu partage doit etre visible AVANT approbation pour inspirer confiance
- Le transfert doit etre quasi-instantane apres approbation — zero latence perceptible
- La trace dans l'audit doit etre visible sans effort pour rassurer sur la gouvernance

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Trop de demandes de permission | Fatigue de validation, le PO refuse tout | Regroupement intelligent des demandes. Suggestion d'automatisation apres patterns repetes. |
| Sentiment de flicage (Verite #20) | Rejet du systeme par les operationnels | Metriques TOUJOURS agregees, jamais individuelles. Pas de "nombre de refus par utilisateur." |
| Partage involontaire de donnees sensibles | Risque compliance | Apercu obligatoire avant partage. Classification des artefacts (public, restreint, confidentiel). |
| L'agent partage un contexte obsolete | Decision basee sur de mauvaises infos | Horodatage visible. Alerte si le contexte date de plus de 48h. |

#### Metriques de succes UX

- Temps moyen de resolution d'une query inter-agents : <2 minutes
- Taux d'approbation des demandes : >75%
- Reduction du temps de handoff inter-roles : -30% (cible a 3 mois)
- Nombre de queries inter-agents par semaine : 50+ (cible a 3 mois)
- Taux de suggestion d'automatisation acceptee : >40%

---

### 2.5 Premier Dashboard Management — "Je vois TOUT sans rien demander"

#### Contexte et declencheur

Le CEO ouvre MnM 48 heures apres le deploiement initial. L'organisation a commence a travailler — quelques agents ont ete lances, des stories avancent, un drift a ete detecte et resolu. Le dashboard executif s'affiche avec des donnees reelles pour la premiere fois.

#### Deroulement detaille (micro-interactions)

1. **Chargement du dashboard** (T+0) : Pas de skeleton screen generique. Les widgets apparaissent progressivement avec une animation subtile de materialisation. Les donnees sont la — pas un ecran vide.

2. **Vue d'ensemble par BU** (T+1s) : Chaque BU est representee par une carte avec indicateurs agreges : nombre d'agents actifs, pourcentage d'avancement, nombre d'alertes drift. Les couleurs sont intuitives : vert = tout va bien, orange = attention, rouge = action requise.

3. **KPIs globaux** (T+3s) : Un panneau synthetique : workflows actifs, taux de respect, drifts detectes, MTTR moyen. Chaque chiffre est cliquable — drill-down en 1 clic vers le detail.

4. **Chat executif** (T+5s) : Le CEO voit la zone de chat et pose naturellement sa premiere question : "Ou en est le projet Alpha ?" La reponse arrive en <10 secondes : avancement, blocages, risques, avec liens vers les details.

5. **Moment de revelation** (T+15s) : Le CEO realise qu'il n'a demande aucune information a personne. Aucune reunion de reporting. Aucun email de suivi. L'information est venue a lui, structuree, temps reel, fiable.

6. **Exploration** (T+1min) : Le CEO clique sur l'alerte drift de la BU USA. Il voit le detail sans jargon technique : "Un agent a modifie des fichiers non-prevus. Resolu par le CTO en 2 minutes." Confiance renforcee — les problemes sont detectes ET resolus.

#### Emotion visee et comment la provoquer

**Emotion principale : Satisfaction profonde**

C'est l'emotion la plus rare en B2B — la satisfaction de ne rien avoir eu a demander. Le dashboard n'est pas un outil que le CEO utilise — c'est une fenetre qui s'ouvre sur son organisation augmentee.

**Comment provoquer :**
- Les donnees doivent etre REELLES, jamais simulees. Meme si elles sont partielles a J+2, elles doivent refleter la realite.
- L'animation de materialisation des widgets cree un micro-moment de decouverte a chaque visite
- Les couleurs sont emotionnelles : vert apaise, orange alerte sans alarmer, rouge appelle a l'action
- Le chat executif doit repondre comme un assistant personnel — pas comme un moteur de recherche
- Les liens "Voir details" doivent mener a une information comprehensible par un non-technique

#### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Dashboard vide a J+2 | Deception massive, abandon | Etats "en attente de donnees" avec progress bar de deploiement. Gamification subtile : "3/5 equipes connectees." |
| Donnees incorrectes ou incompletes | Perte de confiance irreversible | Badge de fiabilite par widget : "Donnees completes" vs "Partielles (2 equipes sur 5)." |
| Surcharge d'informations | Confusion, le CEO ne sait pas ou regarder | Mode "Executive Summary" par defaut — 4 chiffres cles + 1 alerte prioritaire. Details sur demande. |
| Reponse chat trop vague | Frustration, retour a l'email | Ajustement automatique du niveau de synthese. Option "Plus de details" / "Plus concis." |
| Dashboard identique chaque jour | Desinteret progressif | Insights proactifs : "Nouveau cette semaine : le projet Beta a demarre." Tendances visibles. |

#### Metriques de succes UX

- Frequence d'ouverture du dashboard CEO : >1 fois/jour
- Temps moyen passe sur le dashboard : 2-5 minutes (suffisant, pas excessif)
- Nombre de questions posees via le chat executif : >3/semaine
- Score de satisfaction dashboard (CSAT) : >4.5/5
- Taux de disparition des reunions de reporting : >50% a 3 mois
- Drill-down utilise : >60% des sessions

---

## 3. Inspiration & References

### 3.1 References produit — Ce que MnM emprunte

#### Notion — La simplicite radicale

**Ce qu'on emprunte :** La capacite a rendre un outil puissant visuellement simple. Le minimalisme qui cache la complexite. Les espaces blancs genereux. La typographie claire.

**Application MnM :** L'onboarding conversationnel du CEO doit avoir la meme limpidite qu'une page Notion vide — pas d'options visibles, juste un espace de conversation. Le dashboard executif doit etre aussi lisible qu'un document Notion bien structure.

**Emotion cible partagee :** "C'est propre, c'est clair, je comprends immediatement."

#### Linear — La vitesse comme experience

**Ce qu'on emprunte :** La reactivite instantanee. Chaque action se fait en <100ms. Les raccourcis clavier partout. Le feeling "natif" qui fait oublier qu'on est dans un navigateur.

**Application MnM :** Le board PO doit etre aussi rapide que Linear. Le drag-and-drop des stories doit etre instantane. Le chat avec l'agent doit repondre en <2s. Le curseur d'automatisation doit reagir sans latence.

**Emotion cible partagee :** "C'est rapide, ca ne me freine jamais."

#### Figma — La collaboration temps reel

**Ce qu'on emprunte :** Le multiplayer visible — voir qui est ou, qui fait quoi, en temps reel. Les curseurs des collegues. La conscience partagee de l'activite.

**Application MnM :** Le dashboard CTO doit montrer les agents actifs comme Figma montre les collaborateurs. Les drifts apparaissent en temps reel. Les modifications de workflow par un collegue sont visibles instantanement. L'agent-to-agent est le "multiplayer" de MnM.

**Emotion cible partagee :** "On travaille ensemble, en temps reel, sans se parler."

#### Datadog — L'observabilite accessible

**Ce qu'on emprunte :** La capacite a rendre des metriques techniques comprehensibles visuellement. Les graphes temporels. Les alertes graduees. Les dashboards personnalisables.

**Application MnM :** Le dashboard d'observabilite CTO s'inspire directement de Datadog — mais pour des agents IA au lieu de serveurs. Les graphes de drift, les metriques de compaction, la sante des containers.

**Emotion cible partagee :** "Je surveille tout, je comprends tout, je controle tout."

### 3.2 Anti-references — Ce que MnM refuse d'etre

#### Jira — La complexite accidentelle

**Ce qu'on refuse :** L'accumulation de fonctionnalites qui rend l'outil incomprehensible. Les menus a 4 niveaux. Les configurations qui necessitent un consultant certifie. Le onboarding qui prend des semaines.

**Le piege a eviter :** MnM gere 9 personas avec des modes differents. Le risque est d'accumuler des fonctionnalites par persona jusqu'a reconstruire la complexite de Jira. La regle : chaque persona voit UNIQUEMENT ce qui le concerne. Les items non-autorises sont masques, pas grises.

**Anti-emotion :** "Je me perds, je ne sais pas ou cliquer, j'ai besoin d'un tutoriel."

#### Salesforce — La surcharge informationnelle

**Ce qu'on refuse :** Les ecrans avec 50 champs editables. Les tableaux de bord avec 20 widgets. L'information partout, la comprehension nulle part.

**Le piege a eviter :** Le dashboard CEO pourrait afficher toutes les metriques disponibles. La regle : mode "Executive Summary" par defaut — 4 chiffres cles + 1 alerte prioritaire. Le detail est a 1 clic, jamais sur l'ecran principal.

**Anti-emotion :** "Il y a trop d'infos, je ne sais pas quoi regarder."

#### Slack — La surcharge de notifications

**Ce qu'on refuse :** Le flux continu de messages non-priorises. La peur de manquer quelque chose (FOMO). Les notifications qui interrompent le flow.

**Le piege a eviter :** Les communications agent-to-agent et les alertes drift pourraient generer un flux continu de notifications. La regle : regroupement intelligent, priorisation par severite, mode "Ne pas deranger" natif. Les drifts Critical interrompent. Les Info attendent.

**Anti-emotion :** "J'ai 50 notifications, la moitie ne me concerne pas, je les ignore toutes."

### 3.3 Patterns UX empruntes et adaptes

| Pattern | Source | Adaptation MnM |
|---------|--------|----------------|
| **Conversational onboarding** | Typeform, Intercom | Agent d'onboarding CEO — conversation structuree qui genere de la configuration |
| **Progressive disclosure** | Apple, Notion | Modes Simple/Avance dans l'editeur de workflow. Dashboard avec drill-down. |
| **Split view** | VS Code, Cursor | Code a gauche, chat agent a droite. Adaptation : barre de workflow en bas. |
| **Real-time collaboration** | Figma, Google Docs | Agents visibles en temps reel. Modifications de workflow partagees. |
| **Graduated alerts** | PagerDuty, Datadog | Drift detection : Info/Warning/Critical avec actions adaptees. |
| **Automation slider** | Aucun equivalent direct | **Innovation MnM** : curseur d'automatisation a 3 positions, multi-dimensionnel, hierarchique. |
| **Kanban augmente** | Trello, Linear | Board PO avec agents assignes, progression temps reel, DoR automatique. |
| **Command palette** | Linear, VS Code, Raycast | Ctrl+K pour recherche universelle, changement de company, lancement rapide. |
| **Diff visualization** | GitHub, GitLab | Drift detection : "Attendu vs Observe" en diff visuel colore. |
| **Dashboard widgets** | Datadog, Grafana | Grille personnalisable, drag-and-drop, widgets par role. |

### 3.4 Principes directeurs de design emotionnel

1. **Principe de contraste positif** : Chaque premiere interaction doit depasser les attentes. L'onboarding depasse le formulaire. Le lancement agent depasse le bouton "Run." Le drift depasse le log d'erreur.

2. **Principe de controle permanent** : A tout moment, l'utilisateur peut arreter, modifier, annuler. Le bouton "Stop" est toujours visible. Le curseur d'automatisation est toujours accessible. Le rollback est toujours possible.

3. **Principe de transparence sans bruit** : Montrer tout, expliquer simplement, ne pas submerger. Le resume LLM remplace les logs bruts. Le diff visuel remplace les descriptions textuelles. Les metriques agregees remplacent les donnees individuelles.

4. **Principe de progression naturelle** : L'outil grandit avec l'utilisateur. Manuel → Assiste → Automatique. Jamais de pression pour accelerer. La confiance se construit, elle ne s'impose pas.

5. **Principe anti-flicage (Verite #20)** : JAMAIS de metriques individuelles visibles par le management. Les dashboards sont agreges par equipe, par projet, par BU. Le curseur d'automatisation est personnel. L'objectif est l'empowerment, pas la surveillance.

---

> **Note de Maya** : Ce document est concu pour guider les decisions de design a chaque etape du developpement de MnM. Chaque micro-interaction, chaque animation, chaque choix de couleur doit etre evalue contre les emotions cibles definies ici. MnM n'est pas un outil — c'est une experience de transformation organisationnelle. Et la transformation commence par ce que les gens ressentent.
