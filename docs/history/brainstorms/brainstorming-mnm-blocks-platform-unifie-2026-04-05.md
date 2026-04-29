# Brainstorming Unifie — MnM Blocks Platform

> **Date** : 5 avril 2026
> **Participants** : Tom (direction produit), Claude (architecture)
> **Statut** : Brainstorming unifie — REMPLACE les 2 brainstormings precedents
> **Annule et remplace** :
> - `brainstorming-view-presets-dashboard-par-persona-2026-04-04.md` (archi View Presets conservee, enrichie)
> - `brainstorming-json-render-agent-content-engine-2026-04-05.md` (fusionne ici)

---

## 1. Les 4 features (Tom)

> **F1** — Les admin definissent chaque page/vue accessible par role. Un PO ne voit pas les memes choses qu'un dev ou un DSI.
>
> **F2** — Le Dashboard a des widgets customisables. Dashboards predefinis par l'admin pour chaque role, mais les utilisateurs peuvent les customiser avec des widgets pre-configures pour leur role, ou en creer des customs avec un agent general (comme le CAO) qui connait le role, les permissions, les tags de l'utilisateur, lui explique tous les acces et features et endpoints auxquels il a acces, et qui permet de lui faire vraiment le dashboard de ses reves. Parce que beaucoup de PO/PM font des apps sur Vercel branchees a Jira/ClickUp pour faire ce qu'ils veulent mais c'est hyper mauvais.
>
> **F3** — Les agents peuvent repondre dans les issues avec des formulaires plus complets s'ils veulent demander des trucs aux users.
>
> **F4** — Les agents peuvent envoyer dans l'inbox des utilisateurs (notifs) des formulaires ou des trucs avec des boutons d'actions custom pour permettre aux utilisateurs d'actionner des choses bien plus facilement.

---

## 2. Etat des lieux

### Ce qui existe

| Surface | Aujourd'hui | Limitation |
|---|---|---|
| **Sidebar** | ~25 items hardcodes, permission-based (show/hide), 2 sections (Work, Company) | Meme ordre pour tout le monde. Pas de priorite par role |
| **Dashboard** | 5 MetricCards + 4 charts + KPI enterprise + timeline + recent activity/issues. Tout hardcode | Zero customisation. Un PO et un DSI voient exactement la meme chose |
| **Issues** | Commentaires en markdown (`body TEXT`). Agents postent du texte brut | Pas de structure, pas de formulaire, pas d'action |
| **Inbox** | Categories (issues, approvals, failed_runs, stale_work). 2 types d'approbation hardcodes | Chaque type d'approbation = renderer React hardcode. Pas d'actions custom |
| **CAO** | Auto-cree, adapter `claude_local`, admin sandbox, watchdog (auto-comments on failures), @mention interactif | Ne sait pas generer de UI. Commente en texte brut. Pas de connaissance du role/permissions de l'utilisateur qui demande |
| **Composants shadcn/ui** | 23 composants (avatar, badge, button, card, checkbox, dialog, input, select, tabs, etc.) | — |

### Le vrai probleme

**Les PO/PM font des apps sur Vercel branchees a Jira/ClickUp.** Pourquoi ? Parce que les outils generiques leur montrent trop de bruit et pas assez de signal. Ils veulent des vues sur mesure pour leur role, leur equipe, leurs projets. MnM a le meme probleme : un dashboard unique pour tous.

La solution n'est pas juste "montrer/cacher des items" (permission-based). C'est **construire des experiences sur mesure par persona, avec la possibilite de creer des vues IA-generees**.

---

## 3. Techniques de brainstorming

1. **Mind Mapping** — Les 4 features et leurs interactions
2. **Starbursting** — Questions fondamentales pour chaque feature
3. **SCAMPER** — Transformer l'existant
4. **Reverse Brainstorming** — Comment garantir l'echec

---

## 4. Mind Mapping

```
                            MnM Blocks Platform
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       │                            │                            │
  F1: VUES PAR ROLE           F2: DASHBOARD              F3+F4: AGENT BLOCKS
  (View Presets)              INTELLIGENT               (Issues + Inbox)
       │                            │                            │
       ├─ Sidebar                    ├─ Predefined widgets        ├─ Issue comment blocks
       │   ├─ Sections par role     │   ├─ Admin assigne par role│   ├─ Formulaires
       │   ├─ Ordre custom          │   ├─ KPI, charts, panels  │   ├─ Tableaux de donnees
       │   └─ Items caches          │   └─ Widget Registry       │   ├─ Metriques
       │                            │                            │   └─ Boutons d'action
       ├─ Pages visibles            ├─ User customization        │
       │   ├─ Routes accessibles    │   ├─ Add/remove widgets    ├─ Inbox blocks
       │   └─ Landing page          │   ├─ Reorder              │   ├─ Rich notifications
       │                            │   └─ Resize               │   ├─ Action buttons
       └─ Preset → Role (M:1)      │                            │   ├─ Quick forms
                                    ├─ AI-generated widgets      │   └─ Inline approval
                                    │   ├─ CAO genere le widget  │
                                    │   ├─ json-render rendu     ├─ Catalogue Zod
                                    │   ├─ Prompt: role+perms    │   ├─ MetricCard
                                    │   │  +tags+endpoints       │   ├─ DataTable
                                    │   ├─ Stocke en JSONB       │   ├─ QuickForm
                                    │   └─ Editable apres        │   ├─ ActionButton
                                    │                            │   ├─ StatusBadge
                                    └─ HYBRID rendering          │   ├─ ProgressBar
                                        ├─ Predefined = React    │   ├─ CodeBlock
                                        │   component direct     │   ├─ Markdown
                                        └─ Custom = json-render  │   └─ Chart
                                            blocks               │
                                                                 └─ Action system
                                                                     ├─ Generic handler
                                                                     ├─ API call
                                                                     ├─ Reply to agent
                                                                     └─ Mutation + invalidate
```

### Interaction entre les 3 piliers

```
F1 (View Presets)                 F2 (Dashboard)                   F3+F4 (Agent Blocks)
     │                                 │                                 │
     │  "Quelles pages tu vois"        │  "Quel dashboard tu vois"       │  "Quel contenu l'agent produit"
     │                                 │                                 │
     │  Table: view_presets            │  Predefined: widget dans        │  JSONB: content_blocks sur
     │  + roles.view_preset_id         │  le layout du View Preset       │  issue_comments, inbox items
     │  + layout_overrides             │  Custom: blocks JSONB dans      │
     │                                 │  user_dashboard_widgets         │  Renderer: <BlockRenderer>
     │  Renderer: Sidebar/Router       │                                 │  via json-render
     │  (pas de json-render)           │  Renderer: HYBRIDE              │
     │                                 │  - Predefined → Widget          │
     └─────────────┬───────────────────│    Registry (React direct)      │
                   │                   │  - Custom → <BlockRenderer>     │
                   │                   │    via json-render               │
                   │                   │                                 │
                   └───────────────────┴────────────┬────────────────────┘
                                                    │
                                              json-render
                                           (catalogue Zod unifie)
                                           (utilise pour F2 custom + F3 + F4)
```

**Insight cle :** json-render n'est PAS utilise pour F1 (View Presets — c'est du layout statique). json-render est le moteur pour F2 (widgets custom IA-generes), F3 (forms dans issues) et F4 (actions dans inbox). Un seul catalogue Zod, un seul `<BlockRenderer>`, trois surfaces.

---

## 5. Starbursting — Questions fondamentales

### F1 : Vues par role

| Question | Reponse |
|---|---|
| **Qui** configure les vues ? | L'admin, dans une page `/admin/view-presets` |
| **Quoi** exactement est configurable ? | Sidebar (sections, ordre, items), landing page, pages visibles |
| **Ou** est stockee la config ? | Table `view_presets` (layout JSONB) + `roles.view_preset_id` |
| **Quand** est-ce applique ? | Au login (landing page) + en continu (sidebar) |
| **Pourquoi** pas juste les permissions ? | Permissions = peut/peut pas. View Presets = priorite, ordre, experience. Un PO PEUT voir les issues mais c'est pas sa priorite — il veut le chat d'abord |
| **Comment** fallback si pas de preset ? | `DEFAULT_LAYOUT` constant = le layout actuel hardcode |

### F2 : Dashboard intelligent

| Question | Reponse |
|---|---|
| **Qui** cree les widgets ? | Admin (predefinis par role) + User (drag-and-drop) + CAO (genere sur demande) |
| **Quoi** est un widget ? | Soit un composant React predefini (KPI bar, chart), soit un document json-render (custom AI) |
| **Ou** sont stockes les widgets custom ? | `user_dashboard_widgets` table (blocks JSONB + position) |
| **Quand** le CAO intervient ? | Quand l'utilisateur demande : "je veux voir X" dans le chat CAO |
| **Pourquoi** pas tout en json-render ? | Les widgets predefinis (KPI bar, charts) sont plus performants en React direct. Le hybrid = best of both |
| **Comment** le CAO sait quoi generer ? | Son prompt inclut : role, permissions, tags, endpoints accessibles, catalogue de blocks Zod. Il genere des blocks valides |

### F3 : Agent forms dans les issues

| Question | Reponse |
|---|---|
| **Qui** genere les formulaires ? | Les agents, quand ils ont besoin d'une reponse structuree de l'utilisateur |
| **Quoi** comme formulaires ? | QuickForm (champs type/select/checkbox) + ActionButton (choix rapide) + DataTable (contexte) |
| **Ou** est stocke le contenu ? | `issue_comments.content_blocks` JSONB (a cote de `body` TEXT existant) |
| **Quand** l'agent genere un form ? | Quand il a besoin d'une decision, d'un input, d'une validation. Au lieu de poser une question texte |
| **Pourquoi** pas juste du markdown ? | "Quelle approche preferes-tu ? A, B ou C" → l'utilisateur doit lire, comprendre, taper une reponse. Avec des boutons → 1 clic |
| **Comment** la reponse revient a l'agent ? | L'action handler poste un commentaire structure sur l'issue avec les donnees du formulaire. L'agent le recoit via son contexte au prochain run |

### F4 : Agent notifications interactives dans l'inbox

| Question | Reponse |
|---|---|
| **Qui** envoie ? | Les agents (via API ou automatiquement via workflows) |
| **Quoi** ? | Notifications enrichies : MetricCards + ActionButtons + QuickForms (pas juste "Run failed") |
| **Ou** ? | Colonne `content_blocks` JSONB sur la structure inbox (ou table dediee `inbox_items`) |
| **Quand** ? | Run failure + reporting + demande d'action + alertes custom |
| **Pourquoi** pas juste une notif texte + lien ? | Parce que cliquer un lien → ouvrir une page → lire → decider → agir = 5 steps. Un bouton inline dans l'inbox = 1 step |
| **Comment** les actions fonctionnent ? | Meme action handler que F3. L'action peut approuver, rejeter, assigner, relancer, ou repondre a l'agent |

---

## 6. SCAMPER — Transformer l'existant

### Substitute

| Actuel | Substitution |
|---|---|
| Sidebar hardcodee (25 items, 2 sections) | Sidebar data-driven depuis `view_presets.layout.sidebar` |
| Dashboard unique pour tous | Dashboard hybrid : widgets predefinis (admin/role) + widgets custom (json-render/CAO) |
| `body TEXT` dans les commentaires agent | `body TEXT` + `content_blocks JSONB` — les deux coexistent |
| `ApprovalPayload.tsx` (2 renderers hardcodes) | `<BlockRenderer>` generique — l'agent genere le rendu d'approbation |
| CAO qui commente en texte brut | CAO qui genere des blocks structures (metriques, boutons, formulaires) |
| "Failed run" = une ligne de texte dans l'inbox | "Failed run" = MetricCard (erreur) + CodeBlock (stderr) + ActionButton (Retry/Assign/Dismiss) |

### Combine

1. **View Presets + Dashboard config** → Le dashboard fait partie du View Preset. Le `layout.dashboard.widgets` dans le preset definit les widgets predefinis. Les widgets custom AI-generes sont SEPARES (stockes par utilisateur)
2. **Approvals + Agent Forms** → Les approbations ne sont qu'un type particulier de formulaire agent. Un `QuickForm` avec `submitAction: "approve"` EST une approbation
3. **Inbox + Issues blocks** → Meme catalogue Zod, meme `<BlockRenderer>`, meme action handler. Seul le contexte change (inbox item vs issue comment)
4. **CAO watchdog + CAO dashboard builder** → Le CAO est deja l'agent omniscient de MnM. Il ajoute juste une nouvelle capability : generer des widgets dashboard

### Adapt

1. **Adapter le catalogue Zod pour le prompt CAO** — Le schema est auto-descriptif. On le serialise en JSON Schema, on l'injecte dans le system prompt du CAO. Le CAO sait qu'il peut generer un `MetricCard`, un `Chart`, un `DataTable`, et il connait les API endpoints pour alimenter ces widgets
2. **Adapter le WebSocket existant** (`/events/ws`) pour pousser les blocks inbox en temps reel. Quand un agent poste un block dans l'inbox → SSE → l'inbox se met a jour sans refresh
3. **Adapter les permissions existantes** — Les blocks interactifs (ActionButton) portent une `permission` optionnelle. Si l'utilisateur n'a pas la permission, le bouton est desactive. Le systeme RBAC existant est reutilise tel quel

### Modify

1. **Modifier `Dashboard.tsx`** — Au lieu d'un grid hardcode, un grid hybrid : widgets predefinis du View Preset (React components) + widgets custom de l'utilisateur (json-render blocks) dans un seul layout unifi e
2. **Modifier `Inbox.tsx`** — Les items inbox peuvent avoir des `content_blocks`. Si presents → rendre avec `<BlockRenderer>`. Sinon → rendu actuel (texte + lien)
3. **Modifier `CommentThread.tsx`** — Les commentaires avec `content_blocks` sont rendus avec `<BlockRenderer>` au lieu de `<MarkdownBody>`
4. **Modifier le CAO** — Ajouter au prompt : "Tu peux generer des widgets dashboard pour les utilisateurs. Voici le catalogue de composants : [schema Zod]. Voici les endpoints API disponibles pour cet utilisateur : [liste filtree par role/permissions/tags]"

### Put to other uses

1. **Le catalogue Zod = documentation interactive des agents** — Chaque agent sait quels composants il peut utiliser, avec quels props. C'est un protocole standardise pour TOUS les agents, pas juste le CAO
2. **Les widgets custom = mini-apps** — Un PO qui demande au CAO "je veux voir le burn-down de mes sprints avec les issues assignees a mon equipe" recoit un widget qui fait exactement ca. Plus besoin d'app Vercel branchee a Jira
3. **Les blocks dans les issues = rapports automatises** — Un agent de CI/CD poste un rapport de deploiement avec metriques + diff + bouton rollback
4. **Les blocks inbox = orchestration humaine** — Un workflow multi-step ou chaque etape envoie un formulaire dans l'inbox de la personne suivante

### Eliminate

1. **Eliminer `ApprovalPayload.tsx`** et ses renderers hardcodes par type — remplace par `<BlockRenderer>`
2. **Eliminer le concept d'`approval_type` enum** — chaque approbation est un document blocks unique genere par l'agent
3. **Eliminer les apps Vercel parasites** des PO/PM — MnM devient l'outil ou ils construisent leurs vues custom
4. **Eliminer le texte brut comme seul format de communication agent → humain** — les blocks sont le nouveau standard (avec fallback markdown)

### Reverse

1. **Au lieu que le dev code chaque type de notification, l'agent genere le rendu** — nouveau type de notif = zero code
2. **Au lieu que le PO construise une app externe, le CAO lui construit un widget** — meme data, dans MnM directement
3. **Au lieu que l'utilisateur s'adapte au dashboard, le dashboard s'adapte a l'utilisateur** — via les presets role + custom AI

---

## 7. Reverse Brainstorming — Comment garantir l'echec

### Anti-patterns et leurs inverses

| # | Comment echouer | Insight (inverse) |
|---|---|---|
| 1 | **Tout mettre dans json-render** — sidebar, routing, dashboard, tout. Usine a gaz | → json-render UNIQUEMENT pour le contenu dynamique (widgets custom, forms, notifs). Les View Presets (sidebar, routing) restent du JSON simple + React statique |
| 2 | **Le CAO genere n'importe quoi** — pas de contrainte, JSON libre, hallucinations | → Catalogue Zod OBLIGATOIRE. Validation serveur avant stockage. Le CAO ne peut generer QUE des composants du catalogue. Le schema EST le contrat |
| 3 | **Les widgets custom ne marchent jamais** — trop lent, trop complexe, personne les utilise | → Fournir des templates de widgets (les plus demandes par les PO/PM). Le CAO propose des suggestions avant de generer. "Tu veux un burn-down ? Un velocity chart ? Un backlog heatmap ?" |
| 4 | **Les formulaires sont ignores** — les utilisateurs ne remplissent pas les forms dans les issues | → Les forms doivent etre COURTS (2-3 champs max, 1 clic pour les choix). Le format par defaut est le ActionButton (choix binaire), pas le QuickForm (formulaire complet) |
| 5 | **Les notifs inbox sont du spam** — 50 notifs avec des boutons, personne ne lit | → Rate limiting. Les agents ont un budget de notifs/jour. Les notifs avec actions sont PRIORITAIRES (au dessus des notifs texte). Grouping par agent |
| 6 | **Le dashboard custom est une usine a gaz** — 15 etapes pour ajouter un widget | → Le CAO fait tout. L'utilisateur dit "je veux voir mes issues par priorite" et le widget apparait. Pas d'editeur drag-and-drop complexe en v1 |
| 7 | **Les widgets custom ne se rafraichissent pas** — donnees figees au moment de la generation | → Chaque widget custom a un `dataSource` (endpoint API + params). Le widget re-fetch les donnees periodiquement (ou via SSE). Le CAO configure le refresh |
| 8 | **Migration big bang** — on casse le dashboard actuel | → Les 5 MetricCards + 4 charts actuels deviennent les widgets predefinis du preset "Default". Zero changement visible pour les utilisateurs existants |
| 9 | **Les agents ne savent pas generer des blocks** — trop complique, pas dans leur training | → Le catalogue est PETIT (12 composants). Le prompt est SIMPLE ("Voici les composants disponibles, utilise-les"). Les LLM sont excellents pour generer du JSON structure |
| 10 | **Pas de fallback** — si json-render crash, tout crash | → `<ContentRenderer>` detecte le format. Si `content_blocks` invalide ou absent → `<MarkdownBody>` sur `body`. Double colonne toujours presente |

---

## 8. Synthese des idees — 42 idees, 6 categories

### Categorie 1 : View Presets — F1 (8 idees)

*(Conserve du brainstorming #1, inchange)*

1. **Table `view_presets`** — layout JSONB par preset (sidebar sections, landing page)
2. **`roles.view_preset_id`** — FK role → preset (M:1)
3. **`company_memberships.layout_overrides`** — overrides perso par utilisateur
4. **`NAV_ITEM_REGISTRY`** — map statique { id → icon, route, permission } (26 items)
5. **`resolveLayout()`** — merge preset + overrides + permission filter (3 couches)
6. **`useViewPreset()` hook** — GET /my-view, cache 60s, resolve layout
7. **Sidebar dynamique** — sections from layout, items from registry, permission-filtered
8. **Landing page dynamique** — redirect apres login selon le role

### Categorie 2 : Dashboard hybrid — F2 (12 idees)

9. **`view_presets.layout.dashboard.widgets[]`** — les widgets predefinis par role (partie du View Preset)
10. **`WIDGET_REGISTRY`** — map statique { type → React Component, defaultSpan } pour les widgets predefinis
11. **Table `user_widgets`** — widgets custom AI-generes par utilisateur

```sql
CREATE TABLE user_widgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  user_id       TEXT NOT NULL,
  title         TEXT NOT NULL,
  blocks        JSONB NOT NULL,           -- json-render blocks
  data_source   JSONB,                    -- { endpoint, params, refreshInterval }
  position      INTEGER NOT NULL DEFAULT 0,
  span          INTEGER NOT NULL DEFAULT 2,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

12. **Dashboard grid hybrid** — rendu en 2 passes : d'abord les widgets predefinis (Widget Registry), puis les widgets custom (BlockRenderer)
13. **CAO comme "Dashboard Builder"** — nouvelle capability du CAO : generer des widgets sur demande via le chat
14. **Prompt CAO enrichi** — le CAO recoit dans son contexte : le role de l'utilisateur, ses permissions, ses tags, la liste des endpoints API accessibles (filtree), le catalogue de blocks Zod
15. **Widget templates** — des templates pre-faits que le CAO peut proposer : "burn-down", "velocity", "backlog by assignee", "cost tracking", etc.
16. **Widget data refresh** — chaque widget custom a un `data_source` avec un endpoint API et un refresh interval. Le frontend re-fetch periodiquement (ou via SSE pour les donnees live)
17. **Widget sharing** — un utilisateur peut "partager" un widget custom. Ca cree un template que d'autres peuvent ajouter a leur dashboard
18. **"Ajouter un widget" UI** — un bouton "+" en bas du dashboard. Deux options : (a) choisir parmi les templates, (b) demander au CAO
19. **Widget edit** — chaque widget custom a un bouton "edit" qui ouvre le chat avec le CAO, pre-rempli avec le contexte du widget. L'utilisateur peut demander des ajustements
20. **User widget reorder** — drag-and-drop simple (ou fleches up/down) pour reordonner les widgets. Position stockee dans `user_widgets.position`

### Categorie 3 : Agent blocks dans les issues — F3 (7 idees)

21. **`issue_comments.content_blocks` JSONB** — colonne optionnelle a cote de `body TEXT`
22. **`<ContentRenderer>`** — detecte le format (blocks vs markdown) et route vers `<BlockRenderer>` ou `<MarkdownBody>`
23. **Agent form response flow** — quand l'utilisateur soumet un QuickForm dans un commentaire, la reponse est postee comme un nouveau commentaire structure sur l'issue. L'agent le recoit via son contexte au prochain run
24. **Inline action dans les issues** — ActionButton dans un commentaire = API call direct (approve, assign, change priority, etc.) sans quitter la page
25. **Rapport de run structure** — quand un agent termine un run, il peut poster un rapport structure (metriques, diff, tests) au lieu de texte brut
26. **Code review blocks** — un agent de review poste un DataTable (fichiers changes, risques, suggestions) avec des ActionButton (approve, request changes)
27. **Multi-step workflow dans les issues** — un agent pose une question (QuickForm), recoit la reponse, pose une autre question. Chaque step est un commentaire block

### Categorie 4 : Agent blocks dans l'inbox — F4 (7 idees)

28. **Table `inbox_items`** — nouvelle table dediee (ou extension de l'existant)

```sql
CREATE TABLE inbox_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  recipient_id  TEXT NOT NULL,            -- user who receives the notification
  sender_agent_id UUID REFERENCES agents(id),
  title         TEXT NOT NULL,
  content_blocks JSONB,                   -- json-render blocks (optional)
  body          TEXT,                     -- markdown fallback
  category      TEXT NOT NULL DEFAULT 'notification',
  priority      TEXT NOT NULL DEFAULT 'normal',
  status        TEXT NOT NULL DEFAULT 'unread',
  action_taken  JSONB,                   -- { action, payload, timestamp } when user acts
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

29. **Rich failed run notification** — au lieu de "Agent X failed: timeout", on envoie : StatusBadge (error) + CodeBlock (stderr extract) + Stack { ActionButton(Retry), ActionButton(Assign), ActionButton(Dismiss) }
30. **Approval as inbox block** — les approbations deviennent des inbox items avec un QuickForm en footer. Plus de page ApprovalDetail separee — tout se fait inline
31. **Daily digest block** — un agent (ou le CAO) envoie un digest quotidien : MetricCards (stats du jour) + DataTable (issues a traiter) + ActionButton (voir details)
32. **Alert avec action** — un monitoring agent detecte une anomalie → envoie un inbox item avec le contexte (Chart, MetricCard) et les actions (Investigate, Dismiss, Escalate)
33. **Action result feedback** — quand l'utilisateur clique un ActionButton dans l'inbox, le status de l'item passe a "actioned" et le resultat est affiche inline (success badge, error message)
34. **Inbox item expiration** — les items avec des actions urgentes peuvent avoir un `expires_at`. Apres expiration, les actions sont desactivees et l'item est archive

### Categorie 5 : Catalogue de blocks Zod (catalogue unifie) (5 idees)

35. **12 composants v1** — MetricCard, StatusBadge, DataTable, CodeBlock, ProgressBar, Markdown, ActionButton, QuickForm, Chart, Stack, Section, Divider
36. **Composants extensibles** — le catalogue peut etre enrichi sans breaking change (discriminated union Zod)
37. **Schema versionne** — `{ schemaVersion: 1, blocks: [...] }`. Le renderer sait gerer les v1, v2, etc.
38. **Catalogue expose via API** — `GET /block-catalogue` retourne le JSON Schema. Injecte dans les prompts agents
39. **Validation serveur** — tout JSON blocks passe par un validateur Zod serveur-side avant stockage

### Categorie 6 : Action system unifie (3 idees)

40. **Handler generique** — un seul `useBlockActions(context)` qui route toutes les actions (API calls, mutations, reply-to-agent)
41. **Action avec confirmation** — les actions destructives ou importantes affichent un Dialog de confirmation avant execution
42. **Action permissions** — chaque ActionButton peut porter une `permission`. Si l'utilisateur n'a pas la permission → bouton disabled + tooltip explicatif

---

## 9. Insights cles

### Insight 1 : Le CAO est le "Vercel personnel" des PO/PM

**Description :** Le vrai game changer de F2 n'est pas le dashboard customisable — c'est que le **CAO construit des widgets sur demande**. L'utilisateur dit "je veux voir le burn-down de mon sprint" et le CAO genere un widget avec les bonnes donnees, les bons filtres, le bon refresh. C'est exactement ce que les PO/PM font aujourd'hui en construisant des apps Vercel branchees a Jira — sauf que c'est dans MnM, avec un seul prompt.
**Source :** Starbursting F2 (Qui/Comment) + SCAMPER (Reverse)
**Impact :** Very High | **Effort :** Medium
**Pourquoi :** C'est le moat produit. Aucun concurrent ne propose ca. Le PO qui peut construire ses vues custom en parlant a un agent IA ne retourne jamais a Jira+Vercel.

### Insight 2 : json-render pour le contenu dynamique, React statique pour le layout

**Description :** L'erreur serait de tout mettre dans json-render. La separation est claire : **View Presets (F1) = JSON simple + React statique** (sidebar, routing, landing page). **Contenu agent (F2 custom + F3 + F4) = json-render** (widgets IA, formulaires, notifs). Les widgets predefinis du dashboard (F2 predefined) sont des React components classiques via le Widget Registry.
**Source :** Mind Mapping (interaction entre piliers) + Reverse Brainstorming (#1)
**Impact :** High | **Effort :** Low (c'est une decision d'architecture, pas du code)
**Pourquoi :** Evite l'over-engineering. json-render apporte de la valeur la ou le contenu est DYNAMIQUE et IA-genere. Pas la ou c'est de la config admin statique.

### Insight 3 : Les formulaires doivent etre COURTS — ActionButton > QuickForm

**Description :** Le format par defaut pour les interactions agent→humain doit etre le **ActionButton** (1 clic, choix binaire/ternaire), pas le QuickForm (formulaire complet). Les QuickForms sont pour les cas complexes (5%). Si chaque agent envoie des formulaires de 5 champs, les utilisateurs vont les ignorer.
**Source :** Reverse Brainstorming (#4 — formulaires ignores)
**Impact :** High | **Effort :** Very Low (c'est une guideline de design, pas du code)
**Pourquoi :** L'UX de Slack (reactions emoji = 1 clic) bat l'UX de Jira (formulaire de 10 champs). Les agents MnM doivent apprendre la meme lecon.

### Insight 4 : La table `inbox_items` est necessaire — pas juste des colonnes JSONB

**Description :** L'inbox actuelle est un agglomerat de queries (issues touchees, approbations, failed runs, stale work). Il n'y a pas de table `inbox_items`. Pour supporter les blocks et les actions, il faut une vraie table dediee qui stocke les items avec leur `content_blocks`, `action_taken`, `status`, `expires_at`. Les categories actuelles (issues_i_touched, failed_runs) deviennent des SOURCES qui alimentent cette table.
**Source :** Starbursting F4 (Ou est stocke ?) + Mind Mapping (Surface inbox)
**Impact :** High | **Effort :** Medium
**Pourquoi :** Sans table dediee, les blocks et actions inbox sont impossibles. C'est le pre-requis technique de F4.

### Insight 5 : Les widgets custom ont besoin d'un `data_source` — pas juste des blocks statiques

**Description :** Un widget dashboard ne peut pas etre un screenshot JSON fige. Il a besoin de donnees fraiche. Chaque widget custom a un `data_source: { endpoint: "/api/issues", params: { assignee: "me", status: "open" }, refreshInterval: 60 }`. Le frontend re-fetch les donnees et re-rend les blocks avec les nouvelles donnees.
**Source :** Reverse Brainstorming (#7 — donnees figees) + Starbursting F2 (Quand ?)
**Impact :** High | **Effort :** Medium
**Pourquoi :** C'est la difference entre "un widget" et "une image". Le PO veut voir ses issues EN TEMPS REEL, pas un snapshot d'il y a 2 heures.

### Insight 6 : L'action handler unifie est la cle — un seul handler pour F2+F3+F4

**Description :** Les 3 surfaces (dashboard, issues, inbox) partagent le meme systeme d'actions. Un `ActionButton` dans un commentaire issue et un `ActionButton` dans l'inbox utilisent le meme `useBlockActions()`. Les actions sont : API call, reply-to-agent, mutation TanStack. Un seul handler, un seul pattern, zero duplication.
**Source :** Mind Mapping (Action system) + SCAMPER (Combine)
**Impact :** High | **Effort :** Low
**Pourquoi :** Si chaque surface a son propre systeme d'actions, on a 3x la complexite. Un handler unifie = une seule chose a tester, une seule chose a securiser.

---

## 10. Architecture unifiee

### 10.1 Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────────┐
│                           ADMIN                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │  View Presets    │  │  Role → Preset   │  │  Block Catalogue  │   │
│  │  CRUD (F1)      │  │  assignment      │  │  (view schema)    │   │
│  └────────┬────────┘  └────────┬─────────┘  └──────────┬────────┘   │
└───────────┼────────────────────┼────────────────────────┼────────────┘
            │                    │                        │
            ▼                    ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                           DATABASE                                    │
│                                                                       │
│  ┌──────────────┐  ┌───────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ view_presets  │←─│ roles │  │ company_members   │  │ user_      │ │
│  │ (layout JSONB)│  │ (FK)  │  │ (layout_overrides)│  │ widgets    │ │
│  └──────────────┘  └───────┘  └──────────────────┘  │ (blocks    │ │
│                                                      │  JSONB)    │ │
│  ┌──────────────────┐  ┌──────────────────┐         └────────────┘ │
│  │ issue_comments   │  │ inbox_items      │                         │
│  │ + content_blocks │  │ + content_blocks │                         │
│  │   JSONB          │  │ + action_taken   │                         │
│  └──────────────────┘  └──────────────────┘                         │
└──────────────────────────────────────────────────────────────────────┘
            │                                     │
            ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                      │
│                                                                       │
│  F1: useViewPreset()        F2: Dashboard.tsx (hybrid)               │
│   │                          │                                        │
│   ├→ Sidebar (data-driven)   ├→ Predefined widgets                   │
│   │   sections from layout   │   WIDGET_REGISTRY → React component   │
│   │   items from NAV_ITEM_   │                                        │
│   │   REGISTRY               ├→ Custom AI widgets                    │
│   │   permission-filtered    │   user_widgets → <BlockRenderer>      │
│   │                          │   via json-render                      │
│   └→ Landing page redirect   │                                        │
│                              └→ "+ Add widget" → CAO chat             │
│                                                                       │
│  F3: ContentRenderer         F4: InboxItem                           │
│   │  (issues/comments)        │  (inbox_items)                        │
│   │                           │                                       │
│   ├→ content_blocks?          ├→ content_blocks?                     │
│   │   → <BlockRenderer>      │   → <BlockRenderer>                   │
│   │   via json-render         │   via json-render                     │
│   │                           │                                       │
│   └→ else: body              └→ else: title + body                   │
│       → <MarkdownBody>           → texte simple                      │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐          │
│  │              SHARED: <BlockRenderer>                     │          │
│  │                                                          │          │
│  │  json-render engine                                      │          │
│  │  Catalogue Zod (12 composants)                          │          │
│  │  useBlockActions() — handler unifie                     │          │
│  └────────────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          AGENTS                                       │
│                                                                       │
│  System prompt ← catalogue Zod serialise                             │
│                                                                       │
│  Agent genere : { schemaVersion: 1, blocks: [...] }                  │
│  Validation serveur (Zod) avant stockage                             │
│  Si invalide → fallback markdown (body TEXT)                         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────┐             │
│  │  CAO special (F2)                                     │             │
│  │                                                       │             │
│  │  Prompt enrichi:                                      │             │
│  │  - Role + permissions + tags de l'utilisateur         │             │
│  │  - Endpoints API accessibles (filtres)               │             │
│  │  - Catalogue Zod (composants disponibles)            │             │
│  │  - Widget templates (burn-down, velocity, etc.)      │             │
│  │                                                       │             │
│  │  Genere: widget blocks + data_source config          │             │
│  │  Stocke: user_widgets (blocks JSONB)                 │             │
│  └─────────────────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 Data Model complet

```sql
-- ============================================================
-- F1 : VIEW PRESETS (du brainstorming #1, inchange)
-- ============================================================

CREATE TABLE view_presets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  color         TEXT,
  layout        JSONB NOT NULL DEFAULT '{}',
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

ALTER TABLE roles ADD COLUMN view_preset_id UUID REFERENCES view_presets(id);
ALTER TABLE company_memberships ADD COLUMN layout_overrides JSONB;

-- ============================================================
-- F2 : USER WIDGETS (custom AI-generated dashboard widgets)
-- ============================================================

CREATE TABLE user_widgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES companies(id),
  user_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  blocks          JSONB NOT NULL,
  data_source     JSONB,          -- { endpoint, params, refreshInterval }
  position        INTEGER NOT NULL DEFAULT 0,
  span            INTEGER NOT NULL DEFAULT 2,  -- grid span (1-4)
  created_by_agent_id UUID REFERENCES agents(id),  -- which agent created it
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_widgets_user ON user_widgets(company_id, user_id);

-- ============================================================
-- F3 : AGENT BLOCKS DANS LES ISSUES
-- ============================================================

ALTER TABLE issue_comments ADD COLUMN content_blocks JSONB;

-- ============================================================
-- F4 : INBOX ITEMS
-- ============================================================

CREATE TABLE inbox_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id),
  recipient_id      TEXT NOT NULL,
  sender_agent_id   UUID REFERENCES agents(id),
  sender_user_id    TEXT,
  title             TEXT NOT NULL,
  body              TEXT,                   -- markdown fallback
  content_blocks    JSONB,                  -- json-render blocks
  category          TEXT NOT NULL DEFAULT 'notification',
  priority          TEXT NOT NULL DEFAULT 'normal',  -- low, normal, high, urgent
  status            TEXT NOT NULL DEFAULT 'unread',  -- unread, read, actioned, dismissed
  action_taken      JSONB,                  -- { action, payload, timestamp }
  related_issue_id  UUID REFERENCES issues(id),
  related_agent_id  UUID REFERENCES agents(id),
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_items_recipient ON inbox_items(company_id, recipient_id, status);
CREATE INDEX idx_inbox_items_created ON inbox_items(company_id, created_at DESC);
```

**Bilan total :**

| Objet | Type | Feature |
|---|---|---|
| `view_presets` | Nouvelle table | F1 |
| `roles.view_preset_id` | Nouvelle colonne | F1 |
| `company_memberships.layout_overrides` | Nouvelle colonne | F1 |
| `user_widgets` | Nouvelle table | F2 |
| `issue_comments.content_blocks` | Nouvelle colonne | F3 |
| `inbox_items` | Nouvelle table | F4 |

**3 tables + 3 colonnes.** C'est tout.

### 10.3 Catalogue de blocks Zod v1

```typescript
// packages/shared/src/types/content-blocks.ts

import { z } from "zod";

// ─── DISPLAY ─────────────────────────────────────────

export const MetricCard = z.object({
  type: z.literal("metric-card"),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  trend: z.enum(["up", "down", "flat"]).optional(),
  description: z.string().optional(),
});

export const StatusBadge = z.object({
  type: z.literal("status-badge"),
  text: z.string(),
  variant: z.enum(["success", "warning", "error", "info", "neutral"]),
});

export const DataTable = z.object({
  type: z.literal("data-table"),
  title: z.string().optional(),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    align: z.enum(["left", "center", "right"]).optional(),
  })),
  rows: z.array(z.record(z.unknown())),
  maxRows: z.number().optional(),
});

export const CodeBlock = z.object({
  type: z.literal("code-block"),
  language: z.string().optional(),
  code: z.string(),
  title: z.string().optional(),
});

export const ProgressBar = z.object({
  type: z.literal("progress-bar"),
  label: z.string(),
  value: z.number().min(0).max(100),
  variant: z.enum(["default", "success", "warning", "error"]).optional(),
});

export const MarkdownBlock = z.object({
  type: z.literal("markdown"),
  content: z.string(),
});

export const Chart = z.object({
  type: z.literal("chart"),
  chartType: z.enum(["line", "bar", "pie", "donut"]),
  title: z.string().optional(),
  data: z.array(z.object({
    label: z.string(),
    value: z.number(),
    color: z.string().optional(),
  })),
});

export const Divider = z.object({
  type: z.literal("divider"),
});

// ─── INTERACTIVE ─────────────────────────────────────

export const ActionButton = z.object({
  type: z.literal("action-button"),
  label: z.string(),
  action: z.string(),
  payload: z.record(z.unknown()).optional(),
  variant: z.enum(["default", "destructive", "outline", "ghost"]).optional(),
  confirm: z.string().optional(),
  permission: z.string().optional(),
  icon: z.string().optional(),  // lucide icon name
});

export const QuickForm = z.object({
  type: z.literal("quick-form"),
  title: z.string().optional(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "select", "checkbox", "number", "date"]),
    options: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
  })),
  submitLabel: z.string().optional(),
  submitAction: z.string(),
  submitPayload: z.record(z.unknown()).optional(),
});

// ─── LAYOUT ──────────────────────────────────────────

export const Stack: z.ZodType = z.object({
  type: z.literal("stack"),
  direction: z.enum(["horizontal", "vertical"]).optional(),
  gap: z.enum(["sm", "md", "lg"]).optional(),
  children: z.array(z.lazy(() => ContentBlock)),
});

export const Section: z.ZodType = z.object({
  type: z.literal("section"),
  title: z.string().optional(),
  collapsible: z.boolean().optional(),
  children: z.array(z.lazy(() => ContentBlock)),
});

// ─── UNION ───────────────────────────────────────────

export const ContentBlock = z.discriminatedUnion("type", [
  MetricCard, StatusBadge, DataTable, CodeBlock, ProgressBar,
  MarkdownBlock, Chart, Divider,
  ActionButton, QuickForm,
  Stack, Section,
]);

export const ContentDocument = z.object({
  schemaVersion: z.literal(1),
  blocks: z.array(ContentBlock),
});

export type ContentBlock = z.infer<typeof ContentBlock>;
export type ContentDocument = z.infer<typeof ContentDocument>;
```

**14 composants** : 8 display + 2 interactive + 2 layout + 2 utility. Simple, couvre 95% des cas.

### 10.4 Exemples concrets par feature

#### F2 — Widget custom genere par le CAO

**Utilisateur dans le chat :** "CAO, je veux voir le burn-down de mes issues assignees a mon equipe"

**Le CAO genere :**

```json
{
  "widget": {
    "title": "Burn-down — Equipe Product",
    "blocks": {
      "schemaVersion": 1,
      "blocks": [
        { "type": "stack", "direction": "horizontal", "gap": "md", "children": [
          { "type": "metric-card", "label": "Ouvertes", "value": 12, "trend": "down" },
          { "type": "metric-card", "label": "Fermees cette semaine", "value": 8, "trend": "up" },
          { "type": "metric-card", "label": "Velocity", "value": "6.2/jour" }
        ]},
        { "type": "chart", "chartType": "line", "title": "Burn-down 14 jours", "data": [
          { "label": "J-14", "value": 28 }, { "label": "J-12", "value": 25 },
          { "label": "J-10", "value": 22 }, { "label": "J-8", "value": 19 },
          { "label": "J-6", "value": 16 }, { "label": "J-4", "value": 14 },
          { "label": "J-2", "value": 13 }, { "label": "Auj.", "value": 12 }
        ]},
        { "type": "data-table", "title": "Top issues ouvertes", "columns": [
          { "key": "title", "label": "Issue" },
          { "key": "assignee", "label": "Assignee" },
          { "key": "age", "label": "Age", "align": "right" }
        ], "rows": [
          { "title": "Auth SSO SAML", "assignee": "Gab", "age": "5j" },
          { "title": "Webhook retry logic", "assignee": "Tom", "age": "3j" },
          { "title": "Dashboard perf", "assignee": "—", "age": "1j" }
        ], "maxRows": 5 }
      ]
    },
    "data_source": {
      "endpoint": "/api/companies/{companyId}/issues",
      "params": { "assignee_tags": ["team-product"], "status": ["open", "in_progress"] },
      "refreshInterval": 300
    },
    "span": 4
  }
}
```

Le CAO poste le widget → stocke dans `user_widgets` → apparait dans le dashboard.
Le widget se refresh toutes les 5 minutes via `data_source`.

#### F3 — Agent form dans une issue

**Agent CI/CD apres un run :**

```json
{
  "schemaVersion": 1,
  "blocks": [
    { "type": "stack", "direction": "horizontal", "gap": "md", "children": [
      { "type": "metric-card", "label": "Tests", "value": "47/50", "trend": "up" },
      { "type": "metric-card", "label": "Coverage", "value": "82%", "trend": "flat" },
      { "type": "metric-card", "label": "Build", "value": "OK", "description": "3m 12s" }
    ]},
    { "type": "status-badge", "text": "3 tests echoues — auth module", "variant": "warning" },
    { "type": "code-block", "language": "text", "title": "Stderr (extrait)",
      "code": "FAIL auth.login — Expected 200, got 401 (timeout after 5s)\nFAIL auth.signup — Email validation regex mismatch\nFAIL auth.reset — SMTP not configured in test env" },
    { "type": "divider" },
    { "type": "stack", "direction": "horizontal", "gap": "sm", "children": [
      { "type": "action-button", "label": "Relancer les tests", "action": "retry-tests",
        "payload": { "scope": "failed_only" }, "variant": "default", "icon": "refresh-cw" },
      { "type": "action-button", "label": "Merger quand meme", "action": "force-merge",
        "variant": "destructive", "confirm": "3 tests echouent. Merger quand meme ?", "icon": "git-merge" },
      { "type": "action-button", "label": "Assigner a un dev", "action": "assign-issue",
        "variant": "outline", "icon": "user-plus" }
    ]}
  ]
}
```

#### F4 — Notification inbox avec actions

**Agent monitoring detecte un spike de couts :**

```json
{
  "schemaVersion": 1,
  "blocks": [
    { "type": "markdown", "content": "**Alerte cout** — L'agent `DataPipeline` a consomme **$45** dans les dernieres 2h, soit 3x la moyenne." },
    { "type": "stack", "direction": "horizontal", "gap": "md", "children": [
      { "type": "metric-card", "label": "Cout 2h", "value": "$45", "trend": "up" },
      { "type": "metric-card", "label": "Moyenne 2h", "value": "$15" },
      { "type": "metric-card", "label": "Budget restant", "value": "$120", "trend": "down" }
    ]},
    { "type": "chart", "chartType": "bar", "title": "Cout par heure", "data": [
      { "label": "10h", "value": 8 }, { "label": "11h", "value": 12 },
      { "label": "12h", "value": 22 }, { "label": "13h", "value": 23 }
    ]},
    { "type": "divider" },
    { "type": "stack", "direction": "horizontal", "gap": "sm", "children": [
      { "type": "action-button", "label": "Pauser l'agent", "action": "pause-agent",
        "payload": { "agentId": "xxx" }, "variant": "destructive",
        "confirm": "Pauser DataPipeline ? Les runs en cours seront interrompus.", "icon": "pause" },
      { "type": "action-button", "label": "Reduire le budget", "action": "update-budget",
        "payload": { "agentId": "xxx", "newBudget": 50 }, "variant": "outline", "icon": "trending-down" },
      { "type": "action-button", "label": "Ignorer", "action": "dismiss",
        "variant": "ghost", "icon": "x" }
    ]}
  ]
}
```

### 10.5 Prompt CAO enrichi (F2)

```handlebars
Tu es le CAO (Chief Agent Officer) de la company {{company.name}} sur MnM.

L'utilisateur {{user.name}} te demande de creer un widget dashboard.

## Contexte utilisateur
- **Role :** {{user.role.name}}
- **Permissions :** {{#each user.permissions}}{{this}}, {{/each}}
- **Tags :** {{#each user.tags}}{{this.name}}, {{/each}}

## Endpoints API accessibles (filtres par ses permissions)
{{#each accessibleEndpoints}}
- {{this.method}} {{this.path}} — {{this.description}}
{{/each}}

## Catalogue de blocks disponibles
Tu DOIS generer un JSON conforme a ce schema :
```json
{{{blockCatalogueJsonSchema}}}
```

## Regles
- Genere UNIQUEMENT des composants du catalogue ci-dessus
- Le widget doit avoir un `title` clair et un `data_source` avec :
  - `endpoint` : l'API a appeler pour les donnees
  - `params` : les parametres de filtrage (adaptes au role/tags de l'utilisateur)
  - `refreshInterval` : en secondes (minimum 60)
- Utilise les MetricCards pour les chiffres cles, les Charts pour les tendances, les DataTables pour les details
- Le widget doit etre utile pour le role de l'utilisateur
- Propose des alternatives si la demande est ambigue

## Templates disponibles (suggestions)
- Burn-down chart (issues ouvertes dans le temps)
- Velocity (issues fermees par jour/semaine)
- Cost tracking (depenses par agent/jour)
- Agent health (success rate, run duration, errors)
- Backlog heatmap (issues par priorite x age)
- Team workload (issues assignees par membre)
```

### 10.6 API completes

```
# ── F1 : View Presets ──────────────────────────────────────
GET    /companies/:companyId/view-presets                    → list presets
POST   /companies/:companyId/view-presets                    → create preset
PATCH  /companies/:companyId/view-presets/:id                → update preset
DELETE /companies/:companyId/view-presets/:id                → delete preset
GET    /companies/:companyId/my-view                         → get my resolved view
PATCH  /companies/:companyId/my-view/overrides               → save my overrides

# ── F2 : User Widgets (Dashboard) ─────────────────────────
GET    /companies/:companyId/my-widgets                      → list my widgets
POST   /companies/:companyId/my-widgets                      → create widget (or CAO creates)
PATCH  /companies/:companyId/my-widgets/:id                  → update widget (title, position, span)
DELETE /companies/:companyId/my-widgets/:id                  → delete widget

# ── F3 : Blocks dans les issues (pas de nouvelles routes) ─
#    POST /issues/:id/comments   ← accepte content_blocks JSONB en plus de body
#    GET  /issues/:id/comments   ← retourne content_blocks si present

# ── F4 : Inbox Items ──────────────────────────────────────
GET    /companies/:companyId/inbox                           → list inbox items (filtres, pagination)
PATCH  /companies/:companyId/inbox/:id                       → update status (read, dismissed)
POST   /companies/:companyId/inbox/:id/action                → execute action from a block
POST   /companies/:companyId/inbox                           → create inbox item (agent API)
DELETE /companies/:companyId/inbox/:id                       → dismiss/delete

# ── Shared ────────────────────────────────────────────────
GET    /companies/:companyId/block-catalogue                 → JSON Schema du catalogue
POST   /companies/:companyId/blocks/validate                 → valider un ContentDocument
```

**16 routes** : 6 (F1) + 4 (F2) + 0 (F3, routes existantes) + 5 (F4) + 1 (shared catalogue)

---

## 11. Plan d'implementation — 5 epics

### Epic 1 : View Presets — F1 (~5 jours)

**Ce qui est deja designe dans le brainstorming #1. Inchange.**

| Story | Description | Estimation |
|---|---|---|
| VP-01 | Migration DB : table `view_presets` + colonnes `roles`, `company_memberships` | 0.5j |
| VP-02 | Seed : preset "Default" avec le layout actuel + presets PM/Dev/Exec | 0.5j |
| VP-03 | API : 6 routes CRUD + my-view + overrides | 1j |
| VP-04 | Hook `useViewPreset()` + `resolveLayout()` | 0.5j |
| VP-05 | Sidebar dynamique (consomme le layout du preset) | 1j |
| VP-06 | Landing page dynamique (redirect par role) | 0.5j |
| VP-07 | Admin UI : page `/admin/view-presets` + assignment role → preset | 1j |

### Epic 2 : Blocks Foundation (shared) (~3 jours)

**Le socle json-render utilise par F2, F3, F4.**

| Story | Description | Estimation |
|---|---|---|
| BF-01 | Schema Zod `ContentBlock` + `ContentDocument` dans `@mnm/shared` | 0.5j |
| BF-02 | `<BlockRenderer>` — composant qui rend les 14 block types via json-render | 1.5j |
| BF-03 | `<ContentRenderer>` — meta-composant markdown + blocks (detection automatique) | 0.5j |
| BF-04 | `useBlockActions()` — handler d'actions generique | 0.5j |

### Epic 3 : Dashboard Intelligent — F2 (~5 jours)

| Story | Description | Estimation |
|---|---|---|
| DI-01 | Dashboard hybrid : widgets predefinis (Widget Registry) + zone custom | 1j |
| DI-02 | Migration DB : table `user_widgets` | 0.5j |
| DI-03 | API : 4 routes CRUD `my-widgets` | 0.5j |
| DI-04 | UI : rendu des widgets custom via `<BlockRenderer>` + data_source refresh | 1j |
| DI-05 | CAO prompt enrichi : role + permissions + tags + endpoints + catalogue Zod | 0.5j |
| DI-06 | CAO flow : utilisateur demande un widget → CAO genere → stocke → affiche | 1j |
| DI-07 | Widget templates (5 templates pre-faits : burn-down, velocity, costs, health, workload) | 0.5j |

### Epic 4 : Agent Forms dans les Issues — F3 (~2 jours)

| Story | Description | Estimation |
|---|---|---|
| AF-01 | Migration DB : `issue_comments.content_blocks` JSONB | 0.25j |
| AF-02 | API : accepter `content_blocks` dans POST/GET comments | 0.25j |
| AF-03 | UI : `CommentThread.tsx` utilise `<ContentRenderer>` | 0.5j |
| AF-04 | Action handler : les ActionButton/QuickForm dans les commentaires postent la reponse comme nouveau commentaire | 0.5j |
| AF-05 | CAO watchdog enrichi : les rapports d'echec utilisent des blocks au lieu de texte brut | 0.5j |

### Epic 5 : Inbox Interactive — F4 (~3 jours)

| Story | Description | Estimation |
|---|---|---|
| II-01 | Migration DB : table `inbox_items` | 0.5j |
| II-02 | API : 5 routes CRUD + action | 1j |
| II-03 | UI : `Inbox.tsx` refactored pour consommer `inbox_items` avec `<ContentRenderer>` | 1j |
| II-04 | Migration des sources existantes (failed_runs, approvals) vers `inbox_items` | 0.5j |

---

## 12. Ordre d'implementation recommande

```
Epic 2 (Blocks Foundation)     ← socle, prerequis pour tout le reste
    │
    ├──→ Epic 1 (View Presets)  ← F1, independant des blocks mais peut commencer en parallele
    │
    ├──→ Epic 4 (Agent Forms)   ← F3, le plus simple apres le socle
    │
    ├──→ Epic 5 (Inbox)         ← F4, depend du socle + donne de la valeur rapide
    │
    └──→ Epic 3 (Dashboard)     ← F2, le plus complexe (CAO), en dernier
```

**Epic 2 → (Epic 1 || Epic 4) → Epic 5 → Epic 3**

Raison : Epic 3 (Dashboard + CAO) est le plus ambitieux et le plus "wow", mais aussi le plus risque. Commencer par les forms dans les issues (F3) et l'inbox interactive (F4) valide le socle json-render sur des surfaces simples avant de s'attaquer au dashboard intelligent.

**Estimation totale : ~18 jours de dev**

---

## 13. Trade-offs documentes

| Decision | Gain | Cout |
|---|---|---|
| json-render pour F2+F3+F4, React statique pour F1 | Best of both : performance pour le layout, flexibilite pour le contenu dynamique | Deux systemes de rendu a comprendre |
| Table `inbox_items` dediee (pas des colonnes sur l'existant) | Vrais inbox items avec status, actions, expiration. Clean architecture | Migration des sources existantes necessaire (Epic 5 story 04) |
| Table `user_widgets` separee (pas JSONB sur `company_memberships`) | Widgets independants, CRUD propre, creatable par le CAO | 1 table de plus |
| CAO comme dashboard builder (pas un editeur drag-and-drop) | Zero UI complexe a construire en v1. L'IA fait le travail | Depend de la qualite du prompt CAO. Iteration necessaire |
| Widget `data_source` avec refresh | Donnees fraiches, pas de snapshot fige | Complexite frontend (polling, invalidation) |
| Catalogue de 14 composants (pas 39) | Simple a apprendre pour les agents et l'equipe. Extensible | Certains layouts complexes necessitent du markdown |
| `content_blocks` optionnel partout (coexistence avec body/description) | Zero breaking change, migration progressive | Deux chemins de rendu a maintenir temporairement |

---

## 14. Statistiques

| Metrique | Valeur |
|---|---|
| **Idees generees** | 42 |
| **Categories** | 6 |
| **Insights cles** | 6 |
| **Techniques** | 4 (Mind Map, Starbursting, SCAMPER, Reverse) |
| **Features** | 4 |
| **Epics** | 5 (dont 1 shared) |
| **Stories** | 23 |
| **Nouvelles tables DB** | 3 (`view_presets`, `user_widgets`, `inbox_items`) |
| **Nouvelles colonnes** | 3 (`roles.view_preset_id`, `company_memberships.layout_overrides`, `issue_comments.content_blocks`) |
| **Routes API** | 16 |
| **Composants catalogue** | 14 |
| **Breaking changes** | 0 |
| **Estimation totale** | ~18 jours |

---

## 15. Prochaines etapes

1. **Valider cette architecture** avec Tom → ajuster si besoin
2. **Creer les stories** pour Epic 2 (Blocks Foundation) en premier
3. **POC json-render** — tester la compatibilite avec les composants shadcn/ui existants
4. **Enrichir le prompt CAO** — tester la generation de widgets avec le catalogue Zod

---

*Genere par BMAD Method v6 — Creative Intelligence*
*Session unifiee — remplace les 2 brainstormings precedents*
