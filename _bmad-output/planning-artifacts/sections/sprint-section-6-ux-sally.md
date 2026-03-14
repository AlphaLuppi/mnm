# Sprint Planning — Section 6 : Requirements UX par Story

> **Par Sally la Designer** | Date : 2026-03-14 | Version : 1.0
> Sources : UX Design B2B v1.0, PRD B2B v1.0, Design System Sally v1.0, Component Strategy Amelia v1.0
> Direction UX : **Direction C "Adaptive Cockpit"** — dark/light adaptatif au persona

---

## Table des matieres

1. [Requirements UX par Epic](#1-requirements-ux-par-epic)
2. [Wireframes textuels des ecrans principaux](#2-wireframes-textuels-des-ecrans-principaux)
3. [Components shadcn/ui par story](#3-components-shadcnui-par-story)
4. [UX Flows critiques](#4-ux-flows-critiques)
5. [Curseur d'automatisation — Implementation progressive](#5-curseur-dautomatisation--implementation-progressive)
6. [Design tokens et variantes par persona/mode](#6-design-tokens-et-variantes-par-personamode)
7. [Accessibility requirements par story](#7-accessibility-requirements-par-story)
8. [Mapping stories vers pages/ecrans](#8-mapping-stories-vers-pagesecrans)

---

## 1. Requirements UX par Epic

### Epic FR-MU : Multi-User & Auth

**Ecrans concernes** : Page Membres, Modal Invitation, Company Selector, Page Profil, Header (sign-out)

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-MU-01 Invitation email | Modal invitation : champ email + role selector + message optionnel. Feedback toast apres envoi. Lien d'invitation expire en 7j avec indicateur visuel. | Dialog, Input, Select (RoleSelector), Button, Toast | P0 |
| REQ-MU-02 Page Membres | Table triable/filtrable avec colonnes : Avatar, Nom, Role (Badge couleur), Statut, Date ajout, Actions. Bulk actions via checkboxes. Barre de recherche en haut. Pagination. | DataTable, Badge (role), Checkbox, DropdownMenu, Input (search), Pagination | P0 |
| REQ-MU-03 Invitation bulk | Extension de la modal invitation : zone CSV drag-and-drop ou textarea multi-lignes. Preview du nombre d'invitations avant envoi. Progress bar pendant l'envoi. | Dialog, Textarea, FileUpload (drag-and-drop), Progress, Toast | P1 |
| REQ-MU-04 Company Selector | Dropdown dans le header, immediatement apres le logo. Affiche le nom de la company active + chevron. Liste des companies avec avatar + nom + role badge. Raccourci Ctrl+K "company:". | DropdownMenu, Avatar, Badge, CommandPalette integration | P1 |
| REQ-MU-05 Desactivation signup | Toggle dans Parametres > Company > Securite. Label clair : "Mode invitation uniquement". Confirmation dialog si activation. | Switch, Card (settings), Dialog (confirmation) | P0 |
| REQ-MU-06 Sign-out | Item dans le menu avatar du header. Confirmation optionnelle si agent actif. Redirection vers login. | DropdownMenu, Dialog (si agent actif), redirect | P0 |

**Regles UX transverses FR-MU :**
- Les badges de role utilisent les couleurs RBAC : Admin=rouge `--role-admin`, Manager=bleu `--role-manager`, Contributor=vert `--role-contributor`, Viewer=gris `--role-viewer`
- Le triple encodage est obligatoire pour les roles : couleur + icone + texte (Shield pour Admin, Users pour Manager, User pour Contributor, Eye pour Viewer)
- Les actions destructives (retrait d'un membre) passent par une Dialog de confirmation avec texte explicite

---

### Epic FR-RBAC : Roles & Permissions

**Ecrans concernes** : Matrice Permissions, Role Selector, Navigation Guard, Badges Couleur

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-RBAC-01 4 roles metier | Badge visuel par role dans toute l'interface (table membres, header avatar, sidebar). Icone + couleur + label. | Badge (4 variantes role), Avatar overlay | P0 |
| REQ-RBAC-02 Presets permissions | Matrice visuelle : lignes = permissions (15 cles), colonnes = roles. Checkboxes avec etat herite (grise) vs override (actif). Info tooltip par permission. | Table (matrice), Checkbox, Tooltip, Card | P0 |
| REQ-RBAC-03 Scope JSONB | Invisible en UX directement — impact sur le comportement : les contenus affiches changent selon le scope (filtrage automatique). Pas de message "acces refuse" pour le contenu filtre, simplement absent. | NavigationGuard (composant HOC) | P0 |
| REQ-RBAC-06 Masquage navigation | Items de sidebar absents du DOM (pas grises). Command Palette filtree. Redirect 403 avec message clair et bouton retour. | Sidebar conditionnel, CommandPalette filtree, Page 403 | P1 |
| REQ-RBAC-07 UI admin permissions | Page dediee dans Parametres > Roles & Permissions. Onglets par role. Previsualisation "voir comme ce role". | Tabs, Card, Button "Preview as", PermissionMatrix | P1 |
| REQ-RBAC-08 Badges couleur | 4 variantes visuelles : fond couleur/10%, texte couleur, bordure couleur/20%. Taille sm (20px H) dans les tables, default (24px H) dans les profils. | Badge (custom role variant) | P2 |

**Regles UX transverses FR-RBAC :**
- Principe absolu : **masquage > grisage**. Un Viewer ne voit pas l'item "Workflows" dans la sidebar.
- La page 403 affiche : "Vous n'avez pas acces a cette page. Contactez votre administrateur." avec un bouton "Retour au dashboard".
- Les redirections de liens partages vers pages non-autorisees sont silencieuses (redirect vers la page autorisee la plus proche).

---

### Epic FR-ORCH : Orchestrateur Deterministe

**Ecrans concernes** : Pipeline Workflow, Editeur Workflow, Panneau Drift, Stage Detail

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-ORCH-01 Execution step-by-step | Pipeline visuel horizontal : etapes liees par des connecteurs fleches. Couleurs de statut : gris (a venir), bleu+pulsation (en cours), vert (termine), rouge (erreur), orange (drift). Clic sur etape = panneau detail. | WorkflowPipeline (custom), StageCard (custom), Progress | P0 |
| REQ-ORCH-02 Fichiers obligatoires | Dans le detail d'etape : checklist fichiers requis avec statut vert/rouge. Blocage visuel si fichier manquant (etape non-demarrable, bouton desactive + tooltip explicatif). | Card, Checkbox (read-only), Tooltip, Alert | P0 |
| REQ-ORCH-05 Drift detection | Badge orange + icone AlertTriangle sur l'etape en drift. Toast persistant rouge si critique. Panneau drift : diff visuel "attendu vs observe", severite (Info/Warning/Critical), actions (Ignorer, Recharger, Kill+Relance, Alerter CTO). | DriftAlert (custom), Toast (persistent), Badge, Button (4 actions) | P0 |
| REQ-ORCH-08 Editeur workflow | Interface drag-and-drop : palette d'etapes a gauche, canvas central, panneau proprietes a droite. Chaque etape configurable : nom, prompt, fichiers obligatoires, conditions de transition. Preview du pipeline final en bas. | WorkflowEditor (custom), DnD (drag-and-drop), Input, Textarea, Select, Card | P1 |
| REQ-ORCH-09 Validation humaine | Bouton "Valider" visible dans la barre de statut quand une etape requiert validation. Notification push. Dialog de review avec resume de l'etape + diff des changements. | Dialog (review), Button, Toast (notification), Badge (attente validation) | P0 |

**Regles UX transverses FR-ORCH :**
- Le pipeline est toujours visible en barre de statut quand un workflow est actif
- Les animations de pulsation sur l'etape active durent 2000ms en boucle (ease-in-out)
- Respect de `prefers-reduced-motion` : pulsation remplacee par un indicateur statique "En cours"
- Le bouton Stop est TOUJOURS visible et accessible en < 1 seconde

---

### Epic FR-OBS : Observabilite & Audit

**Ecrans concernes** : Dashboard CEO, Dashboard CTO, Audit Log, Timeline Agent

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-OBS-01 Resume LLM | Panneau lateral droit "Activite Agent" : resume en langage naturel de la derniere action, mis a jour en temps reel (<5s). Texte court (2-3 phrases), lien "Voir details". | Card (agent-variant), Badge (sante), Timeline | P1 |
| REQ-OBS-02 Audit log | Page Audit : table filtrable par date, utilisateur, type d'action, workflow, severite. Export CSV/JSON. Pagination server-side. Tri par date descendant par defaut. | DataTable (sortable, filterable), DateRangePicker, Select (filtres), Button (export), Pagination | P0 |
| REQ-OBS-03 Dashboards agreges | Dashboard CEO : 4-6 cartes KPI (agents actifs, taux workflow, drifts, avancement BU). Graphiques bar/line pour tendances. Dashboard CTO : graphe drift temps reel, sante containers, metriques compaction. JAMAIS de donnees individuelles. | Card (KPI), Chart (bar, line), Badge, MetricWidget (custom) | P1 |
| REQ-OBS-05 Export audit | Boutons "Exporter CSV" et "Exporter JSON" dans la page Audit. Dialog de confirmation avec filtres appliques resumes. Progress bar pendant l'export. | Button, Dialog, Progress, Toast (succes) | P1 |

**Regles UX transverses FR-OBS :**
- Les dashboards management ne montrent JAMAIS de donnees individuelles (Verite #20). Le drill-down s'arrete au niveau equipe.
- Les metriques sont agregees : "3 agents actifs", "12 stories en cours", pas "Alice a 2 stories, Bob en a 1".
- Le dashboard personnel (mon activite) est prive et visible uniquement par l'utilisateur lui-meme.

---

### Epic FR-ONB : Onboarding Cascade

**Ecrans concernes** : Chat Onboarding, Organigramme, Import Progress, Setup Wizard

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-ONB-01 Onboarding CEO | Interface chat plein ecran, epuree. Agent pose des questions structurees (5-7 max). Chaque reponse genere un element visuel (BU, equipe, role). Barre de progression en haut. | ChatPanel (variant onboarding), Progress, Card | P1 |
| REQ-ONB-02 Cascade hierarchique | Organigramme interactif : arbre hierarchique avec drag-and-drop. Noeuds = roles avec avatar + nom + badge role. Bouton "Inviter" sur chaque noeud vide. Emails d'invitation pre-remplis avec contexte du perimetre. | OrgChart (custom), Avatar, Badge, Button, Dialog (invitation) | P1 |
| REQ-ONB-03 Import Jira | Wizard 4 etapes : 1) Connexion API, 2) Selection projets, 3) Mapping champs, 4) Confirmation + lancement. Progress bar avec estimation temps. Resume post-import avec compteurs (X projets, Y stories importes). | Stepper (custom), Form, Select, Progress, Card (resume) | P2 |
| REQ-ONB-04 Dual-mode config | Selecteur mode en haut du wizard : "Conversationnel" (chat) vs "Formulaire" (classique). Le CEO prefere le chat, le CTO prefere le formulaire. Contenu identique, format different. | Tabs (2 modes), ChatPanel ou Form selon le mode | P2 |

---

### Epic FR-DUAL : Dual-Speed Workflow

**Ecrans concernes** : Panneau Curseur, Preferences, Parametres Projet, Parametres Company

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-DUAL-01 Curseur 3 positions | Slider segmente 3 positions : Manuel (gris), Assiste (bleu), Automatique (vert). Label et description sous chaque position. Animation douce lors du changement. | Slider (3-segment custom), Label, Card | P1 |
| REQ-DUAL-02 Granularite 4 niveaux | Interface hierarchique : onglets Entreprise > Projet > Agent > Action. Chaque niveau affiche son curseur. Les niveaux superieurs imposent un plafond visible (zone grisee non-cliquable). | Tabs, Slider, Card, Alert (plafond actif) | P1 |
| REQ-DUAL-03 Plafond hierarchique | Zone grisee sur le slider au-dela du plafond impose. Tooltip : "Limite par [role] : maximum [position]". Icone cadenas sur la zone bloquee. | Slider (avec zone disabled), Tooltip, Lock icon | P1 |

---

### Epic FR-CHAT : Chat Temps Reel

**Ecrans concernes** : Chat Panel, Split View Code+Chat, Chat Onboarding

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-CHAT-01 WebSocket bidirectionnel | Panneau chat 320px a droite. Bulles : humain a droite (bleu), agent a gauche (violet `--agent`). Indicateur de frappe. Timestamps sur hover. | ChatPanel (custom), MessageBubble (custom), TypingIndicator (custom) | P0 |
| REQ-CHAT-02 Dialogue pendant execution | Chat integre dans la split view : code a gauche, chat a droite. Les messages de l'agent incluent des liens vers les fichiers modifies. Boutons d'action rapide : Stop, Rollback, Continuer. | SplitView layout, ChatPanel, Button (Stop/Rollback), FileLink | P0 |
| REQ-CHAT-03 Reconnexion WebSocket | Indicateur connexion dans le header du chat : vert (connecte), orange (reconnexion...), rouge (deconnecte). Message "Reconnexion en cours..." si deconnexion. Sync messages manques. | ConnectionStatus (custom), Badge, Toast (reconnexion) | P1 |
| REQ-CHAT-04 Chat read-only viewer | Meme interface mais sans champ de saisie. Badge "Lecture seule" en bas du panneau. | ChatPanel (variant readonly), Badge | P1 |

---

### Epic FR-CONT : Containerisation

**Ecrans concernes** : Container Status, Resource Monitor, Config Credential Proxy

| Story | Requirements UX | Composants cles | Priorite UX |
|-------|----------------|-----------------|-------------|
| REQ-CONT-01 Container Docker | Indicateur dans la barre de statut : icone Container + statut (Starting, Running, Stopped). Clic ouvre le panneau detail : ID, image, uptime, resources. | Badge (container status), Card (detail), MetricWidget | P0 |
| REQ-CONT-02 Credential proxy | Page Parametres > Securite > Credentials. Table des regles de proxy. Chaque regle : service + methode d'injection + statut. Actions : editer, desactiver, supprimer. | DataTable, Badge, DropdownMenu, Dialog (edition) | P0 |
| REQ-CONT-06 Resource limits | Graphiques temps reel dans le panneau container : CPU (jauge), RAM (jauge), Disk (barre). Seuils visuels : vert (<70%), orange (70-90%), rouge (>90%). | Progress (gauge variant), Card, Badge (seuil) | P1 |

---

## 2. Wireframes textuels des ecrans principaux

### 2.1 Dashboard CEO (Light mode, aere)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K Rechercher...]  |  [?] [3] [Avatar v]    |
+============================================================================+
|  [ico] Dashboard    |                                                      |
|  [ico] Projets    > |  DASHBOARD EXECUTIF                                  |
|                     |                                                      |
|                     |  +----------+ +----------+ +----------+ +----------+ |
|                     |  | Agents   | | Workflows| | Drifts   | | Stories  | |
|                     |  | actifs   | | en cours | | actifs   | | livrees  | |
|                     |  |    12    | |     8    | |     2    | |    47    | |
|                     |  | +15% ^   | | stable   | | -1 v     | | +23% ^   | |
|                     |  +----------+ +----------+ +----------+ +----------+ |
|                     |                                                      |
|                     |  +--- Avancement par BU ----------------------------+|
|                     |  | BU France      ████████████░░░░  78%             ||
|                     |  | BU USA         ██████████░░░░░░  64%             ||
|                     |  | BU Allemagne   ████████░░░░░░░░  52%             ||
|                     |  +-----------------------------------------------------+|
|                     |                                                      |
|                     |  +--- Alertes recentes ---+  +--- Chat executif ---+|
|                     |  | [!] Drift Agent-12     |  | > Ou en est Alpha? ||
|                     |  |     Pipeline Review     |  |                    ||
|                     |  |     il y a 5 min        |  | Le projet Alpha est||
|                     |  | [i] Nouvel agent actif |  | a 78% avec 2 drifts||
|                     |  |     BU France           |  | mineurs resolus... ||
|  [ico] Preferences  |  +------------------------+  +--------------------+|
+============================================================================+
|  Workflow: --  |  Agents: 12 actifs  |  Sante: OK  |  Derniere MAJ: 14:32 |
+============================================================================+
```

### 2.2 Dashboard CTO (Dark mode, dense)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [5!] [Avatar v]             |
+============================================================================+
|  [ico] Dashboard    |                                                      |
|  [ico] Projets    > |  MONITORING TECHNIQUE                                |
|  [ico] Workflows    |                                                      |
|  [ico] Agents       |  +--- Drift Detection ----+  +--- Sante Agents ---+|
|  [ico] Membres      |  | Drifts actifs: 2       |  | alice-dev   [OK]   ||
|  [ico] Audit        |  | ████░░ Agent-12 WARNING |  | bob-test    [OK]   ||
|  [ico] Parametres   |  | ██░░░░ Agent-07 INFO    |  | carol-rev   [WARN] ||
|                     |  | Resolution moy: 4min   |  | dave-onb    [IDLE] ||
|                     |  +------------------------+  +--------------------+|
|                     |                                                      |
|                     |  +--- Containers ----------+  +--- Compaction -----+|
|                     |  | Actifs: 8/12            |  | Sessions: 24       ||
|                     |  | CPU moy: 34%            |  | Compactions: 3     ||
|                     |  | RAM moy: 1.2GB          |  | Survie: 92%        ||
|                     |  | Disk: 45GB/100GB        |  | Reinjection: 88%   ||
|                     |  +------------------------+  +--------------------+|
|                     |                                                      |
|                     |  +--- Workflows actifs --------------------------------+|
|                     |  | Dev Story  [Brief]->[Code]->[Review]->[Test]->[Merge]||
|                     |  |            done    ACTIVE   pending   pend    pend   ||
|                     |  | Hotfix     [Triage]->[Fix]->[Test]->[Deploy]        ||
|                     |  |            done      done   ACTIVE   pending         ||
|                     |  +-----------------------------------------------------+|
|  [ico] Preferences  |                                                      |
+============================================================================+
|  Drifts: 2  |  Containers: 8/12  |  CPU: 34%  |  WebSocket: connecte       |
+============================================================================+
```

### 2.3 Board Dev (Dark mode, focus code)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [1] [Avatar v]              |
+============================================================================+
|  [ico] Mon Board    |                                                      |
|  [ico] Projets    > |  MON BOARD                    [Filtrer v] [+ Story]  |
|  [ico] Mes Agents   |                                                      |
|  [ico] Chat         |  +--- A Faire ---+  +--- En Cours ---+  +- Review -+|
|                     |  |               |  |                 |  |          ||
|                     |  | +-- US-156 --+|  | +-- US-142 ---+|  | US-138   ||
|                     |  | | Filtre date||  | | Filtre rech. ||  | [badge]  ||
|                     |  | | [P1] [Dev] ||  | | [P0] [Dev]   ||  | Lead rev.||
|                     |  | | Est: 3pts  ||  | | Agent: actif ||  |          ||
|                     |  | +------------+|  | | [Stop][Chat] ||  +----------+|
|                     |  |               |  | +--------------+|  |          ||
|                     |  | +-- BUG-23 --+|  |                 |  |          ||
|                     |  | | Login iOS  ||  |                 |  |          ||
|                     |  | | [URGENT]   ||  |                 |  |          ||
|                     |  | +------------+|  |                 |  |          ||
|                     |  +---------------+  +-----------------+  +----------+|
|                     |                                                      |
|  [ico] Preferences  |  Burndown: ████████░░░░ 67% sprint                   |
+============================================================================+
|  Story: US-142  |  Workflow: Dev Story 2/5  |  Agent: alice [OK]  | 12:34  |
+============================================================================+
```

### 2.4 Split View Dev : Code + Chat Agent

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [1] [Avatar v]              |
+============================================================================+
|  Pipeline: [Brief OK]->[Code ACTIVE]->[Review]->[Test]->[Merge]            |
+============================================================================+
|                                        |                                   |
|  src/services/search.ts               |  CHAT — Agent Alice                |
|  ====================================  |  ================================|
|  1  import { db } from '../db';       |  [alice] Plan propose:             |
|  2  import { SearchQuery }...         |  1. Ajout index PostgreSQL         |
|  3                                     |  2. Modification SearchService    |
|  4  export class SearchService {      |  3. Tests unitaires               |
|  5    async search(query: SearchQuery)|  4. Tests integration             |
|  6+     const results = await db      |                                   |
|  7+       .select()                   |  [vous] Utilise le pattern         |
|  8+       .from(issues)               |  Repository au lieu de l'acces    |
|  9+       .where(                     |  direct a db.                     |
| 10+         ilike(issues.title,       |                                   |
| 11+           `%${query.term}%`)      |  [alice] Compris. Je refactore    |
| 12+       )                           |  avec Repository pattern.         |
| 13+       .limit(query.limit ?? 20); |  Fichiers modifies:               |
| 14      return results;               |  - src/repos/search-repo.ts [NEW] |
| 15    }                               |  - src/services/search.ts [MOD]   |
| 16  }                                 |                                   |
|                                        |  > ______________________________ |
|  +3 fichiers modifies  [Voir diff]    |  [Envoyer]  [Stop] [Rollback]     |
+============================================================================+
|  Story: US-142  |  Etape: 2/5 Code  |  Agent: alice [OK]  |  Timer: 12:34 |
+============================================================================+
```

### 2.5 Page Membres (Admin)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [0] [Avatar v]              |
+============================================================================+
|  [ico] Dashboard    |                                                      |
|  [ico] Projets    > |  MEMBRES                          [+ Inviter]       |
|  [ico] Workflows    |                                                      |
|  [ico] Agents       |  [Rechercher...]  [Role: Tous v]  [Statut: Tous v]  |
|  [ico] Membres  <<  |                                                      |
|  [ico] Audit        |  +======================================================+|
|  [ico] Parametres   |  | [ ] | Membre          | Role          | Statut   ||
|                     |  |-----|-----------------|---------------|----------||
|                     |  | [ ] | Marc Dupont     | [A] Admin     | Actif    ||
|                     |  | [ ] | Sophie Lemaire  | [M] Manager   | Actif    ||
|                     |  | [ ] | Alice Torres    | [C] Contributor| Actif   ||
|                     |  | [ ] | Bob Martin      | [C] Contributor| Actif   ||
|                     |  | [ ] | Claude Petit    | [V] Viewer    | Invite   ||
|                     |  +======================================================+|
|                     |  5 membres  |  2 invitations en attente  [< 1/1 >]  |
|                     |                                                      |
|  [ico] Preferences  |  Actions en lot: [Changer role v] [Retirer]          |
+============================================================================+
```

### 2.6 Editeur Workflow (CTO)

```
+============================================================================+
|  [MnM]  Alpha Corp v  |  [Ctrl+K...]  |  [?] [0] [Avatar v]              |
+============================================================================+
|  [ico] Dashboard    |                                                      |
|  [ico] Workflows << |  EDITEUR WORKFLOW : Dev Story Pipeline               |
|                     |                                                      |
|  +-- Palette --+    |  +--- Canvas (drag-and-drop) ----+  +-- Props ---+  |
|  |             |    |  |                                |  |            |  |
|  | [Brief]     |    |  | [Brief]--->[Code]--->[Review]  |  | Etape:    |  |
|  | [Code]      |    |  |                  |              |  | Code      |  |
|  | [Review]    |    |  |                  v              |  |           |  |
|  | [Test]      |    |  |              [Test]--->[Merge]  |  | Prompt:   |  |
|  | [Deploy]    |    |  |                                |  | [........]|  |
|  | [Custom...] |    |  |                                |  |           |  |
|  |             |    |  |                                |  | Fichiers: |  |
|  +-------------+    |  |                                |  | [x] spec  |  |
|                     |  |                                |  | [x] tests |  |
|                     |  +--------------------------------+  |           |  |
|                     |                                      | Transition|  |
|                     |  Preview: [Brief]->[Code]->[Review]  | [Auto v]  |  |
|                     |           ->[Test]->[Merge]           +----------+  |
+============================================================================+
|  Template: Dev Story  |  5 etapes  |  Modifie il y a 2 min  | [Sauvegarder]|
+============================================================================+
```

### 2.7 Curseur d'Automatisation (Preferences)

```
+============================================================================+
|  PREFERENCES > Curseur d'automatisation                                    |
+============================================================================+
|                                                                            |
|  +--- Niveau Entreprise (defini par Admin) ---+                            |
|  | Plafond global : ASSISTE maximum                                       |
|  | [MANUEL]=====[ASSISTE]xxxxx[AUTO]                                      |
|  |                       ^--- bloque par Admin                            |
|  +-----------------------------------------------------+                  |
|                                                                            |
|  +--- Niveau Projet : Alpha ---+  +--- Niveau Projet : Beta ---+          |
|  | [MANUEL]===[ASSISTE]xxx[AUTO]|  | [MANUEL]=======[ASSISTE]xxx|          |
|  | Limite: ASSISTE              |  | Limite: ASSISTE            |          |
|  +------------------------------+  +----------------------------+          |
|                                                                            |
|  +--- Niveau Agent : alice-dev ---+                                        |
|  | [MANUEL]=====[ASSISTE]                                                 |
|  | Position actuelle: ASSISTE                                             |
|  +-----------------------------------------------------+                  |
|                                                                            |
|  +--- Niveau Action ---------+                                             |
|  | Tests unitaires : [AUTO]  | <- en dessous du plafond                   |
|  | Code review : [ASSISTE]   |                                             |
|  | Architecture : [MANUEL]   | <- choix personnel                         |
|  +----------------------------+                                            |
|                                                                            |
|  Legende:  ===== accessible   xxxxx bloque par hierarchie                  |
|            [cadenas] limite imposee par un niveau superieur                |
+============================================================================+
```

---

## 3. Components shadcn/ui par story

### 3.1 Composants existants shadcn/ui utilises

| Composant | Stories qui l'utilisent |
|-----------|----------------------|
| **Button** | Toutes les stories (actions primaires, secondaires, destructives) |
| **Card** | FR-OBS dashboards, FR-ORCH stage detail, FR-ONB wizard, FR-DUAL curseur |
| **Dialog** | FR-MU invitation, FR-RBAC confirmation, FR-ORCH review, FR-CONT config |
| **Input** | FR-MU recherche, FR-CHAT saisie message, FR-ONB formulaires |
| **Select** | FR-MU role selector, FR-RBAC filtres, FR-ORCH transition config |
| **Badge** | FR-RBAC roles, FR-ORCH statuts workflow, FR-CONT container status |
| **Toast** | FR-MU feedback invitation, FR-ORCH drift alerte, FR-CHAT reconnexion |
| **DropdownMenu** | FR-MU company selector, FR-MU actions membre, FR-ORCH actions drift |
| **Tabs** | FR-RBAC onglets roles, FR-DUAL niveaux curseur, FR-ONB mode config |
| **Tooltip** | FR-RBAC info permission, FR-DUAL plafond hierarchique, FR-ORCH fichiers |

### 3.2 Composants shadcn/ui a ajouter

| Composant | Stories | Raison |
|-----------|---------|--------|
| **DataTable** | FR-MU-02 Page Membres, FR-OBS-02 Audit Log | Tables triables/filtrables avec pagination |
| **Switch** | FR-MU-05 Toggle invitation-only | On/off binaire |
| **Progress** | FR-ONB-03 Import, FR-CONT-06 Resources | Barres de progression |
| **Slider** | FR-DUAL-01 Curseur automatisation | Slider 3 positions segmente |
| **Alert** | FR-ORCH-02 Fichiers manquants, FR-DUAL-03 Plafond | Messages d'alerte contextuels |
| **Form** | FR-ONB config, FR-CONT-02 Credential proxy | Validation avec React Hook Form + Zod |
| **Accordion** | FR-OBS audit detail, FR-ORCH etape detail | Contenu expandable |
| **Sheet** | FR-CHAT panneau lateral, FR-OBS resume agent | Panneau lateral glissant |
| **HoverCard** | FR-MU profil membre hover, FR-ORCH agent info | Preview au survol |
| **NavigationMenu** | Sidebar evolution | Navigation structuree |

### 3.3 Composants custom a creer

| Composant | Epic | Description | Complexite |
|-----------|------|-------------|-----------|
| **WorkflowPipeline** | FR-ORCH | Pipeline horizontal, etapes connectees, statuts colores, pulsation | L |
| **StageCard** | FR-ORCH | Carte d'etape workflow avec statut, fichiers, timer | M |
| **DriftAlert** | FR-ORCH | Panneau drift : diff, severite, actions | L |
| **WorkflowEditor** | FR-ORCH | Editeur drag-and-drop de pipeline | XL |
| **ChatPanel** | FR-CHAT | Panneau chat avec bulles, typing, connexion | L |
| **MessageBubble** | FR-CHAT | Bulle de message humain/agent avec timestamp | S |
| **TypingIndicator** | FR-CHAT | Animation 3 points "en train d'ecrire" | S |
| **ConnectionStatus** | FR-CHAT | Indicateur WebSocket vert/orange/rouge | S |
| **AutomationCursor** | FR-DUAL | Slider 3 positions segmente avec zone bloquee | M |
| **OrgChart** | FR-ONB | Arbre hierarchique interactif drag-and-drop | L |
| **MetricWidget** | FR-OBS | Widget KPI : valeur, tendance, comparaison | M |
| **ContainerStatus** | FR-CONT | Badge + detail container avec resources | M |
| **NavigationGuard** | FR-RBAC | HOC de protection de route par permission | S |

---

## 4. UX Flows critiques

### 4.1 Flow Onboarding CEO

```
[1] Email invitation         [2] Clic lien             [3] Compte cree
    "Bienvenue sur MnM"          /onboarding               Redirect: /onboarding/chat
         |                           |                           |
         v                           v                           v
[4] Chat conversationnel     [5] Organigramme genere    [6] Validation drag-drop
    5-7 echanges max              Arbre visuel               Ajuster les noeuds
    "Decrivez votre                interactif
     entreprise"                      |                           |
                                      v                           v
                              [7] Invitations cascade    [8] Dashboard J+2
                                  Emails pre-remplis          KPIs agreges
                                  par perimetre               Chat strategique

    Emotion: Scepticisme -> Curiosite -> Surprise -> Confiance -> Satisfaction
    Metriques: Time-to-structure < 15 min, Completion > 70%
```

**Points UX critiques :**
- Ecran de chat epure : fond blanc, pas de sidebar, focus total sur la conversation
- Chaque reponse genere immediatement un element visuel (feedback instantane)
- Barre de progression discretement visible en haut (3/7 echanges)
- Bouton "Passer" toujours visible pour sauter les etapes optionnelles
- Animation douce lors de la generation de l'organigramme (200ms fade-in par noeud)

### 4.2 Flow Config CTO

```
[1] Acceptation invite       [2] Dashboard technique    [3] Config SSO
    Perimetre pre-configure       Vue monitoring              SAML/OIDC wizard
         |                           |                           |
         v                           v                           v
[4] Creation workflow        [5] Test simule            [6] Config drift
    Editeur drag-and-drop         Execution dry-run          Curseur sensibilite
         |                           |                           |
         v                           v                           v
[7] Monitoring quotidien     [8] Intervention drift
    Dashboard temps reel          Diff attendu vs observe
    Sante containers              Actions: recharger/kill/ignorer

    Emotion: Mefiance -> Verification -> Flow -> Maitrise -> Serenite
    Metriques: Config SSO < 30 min, Premier workflow < 1h
```

**Points UX critiques :**
- Le CTO arrive sur un dashboard pre-rempli avec des donnees de demo (pas un ecran vide)
- Le wizard SSO inclut un bouton "Tester la connexion" a chaque etape
- L'editeur de workflow supporte le clavier (Tab pour naviguer, Enter pour editer, Escape pour annuler)
- Le monitoring drift affiche des metriques en temps reel sans refresh (WebSocket)

### 4.3 Flow Quotidien Dev

```
[1] Ouverture MnM            [2] Board personnel        [3] Selection story
    Login ou session active       Stories triees par          Contexte complet:
    Redirect: /board              priorite                   specs, maquettes,
         |                           |                       fichiers concernes
         v                           v                           |
[4] Lancement agent          [5] Split view live         [6] Pilotage chat
    "Lancer l'agent"              Code gauche                "Utilise pattern X"
    Workflow demarre              Chat droite                 Agent s'adapte
         |                        Diff en surbrillance           |
         v                           |                           v
[7] Review code              [8] Merge 1 clic
    Diff avec annotations         MR automatique
    Tests generes                 Audit log
    Metriques couverture          Story -> Done

    Emotion: Scepticisme -> Focus -> Fascination -> Controle -> Accomplissement
    Metriques: Time-to-first-agent < 30 min, Interruption reussie 100%
```

**Points UX critiques :**
- Le board est la page par defaut du dev (pas le dashboard)
- La story affiche le contexte complet sans navigation supplementaire
- Le bouton "Lancer l'agent" est proEminent (Button primary, taille lg)
- Le split view se redimensionne avec un drag handle central
- Les boutons Stop et Rollback sont TOUJOURS visibles dans la barre de statut et le chat

### 4.4 Flow Workflow PO

```
[1] Board Sprint             [2] Reception epic         [3] Chat decomposition
    Vue Kanban                    Epic complete:              "Decompose cette epic"
    Stories par colonne           analyse, maquettes,         Agent propose 5-8
    DoR indicators                contraintes                 stories structurees
         |                           |                           |
         v                           v                           v
[4] Affinage stories         [5] Validation DoR         [6] Suivi sprint
    Kanban drag-and-drop          Checklist auto              Dashboard augmente
    Edition inline                vert/rouge par critere      Burndown agent
    Validation 1 clic             [Forcer avec justif.]       Stories en cours

    Emotion: Routine -> Efficacite -> Confiance -> Maitrise
    Metriques: Time-to-DoR < 5 min, Stories par epic > 5
```

**Points UX critiques :**
- La checklist DoR utilise des checkmarks vert/rouge avec labels explicites
- Le bouton "Forcer avec justification" est present mais secondaire (ghost variant)
- Le chat de decomposition affiche les stories generees sous forme de cartes draggables
- L'edition inline sur le board utilise le double-clic (pattern Notion/Linear)

---

## 5. Curseur d'automatisation — Implementation progressive

### 5.1 Sprint 0 : Fondation

- **Composant AutomationCursor** : Slider 3 positions statique (Manuel/Assiste/Auto)
- **Design** : Slider segmente avec 3 zones colorees (gris, bleu, vert)
- **Interaction** : Clic sur une position, pas de drag continu
- **Scope** : Niveau utilisateur uniquement (preferences personnelles)
- **Pas encore** : hierarchie, plafonds, granularite

### 5.2 Phase 1 : Integration basique

- **Ajout dans les preferences** : Section "Mon curseur d'automatisation"
- **Persistance** : Table `automation_cursors` avec userId + position
- **Impact UX** : Affecte l'affichage des suggestions agent (Manuel = pas de suggestions, Assiste = suggestions visibles, Auto = execution directe)
- **Feedback** : Toast "Curseur mis a jour" + changement visuel immediat

### 5.3 Phase 2 : Granularite et hierarchie

- **4 niveaux** : Entreprise > Projet > Agent > Action (onglets)
- **Plafond** : Zone grisee avec cadenas et tooltip explicatif
- **Heritage** : Le niveau inferieur herite du superieur par defaut (overridable dans la limite)
- **UI admin** : Le CTO/CEO voit et configure les plafonds dans Parametres > Company

### 5.4 Phase 3+ : Intelligence et recommandation

- **Recommandation** : Basee sur l'historique — "Vous validez systematiquement les tests generes. Passer en Auto ?"
- **Notification non-intrusive** : Badge discret sur le curseur, pas de popup
- **Analytics** : Evolution du curseur dans le temps (graphique dans le dashboard personnel)

---

## 6. Design tokens et variantes par persona/mode

### 6.1 Tokens par mode (Direction C "Adaptive Cockpit")

| Token | Mode Management (Light) | Mode Technique (Dark) |
|-------|------------------------|----------------------|
| `--background` | `oklch(1 0 0)` — blanc | `oklch(0.145 0 0)` — noir bleu |
| `--foreground` | `oklch(0.145 0 0)` — noir | `oklch(0.985 0 0)` — blanc |
| `--card` | `oklch(1 0 0)` — blanc | `oklch(0.205 0 0)` — gris fonce |
| `--muted` | `oklch(0.965 0 0)` — gris clair | `oklch(0.269 0 0)` — gris moyen |
| `--border` | `oklch(0.922 0 0)` — gris bordure | `oklch(0.371 0 0)` — gris bordure dark |
| `--primary` | `oklch(0.55 0.15 255)` — bleu MnM | `oklch(0.65 0.15 255)` — bleu clair |
| `--agent` | `oklch(0.55 0.15 290)` — violet | `oklch(0.65 0.15 290)` — violet clair |

### 6.2 Variantes par persona

| Persona | Mode par defaut | Densite | Sidebar | Contenu prioritaire |
|---------|----------------|---------|---------|-------------------|
| **CEO** | Light | Aere (gap 24px) | Minimale (2-3 items) | Cartes KPI, chat |
| **CTO** | Dark | Dense (gap 12px) | Complete (7+ items) | Graphiques, metriques |
| **Dev** | Dark | Dense (gap 12px) | Moyenne (4-5 items) | Code, chat agent |
| **PO** | Light | Moyen (gap 16px) | Moyenne (4-5 items) | Kanban, chat |
| **PM** | Light | Moyen (gap 16px) | Moyenne (4-5 items) | Brainstorm, roadmap |
| **Lead Tech** | Dark | Dense (gap 12px) | Complete (7+ items) | Reviews, dette tech |
| **QA** | Dark | Dense (gap 12px) | Moyenne (4-5 items) | Tests, couverture |

### 6.3 Tokens par mode d'interaction (5 modes)

| Mode | Fond dominant | Composants cles | Densité |
|------|--------------|-----------------|---------|
| **ORAL** | Light, epure | ChatPanel (plein ecran), MessageBubble | Minimale |
| **VISUEL** | Dark, graphiques | MetricWidget, Chart, DashboardCard | Dense |
| **CODE** | Dark, monospace | Editor, Terminal, SplitView, DiffViewer | Maximale |
| **BOARD** | Light ou dark | Kanban, StoryCard, Burndown | Moyenne |
| **TEST** | Dark | TestSuite, CoverageReport, BugList | Dense |

### 6.4 Mapping mode par defaut -> persona

```
CEO   -> ORAL + VISUEL (light)
CTO   -> VISUEL + CODE (dark)
Dev   -> CODE + BOARD (dark)
PO    -> BOARD + ORAL (light)
PM    -> ORAL + BOARD (light)
Lead  -> CODE + VISUEL + BOARD (dark)
QA    -> TEST + CODE (dark)
DPO   -> BOARD + VISUEL (light)
DSI   -> VISUEL + ORAL (light)
```

L'utilisateur peut toujours override : switch dark/light dans le header, activation/desactivation de modes dans les preferences.

---

## 7. Accessibility requirements par story (WCAG 2.1 AA)

### 7.1 Requirements transverses (toutes les stories)

| Critere WCAG | Exigence | Implementation |
|-------------|----------|----------------|
| 1.1.1 Non-text Content | Toutes les icones ont un `aria-label` | Lucide icons + aria-label |
| 1.3.1 Info and Relationships | Structure semantique : headings, landmarks, tables | HTML5 semantique + aria-landmarks |
| 1.4.3 Contrast Minimum | 4.5:1 texte normal, 3:1 grand texte | Design tokens valides axe-core |
| 1.4.11 Non-text Contrast | 3:1 pour composants UI et graphiques | Bordures et focus visible |
| 2.1.1 Keyboard | Navigation complete au clavier | Tab, Shift+Tab, Enter, Escape, fleches |
| 2.4.3 Focus Order | Ordre de focus logique | tabindex naturel, pas de tabindex > 0 |
| 2.4.7 Focus Visible | Outline 2px `--ring` sur tous les elements | `focus-visible:ring-2` Tailwind |
| 4.1.2 Name Role Value | Composants ARIA complets | Radix UI (base shadcn/ui) |

### 7.2 Requirements specifiques par epic

#### FR-MU : Multi-User
- **Table Membres** : `role="table"`, headers avec `scope="col"`, tri annonce par `aria-sort`
- **Modal Invitation** : focus trap, `aria-modal="true"`, Escape ferme la modale
- **Company Selector** : `role="listbox"`, `aria-activedescendant` pour la selection

#### FR-RBAC : Permissions
- **Matrice Permissions** : `role="grid"`, navigation fleches, `aria-checked` sur checkboxes
- **Badges Role** : `aria-label` descriptif ("Role: Admin"), pas seulement la couleur
- **Page 403** : `role="alert"`, lien de retour focusable, message explicite

#### FR-ORCH : Orchestrateur
- **Pipeline Workflow** : `role="progressbar"`, `aria-valuenow` pour l'etape active, `aria-valuemax` pour le total
- **Drift Alert** : `role="alert"`, `aria-live="assertive"` pour les alertes critiques
- **Pulsation etape** : Respecte `prefers-reduced-motion` — remplacee par indicateur statique

#### FR-OBS : Observabilite
- **Dashboard KPIs** : Chaque carte a un `aria-label` descriptif ("Agents actifs : 12, hausse de 15%")
- **Graphiques** : Alternative textuelle avec les donnees cles, pas juste une image
- **Audit Log** : Table avec pagination annoncee (`aria-live="polite"` sur le compteur)

#### FR-CHAT : Chat Temps Reel
- **Messages** : `role="log"`, `aria-live="polite"` pour les nouveaux messages
- **Indicateur frappe** : `aria-label="L'agent est en train d'ecrire"`, pas seulement l'animation
- **Connexion WebSocket** : `aria-live="assertive"` pour les changements de statut connexion
- **Chat read-only** : `aria-readonly="true"`, message explicite pour les screen readers

#### FR-DUAL : Curseur Automatisation
- **Slider** : `role="slider"`, `aria-valuemin/max/now`, `aria-valuetext` ("Position : Assiste")
- **Zone bloquee** : `aria-disabled="true"` + `aria-describedby` expliquant le plafond
- **Niveaux** : Tabpanel avec `aria-labelledby` pour chaque onglet

#### FR-ONB : Onboarding
- **Chat** : Meme accessibilite que FR-CHAT
- **Organigramme** : `role="tree"`, `aria-expanded` sur les noeuds, navigation fleches
- **Progress** : `role="progressbar"` avec `aria-valuenow`

#### FR-CONT : Containerisation
- **Jauges CPU/RAM** : `role="meter"`, `aria-valuenow`, `aria-valuetext` ("CPU : 34%, normal")
- **Statut container** : Triple encodage obligatoire (couleur + icone + texte)

### 7.3 Tests accessibilite prevus

| Test | Outil | Frequence | Critere de succes |
|------|-------|-----------|-------------------|
| Audit automatise | axe-core dans CI | Chaque PR | 0 erreur critique |
| Score Lighthouse | Lighthouse CI | Chaque PR | Accessibility >= 90 |
| Navigation clavier | Manuel (QA) | Chaque sprint | Tous les flows navigables sans souris |
| Screen reader | NVDA / VoiceOver | Chaque phase | 7 smoke tests annonces correctement |
| Contraste | axe-core + manuel | Chaque PR | 4.5:1 texte, 3:1 UI |
| Motion | `prefers-reduced-motion` | Chaque sprint | Animations desactivees proprement |

---

## 8. Mapping stories vers pages/ecrans

### 8.1 Vue synthetique

| Page/Ecran | URL | Stories concernees | Persona primaire |
|-----------|-----|-------------------|-----------------|
| **Dashboard Executif** | `/dashboard` | REQ-OBS-03 | CEO, DSI |
| **Dashboard Technique** | `/dashboard` (variant CTO) | REQ-OBS-03, REQ-CONT-06 | CTO, Lead Tech |
| **Page Membres** | `/settings/members` | REQ-MU-02, REQ-MU-03, REQ-RBAC-08 | Admin |
| **Matrice Permissions** | `/settings/roles` | REQ-RBAC-02, REQ-RBAC-07 | Admin |
| **Board Personnel** | `/board` | REQ-CHAT-02 (context) | Dev, PO |
| **Detail Story** | `/projects/:id/stories/:id` | REQ-CHAT-02, REQ-ORCH-01 | Dev, PO |
| **Split View Code+Chat** | `/projects/:id/stories/:id/agent` | REQ-CHAT-01, REQ-CHAT-02, REQ-ORCH-01 | Dev |
| **Editeur Workflow** | `/workflows/:id/edit` | REQ-ORCH-08 | CTO |
| **Pipeline Workflow** | `/workflows/:id` | REQ-ORCH-01, REQ-ORCH-02, REQ-ORCH-05 | CTO, Dev |
| **Audit Log** | `/audit` | REQ-OBS-02, REQ-OBS-05 | Admin, CTO |
| **Chat Onboarding** | `/onboarding/chat` | REQ-ONB-01 | CEO |
| **Organigramme** | `/onboarding/org` | REQ-ONB-02 | CEO |
| **Import Wizard** | `/onboarding/import` | REQ-ONB-03 | CTO, Admin |
| **Preferences** | `/settings/preferences` | REQ-DUAL-01, REQ-DUAL-02 | Tous |
| **Config SSO** | `/settings/security/sso` | PRD 4.2 etape 2 | CTO, Admin |
| **Config Credentials** | `/settings/security/credentials` | REQ-CONT-02 | CTO, Admin |
| **Page Profil** | `/profile` | REQ-MU (implicite) | Tous |
| **Page 403** | `/403` | REQ-RBAC-06 | Tous (quand refuse) |
| **Command Palette** | Overlay (Ctrl+K) | REQ-RBAC-06 (filtrage) | Tous |

### 8.2 Navigation par persona

```
CEO:
  /dashboard (executif) -> /onboarding/chat -> /onboarding/org -> /dashboard

CTO:
  /dashboard (technique) -> /workflows/:id/edit -> /workflows/:id
  -> /settings/security/sso -> /audit

Dev:
  /board -> /projects/:id/stories/:id -> /projects/:id/stories/:id/agent
  -> (split view code+chat)

PO:
  /board -> /projects/:id/stories/:id -> chat decomposition
  -> validation DoR

PM:
  /chat (brainstorm) -> /projects/:id/epics/:id -> /roadmap

Admin:
  /settings/members -> /settings/roles -> /audit
  -> /settings/security/sso -> /settings/security/credentials
```

### 8.3 Matrice page x composant custom

| Page | WorkflowPipeline | ChatPanel | DriftAlert | AutomationCursor | OrgChart | MetricWidget |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard Executif | - | Mini | - | - | - | Oui |
| Dashboard Technique | Oui | - | Oui | - | - | Oui |
| Board | - | Mini | - | - | - | - |
| Split View | Barre statut | Oui | - | - | - | - |
| Editeur Workflow | Oui | - | - | - | - | - |
| Audit Log | - | - | - | - | - | - |
| Onboarding | - | Oui | - | - | Oui | - |
| Preferences | - | - | - | Oui | - | - |
| Container Status | - | - | - | - | - | Oui |

---

## Synthese et recommandations

### Priorite de developpement UX

1. **Sprint 0** (prerequis) : Design tokens, composants de base (Button, Card, Badge, Dialog, Table), Sidebar adaptee, Header avec Company Selector
2. **Phase 1** (P0) : Page Membres, Modal Invitation, Sign-out, NavigationGuard, Badges role
3. **Phase 2** (P0-P1) : Matrice Permissions, Pipeline Workflow, ChatPanel, Drift Detection basique
4. **Phase 3** (P1) : Curseur Automatisation v1, Dashboards CEO/CTO, Audit Log
5. **Phase 4** (P1-P2) : Onboarding Cascade, Import Wizard, Editeur Workflow, Containerisation UI

### Composants a prototyper en priorite

1. **WorkflowPipeline** — C'est le composant central de MnM, visible partout
2. **ChatPanel** — Le plus ambitieux techniquement (WebSocket bidirectionnel)
3. **AutomationCursor** — L'innovation UX qui differencie MnM
4. **DriftAlert** — Depend du WorkflowPipeline, critique pour la valeur CTO

### Metriques UX a suivre

| Metrique | Cible | Methode |
|----------|-------|---------|
| Time-to-first-action | < 2 min apres login | Analytics |
| Completion onboarding | > 70% | Funnel tracking |
| Lighthouse Accessibility | >= 90 | CI automatise |
| Interruption agent reussie | 100% | Test E2E |
| Latence feedback visuel | < 200ms | Performance monitoring |

---

*Sprint Section 6 — Sally la Designer — ~4200 mots — Requirements UX complets par epic, wireframes ASCII, composants, flows, accessibilite, mapping stories-ecrans.*
