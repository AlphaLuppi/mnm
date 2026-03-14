# User Journeys, UX Requirements & Accessibility — MnM B2B

> **Par Sally la Designer** | Date : 2026-03-13 | Version : 1.0
> Source : Product Brief B2B v2.0, section 5 Experience Strategy

---

## Table des matieres

1. [User Journeys detailles par persona](#1-user-journeys-detailles-par-persona)
2. [UX Requirements fonctionnels](#2-ux-requirements-fonctionnels)
3. [Accessibility Requirements](#3-accessibility-requirements)

---

## 1. User Journeys detailles par persona

### 1.1 Journey CEO — "Du lancement a la vision globale"

**Persona :** Le Pilote Strategique. Ne touche jamais un prompt, ne voit jamais de code. Parle, valide, supervise.
**Mode principal :** ORAL + VISUEL
**Objectif :** Obtenir une vue temps reel de toute l'organisation en moins de 48h.

| # | Etape | Action utilisateur | Reponse systeme | Emotion | Friction potentielle |
|---|-------|-------------------|-----------------|---------|---------------------|
| 1 | Connexion initiale | Clique sur le lien d'invitation recu par email | Page d'accueil avec creation de compte simplifie (nom, email, mot de passe) | Curiosite neutre | Lien expire ? Message d'erreur clair avec renvoi |
| 2 | Agent d'onboarding | Voit un chat avec l'agent : "Bonjour ! Decrivez votre entreprise..." | Agent conversationnel pose des questions structurees sur la structure (BU, equipes, produits) | Interet — "C'est different d'un formulaire" | Si l'agent pose trop de questions -> impatience. Limiter a 5-7 echanges max |
| 3 | Definition de la structure | Dicte : "On a 3 BU — France, USA, Transverse. Chaque BU a un CTO et des equipes produit." | MnM genere un organigramme visuel interactif. Propose des roles standards. Demande validation. | Satisfaction — "Il a compris du premier coup" | Mauvaise interpretation de la structure -> bouton "Corriger" visible |
| 4 | Validation structure | Revise l'organigramme, deplace des blocs, renomme des roles | Drag-and-drop sur l'organigramme. Chaque modification est instantanee. | Controle — "C'est MOI qui decide" | Si le drag-and-drop est maladroit sur mobile -> frustration |
| 5 | Invitation en cascade | Valide la structure -> "Inviter les responsables" | Emails d'invitation generes avec contexte pre-rempli. Chaque invite recoit son perimetre. | Confiance — "Ca se deploie vite" | Invitations qui tombent en spam -> verifier le domaine d'envoi |
| 6 | Import existant | "On utilise Jira depuis 3 ans" | Agent propose de scanner Jira. Progress bar avec etapes claires. Mapping propose. | Surprise — "Il importe Jira ?" | Import qui echoue ou dure trop -> progress bar avec estimation temps |
| 7 | Premier dashboard (J+2) | Ouvre MnM apres 48h | Dashboard executif : avancement par BU, agents actifs, alertes drift, KPIs agreges | Satisfaction profonde — "Je vois TOUT sans rien demander" | Dashboard vide si personne n'a encore travaille -> afficher "En attente de donnees" |
| 8 | Question strategique | "Ou en est le projet Alpha ?" dans le chat | Agent synthetise : avancement, blocages, risques, avec liens vers les details | Confiance — "Plus besoin de reunion de reporting" | Reponse trop vague ou trop detaillee -> ajuster le niveau de synthese |

#### Wireframe textuel — Dashboard CEO

```
+============================================================================+
|  MnM  [logo]              Recherche...              [?] [Notif 3] [Avatar] |
+============================================================================+
|                                                                            |
|  Bonjour Marc — Vue Executive                              13 mars 2026   |
|                                                                            |
|  +---------------------------+  +---------------------------+              |
|  | BU France        [=====] |  | BU USA           [====  ] |              |
|  | 12 agents actifs    78%  |  | 8 agents actifs     64%  |              |
|  | 0 alertes drift          |  | 2 alertes drift  [!]     |              |
|  | 3 projets en cours       |  | 2 projets en cours       |              |
|  +---------------------------+  +---------------------------+              |
|                                                                            |
|  +---------------------------+  +---------------------------+              |
|  | BU Transverse     [===  ] |  | KPIs Globaux             |              |
|  | 5 agents actifs     52%  |  | Workflows actifs : 23    |              |
|  | 1 alerte drift   [!]     |  | Taux respect : 94%       |              |
|  | 1 projet en cours        |  | Drift detectes : 3       |              |
|  +---------------------------+  | MTTR moyen : 12 min      |              |
|                                  +---------------------------+              |
|                                                                            |
|  +----------------------------------------------------------------------+  |
|  | Chat Executif                                              [Agrandir] |  |
|  | > Ou en est le projet Alpha ?                                        |  |
|  | Agent: Le projet Alpha (BU France) est a 78%. 2 stories restantes.   |  |
|  |        Blocage : attente review archi par Lead Tech.                  |  |
|  |        Estimation livraison : 17 mars.  [Voir details]               |  |
|  | > _______________________________________________________________    |  |
|  +----------------------------------------------------------------------+  |
+============================================================================+
```

---

### 1.2 Journey CTO — "Configuration technique et monitoring"

**Persona :** Le Garant Technique. Edite les workflows, configure les standards, monitore les drifts.
**Mode principal :** VISUEL + CODE
**Objectif :** Definir les workflows deterministes et surveiller leur respect.

| # | Etape | Action utilisateur | Reponse systeme | Emotion | Friction potentielle |
|---|-------|-------------------|-----------------|---------|---------------------|
| 1 | Acceptation invite | Clique le lien d'invitation du CEO | Voit son perimetre technique pre-configure, structure deja en place | Soulagement — "Je n'ai pas tout a faire from scratch" | Perimetre incorrect -> bouton "Demander modification" |
| 2 | Config SSO | Va dans Parametres > Securite > SSO | Formulaire SAML/OIDC avec guide pas-a-pas, test de connexion integre | Confiance technique — "C'est pro" | Erreur de config SSO -> logs detailles + lien doc |
| 3 | Definition workflow | Cree un workflow "Dev Story" | Editeur visuel : drag-and-drop des etapes, edition des prompts, selection fichiers obligatoires par etape | Flow — "C'est intuitif" | Trop d'options dans l'editeur -> mode "Simple" vs "Avance" |
| 4 | Test workflow | Lance un agent de test sur le workflow | Execution simulee avec logs en temps reel. Chaque etape surlignee. | Verification — "Ca marche comme prevu" | Echec silencieux -> toujours afficher le statut de chaque etape |
| 5 | Config drift detection | Definit les seuils de tolerance | Curseur de sensibilite (laxiste -> strict) avec exemples concrets de ce que chaque niveau detecte | Maitrise — "Je controle la severite" | Trop de faux positifs -> recommandation automatique du seuil |
| 6 | Monitoring quotidien | Ouvre le dashboard technique | Graphe de drift en temps reel, agents actifs, health des containers, metriques de compaction | Serenite — "Tout est sous controle" | Surcharge d'info -> filtres rapides + vue "Problemes uniquement" |
| 7 | Intervention drift | Recoit alerte : "Agent X devie a l'etape 3" | Detail du drift : attendu vs observe, diff visuel, options (recharger contexte, kill+relance, ignorer) | Urgence maitrisee — "Je sais quoi faire" | Pas assez de contexte pour decider -> toujours montrer le diff |

#### Wireframe textuel — Editeur de Workflow CTO

```
+============================================================================+
|  MnM  [logo]     Workflows > Dev Story            [Sauver] [Tester] [...]  |
+============================================================================+
|                                                                            |
|  +--- Pipeline Workflow (drag-and-drop) ----------------------------------+|
|  |                                                                        ||
|  |  [1. Brief]-->[2. Code]-->[3. Review]-->[4. Test]-->[5. Merge]        ||
|  |     |            |            |             |            |             ||
|  |   active       idle         idle          idle         idle            ||
|  |                                                                        ||
|  +------------------------------------------------------------------------+|
|                                                                            |
|  +--- Etape selectionnee : 1. Brief  ------------------------------------+|
|  |                                                                        ||
|  |  Nom : Brief reception              Validation : [ ] Humaine requise  ||
|  |                                      Curseur max: [Assiste v]          ||
|  |  Prompt systeme :                                                      ||
|  |  +----------------------------------------------------------------+   ||
|  |  | Tu es un agent de brief. Tu recois une story et tu dois :      |   ||
|  |  | 1. Verifier les criteres d'acceptance                          |   ||
|  |  | 2. Identifier les fichiers concernes                           |   ||
|  |  | 3. Proposer un plan d'implementation                           |   ||
|  |  +----------------------------------------------------------------+   ||
|  |                                                                        ||
|  |  Fichiers obligatoires :                                               ||
|  |  [x] CLAUDE.md   [x] schema.ts   [ ] + Ajouter fichier               ||
|  |                                                                        ||
|  |  Conditions de passage a l'etape suivante :                            ||
|  |  [x] Plan d'implementation valide                                      ||
|  |  [x] Fichiers concernes identifies (min 1)                            ||
|  |  [ ] + Ajouter condition                                               ||
|  |                                                                        ||
|  +------------------------------------------------------------------------+|
+============================================================================+
```

---

### 1.3 Journey Developpeur — "Mon quotidien augmente"

**Persona :** L'Artisan du Code. Veut un workflow fluide, un agent qui comprend le contexte, un IDE augmente.
**Mode principal :** CODE + BOARD
**Objectif :** Livrer du code de qualite plus vite avec un agent personnel pilotable.

| # | Etape | Action utilisateur | Reponse systeme | Emotion | Friction potentielle |
|---|-------|-------------------|-----------------|---------|---------------------|
| 1 | Ouverture MnM | Ouvre l'application | Board personnel : 2 stories assignees, 1 review en attente, 1 bug urgent | Focus — "Je sais quoi faire" | Board vide -> "Aucune tache. Voir les projets ?" |
| 2 | Selection story | Clique sur "US-142 : Ajouter filtre recherche" | Detail de la story : contexte complet, maquettes liees, specs techniques, fichiers concernes | Clarte — "Tout le contexte est la" | Contexte incomplet -> lien "Demander precision au PO" |
| 3 | Lancement agent | Bouton "Lancer l'agent" | Agent demarre avec workflow deterministe. Barre de progression des etapes. Terminal ouvert. | Anticipation — "C'est parti" | Agent met du temps a demarrer -> spinner + estimation "~15s" |
| 4 | Pilotage temps reel | Tape dans le chat : "Utilise le pattern Repository pour le data access" | Agent ajuste son approche. Affiche le plan mis a jour. Continue l'execution. | Collaboration — "C'est un junior que je guide" | Agent ignore l'instruction -> alerte "L'agent n'a pas integre votre directive. Reformuler ?" |
| 5 | Observation live | Regarde les fichiers se modifier en temps reel | Split view : code a gauche, chat agent a droite. Diff en surbrillance. | Fascination — "Je vois le code se construire" | Trop de bruit dans les logs -> filtre "Actions principales uniquement" |
| 6 | Interruption | "Stop — ne modifie pas ce fichier" | Agent s'arrete immediatement. Propose de rollback les derniers changements. | Controle — "J'ai le pouvoir d'arreter" | Rollback incomplet -> confirmation avant chaque rollback |
| 7 | Review code | Agent termine. Bouton "Voir le diff" | Diff complet avec annotations de l'agent. Tests generes automatiquement. Metrics de couverture. | Satisfaction — "C'est propre" | Diff trop gros -> navigation par fichier avec resume |
| 8 | Merge | Approuve et merge | MR creee automatiquement. Audit log complete. Story passe en "Done". | Accomplissement — "Livre en 2h au lieu de 6h" | Conflit de merge -> agent propose resolution |

#### Wireframe textuel — Vue Developpeur (Code + Chat)

```
+============================================================================+
|  MnM  [logo]     US-142 : Filtre recherche      [Manuel|Assiste|Auto]  [...] |
+============================================================================+
| Board | Code | Chat                                                        |
+============================================================================+
|                                    |                                        |
|  +--- Editeur de code -----------+ | +--- Chat Agent -------------------+  |
|  |                               | | |                                  |  |
|  |  src/services/search.ts       | | | Agent: J'ai analyse la story.    |  |
|  |  ---                          | | | Plan d'implementation :          |  |
|  |  1  import { Repository }     | | | 1. Creer SearchFilter model      |  |
|  |  2  from '../core/repo';      | | | 2. Ajouter route GET /search     |  |
|  |  3                            | | | 3. Composant FilterPanel.tsx      |  |
|  |  4+ export class SearchSvc {  | | | 4. Tests unitaires               |  |
|  |  5+   private repo: Repo;     | | |                                  |  |
|  |  6+                           | | | [Etape 1/4] =====>------  25%   |  |
|  |  7+   async filter(query) {   | | |                                  |  |
|  |  8+     return this.repo      | | | Vous: Utilise le pattern          |  |
|  |  9+       .where(query)       | | |   Repository pour le data access |  |
|  | 10+       .exec();            | | |                                  |  |
|  | 11+   }                       | | | Agent: Compris. J'ajuste le plan |  |
|  | 12+ }                         | | | pour utiliser le pattern Repo    |  |
|  |                               | | | existant dans core/repo.ts.      |  |
|  | [Fichiers modifies: 3]        | | |                                  |  |
|  | search.ts | FilterPanel.tsx    | | | > _______________________________ |  |
|  | search.test.ts                | | | [Envoyer]   [Stop] [Rollback]   |  |
|  +-------------------------------+ | +----------------------------------+  |
+============================================================================+
|  Workflow: [1.Brief OK] [2.Code >>>] [3.Review --] [4.Test --] [5.Merge --] |
+============================================================================+
```

---

### 1.4 Journey PO — "Du besoin a la story validee"

**Persona :** Le Traducteur de Besoins. 80% d'execution mecanique aujourd'hui, veut passer a 80% de reflexion.
**Mode principal :** BOARD + ORAL
**Objectif :** Decomposer des epics en stories validees avec un agent qui fait le gros du travail.

| # | Etape | Action utilisateur | Reponse systeme | Emotion | Friction potentielle |
|---|-------|-------------------|-----------------|---------|---------------------|
| 1 | Reception epic | Notification : "Nouvelle epic assignee par PM" | Vue de l'epic avec contexte complet : analyse marche, maquettes, contraintes techniques, objectifs business | Clarte — "Je sais d'ou ca vient" | Contexte manquant -> bandeau "Contexte incomplet : manque [maquettes]" |
| 2 | Brainstorm decomposition | Ouvre le chat : "Decompose cette epic en stories" | Agent propose 5-8 stories structurees avec criteres d'acceptance, estimations, et liens vers les maquettes | Gain de temps — "En 5 min au lieu de 2h" | Stories trop vagues -> "Affiner la story #3 : qu'est-ce que tu entends par..." |
| 3 | Affinage stories | Modifie, reordonne, ajoute des criteres | Board Kanban avec drag-and-drop. Chaque story editable inline. Validation en 1 clic. | Maitrise — "C'est MON backlog" | Edition inline trop limitee -> modal d'edition detaillee |
| 4 | Validation Definition of Ready | Bouton "Verifier DoR" | Checklist automatique : chaque critere verifie avec indicateur vert/rouge. Manques identifies. | Rigueur — "Rien ne passe si c'est pas pret" | Faux positif DoR -> possibilite de forcer avec justification |
| 5 | Assignation agents | Assigne stories aux devs | Agents demarrent avec tout le contexte. PO voit la progression en temps reel. | Delegation — "Je supervise, je ne fais plus" | Pas de dev disponible -> suggestion de priorisation |
| 6 | Suivi sprint | Dashboard temps reel | Stories en cours, bloquees, terminees. Alertes drift. Burndown chart agent-augmente. | Vue d'ensemble — "Je vois tout" | Trop de bruit -> filtre "Bloquees uniquement" |

#### Wireframe textuel — Board PO

```
+============================================================================+
|  MnM  [logo]     Sprint 14 — Projet Alpha        [Filtrer] [+ Story] [...] |
+============================================================================+
| Board | Timeline | Metriques                                               |
+============================================================================+
|                                                                            |
|  TODO (3)          | EN COURS (2)       | REVIEW (1)     | DONE (4)       |
|  +--------------+  | +--------------+   | +--------------+| +-----------+ |
|  | US-145       |  | | US-142  [>>>]|   | | US-139       || | US-135 OK | |
|  | Filtre date  |  | | Filtre rech. |   | | Pagination   || | US-136 OK | |
|  | DoR: [VERT]  |  | | Dev: Alice   |   | | Dev: Bob     || | US-137 OK | |
|  | Est: 3pts    |  | | Agent: 64%   |   | | Agent: DONE  || | US-138 OK | |
|  +--------------+  | | Etape: Code  |   | | Attente rev. || +-----------+ |
|  +--------------+  | +--------------+   | +--------------+|               |
|  | US-146       |  | +--------------+   |                 |               |
|  | Export CSV   |  | | US-143 [!]   |   |                 |               |
|  | DoR: [ROUGE] |  | | Auth SSO     |   |                 |               |
|  | Manque: specs|  | | Dev: Carlos  |   |                 |               |
|  +--------------+  | | BLOQUE       |   |                 |               |
|  +--------------+  | | Drift detect.|   |                 |               |
|  | US-147       |  | +--------------+   |                 |               |
|  | Notif push   |  |                    |                 |               |
|  | DoR: [VERT]  |  |                    |                 |               |
|  +--------------+  |                    |                 |               |
|                                                                            |
|  +--- Chat PO -----------------------------------------------[Agrandir]-+ |
|  | > Decompose l'epic "Recherche avancee" en stories                     | |
|  | Agent: Voici 5 stories proposees :                                    | |
|  |   1. US-145 Filtre par date (3pts) — Criteres: [...]                  | |
|  |   2. US-146 Export CSV (2pts) — Criteres: [...]                       | |
|  | [Accepter toutes] [Modifier] [Ajouter story]                          | |
|  +-----------------------------------------------------------------------+ |
+============================================================================+
```

---

### 1.5 Journey PM — "Du brainstorm a la roadmap structuree"

**Persona :** Le Stratege Produit. Veut brainstormer et que l'output devienne directement exploitable.
**Mode principal :** ORAL + BOARD
**Objectif :** Transformer la reflexion strategique en artefacts executables sans perte d'information.

| # | Etape | Action utilisateur | Reponse systeme | Emotion | Friction potentielle |
|---|-------|-------------------|-----------------|---------|---------------------|
| 1 | Initiation brainstorm | "Brainstormons sur la feature Marketplace" | Agent de brainstorm structure : pose des questions, challenge les hypotheses, organise les idees | Stimulation creative — "L'agent est un bon sparring partner" | Agent trop passif ou trop directif -> curseur de style configurable |
| 2 | Synthese structuree | Fin du brainstorm | Output structure : problem statement, personas impactes, user stories candidates, risques identifies, priorite suggeree | Productivite — "2h de brainstorm = un brief exploitable" | Output trop long -> resume executif en haut avec "Voir details" |
| 3 | Creation epic | "Transforme ca en epic" | Epic creee avec contexte complet, liee au brainstorm source, criteres de succes, KPIs proposes | Satisfaction — "Zero perte d'info entre ma pensee et l'execution" | Mapping incomplet -> "Ces elements du brainstorm n'ont pas ete inclus : [...]" |
| 4 | Roadmap planning | Drag-and-drop des epics sur la timeline | Vue Gantt-like. Dependances detectees automatiquement. Conflits de ressources signales. | Vision — "Je vois l'ensemble" | Timeline trop optimiste -> warnings avec estimations historiques |

---

### 1.6 Journey Lead Tech — "Gardien de l'architecture"

**Persona :** Le Gardien de l'Architecture. Monitore la dette technique, revoit le code, defend les standards.
**Mode principal :** VISUEL + CODE + BOARD
**Objectif :** Reduire le temps passe sur le mecanique (reviews, scrum) pour se concentrer sur l'architecture.

| # | Etape | Action utilisateur | Reponse systeme | Emotion | Friction potentielle |
|---|-------|-------------------|-----------------|---------|---------------------|
| 1 | Dashboard matin | Ouvre MnM | Dashboard technique : dette technique trackee, reviews en attente (pre-analysees par agent), alertes drift, metriques couverture tests | Focus — "Priorites claires" | Trop d'alertes -> tri par severite + "Top 3 priorites" |
| 2 | Code review assistee | Ouvre une MR pre-analysee | Agent a deja annote : patterns respectes/violes, risques de securite, suggestions d'amelioration, couverture tests | Efficacite — "Review en 10 min au lieu de 45 min" | Agent trop permissif -> configurer les regles de review |
| 3 | Workflow dette technique | Cree un workflow "Refactoring" | Workflow dedie : analyse impact -> planification -> execution -> validation -> merge avec metriques avant/apres | Methodique — "La dette est geree comme un projet" | Refactoring casse des tests -> rollback automatique propose |

---

## 2. UX Requirements fonctionnels

### 2.1 FR-MU : Multi-User Management

#### FR-MU-01 : Flux d'invitation

**Flux principal :**
1. Admin clique "Inviter un membre" dans la page Membres
2. Modale : saisie email + selection role + selection projet(s) optionnel(s)
3. Validation -> email envoye avec lien d'invitation signe (expire 7 jours)
4. Invite clique le lien -> page de creation de compte pre-remplie (email non-modifiable)
5. Creation compte -> redirection vers le perimetre configure

**Contraintes UX :**
- Invitation en bulk (CSV ou liste d'emails separees par virgule)
- Indicateur de statut : Invite, Accepte, Expire
- Re-envoi possible tant que non-accepte
- Annulation possible tant que non-accepte

**Wireframe — Modale d'invitation :**
```
+------------------------------------------+
|  Inviter un membre               [X]     |
|------------------------------------------|
|                                          |
|  Email(s) :                              |
|  +------------------------------------+  |
|  | alice@company.com, bob@company.com |  |
|  +------------------------------------+  |
|  ou [Importer CSV]                       |
|                                          |
|  Role :  [Contributor  v]                |
|                                          |
|  Projets (optionnel) :                   |
|  [x] Projet Alpha                        |
|  [ ] Projet Beta                         |
|  [ ] Tous les projets                    |
|                                          |
|  Message personnalise (optionnel) :      |
|  +------------------------------------+  |
|  | Bienvenue dans l'equipe MnM !      |  |
|  +------------------------------------+  |
|                                          |
|       [Annuler]    [Envoyer invitation]  |
+------------------------------------------+
```

#### FR-MU-02 : Page Membres

**Layout :**
- Tableau avec colonnes : Avatar, Nom, Email, Role, Projets, Statut, Date d'ajout, Actions
- Filtres rapides : par role, par statut, par projet
- Barre de recherche par nom/email
- Actions par ligne : Modifier role, Gerer projets, Desactiver, Supprimer
- Actions en lot : selectionner plusieurs -> changer role / assigner projet

**Wireframe — Page Membres :**
```
+============================================================================+
|  MnM  [logo]     Parametres > Membres               [+ Inviter]           |
+============================================================================+
|                                                                            |
|  Rechercher... [_____________]   Role: [Tous v]  Statut: [Tous v]         |
|                                                                            |
|  +------------------------------------------------------------------------+|
|  | [ ] | Avatar | Nom           | Role         | Projets | Statut | ...   ||
|  |-----|--------|---------------|--------------|---------|--------|-------||
|  | [ ] |  (MC)  | Marc Dupont   | Admin        | Tous    | Actif  | [...] ||
|  | [ ] |  (SL)  | Sophie Lemaire| Manager      | Alpha   | Actif  | [...] ||
|  | [ ] |  (AT)  | Alice Torres  | Contributor  | Alpha,B | Actif  | [...] ||
|  | [ ] |  (JR)  | Jean Roux     | Contributor  | Beta    | Invite | [...] ||
|  | [ ] |  (BN)  | Bob Nguyen    | Viewer       | Alpha   | Actif  | [...] ||
|  +------------------------------------------------------------------------+|
|                                                                            |
|  5 membres — 4 actifs, 1 invite          [< 1 / 1 >]                      |
+============================================================================+
```

#### FR-MU-03 : Selecteur de Company

**Position :** En haut a gauche, juste apres le logo MnM.
**Comportement :**
- Dropdown avec la liste des companies de l'utilisateur
- Indicateur visuel de la company active (couleur, badge)
- Raccourci clavier : Ctrl+K puis "company:" pour changer
- Au changement de company, tout le contexte se rafraichit (projets, membres, agents, workflows)

```
+----------------------------------+
|  MnM  [Alpha Corp  v]           |
|       +---------------------+    |
|       | Alpha Corp     [OK] |    |
|       | Beta SAS             |    |
|       | Gamma Tech           |    |
|       +---------------------+    |
+----------------------------------+
```

---

### 2.2 FR-RBAC : Role-Based Access Control

#### FR-RBAC-01 : Selecteur de role

**Contexte :** Disponible lors de l'invitation et dans la gestion des membres.
**Roles definis :**
- **Admin** — Acces total. Gestion company, membres, workflows, audit.
- **Manager** — Gestion projets assignes, membres de son equipe, workflows de son perimetre.
- **Contributor** — Execution dans ses projets : lancer agents, creer/modifier stories, chat.
- **Viewer** — Lecture seule. Dashboards, rapports, audit trail.

**UX du selecteur :**
- Dropdown avec description de chaque role au survol/focus
- Badge de couleur par role (Admin=rouge, Manager=bleu, Contributor=vert, Viewer=gris)
- Avertissement si on donne le role Admin ("Cet utilisateur aura un acces total")

#### FR-RBAC-02 : Page Permissions

**Acces :** Parametres > Roles & Permissions (Admin uniquement)
**Layout :**
- Matrice : roles en colonnes, permissions en lignes
- Cases a cocher avec 3 etats : Autorise, Refuse, Herite (du preset)
- Bouton "Restaurer presets" par role
- Preview : "Avec ces permissions, ce role peut : [liste des actions]"

**Wireframe — Matrice Permissions :**
```
+============================================================================+
|  Parametres > Roles & Permissions                    [Restaurer presets]   |
+============================================================================+
|                                                                            |
|  Permission              | Admin | Manager | Contributor | Viewer         |
|  ----------------------- | ----- | ------- | ----------- | ------         |
|  company.manage          |  [x]  |  [ ]    |    [ ]      |  [ ]           |
|  members.invite          |  [x]  |  [x]    |    [ ]      |  [ ]           |
|  members.manage          |  [x]  |  [x]    |    [ ]      |  [ ]           |
|  projects.create         |  [x]  |  [x]    |    [ ]      |  [ ]           |
|  projects.manage         |  [x]  |  [x]    |    [ ]      |  [ ]           |
|  workflows.create        |  [x]  |  [x]    |    [ ]      |  [ ]           |
|  workflows.manage        |  [x]  |  [x]    |    [ ]      |  [ ]           |
|  agents.launch           |  [x]  |  [x]    |    [x]      |  [ ]           |
|  agents.configure        |  [x]  |  [x]    |    [ ]      |  [ ]           |
|  stories.create          |  [x]  |  [x]    |    [x]      |  [ ]           |
|  stories.edit            |  [x]  |  [x]    |    [x]      |  [ ]           |
|  audit.view              |  [x]  |  [x]    |    [ ]      |  [x]           |
|  audit.export            |  [x]  |  [x]    |    [ ]      |  [ ]           |
|  dashboard.executive     |  [x]  |  [x]    |    [ ]      |  [x]           |
|  chat.agent              |  [x]  |  [x]    |    [x]      |  [ ]           |
|                                                                            |
|  Preview role "Manager" :                                                  |
|  Peut : inviter des membres, gerer les projets et workflows,              |
|         lancer des agents, creer des stories, voir l'audit.               |
|  Ne peut pas : gerer la company, configurer les agents, exporter l'audit. |
+============================================================================+
```

#### FR-RBAC-03 : Indicateurs visuels de role

**Partout dans l'interface :**
- Badge de couleur a cote du nom de l'utilisateur
- Icone de role dans les listes de membres
- Tooltip au survol : "Manager — Peut gerer les projets de son perimetre"
- Navigation adaptee : les items non-autorises sont masques (pas grise = pas de frustration)
- Si un lien partage mene a une page non-autorisee : message clair "Vous n'avez pas acces. Contactez votre administrateur."

---

### 2.3 FR-ORCH : Orchestration de Workflows

#### FR-ORCH-01 : Visualisation de workflow

**Representation :** Pipeline horizontal avec etapes connectees par des fleches.
**Chaque etape affiche :**
- Nom de l'etape
- Statut (couleur) : gris=a venir, bleu=en cours, vert=termine, rouge=erreur, orange=drift
- Temps passe dans l'etape
- Nombre de fichiers en contexte
- Curseur d'automatisation de l'etape

**Interaction :**
- Clic sur une etape -> panneau de detail (prompt, fichiers, conditions, logs)
- Drag-and-drop pour reordonner (mode edition)
- Zoom/dezoom sur les workflows longs (>10 etapes)

#### FR-ORCH-02 : Indicateur d'etape courante

**Position :** Barre de statut en bas de l'ecran + dans le pipeline visuel.
**Affichage :**
- Etape courante surlignee avec animation subtile (pulsation lente)
- Progress bar sous l'etape : pourcentage de completion
- Timer : temps ecoule dans l'etape courante
- Indicateur de sante agent : vert=normal, orange=compaction recente, rouge=probleme

**Wireframe — Barre de workflow :**
```
+============================================================================+
| [1.Brief OK] [2.Code >>>>>>>] [3.Review --] [4.Test --] [5.Merge --]      |
|              ^^^^^^^^^^^^^^^^                                              |
|              Etape 2 - Code   |  45% complete  |  Timer: 12:34  |  [SAIN] |
+============================================================================+
```

#### FR-ORCH-03 : Alerte Drift

**Detection :** Quand un agent devie du workflow defini (fichiers non-prevus modifies, etape sautee, output non-conforme).
**Notification :**
- Badge rouge sur l'etape concernee dans le pipeline
- Notification toast en haut a droite : "Drift detecte sur US-142 a l'etape Code"
- Entree dans le centre de notifications

**Detail du drift :**
- Comparaison : "Attendu" vs "Observe"
- Diff visuel des ecarts
- Severite : Info, Warning, Critical
- Actions proposees : Ignorer (avec justification), Recharger le contexte, Kill+relance, Alerter le CTO

**Wireframe — Panneau Drift :**
```
+------------------------------------------+
|  DRIFT DETECTE               [!] Critical|
|------------------------------------------|
|                                          |
|  Agent : Alice-dev / US-142              |
|  Etape : 2. Code                         |
|  Heure : 14:32:15                        |
|                                          |
|  Attendu :                               |
|    Modifier src/services/search.ts       |
|    Modifier src/components/Filter.tsx     |
|                                          |
|  Observe :                               |
|    Modifier src/services/search.ts  [OK] |
|    Modifier src/core/database.ts    [!!] |
|    Modifier src/config/app.ts       [!!] |
|                                          |
|  L'agent modifie des fichiers hors       |
|  du scope prevu par la story.            |
|                                          |
|  Actions :                               |
|  [Ignorer] [Recharger] [Kill+Relance]    |
+------------------------------------------+
```

---

### 2.4 FR-OBS : Observabilite & Audit

#### FR-OBS-01 : Dashboard Observabilite

**Layout :** Grille de widgets configurables (drag-and-drop pour personnaliser).

**Widgets disponibles :**
- **Agents actifs** — Liste avec statut en temps reel (idle, running, compacting, error)
- **Graphe de drift** — Historique des drifts sur 7/30/90 jours avec tendances
- **Metriques de compaction** — Frequence, impact sur le contexte, taux de reinjection reussie
- **Health containers** — CPU, memoire, uptime par container agent
- **Taux de respect workflow** — Pourcentage global + par workflow
- **MTTR** — Mean Time To Resolution des incidents agents

**Wireframe — Dashboard Observabilite :**
```
+============================================================================+
|  MnM  [logo]     Observabilite                     [Configurer] [Exporter] |
+============================================================================+
|                                                                            |
|  +--- Agents actifs (8) ----------+  +--- Drift 30 jours ---------------+ |
|  |                                |  |          ^                        | |
|  |  Alice-dev    [Running] 45min  |  |    5 |   *                        | |
|  |  Bob-dev      [Running] 12min  |  |    4 |  * *          *            | |
|  |  Carlos-dev   [Idle]           |  |    3 | *   *   *    * *           | |
|  |  QA-agent-1   [Running] 78min  |  |    2 |      * * *  *   *         | |
|  |  Brief-agent  [Compacting]     |  |    1 |           **      *  *    | |
|  |  Review-bot   [Running] 5min   |  |    0 +--+--+--+--+--+--+--+--> | |
|  |  PO-assist    [Idle]           |  |       S1 S2 S3 S4 S5 S6 S7     | |
|  |  PM-brainstorm [Idle]          |  |                                  | |
|  +--------------------------------+  |  Tendance: -15% (amelioration)   | |
|                                      +----------------------------------+ |
|                                                                            |
|  +--- Respect Workflow ---+  +--- Compaction -------+  +--- MTTR -------+ |
|  |                        |  |                       |  |                 | |
|  |  Global : 94%          |  |  Compactions/jour: 12 |  |  Actuel: 11min | |
|  |  Dev Story : 97%       |  |  Reinjection OK: 89%  |  |  Cible : <15min| |
|  |  QA Flow : 91%         |  |  Kill+relance: 3      |  |  Tendance: -8% | |
|  |  Brief Flow : 88%      |  |                       |  |                 | |
|  +------------------------+  +-----------------------+  +-----------------+ |
+============================================================================+
```

#### FR-OBS-02 : Timeline d'Audit

**Vue chronologique inversee** (plus recent en haut) des evenements systeme.

**Colonnes :** Horodatage, Acteur (user ou agent), Action, Cible, Workflow, Etape, Detail
**Filtres :** Par acteur, par type d'action, par workflow, par projet, par periode
**Export :** CSV, JSON (pour compliance)

**Chaque entree est cliquable** -> detail complet avec contexte (quel prompt, quels fichiers, quel etat agent)

**Wireframe — Timeline Audit :**
```
+============================================================================+
|  Audit Trail                    [Filtres v]  [Exporter CSV]  [Exporter JSON]|
+============================================================================+
|                                                                            |
|  Horodatage       | Acteur       | Action          | Cible    | Workflow   |
|  ---------------  | ------------ | --------------- | -------- | ---------- |
|  14:32:15         | Alice-agent  | DRIFT_DETECTED  | US-142   | Dev Story  |
|  14:30:02         | Alice-agent  | FILE_MODIFIED   | search.ts| Dev Story  |
|  14:28:45         | Alice (user) | CHAT_MESSAGE    | US-142   | Dev Story  |
|  14:25:00         | Bob-agent    | STEP_COMPLETED  | US-139   | Dev Story  |
|  14:20:12         | System       | COMPACTION       | QA-agent | QA Flow   |
|  14:18:00         | Sophie (user)| MEMBER_INVITED  | Jean     | --         |
|  14:15:33         | PM-agent     | EPIC_CREATED    | EP-045   | Brief Flow |
|                                                                            |
|  [< 1  2  3 ... 24 >]                                                     |
+============================================================================+
```

#### FR-OBS-03 : Resume LLM

**Position :** Panneau lateral droit, accessible par clic sur un agent dans le dashboard.
**Contenu :**
- Resume en langage naturel de ce que l'agent fait ("Modifie le composant de recherche, a 3 fichiers en contexte, etape 2/5 du workflow")
- Niveau de confiance de l'agent (auto-evalue)
- Fichiers en contexte (avec indicateur de pertinence)
- Decisions prises et justifications
- Mise a jour toutes les 5 secondes

```
+----------------------------------+
|  Resume Agent : Alice-dev        |
|----------------------------------|
|                                  |
|  "Implemente le filtre de       |
|  recherche dans search.ts.       |
|  Utilise le pattern Repository   |
|  comme demande. 3 fichiers en    |
|  contexte. Etape Code (2/5)."    |
|                                  |
|  Confiance agent : 87%           |
|                                  |
|  Fichiers en contexte :          |
|  - search.ts (pertinent)         |
|  - repo.ts (pertinent)           |
|  - types.ts (reference)          |
|                                  |
|  Derniere decision :             |
|  "Choisi Repository pattern      |
|  suite a directive utilisateur"  |
|                                  |
|  Mis a jour il y a 3s            |
+----------------------------------+
```

---

### 2.5 FR-CHAT : Communication Temps Reel

#### FR-CHAT-01 : Composant ChatPanel

**Position :** Panneau lateral droit ou en bas de l'ecran (configurable).
**Redimensionnable :** Drag le bord pour agrandir/reduire. Double-clic = plein ecran.

**Elements :**
- Zone de messages avec bulles (utilisateur a droite, agent a gauche)
- Input text multiligne avec support Markdown
- Boutons d'action rapide : Stop, Rollback, Relancer
- Indicateur de statut agent : En ligne, En reflexion, En execution, Deconnecte
- Historique scrollable avec chargement infini
- Horodatage discret sur chaque message

**Wireframe — ChatPanel :**
```
+----------------------------------+
|  Chat : Alice-dev / US-142  [-]  |
|  Agent: En execution...          |
|----------------------------------|
|                                  |
|  [Agent] 14:25                   |
|  J'ai analyse la story US-142.  |
|  Plan propose :                  |
|  1. SearchFilter model           |
|  2. Route GET /search            |
|  3. Composant FilterPanel        |
|  [Voir plan complet]             |
|                                  |
|             [Vous] 14:26         |
|         Utilise le pattern       |
|         Repository pour le       |
|         data access.             |
|                                  |
|  [Agent] 14:26                   |
|  Compris. J'adapte le plan.      |
|  J'utilise core/repo.ts comme    |
|  base. [Voir diff plan]          |
|                                  |
|  [Agent] 14:28  (en execution)   |
|  Modification de search.ts en    |
|  cours... [voir live]            |
|                                  |
|----------------------------------|
|  +----------------------------+  |
|  | Votre message...           |  |
|  +----------------------------+  |
|  [Envoyer]  [Stop] [Rollback]   |
+----------------------------------+
```

#### FR-CHAT-02 : Indicateur de typing/activite

**3 etats visuels de l'agent :**
1. **En reflexion** — Icone de "pensee" (3 points animes). "L'agent analyse votre message..."
2. **En execution** — Barre de progression. "L'agent modifie search.ts..."
3. **En attente** — Icone idle. "L'agent attend vos instructions."

**Position :** Juste au-dessus de la zone d'input dans le ChatPanel.

#### FR-CHAT-03 : Historique de conversation

- Persistant entre sessions
- Searchable (Ctrl+F dans le chat)
- Filtrable par type de message (directives, reponses agent, decisions, erreurs)
- Exportable (Markdown, JSON)
- Groupable par session de travail

---

## 3. Accessibility Requirements

### 3.1 Conformite WCAG 2.1 AA — Exigences minimales

MnM vise la conformite WCAG 2.1 niveau AA pour toutes les interfaces. Les elements suivants sont obligatoires.

### 3.2 Navigation clavier

| Contexte | Raccourci | Action |
|----------|-----------|--------|
| Global | `Tab` / `Shift+Tab` | Navigation entre elements interactifs |
| Global | `Ctrl+K` | Palette de commandes (command palette) |
| Global | `Escape` | Fermer modale / panneau / dropdown actif |
| Board | `Arrow keys` | Naviguer entre stories dans le board |
| Board | `Enter` | Ouvrir le detail d'une story |
| Board | `D` | Drag mode (activer drag, arrows pour deplacer, Enter pour deposer) |
| Chat | `Enter` | Envoyer le message |
| Chat | `Shift+Enter` | Nouvelle ligne dans le message |
| Chat | `Ctrl+Shift+S` | Stop agent |
| Workflow | `Arrow Left/Right` | Naviguer entre etapes du workflow |
| Workflow | `Enter` | Ouvrir le detail de l'etape |
| Dashboard | `Tab` | Naviguer entre widgets |
| Dashboard | `Enter` | Expand/interact avec un widget |

**Exigences :**
- Focus visible sur TOUS les elements interactifs (outline 2px minimum, contraste suffisant)
- Ordre de tabulation logique (gauche->droite, haut->bas)
- Pas de piege clavier (toujours possible de sortir avec Escape ou Tab)
- Skip links en haut de page ("Aller au contenu principal", "Aller a la navigation")

### 3.3 Lecteur d'ecran

**ARIA landmarks obligatoires :**
- `role="banner"` pour le header
- `role="navigation"` pour la sidebar
- `role="main"` pour le contenu principal
- `role="complementary"` pour le ChatPanel
- `role="status"` pour les notifications et indicateurs de statut agent

**ARIA labels obligatoires :**
- Tous les boutons d'icone (sans texte visible) : `aria-label` descriptif
- Indicateurs de statut : `aria-live="polite"` pour les mises a jour automatiques
- Alertes drift : `aria-live="assertive"` pour les alertes critiques
- Progress bars : `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Tableaux : `aria-sort` sur les colonnes triables
- Onglets : pattern `role="tablist"` / `role="tab"` / `role="tabpanel"`

**Annonces dynamiques :**
- Changement d'etape workflow : annonce vocale "Etape 3 : Review - En cours"
- Message agent recu : annonce "Nouveau message de l'agent : [debut du message]"
- Drift detecte : annonce assertive "Alerte : drift detecte sur [story]"
- Completion d'action : annonce "Story US-142 passee en Done"

### 3.4 Contraste et couleurs

**Ratios minimaux (WCAG 2.1 AA) :**
- Texte normal (<18pt) : ratio 4.5:1 minimum
- Texte large (>=18pt ou 14pt bold) : ratio 3:1 minimum
- Elements interactifs (bordures, icones) : ratio 3:1 minimum

**Ne jamais utiliser la couleur seule pour communiquer une information :**
- Statut agent : couleur + icone + texte ("Running" en vert avec icone play)
- Drift : couleur orange + icone warning + texte "Drift detecte"
- DoR : couleur + icone check/cross + texte "DoR valide" / "DoR incomplet"
- Roles : couleur badge + texte du role toujours visible

**Themes :**
- Theme clair (defaut)
- Theme sombre (obligatoire — la majorite des devs l'utilisent)
- Respect des preferences systeme (`prefers-color-scheme`)
- Les deux themes doivent respecter les ratios de contraste

### 3.5 Responsive design

**Breakpoints :**
- Desktop : >= 1280px (experience optimale, tous les panneaux)
- Laptop : 1024px - 1279px (ChatPanel en overlay au lieu de panneau fixe)
- Tablette : 768px - 1023px (sidebar retractable, navigation hamburger)
- Mobile : < 768px (vue simplifiee, un panneau a la fois)

**Adaptations par taille :**
- Le board Kanban passe en scroll horizontal sur tablette/mobile
- Le pipeline workflow passe en liste verticale sur mobile
- Le ChatPanel est accessible via un FAB (floating action button) sur mobile
- Les wireframes ASCII des dashboards se reorganisent en pile verticale
- Les tableaux (membres, audit) passent en vue "carte" sur mobile

### 3.6 Exigences specifiques aux composants MnM

#### Curseur d'automatisation
- Accessible au clavier (Arrow Left/Right pour changer de position)
- `aria-label="Curseur d'automatisation"` + `aria-valuenow="assiste"` + `aria-valuetext="Mode assiste : l'agent propose, vous validez"`
- Les 3 positions sont cliquables ET atteignables au clavier
- Annonce vocale lors du changement : "Mode automatisation change en : Assiste"

#### Pipeline Workflow
- Chaque etape est un element focusable
- `aria-current="step"` sur l'etape en cours
- Navigation fleches gauche/droite
- Detail de l'etape via Enter (ouvre un panneau, pas une nouvelle page)
- `aria-label` incluant le statut : "Etape 2, Code, en cours, 45 pourcent"

#### Drag-and-drop (Board, Workflow editor)
- Alternative clavier obligatoire pour TOUTES les operations drag-and-drop
- Mode "deplacer" active par touche (D ou Espace), fleches pour naviguer, Enter pour deposer
- Annonce vocale : "Story US-142 selectionnee. Utilisez les fleches pour deplacer. Enter pour deposer."
- Pour les utilisateurs sans drag-and-drop : menu contextuel "Deplacer vers..." avec liste des colonnes/positions

#### ChatPanel
- Messages navigables avec les fleches haut/bas
- Chaque message a un `aria-label` avec l'emetteur et l'horodatage
- Boutons Stop/Rollback toujours accessibles au clavier meme pendant le scroll
- Zone de saisie avec `aria-label="Envoyer un message a l'agent"`

### 3.7 Tests d'accessibilite requis

**Automatises (CI/CD) :**
- axe-core sur chaque composant (regles WCAG 2.1 AA)
- Lighthouse accessibility score >= 90
- Pa11y sur les pages principales

**Manuels (avant chaque release) :**
- Navigation complete au clavier (aucun element inaccessible)
- Test avec NVDA (Windows) et VoiceOver (macOS)
- Test avec zoom navigateur a 200% (pas de perte de fonctionnalite)
- Test daltonisme (simulateur dans Chrome DevTools)

---

*Document UX Journeys & Requirements v1.0 — 6 journeys detailles, 15 FRs avec wireframes, accessibility WCAG 2.1 AA complet. ~3000 mots.*
