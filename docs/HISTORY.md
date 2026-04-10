# Historique de MnM

Cette page retrace la chronologie du projet, les sessions de brainstorming qui ont construit la vision, les metriques de developpement et la roadmap. Pour l'architecture technique, voir [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Chronologie du projet

| Date | Jalon |
|---|---|
| **Fev 2026** | Fork de Paperclip, premieres sessions de brainstorming |
| **19 fev** | Brainstorm Cross-Document Drift Detection (architecture fondatrice) |
| **21 fev** | Brainstorm IDE for Agent-Driven Dev — 45 idees, changement de paradigme |
| **Mar 2026** | Pivot B2B enterprise, migration PostgreSQL |
| **12 mar** | Brainstorm B2B Transformation — 5 piliers de valeur identifies |
| **16 mar** | Brainstorm Distributed Tracing — trace-as-context |
| **20-21 mar** | Decision architecture Roles+Tags, definition du CAO |
| **22 mar** | Sprint Roles+Tags termine (132 SP, tous P1 complete) |
| **23 mar** | Review architecture — 92% d'alignement avec les specs |
| **2 avr** | Epic Config Layers termine (5 stories, 47 SP) |
| **3 avr** | Epic Chat Collaboratif termine (18 stories, 80 SP) |
| **4 avr** | **69/69 stories B2B completees** — MVP enterprise ready |
| **5-6 avr** | Blocks Platform (View Presets, Dashboard CAO, Agent Forms, Inbox) — 8 stories livrees |
| **6 avr** | GitNexus integre (8752 nodes, 21K edges). Brainstorm Projects v2 — vision Feature Map & Traceability |
| **8-10 avr** | MCP Server — 68 tools, 10 resources, OAuth 2.1 avec ecran de consentement granulaire |

---

## Sessions de brainstorming

Le projet a ete construit sur une reflexion approfondie documentee dans `_bmad-output/` :

- **Cross-Document Drift** (fev 19) — Detection de derive hierarchique entre documents de specs
- **IDE for Agent-Driven Dev** (fev 21) — 45 idees via assumption-reversal, morphological analysis, cross-pollination. Paradigme : superviser, pas coder.
- **B2B Transformation** (mar 12) — 24 idees via role-playing et what-if scenarios. 5 noyaux de valeur.
- **Distributed Tracing** (mar 16) — Trace-as-context, vision Langfuse-native
- **Enterprise Architecture** (mar 20-21) — Modele hybride Roles+Tags, CAO, pods Docker, task pools
- **Projects v2 — Feature Map & Traceability** (avr 6) — Vision complete : nodes generiques + entity_links, Feature Map comme vue centrale, AC tracking, compliance traceability, GitNexus MCP par repo, handoff chat → production

---

## Metriques

- **292+ commits** sur la branche B2B
- **503+ fichiers** modifies
- **~194 000 lignes** ajoutees
- **69/69 stories** B2B implementees (16 epics)
- **51 tables** PostgreSQL (41 avec RLS)
- **71 services** backend
- **35+ routes** API
- **99+ composants** React
- **70+ fichiers** de tests E2E
- **13 packages** typechecked
- **68 tools + 10 resources** MCP

---

## Features implementees (detail)

### RBAC & Multi-tenant (15 stories)
- 4 roles dynamiques (Admin, Lead, Member, Viewer) stockes en DB
- 20+ permissions granulaires, matrice de permissions UI
- Isolation par tags : les utilisateurs ne voient que les agents/issues partageant au moins 1 tag
- RLS PostgreSQL sur 41 tables
- Invitations par email, import CSV bulk, inscription sur invitation uniquement

### Orchestration & Agents (5 stories)
- CAO (Chief Agent Officer) : agent systeme auto-cree, watchdog silencieux + interactif via @cao
- Machine a etats XState (12 transitions), WorkflowEnforcer, validation HITL
- Workflow templates BMAD (Brief → PRD → Architecture → Stories → Dev → Test)
- Editeur visuel de workflows

### Sandbox & Securite (5 stories)
- Container Docker persistant par utilisateur
- 5 couches de securite : ephemere, read-only, mount allowlist, credential proxy, reseaux isoles
- Token OAuth Claude injecte par run (pas de credentials sur le filesystem sandbox)
- `docker exec` avec rewrite automatique localhost → host.docker.internal

### Pipeline de Traces (8 stories)
- Gold (vue par defaut) : timeline intelligente, phases scorees, annotees, contextualisees
- Silver : observations groupees avec resumes
- Bronze : blocs JSON bruts (debug)
- Auto-generation a la completion du trace
- Enrichissement LLM hierarchique : global → workflow → agent → issue

### Config Layers (5 stories)
- 8 tables DB, 22+ routes API, 6 services backend, 10+ composants frontend
- Types d'items : MCP Servers, Skills, Hooks, Settings, Credentials — chacun avec editeur dedie
- Merge par priorite : Company enforced (999) > Base layer (500) > Additional (0-498)
- Detection de conflits avec advisory locks PostgreSQL
- OAuth2 PKCE pour credentials MCP (chiffrement AES-256-GCM)
- Historique de revisions avec snapshots

### Chat Collaboratif (18 stories)
- Chat temps reel 1-1 avec agents IA via WebSocket
- Artifacts : versiones, preview HTML dans side panel, CRUD via tools
- Documents & RAG : upload, ingestion pipeline, embeddings pgvector, recherche par similarite cosinus
- Dossiers : visibilite par tags (prive/public + tags directs), auto-save artifacts
- Slash commands, @mentions, streaming
- 8 tables DB, 13 nouvelles permissions

### MCP Server
- 68 tools + 10 resources sur 14 domaines
- OAuth 2.1 complet avec PKCE, Dynamic Client Registration, ecran de consentement granulaire
- Transport Streamable HTTP + SSE legacy
- Rate limiting + semaphore DB + event loop monitoring
- OAuth store en PostgreSQL (survit aux restarts)

### Observabilite & Audit
- Table `audit_events` immutable (protegee par TRIGGER, partitionnee par mois)
- Auto-emission sur actions critiques
- UI AuditLog avec filtres et export
- Dashboard role-based avec cartes configurables, updates WebSocket temps reel

### Communication Agent-to-Agent
- Bus de communication A2A avec regles de permissions
- Trail d'audit pour chaque echange
- Connecteurs MCP

### Drift Detection
- Detection automatique de derive entre specs et code
- UI diff viewer side-by-side
- Persistence en DB

### Dual-Speed Workflow
- Curseurs d'automation (Manual/Assisted/Auto x 4 niveaux)
- Slider visuel UI + enforcement

---

## Roadmap — ce qui reste

| Item | Priorite | Description |
|---|---|---|
| **Projects v2 — Feature Map & Traceability** | P0 | Arbre de nodes generique (features, ACs, requirements) + entity_links (graph de liens). Feature Map comme vue centrale du projet. Coverage structurelle par feature. Voir `_bmad-output/vision-projects-v2-2026-04-06.md` |
| **GitNexus MCP par repo** | P0 | 1 MCP server par codebase exposant le knowledge graph du code. Agents + humains peuvent query l'architecture sans cloner. |
| **Handoff Chat → Production** | P1 | Agent extracteur qui distille un brainstorm chat en document structure pour les equipes prod. |
| Validation E2E complete | P1 | Deploy test instance, smoke test 8 scenarios CBA |
| Import Jira intelligent | P1 | Mapping semantique Jira → MnM, dry-run preview |
| "Drive the Agent" Live UX | P1 | Split view code+chat, quick-actions, historique navigable |
| Distributed Tracing avance | P2 | OpenTelemetry, correlation trace/audit/drift, alertes |
| Drift Auto-Remediation | P2 | Politiques configurables, kill+relance automatique |
| Auto-Generated Connectors | P2 | Agent analyse API/codebase, genere un MCP server |
| MnM Self-Modifying | P3 | Les agents modifient MnM lui-meme |
| Agent Communication Proxies | P3 | Echange de contexte machine-to-machine |
| AI Auto-Brainstorming | P3 | Detection de problemes, proposition de solutions |
