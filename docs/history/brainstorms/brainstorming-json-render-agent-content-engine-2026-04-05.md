# Brainstorming — json-render comme moteur de rendu universel du contenu agent

> **Date** : 5 avril 2026
> **Participants** : Tom (direction produit), Claude (architecture)
> **Statut** : Brainstorming termine, architecture proposee, pret pour validation
> **Prerequis** : [brainstorming-view-presets-dashboard-par-persona-2026-04-04.md](brainstorming-view-presets-dashboard-par-persona-2026-04-04.md) — archi View Presets validee

---

## 1. Demande initiale (Tom)

> Savoir si ce serait pas top d'utiliser la lib json-render ? Au moins on reinvente pas la roue et en + on peut les utiliser ailleurs genre dans les comptes rendus des agents dans les issues et dans les inbox genre en plus des approbations classique pouvoir faire des questions pour trigger des actions selon des formulaires pour repondre vite aux agents etc...

## 2. Contexte

**Ce que json-render est (avril 2026) :**
- Vercel Labs, 14K+ stars, 200+ releases depuis janvier 2026
- 39 composants shadcn/ui pre-integres (Input, Button, Card, Select, Table, Dialog, Tabs, Charts...)
- Catalogue Zod — les agents ne peuvent generer QUE du JSON conforme au schema
- Streaming JSONL — patches incrementaux, rendu progressif pendant que l'agent genere
- Interactif — forms, boutons, state management, actions
- Cross-framework (React, Vue, Svelte, React Native)

**Etat des lieux MnM — comment le contenu agent est rendu aujourd'hui :**

| Surface | Rendu actuel | Composants cles |
|---|---|---|
| Issues (description, commentaires) | Markdown via `react-markdown` + `remark-gfm` + mermaid | `MarkdownBody.tsx`, `CommentThread.tsx`, `InlineEditor.tsx` |
| Inbox | Items categorises (issues, approvals, failed_runs, alerts) | `Inbox.tsx`, `ApprovalCard.tsx` |
| Approvals | **2 types hardcodes** : `hire_agent`, `approve_ceo_strategy` | `ApprovalPayload.tsx` — renderers specifiques par type |
| Chat | Texte brut (pas markdown) + artifacts (code, HTML, markdown) | `MessageBubble.tsx`, `ArtifactRenderer.tsx` |
| Traces | Markdown des analyses LLM + JSON tree pour les observations | `LensAnalysisResult.tsx`, `TraceDetailPanel.tsx` |

**Composants shadcn/ui existants dans MnM (23) :**
avatar, badge, breadcrumb, button, card, checkbox, collapsible, command, dialog, dropdown-menu, input, label, popover, resizable, scroll-area, select, separator, sheet, skeleton, switch, tabs, textarea, tooltip

**Constat critique :** Chaque type de contenu agent a son propre renderer hardcode. Ajouter un nouveau type d'approbation = nouveau composant React. L'agent ne peut pas produire de contenu structure riche (tableaux de metriques, charts, formulaires) — il est limite au markdown.

---

## 3. Techniques de brainstorming

1. **Mind Mapping** — Explorer toutes les surfaces et dimensions d'integration
2. **SCAMPER** — Transformer les interactions agent↔humain existantes
3. **Reverse Brainstorming** — Comment garantir l'echec de l'integration
4. **Six Thinking Hats** — Perspectives multiples sur l'adoption

---

## 4. Mind Mapping — Les dimensions du probleme

```
                              json-render dans MnM
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
   SURFACES                    CATALOGUE                    INFRASTRUCTURE
   D'INTEGRATION               COMPOSANTS                   TECHNIQUE
        │                            │                            │
        ├─ Issues                     ├─ Display                   ├─ Stockage JSON
        │   ├─ Descriptions riches    │   ├─ MetricCard            │   ├─ JSONB dans issues.body?
        │   ├─ Rapports agents        │   ├─ DataTable             │   ├─ Colonne separee content_blocks?
        │   └─ Status updates         │   ├─ StatusBadge           │   ├─ Versionning du schema
        │                             │   ├─ ProgressBar           │   └─ Migration markdown → blocks
        ├─ Inbox                      │   ├─ CodeBlock             │
        │   ├─ Notifications riches   │   ├─ Chart (line, bar)     ├─ Rendering
        │   ├─ Actions rapides        │   └─ Timeline              │   ├─ Composant <BlockRenderer>
        │   └─ Formulaires inline     │                            │   ├─ Lazy loading par type
        │                             ├─ Interactive               │   ├─ Fallback markdown
        ├─ Chat                       │   ├─ ActionButton           │   └─ Sandbox de securite
        │   ├─ Reponses structurees   │   ├─ ApprovalForm          │
        │   ├─ Artifacts enrichis     │   ├─ QuickForm             ├─ Agent-side
        │   └─ Inline forms           │   ├─ SelectField           │   ├─ Catalogue expose aux agents
        │                             │   ├─ Checkbox/Toggle       │   ├─ Instructions system prompt
        ├─ Traces                     │   ├─ TextInput             │   ├─ Validation Zod pre-rendu
        │   ├─ Gold summaries         │   └─ StarRating            │   └─ Fallback text si echec
        │   └─ Phase reports          │                            │
        │                             ├─ Layout                    ├─ Action handling
        ├─ Dashboards (View Presets)  │   ├─ Grid                  │   ├─ Action → API call
        │   └─ Widgets dynamiques?    │   ├─ Stack (h/v)           │   ├─ Action → mutation TanStack
        │                             │   ├─ Section               │   ├─ Confirmation dialog
        └─ Futurs                     │   ├─ Card                  │   └─ Optimistic updates
            ├─ Deployments reports    │   ├─ Tabs                  │
            ├─ Security alerts        │   └─ Accordion             └─ Streaming
            ├─ Onboarding wizard      │                                ├─ SSE → JSONL patches
            └─ Custom agent UIs       └─ MnM-specific                 ├─ Progressive rendering
                                          ├─ AgentAvatar              ├─ Skeleton placeholders
                                          ├─ IssueMention             └─ WebSocket integration
                                          ├─ ProjectBadge
                                          ├─ UserMention
                                          └─ PermissionGate
```

### Branches cles identifiees :

1. **5 surfaces d'integration** — Issues, Inbox, Chat, Traces, (Dashboards optionnel)
2. **~25 composants catalogue** — 15 display + 7 interactive + 3 layout + 5 MnM-specific
3. **4 piliers infra** — Stockage, Rendering, Agent-side, Action handling
4. **Le streaming est natif** — json-render + SSE/WebSocket existant = rendu progressif gratuit

---

## 5. SCAMPER — Transformer les interactions agent↔humain

### Substitute — Remplacer

| Aujourd'hui | Demain avec json-render |
|---|---|
| Markdown brut dans les commentaires agent | **Blocks structures** : metriques en haut, details en bas, actions en footer |
| `ApprovalPayload.tsx` avec 2 types hardcodes | **Catalogue generique** : l'agent genere le formulaire d'approbation, pas le dev |
| Texte brut dans les messages chat | **Messages structures** avec cards, tables, badges |
| JSON tree dans les traces | **Visualisation semantique** : phases avec barres de progression et verdicts colores |
| Status updates textuels dans les issues | **Cards de progression** avec KPIs, charts, et call-to-action |

### Combine — Fusionner

1. **MarkdownBody + BlockRenderer** → Un seul composant `<ContentRenderer>` qui detecte le format (markdown string vs JSON blocks) et route vers le bon renderer
2. **Approvals + Forms** → Les approbations deviennent un cas particulier de formulaire interactif. Plus besoin d'un systeme d'approbation separe — c'est juste un QuickForm avec un submitAction "approve"
3. **Chat artifacts + Issue content** → Meme catalogue de composants, meme renderer. Un artefact genere dans le chat peut etre attache a une issue et rendu identiquement
4. **Traces Gold + Dashboards** → Les widgets de dashboard et les summaries Gold utilisent les memes MetricCard, ProgressBar, StatusBadge

### Adapt — Adapter

1. **Adapter le streaming SSE existant** (`/events/ws`) pour transporter les JSONL patches de json-render. Les agents qui generent du contenu en temps reel → le UI se met a jour progressivement
2. **Adapter le Zod du catalogue** pour servir de **documentation aux agents** — le schema Zod IS la doc. L'agent sait exactement quels composants il peut utiliser et quels props ils acceptent
3. **Adapter le systeme de permissions** — certains composants interactifs (ActionButton "delete") ne devraient etre rendu que si l'utilisateur a la permission correspondante

### Modify — Modifier

1. **Modifier la table `issues`** — ajouter une colonne `content_blocks JSONB` a cote du `description TEXT`. Les deux coexistent. Si `content_blocks` est present → rendu json-render. Sinon → markdown fallback
2. **Modifier `ApprovalPayload.tsx`** — plus de renderers specifiques par type. Le payload de l'approbation EST le JSON json-render. `ApprovalPayloadRenderer` devient juste `<BlockRenderer blocks={payload.blocks} />`
3. **Modifier le prompt system des agents** — ajouter le catalogue de composants disponibles. L'agent sait qu'il peut generer un `QuickForm` plutot que de poser une question en texte libre

### Put to other uses — Reutiliser

1. **Reutiliser json-render pour l'onboarding** — L'admin cree un "welcome flow" en JSON blocks : message + formulaire de setup + quick actions. Rendu dynamiquement pour les nouveaux utilisateurs
2. **Reutiliser pour les templates de rapports** — Un template de rapport periodique (daily standup, weekly report) est un document JSON blocks que les agents remplissent
3. **Reutiliser pour les deployments** — Les rapports de deploiement (tests passes, metriques, screenshots) sont des blocks structures, pas du markdown
4. **Reutiliser pour les notifications enrichies** — Les emails de notification pourraient inclure une version simplifiee des blocks (markdown fallback pour email)

### Eliminate — Eliminer

1. **Eliminer `ApprovalPayload.tsx`** — plus de renderers hardcodes par type d'approbation
2. **Eliminer `ArtifactRenderer.tsx`** — les artifacts deviennent des documents json-render
3. **Eliminer la distinction "approval type"** — plus de `hire_agent`, `approve_ceo_strategy` en enum. Chaque approbation est un document JSON avec son propre UI
4. **Eliminer le besoin de deployer du code pour un nouveau type d'interaction** — l'agent decide de son UI

### Reverse — Inverser

1. **Au lieu que le dev code le rendu, l'agent le genere** — inversion du flux. Le dev fournit le catalogue (une fois), l'agent compose le UI (a chaque fois)
2. **Au lieu que l'utilisateur navigue vers l'info, l'info vient a lui** — l'agent push des cards structurees dans l'inbox avec les actions contextuelles
3. **Au lieu de formulaires separes pour chaque workflow, un formulaire generique** — l'agent genere le formulaire exact dont il a besoin, quand il en a besoin

---

## 6. Reverse Brainstorming — Comment garantir l'echec

> "Comment s'assurer que l'integration json-render soit un desastre complet ?"

### Anti-patterns identifies

1. **Tout migrer d'un coup** — Remplacer markdown par json-render partout en un seul sprint. Resultat : 200 agents cassent, les utilisateurs voient des JSON bruts
   - → **Insight** : Migration progressive. Markdown = format legacy toujours supporte. `content_blocks` est optionnel

2. **Laisser les agents generer du JSON libre** — Pas de catalogue Zod, pas de validation. L'agent hallucine des composants qui n'existent pas
   - → **Insight** : Le catalogue Zod est OBLIGATOIRE. Validation serveur avant stockage. Fallback texte brut si invalide

3. **Creer 50 composants dans le catalogue** — Partir sur un catalogue enorme, complexe, avec des composants tres specifiques
   - → **Insight** : Commencer avec ~10-12 composants. Ajouter quand le besoin emerge. Le catalogue grandit organiquement

4. **Ignorer les performances** — Chaque message chat charge 39 composants lazy. 100 messages = 3900 imports
   - → **Insight** : Pre-bundle les composants les plus utilises (Card, Badge, Button). Lazy load uniquement les complexes (Chart, DataTable)

5. **Pas de fallback** — Si le JSON est corrompu ou le composant n'existe plus, crash
   - → **Insight** : Triple fallback : (1) JSON valide → render, (2) JSON invalide → afficher comme markdown si `content` est present, (3) ni l'un ni l'autre → `<pre>{JSON.stringify(blocks)}</pre>`

6. **Actions sans confirmation** — Un bouton "Delete all data" genere par un agent, clickable sans warning
   - → **Insight** : Les actions interactives passent par un systeme de permissions. Les actions destructives requierent une confirmation UI. Les actions sont des API calls authentifiees, pas du code cote client

7. **Pas de versionning** — Le schema change, les anciens blocks ne rendent plus
   - → **Insight** : Versionner le catalogue. `{ version: 1, blocks: [...] }`. Le renderer sait gerer les v1, v2, etc. Les composants deprecies ont un fallback

8. **Hardcoder les action handlers** — Chaque composant interactif a son propre handler custom
   - → **Insight** : Systeme d'actions generique. `{ action: "api-call", method: "POST", path: "/issues/:id/approve", body: { ... } }`. Un seul handler central route toutes les actions

9. **Oublier l'accessibilite** — Les formulaires generes n'ont pas de labels, pas de focus management
   - → **Insight** : Le catalogue Zod FORCE les champs accessibilite (label obligatoire, aria-describedby optionnel). shadcn/ui est deja accessible par defaut

10. **Ne pas tester avec les vrais agents** — Le catalogue est parfait en theorie mais les agents generent du JSON bizarre en pratique
    - → **Insight** : Phase de test intensive avec les agents existants. Analyser les patterns de generation. Ajuster le catalogue pour correspondre a ce que les LLM generent naturellement

---

## 7. Six Thinking Hats

### White Hat — Les faits

- json-render a 14K stars, 200+ releases, maintenu par Vercel Labs
- MnM utilise deja shadcn/ui (23 composants) — json-render a 39 composants shadcn pre-integres = overlap quasi total
- Le contenu agent est actuellement 100% markdown ou hardcode
- 2 types d'approbation hardcodes. Chaque nouveau type = code React + deploiement
- Les agents MnM tournent via `claude_local` qui supporte les tool calls → peuvent generer du JSON structure
- Le streaming JSONL de json-render est compatible avec le SSE existant

### Red Hat — L'intuition

- **Excitation** : json-render transforme MnM d'un "viewer de logs" en un "cockpit interactif". Les agents deviennent des producteurs d'interfaces, pas juste de texte
- **Crainte** : dependance sur une lib jeune (3 mois). Si Vercel Labs arrete, on est coince
- **Conviction** : c'est le bon moment. Les agents IA sont la tendance, et la interaction agent↔humain via des UIs structurees est le futur du produit
- **Sensation** : le "aha moment" pour les clients sera quand un agent leur envoie un formulaire interactif au lieu d'un mur de texte

### Black Hat — Les risques

1. **Dependance Vercel Labs** — lib de 3 mois, API instable (breaking change v0.5.0)
   - Mitigation : wrapper mince (`<BlockRenderer>`) qui isole json-render. Si la lib meurt, on reimplemente le renderer en ~200 lignes (c'est un `switch` sur les types de composants)

2. **Securite** — un agent malveillant genere du JS executable ou des liens dangereux
   - Mitigation : le catalogue Zod contraint les composants. Pas de `dangerouslySetInnerHTML`. Les actions sont des API calls, pas du code client. Sanitization des URLs

3. **Complexite pour l'equipe** — nouveau paradigme a apprendre (catalogue, actions, streaming)
   - Mitigation : le catalogue est petit (~12 composants). Le pattern est simple : JSON → React. L'equipe connait deja shadcn/ui

4. **Performance inbox/chat** — rendre du JSON structure est plus lourd que du texte
   - Mitigation : les composants simples (Card, Badge, Button) sont pre-bundles. Virtualization pour les listes longues. Les blocks sont generalement petits (5-15 elements)

5. **Qualite du JSON genere** — les LLM ne sont pas parfaits, le JSON peut etre invalide
   - Mitigation : validation Zod serveur-side avant stockage. Fallback markdown. Monitoring des erreurs de parsing

### Yellow Hat — Les opportunites

1. **Differentiation produit** — aucun concurrent ne propose des interactions agent↔humain via des UIs dynamiques. C'est un moat
2. **Reduction du TTM** — nouveau type d'approbation = 0 code frontend. L'agent genere le formulaire, l'humain repond
3. **Scalabilite des workflows** — les agents peuvent creer des workflows custom avec des formulaires custom sans intervention dev
4. **Monetisation** — "Custom Agent UIs" comme feature premium enterprise
5. **Effet plateforme** — les clients pourraient creer leurs propres composants catalogue pour des cas metier specifiques
6. **Chat → cockpit** — les messages chat deviennent des mini-applications. Un agent peut envoyer un dashboard embarque dans un message

### Green Hat — Les idees creatives

1. **"Agent Canvas"** — un mode ou l'agent construit un document interactif en temps reel (streaming). L'utilisateur voit les blocks apparaitre progressivement comme un canvas collaboratif
2. **"Action Chains"** — un formulaire peut trigger une action qui genere un autre formulaire. L'agent orchestre un workflow multi-step via des UIs chainées
3. **"Template Marketplace"** — les admins partagent des templates de blocks entre companies (rapports type, formulaires standards, dashboards)
4. **"Bi-directional Blocks"** — l'utilisateur aussi peut composer des blocks (via un editeur simplifie) pour donner des instructions structurees aux agents
5. **"Conditional Rendering"** — les blocks ont des conditions : `{ if: "user.role === 'admin'", then: { type: "ActionButton", ... } }`. L'agent genere une UI qui s'adapte au viewer
6. **"Block Analytics"** — tracker quels blocks sont les plus interactifs, quels formulaires ont le meilleur taux de completion. Feed-back aux agents pour optimiser leurs UIs
7. **"Embed Mode"** — les blocks sont renderables en iframe. Un client peut embarquer un rapport agent dans son propre outil
8. **"Voice-to-Blocks"** — l'agent transcrit un call et genere un rapport structure avec action items, pas un mur de texte

### Blue Hat — Le plan

1. **Phase 0** : Catalogue minimal + `<BlockRenderer>` wrapper (sans json-render d'abord — validation du pattern)
2. **Phase 1** : Integration json-render sous le wrapper. Migration approvals
3. **Phase 2** : Issues — `content_blocks` JSONB + rendu bi-mode
4. **Phase 3** : Inbox enrichie + actions interactives
5. **Phase 4** : Chat structured messages
6. **Phase 5** : Traces Gold + streaming progressif

---

## 8. Synthese des idees generees

### Categorie 1 : Architecture de rendu (8 idees)

1. **`<BlockRenderer>`** — Composant wrapper unique qui prend un `blocks: Block[]` et rend chaque block via le catalogue. Isole la dependance json-render
2. **`<ContentRenderer>`** — Meta-composant qui detecte le format (string → markdown, Block[] → blocks) et route vers `MarkdownBody` ou `BlockRenderer`
3. **Pre-bundling des composants frequents** — Card, Badge, Button, Stack pre-charges. Charts et DataTable en lazy
4. **Triple fallback** — JSON valide → render, invalide + content string → markdown, sinon → raw JSON
5. **Versionning du catalogue** — `{ schemaVersion: 1, blocks: [...] }` pour les migrations futures
6. **Sandbox de securite** — pas de HTML arbitraire, pas de JS, actions = API calls authentifiees
7. **Streaming integration** — JSONL patches via WebSocket existant pour rendu progressif
8. **Component hot-reload en dev** — le catalogue est rechargeable a chaud pour iterer vite

### Categorie 2 : Catalogue de composants (12 idees)

9. **Display : MetricCard** — Label + value + trend (up/down/flat) + sparkline optionnel
10. **Display : DataTable** — Colonnes + rows + tri + pagination optionnelle
11. **Display : StatusBadge** — Texte + couleur semantique (success/warning/error/info)
12. **Display : ProgressBar** — Label + valeur + max + couleur
13. **Display : CodeBlock** — Langage + code + highlight
14. **Display : Chart** — Type (line/bar/pie) + data points + labels
15. **Interactive : ActionButton** — Label + action + variant + confirmation optionnelle
16. **Interactive : QuickForm** — Fields[] + submitAction. Chaque field a un type (text/select/checkbox/number/date)
17. **Interactive : StarRating** — Label + max + submitAction. Pour le feedback rapide
18. **Layout : Stack** — Direction (h/v) + gap + children
19. **Layout : Grid** — Cols + gap + children
20. **MnM-specific : AgentMention** — Render un agent avec avatar + nom + status

### Categorie 3 : Integration par surface (7 idees)

21. **Issues : `content_blocks` JSONB** — Colonne optionnelle sur la table issues. Coexistence avec `description` markdown
22. **Approvals : payload IS blocks** — Plus de renderers specifiques. Le payload d'approbation est un document JSON blocks avec un QuickForm en footer
23. **Inbox : rich notifications** — Chaque notification inbox peut avoir des blocks (MetricCard + ActionButton au lieu de texte + lien)
24. **Chat : structured messages** — Un nouveau type de message `blocks` a cote de `text`, `artifact`, `system`
25. **Traces : Gold as blocks** — Le summary Gold n'est plus du markdown mais des blocks (verdicts, metriques, timeline)
26. **Dashboards : widgets as blocks?** — Les widgets de View Presets POURRAIENT etre des blocks, mais c'est optionnel (le registry statique suffit)
27. **Email notifications** — Fallback : `blocks → markdown → HTML` pour les emails de notification

### Categorie 4 : Action system (6 idees)

28. **Action generique** — `{ action: "api-call", method: "POST", path: "/api/...", body: {...} }`. Un seul handler central
29. **Action avec confirmation** — `{ action: "api-call", ..., confirm: "Etes-vous sur ?" }`. Dialog avant execution
30. **Action → mutation TanStack** — Le handler central utilise les mutations TanStack Query existantes. Invalidation du cache automatique
31. **Action → agent message** — `{ action: "reply-to-agent", agentId: "...", message: { formData } }`. L'utilisateur repond a l'agent via le formulaire
32. **Action permissions** — Chaque action porte une `permission` optionnelle. Si l'utilisateur n'a pas la permission, le bouton est desactive
33. **Action chains** — Le resultat d'une action peut retourner de nouveaux blocks. Workflow multi-step sans rechargement

### Categorie 5 : Agent-side (5 idees)

34. **Catalogue Zod expose via API** — `GET /api/block-catalogue` retourne le schema JSON du catalogue. Les agents le consomment pour savoir quoi generer
35. **System prompt injection** — Le catalogue de composants est injecte dans le system prompt des agents. `"Tu peux generer des blocks UI. Composants disponibles : MetricCard(label, value, trend), QuickForm(fields, submitAction), ..."`
36. **Validation serveur** — Tout JSON blocks passe par un validateur Zod serveur-side avant d'etre stocke. Si invalide → stocke comme markdown fallback
37. **Agent templates** — Des templates pre-faits pour les cas courants : "rapport de run", "demande d'approbation", "question a l'utilisateur"
38. **Feedback loop** — Si un utilisateur ignore ou dismiss un block interactif, l'agent est notifie → il peut ajuster sa strategie de communication

---

## 9. Insights cles

### Insight 1 : json-render n'est pas un choix UI — c'est un protocole agent↔humain

**Description :** Le vrai value prop de json-render n'est pas "rendre du JSON en React". C'est de fournir un **langage commun** entre les agents et les humains. Un catalogue Zod = un contrat d'interface. L'agent sait exactement ce qu'il peut produire, l'humain sait exactement ce qu'il peut recevoir. C'est le "Block Kit" de MnM.

**Source :** Mind Mapping (branche Agent-side) + SCAMPER (Reverse — l'agent decide son UI)
**Impact :** Very High | **Effort :** Medium
**Pourquoi c'est important :** Ca transforme la relation agent↔humain de "l'agent ecrit du texte que l'humain lit" a "l'agent construit une interface que l'humain utilise". C'est un changement de paradigme pour le produit.

### Insight 2 : Le wrapper `<BlockRenderer>` isole le risque json-render

**Description :** Ne PAS exposer json-render dans tout le codebase. Un seul composant `<BlockRenderer blocks={blocks} actions={actionHandler} />` encapsule toute la logique. Si json-render meurt ou a un breaking change, on reimplemente le renderer dans ce seul fichier (~200 lignes de switch/case sur les types de composants, vu qu'on utilise deja shadcn/ui).

**Source :** Reverse Brainstorming (anti-pattern #1 : dependance) + Six Hats Black (risque lib jeune)
**Impact :** High | **Effort :** Very Low
**Pourquoi c'est important :** Elimine le risque principal identifie dans le brainstorming precedent. Le cout d'adoption de json-render tombe a zero si on peut le remplacer sans toucher au reste du code.

### Insight 3 : `<ContentRenderer>` — le meta-composant markdown + blocks

**Description :** Plutot que de migrer tout le markdown vers des blocks, creer un `<ContentRenderer content={content} blocks={blocks} />` qui affiche l'un ou l'autre (ou les deux). Markdown reste le format par defaut. Les blocks sont un upgrade optionnel. Zero migration de contenu existant.

**Source :** SCAMPER (Combine — MarkdownBody + BlockRenderer) + Reverse Brainstorming (anti-pattern #1 : tout migrer)
**Impact :** High | **Effort :** Low
**Pourquoi c'est important :** Migration progressive sans breaking change. Les agents qui ne supportent pas encore les blocks continuent a produire du markdown. Ceux qui le supportent produisent des blocks. Le meme composant gere les deux.

### Insight 4 : Les approbations deviennent un cas particulier de QuickForm

**Description :** Plus besoin de `ApprovalPayload.tsx` avec des renderers hardcodes par type. Une approbation = un document JSON blocks avec un `QuickForm` en footer. L'agent genere le formulaire complet : quelles infos afficher, quelles questions poser, quelles actions proposer. Plus de deploiement pour un nouveau type d'approbation.

**Source :** SCAMPER (Eliminate — renderers hardcodes) + Six Hats Yellow (reduction TTM)
**Impact :** Very High | **Effort :** Medium
**Pourquoi c'est important :** Aujourd'hui, `ApprovalPayload.tsx` a 2 types hardcodes (`hire_agent`, `approve_ceo_strategy`). Chaque nouveau type = PR frontend. Avec json-render, l'agent genere le formulaire — scalabilite infinie sans code.

### Insight 5 : Le systeme d'actions generique est le vrai game changer

**Description :** Un seul handler central pour toutes les actions interactives : `{ action: "api-call", method, path, body, confirm?, permission? }`. Combine avec les mutations TanStack Query existantes. Les agents peuvent trigger n'importe quelle API de MnM via un bouton, avec confirmation et permissions.

**Source :** Reverse Brainstorming (anti-pattern #8) + SCAMPER (Adapt — permissions)
**Impact :** Very High | **Effort :** Medium
**Pourquoi c'est important :** C'est ce qui rend les blocks INTERACTIFS et pas juste cosmetiques. Sans systeme d'actions, json-render est juste un "markdown plus joli". Avec, c'est un cockpit ou les agents deploient des mini-applications.

### Insight 6 : Commencer par les approvals, pas par les issues

**Description :** Les approvals sont le use case parfait pour la v1 : perimetre limite (inbox), payload deja structure (JSON), actions deja existantes (approve/reject/revision), et le pain point est reel (2 types hardcodes). Migrer les approvals vers json-render = proof of concept complet en ~2 jours.

**Source :** Six Hats Blue (plan) + Reverse Brainstorming (anti-pattern #1)
**Impact :** High | **Effort :** Very Low
**Pourquoi c'est important :** Ca valide toute la stack (catalogue, renderer, actions) sur un cas reel avant de toucher aux surfaces plus complexes (issues, chat).

### Insight 7 : Le catalogue Zod EST la documentation des agents

**Description :** Le schema Zod qui definit les composants du catalogue est auto-descriptif. On peut le serialiser en JSON Schema, l'injecter dans le system prompt des agents, et ils savent exactement quoi generer. Pas de documentation separee a maintenir. Le code = la doc = le contrat.

**Source :** SCAMPER (Adapt — Zod comme doc) + Mind Mapping (branche Agent-side)
**Impact :** Medium | **Effort :** Very Low
**Pourquoi c'est important :** Elimine le probleme classique "la doc est desynchronisee du code". Le schema Zod est la source de verite unique pour ce que les agents peuvent produire.

---

## 10. Architecture proposee — Agent Content Blocks

### 10.1 Principe directeur

**Deux systemes complementaires, un seul renderer :**

| Systeme | Purpose | Stockage | Rendu |
|---|---|---|---|
| **View Presets** (brainstorming precedent) | Layout/navigation par persona | `view_presets.layout` JSONB | Widget Registry (statique, ~50 lignes) |
| **Agent Content Blocks** (ce brainstorming) | Contenu agent interactif | JSONB sur chaque surface (issues, approvals, chat) | `<BlockRenderer>` via json-render |

Les deux sont independants. Les View Presets definissent **OU** les choses apparaissent. Les Agent Content Blocks definissent **QUOI** les agents produisent.

### 10.2 Data Model — Additions au schema existant

```sql
-- Pas de nouvelle table. Des colonnes JSONB optionnelles sur les tables existantes.

-- Issues : contenu structure optionnel
ALTER TABLE issues ADD COLUMN content_blocks JSONB;

-- Comments : contenu structure optionnel
ALTER TABLE comments ADD COLUMN content_blocks JSONB;

-- Approvals : payload blocks (remplace les renderers hardcodes)
-- La colonne `payload` JSONB existe deja — on ajoute juste un champ `blocks` dedans
-- { ...existingPayload, blocks: [...] }

-- Chat messages : type 'blocks' + content_blocks
-- La colonne `content` TEXT existe deja pour le texte
ALTER TABLE messages ADD COLUMN content_blocks JSONB;

-- Catalogue versionne
CREATE TABLE block_catalogue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id),
  version       INTEGER NOT NULL DEFAULT 1,
  schema        JSONB NOT NULL,         -- JSON Schema du catalogue
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, version)
);
```

**Bilan : 3 colonnes JSONB ajoutees + 1 petite table optionnelle.** Minimaliste.

### 10.3 Catalogue de composants — v1 (12 composants)

```typescript
// packages/shared/src/types/content-blocks.ts

import { z } from "zod";

// === DISPLAY ===

const MetricCard = z.object({
  type: z.literal("metric-card"),
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  trend: z.enum(["up", "down", "flat"]).optional(),
  description: z.string().optional(),
});

const StatusBadge = z.object({
  type: z.literal("status-badge"),
  text: z.string(),
  variant: z.enum(["success", "warning", "error", "info", "neutral"]),
});

const DataTable = z.object({
  type: z.literal("data-table"),
  columns: z.array(z.object({
    key: z.string(),
    label: z.string(),
    align: z.enum(["left", "center", "right"]).optional(),
  })),
  rows: z.array(z.record(z.unknown())),
});

const CodeBlock = z.object({
  type: z.literal("code-block"),
  language: z.string().optional(),
  code: z.string(),
  title: z.string().optional(),
});

const ProgressBar = z.object({
  type: z.literal("progress-bar"),
  label: z.string(),
  value: z.number().min(0).max(100),
  variant: z.enum(["default", "success", "warning", "error"]).optional(),
});

const Markdown = z.object({
  type: z.literal("markdown"),
  content: z.string(),
});

// === INTERACTIVE ===

const ActionButton = z.object({
  type: z.literal("action-button"),
  label: z.string(),
  action: z.string(),           // e.g. "approve", "reject", "assign"
  payload: z.record(z.unknown()).optional(),
  variant: z.enum(["default", "destructive", "outline", "ghost"]).optional(),
  confirm: z.string().optional(), // confirmation message before action
  permission: z.string().optional(),
});

const QuickForm = z.object({
  type: z.literal("quick-form"),
  title: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    label: z.string(),
    type: z.enum(["text", "textarea", "select", "checkbox", "number", "date"]),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    defaultValue: z.unknown().optional(),
  })),
  submitLabel: z.string().optional(),
  submitAction: z.string(),
  submitPayload: z.record(z.unknown()).optional(),
});

// === LAYOUT ===

const Stack = z.object({
  type: z.literal("stack"),
  direction: z.enum(["horizontal", "vertical"]).optional(),
  gap: z.enum(["sm", "md", "lg"]).optional(),
  children: z.array(z.lazy(() => ContentBlock)),
});

const Section = z.object({
  type: z.literal("section"),
  title: z.string().optional(),
  collapsible: z.boolean().optional(),
  children: z.array(z.lazy(() => ContentBlock)),
});

// === UNION ===

const ContentBlock = z.discriminatedUnion("type", [
  MetricCard, StatusBadge, DataTable, CodeBlock, ProgressBar, Markdown,
  ActionButton, QuickForm,
  Stack, Section,
]);

const ContentDocument = z.object({
  schemaVersion: z.literal(1),
  blocks: z.array(ContentBlock),
});

type ContentBlock = z.infer<typeof ContentBlock>;
type ContentDocument = z.infer<typeof ContentDocument>;

export {
  ContentBlock, ContentDocument,
  MetricCard, StatusBadge, DataTable, CodeBlock, ProgressBar, Markdown,
  ActionButton, QuickForm, Stack, Section,
};
```

### 10.4 Exemples concrets

**Exemple 1 : Rapport de run agent (dans une issue)**

```json
{
  "schemaVersion": 1,
  "blocks": [
    { "type": "stack", "direction": "horizontal", "gap": "md", "children": [
      { "type": "metric-card", "label": "Tests", "value": "47/50", "trend": "up" },
      { "type": "metric-card", "label": "Duree", "value": "3m 42s", "trend": "down" },
      { "type": "metric-card", "label": "Cout", "value": "$0.12", "trend": "flat" }
    ]},
    { "type": "status-badge", "text": "3 tests echoues", "variant": "warning" },
    { "type": "data-table", "columns": [
      { "key": "test", "label": "Test" },
      { "key": "status", "label": "Status" },
      { "key": "error", "label": "Erreur" }
    ], "rows": [
      { "test": "auth.login", "status": "FAIL", "error": "Timeout apres 5s" },
      { "test": "auth.signup", "status": "FAIL", "error": "Validation email" },
      { "test": "auth.reset", "status": "FAIL", "error": "SMTP non configure" }
    ]},
    { "type": "quick-form", "title": "Que faire ?", "fields": [
      { "name": "action", "label": "Action", "type": "select", "options": [
        { "label": "Rerun les tests echoues", "value": "rerun" },
        { "label": "Ignorer et merger", "value": "merge" },
        { "label": "Assigner a un dev", "value": "assign" }
      ]},
      { "name": "comment", "label": "Note", "type": "text", "placeholder": "Optionnel..." }
    ], "submitLabel": "Confirmer", "submitAction": "handle-test-failure" }
  ]
}
```

**Exemple 2 : Approbation dynamique (dans l'inbox)**

```json
{
  "schemaVersion": 1,
  "blocks": [
    { "type": "markdown", "content": "**Agent MarketBot** demande l'autorisation de publier une campagne." },
    { "type": "section", "title": "Details de la campagne", "children": [
      { "type": "stack", "direction": "horizontal", "gap": "md", "children": [
        { "type": "metric-card", "label": "Budget", "value": "$2,500" },
        { "type": "metric-card", "label": "Audience", "value": "12K" },
        { "type": "metric-card", "label": "Duree", "value": "7 jours" }
      ]},
      { "type": "data-table", "columns": [
        { "key": "channel", "label": "Canal" },
        { "key": "budget", "label": "Budget" },
        { "key": "objective", "label": "Objectif" }
      ], "rows": [
        { "channel": "LinkedIn Ads", "budget": "$1,500", "objective": "Lead gen" },
        { "channel": "Google Ads", "budget": "$1,000", "objective": "Brand awareness" }
      ]}
    ]},
    { "type": "quick-form", "fields": [
      { "name": "budget_ok", "label": "Budget approuve ?", "type": "select", "options": [
        { "label": "Oui, tel quel", "value": "approved" },
        { "label": "Reduire a $1,500", "value": "reduced" },
        { "label": "Rejeter", "value": "rejected" }
      ]},
      { "name": "start_date", "label": "Date de debut", "type": "date" },
      { "name": "notes", "label": "Notes pour l'agent", "type": "textarea" }
    ], "submitLabel": "Envoyer la decision", "submitAction": "campaign-approval" }
  ]
}
```

**Exemple 3 : Question rapide agent → humain (dans le chat)**

```json
{
  "schemaVersion": 1,
  "blocks": [
    { "type": "markdown", "content": "J'ai trouve 3 approches possibles pour cette refacto. Laquelle tu preferes ?" },
    { "type": "data-table", "columns": [
      { "key": "approach", "label": "Approche" },
      { "key": "effort", "label": "Effort" },
      { "key": "risk", "label": "Risque" }
    ], "rows": [
      { "approach": "A: Migration incrementale", "effort": "3 jours", "risk": "Faible" },
      { "approach": "B: Rewrite complet", "effort": "5 jours", "risk": "Moyen" },
      { "approach": "C: Adapter pattern", "effort": "2 jours", "risk": "Faible" }
    ]},
    { "type": "stack", "direction": "horizontal", "gap": "sm", "children": [
      { "type": "action-button", "label": "Approche A", "action": "choose-approach", "payload": { "choice": "A" }, "variant": "outline" },
      { "type": "action-button", "label": "Approche B", "action": "choose-approach", "payload": { "choice": "B" }, "variant": "outline" },
      { "type": "action-button", "label": "Approche C", "action": "choose-approach", "payload": { "choice": "C" }, "variant": "default" }
    ]}
  ]
}
```

### 10.5 Frontend — `<BlockRenderer>` et `<ContentRenderer>`

```typescript
// ui/src/components/blocks/BlockRenderer.tsx

interface BlockRendererProps {
  blocks: ContentBlock[];
  onAction?: (action: string, payload: Record<string, unknown>) => void;
}

function BlockRenderer({ blocks, onAction }: BlockRendererProps) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <BlockNode key={i} block={block} onAction={onAction} />
      ))}
    </div>
  );
}

function BlockNode({ block, onAction }: { block: ContentBlock; onAction?: ... }) {
  switch (block.type) {
    case "metric-card":     return <MetricCardBlock {...block} />;
    case "status-badge":    return <StatusBadgeBlock {...block} />;
    case "data-table":      return <DataTableBlock {...block} />;
    case "code-block":      return <CodeBlockBlock {...block} />;
    case "progress-bar":    return <ProgressBarBlock {...block} />;
    case "markdown":        return <MarkdownBody>{block.content}</MarkdownBody>;
    case "action-button":   return <ActionButtonBlock {...block} onAction={onAction} />;
    case "quick-form":      return <QuickFormBlock {...block} onAction={onAction} />;
    case "stack":           return <StackBlock {...block} onAction={onAction} />;
    case "section":         return <SectionBlock {...block} onAction={onAction} />;
    default:                return <UnknownBlock block={block} />;
  }
}
```

```typescript
// ui/src/components/ContentRenderer.tsx

interface ContentRendererProps {
  content?: string;           // markdown string (legacy)
  blocks?: ContentBlock[];    // structured blocks (new)
  onAction?: (action: string, payload: Record<string, unknown>) => void;
}

function ContentRenderer({ content, blocks, onAction }: ContentRendererProps) {
  // Prefer blocks if available
  if (blocks && blocks.length > 0) {
    return <BlockRenderer blocks={blocks} onAction={onAction} />;
  }
  // Fallback to markdown
  if (content) {
    return <MarkdownBody>{content}</MarkdownBody>;
  }
  return null;
}
```

### 10.6 Action Handler — Systeme generique

```typescript
// ui/src/hooks/useBlockActions.ts

function useBlockActions(context: { issueId?: string; agentId?: string; approvalId?: string }) {
  const queryClient = useQueryClient();

  const handleAction = useCallback(async (action: string, payload: Record<string, unknown>) => {
    // Built-in actions
    switch (action) {
      case "approve":
        return approvalsApi.approve(context.approvalId!, payload);
      case "reject":
        return approvalsApi.reject(context.approvalId!, payload);
      case "reply-to-agent":
        return agentsApi.sendMessage(context.agentId!, payload);
      default:
        // Generic API call action
        if (payload._apiPath) {
          return apiClient.request(payload._method as string, payload._apiPath as string, payload);
        }
        // Agent-defined custom action — send to agent as structured response
        return agentsApi.handleBlockAction(context.agentId!, { action, ...payload });
    }
  }, [context]);

  return handleAction;
}
```

### 10.7 API — 3 nouvelles routes

```
# Catalogue
GET  /companies/:companyId/block-catalogue          → retourne le schema Zod serialise
                                                       (pour injection dans les prompts agents)

# Validation
POST /companies/:companyId/blocks/validate           → valide un document ContentDocument
                                                       Body: { blocks: [...] }
                                                       Returns: { valid: boolean, errors?: [...] }

# Action handling
POST /companies/:companyId/block-actions/:actionId   → execute une action generee par un block
                                                       Body: { action: string, payload: {...}, context: {...} }
```

Les routes existantes (issues, comments, messages, approvals) acceptent simplement un champ `content_blocks` optionnel en plus du `content`/`description`/`payload` existant.

### 10.8 Integration par surface

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENT (generateur)                             │
│                                                                   │
│  System prompt ← GET /block-catalogue (schema Zod)               │
│                                                                   │
│  Agent genere : { schemaVersion: 1, blocks: [...] }              │
│  Validation serveur : POST /blocks/validate                      │
│  Si invalide → fallback markdown (content string)                │
│  Si valide → stocke dans content_blocks JSONB                    │
└──────────────────────┬───────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  ISSUES  │  │  INBOX   │  │   CHAT   │  │  TRACES  │
  │          │  │          │  │          │  │          │
  │ Content  │  │ Content  │  │ Content  │  │ Content  │
  │ Renderer │  │ Renderer │  │ Renderer │  │ Renderer │
  │  ↓       │  │  ↓       │  │  ↓       │  │  ↓       │
  │ blocks?  │  │ blocks?  │  │ blocks?  │  │ blocks?  │
  │  → Block │  │  → Block │  │  → Block │  │  → Block │
  │ Renderer │  │ Renderer │  │ Renderer │  │ Renderer │
  │  ↓       │  │  ↓       │  │  ↓       │  │  ↓       │
  │ else     │  │ else     │  │ else     │  │ else     │
  │  → Mark  │  │  → Mark  │  │  → Mark  │  │  → Mark  │
  │   down   │  │   down   │  │   down   │  │   down   │
  └──────────┘  └──────────┘  └──────────┘  └──────────┘
        │              │              │              │
        └──────────────┼──────────────┘──────────────┘
                       ▼
              ┌─────────────────┐
              │  ACTION HANDLER │
              │                 │
              │  action string  │
              │  + payload      │
              │       ↓         │
              │  Built-in?      │
              │  → API mutation │
              │  Custom?        │
              │  → Send to agent│
              └─────────────────┘
```

---

## 11. Relation avec les View Presets

Les deux systemes sont **orthogonaux et complementaires** :

| | View Presets | Agent Content Blocks |
|---|---|---|
| **Qui configure** | L'admin (dans l'interface d'admin) | L'agent (automatiquement) |
| **Quand** | Une fois, a la configuration du role | A chaque interaction/rapport/message |
| **Quoi** | Structure de navigation, dashboard layout | Contenu des messages, rapports, formulaires |
| **Stockage** | `view_presets.layout` JSONB | `*.content_blocks` JSONB (sur chaque surface) |
| **Rendu** | Widget Registry statique | `<BlockRenderer>` via json-render |
| **Interactivite** | Aucune (c'est du layout) | Oui (forms, boutons, actions) |

**Seul point de contact possible (futur) :** Les widgets de dashboard (View Presets) pourraient etre des documents blocks. Mais c'est optionnel — le Widget Registry statique est plus simple et suffit pour la v1.

---

## 12. Plan d'implementation — 6 phases

### Phase 0 : Foundation (~1 jour)
- Schema Zod `ContentBlock` + `ContentDocument` dans `@mnm/shared`
- Composant `<BlockRenderer>` avec les 12 block types
- Composant `<ContentRenderer>` (markdown + blocks)
- Tests unitaires du renderer
- **Pas de json-render encore** — implementation maison pour valider le pattern

### Phase 1 : Approvals (~2 jours)
- Migration `ApprovalPayload.tsx` → `<ContentRenderer>`
- Modifier le workflow d'approbation pour accepter `blocks` dans le payload
- Action handler pour approve/reject/revision via QuickForm
- Tester avec les 2 types existants (hire_agent, approve_ceo_strategy)
- **Premier use case en production**

### Phase 2 : Issues & Comments (~2 jours)
- Migration DB : `ALTER TABLE issues ADD COLUMN content_blocks JSONB`
- Migration DB : `ALTER TABLE comments ADD COLUMN content_blocks JSONB`
- Modifier `IssueDetail.tsx` et `CommentThread.tsx` pour utiliser `<ContentRenderer>`
- API : accepter `content_blocks` dans POST/PATCH issues et comments
- Les agents commencent a generer des rapports structures

### Phase 3 : Inbox enrichie (~2 jours)
- Modifier les items inbox pour supporter les blocks
- Actions rapides dans l'inbox (approve depuis la liste, pas besoin d'ouvrir)
- Rich notifications avec MetricCard + ActionButton

### Phase 4 : Chat structured messages (~2 jours)
- Migration DB : `ALTER TABLE messages ADD COLUMN content_blocks JSONB`
- Nouveau type de message `blocks` dans `MessageBubble.tsx`
- L'agent peut envoyer des formulaires dans le chat
- L'utilisateur repond via le formulaire → reponse structuree a l'agent

### Phase 5 : json-render + Streaming (~2 jours)
- Remplacer l'implementation maison du `<BlockRenderer>` par json-render
- Integrer le streaming JSONL pour le rendu progressif
- Tester les performances et le bundle size
- **Si json-render pose probleme** → on garde l'implementation maison, zero impact

**Estimation totale : ~11 jours**

---

## 13. Trade-offs documentes

| Decision | Gain | Cout |
|---|---|---|
| json-render en Phase 5 (pas Phase 0) | Valide le pattern sans dependance. Si json-render ne convient pas, on a deja la solution | Implementation maison du renderer (~200 lignes) |
| Colonnes JSONB optionnelles (pas de migration de contenu) | Zero breaking change, coexistence markdown + blocks | Deux chemins de rendu a maintenir |
| Catalogue de 12 composants (pas 39) | Simple a apprendre, facile a documenter, couvre 90% des cas | Certains layouts complexes necessitent du markdown |
| Actions generiques (pas de handlers par type) | Un seul point d'entree, scalable, pas de code par action | Logique d'action abstraite, debug potentiellement plus dur |
| `<ContentRenderer>` unifie | Un seul composant partout, zero duplication | Un level d'indirection supplementaire |
| Pas de table `block_catalogue` en v1 | Plus simple, le schema est dans le code TypeScript | Pas de versionning DB du catalogue (OK pour v1) |

---

## 14. Statistiques

| Metrique | Valeur |
|---|---|
| Idees generees | 38 |
| Categories | 5 |
| Insights cles | 7 |
| Techniques appliquees | 4 (Mind Mapping, SCAMPER, Reverse Brainstorming, Six Hats) |
| Composants catalogue v1 | 12 |
| Nouvelles tables DB | 0 (colonnes JSONB optionnelles) |
| Nouvelles routes API | 3 |
| Phases d'implementation | 6 |
| Estimation | ~11 jours |
| Breaking changes | 0 |

---

## 15. Recommandation finale

**OUI a json-render, mais comme Phase 5 d'une architecture plus large.**

L'architecture "Agent Content Blocks" est valable **avec ou sans json-render**. On commence par une implementation maison du renderer (Phase 0-4), on valide le pattern en production sur les approvals, issues, inbox et chat. Puis en Phase 5, on branche json-render pour gagner le streaming, les composants pre-faits, et la compatibilite cross-framework.

Si json-render disparait ou a un breaking change majeur → on garde l'implementation maison, zero impact.

**Le vrai delivrable n'est pas json-render. C'est le protocole de blocks agent↔humain.** json-render est un accelerateur, pas le fondement.

---

## 16. Prochaines etapes

1. **Story VP-S02** : Creer la story pour le schema Zod + `<BlockRenderer>` (Phase 0)
2. **Story VP-S03** : Migration approvals vers ContentRenderer (Phase 1)
3. **Tech Spec** : Detailler le systeme d'actions generique (Insight #5)
4. **POC** : Tester json-render en isolation pour valider la compatibilite shadcn/ui

---

*Genere par BMAD Method v6 — Creative Intelligence*
*Session : ~30 minutes*
