# Sprint Plan — Epic WS-SEC: WebSocket Tag-Based Filtering

> **Date**: 2026-04-07
> **Epic Owner**: PM/PO
> **Source**: `_bmad-output/dashboard-v2-architecture.md` — Section 1
> **Status**: DRAFT

---

## Synthese

| Metrique | Valeur |
|----------|--------|
| **Stories** | 11 |
| **Total Story Points** | 39 SP |
| **Effort estime** | ~2 sprints (Sprint 1: infrastructure + migrations critiques, Sprint 2: migrations restantes + tests) |
| **Fichiers crees** | 2 nouveaux (`event-visibility.ts`, `agent-tag-cache.ts`) |
| **Fichiers modifies** | ~36 fichiers existants |
| **Call sites a migrer** | ~100+ appels `publishLiveEvent` dans 34 fichiers |

### Repartition par sprint

| Sprint | Stories | Points |
|--------|---------|--------|
| Sprint 1 | WS-SEC-01 a WS-SEC-06 | 22 SP |
| Sprint 2 | WS-SEC-07 a WS-SEC-11 | 17 SP |

---

## Stories

### WS-SEC-01 — Ajouter le type `EventVisibility` au package shared

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-01 |
| **Points** | 2 |
| **Dependencies** | Aucune |

**Description**

Ajouter le type discrimine `EventVisibility` (4 scopes: `company-wide`, `tag-filtered`, `actor-only`, `agents`) au package `@mnm/shared`. Mettre a jour le type `LiveEvent` pour inclure le champ optionnel `visibility`. Exporter les nouveaux types depuis l'index du package.

**Criteres d'acceptation**

- [ ] Le type `EventVisibility` est defini dans `packages/shared/src/types/live.ts` avec les 4 scopes documentes dans l'architecture
- [ ] Le type `LiveEvent` inclut `visibility: EventVisibility` comme champ requis
- [ ] Les types sont exportes depuis `packages/shared/src/index.ts`
- [ ] `bun run typecheck` passe sur les 13 packages (aucune regression)

**Fichiers a modifier**

| Action | Fichier |
|--------|---------|
| Modifier | `packages/shared/src/types/live.ts` |
| Modifier | `packages/shared/src/index.ts` (si necessaire pour l'export) |

---

### WS-SEC-02 — Mettre a jour `publishLiveEvent` avec le parametre `visibility`

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-02 |
| **Points** | 2 |
| **Dependencies** | WS-SEC-01 |

**Description**

Modifier la fonction `publishLiveEvent` dans `live-events.ts` pour accepter un parametre optionnel `visibility` de type `EventVisibility`. La valeur par defaut est `{ scope: "company-wide" }`. Mettre a jour la fonction interne `toLiveEvent` pour inclure `visibility` dans l'objet `LiveEvent` emis. Ceci est retro-compatible : tous les appels existants continuent de fonctionner sans modification.

**Criteres d'acceptation**

- [ ] `publishLiveEvent` accepte `visibility?: EventVisibility` en parametre
- [ ] Sans `visibility` fourni, l'evenement est cree avec `{ scope: "company-wide" }` par defaut
- [ ] Avec `visibility` fourni, la valeur est propagee dans l'objet `LiveEvent`
- [ ] Tous les appels existants (sans `visibility`) continuent de fonctionner sans erreur
- [ ] `bun run typecheck` passe

**Fichiers a modifier**

| Action | Fichier |
|--------|---------|
| Modifier | `server/src/services/live-events.ts` |

---

### WS-SEC-03 — Creer la fonction de filtrage `canReceiveEvent` + tests unitaires

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-03 |
| **Points** | 5 |
| **Dependencies** | WS-SEC-01 |

**Description**

Creer le fichier `server/src/realtime/event-visibility.ts` contenant la fonction pure `canReceiveEvent(event, actor, resolveAgentTagOverlap)`. Cette fonction determine si un acteur connecte doit recevoir un evenement donne, en evaluant les 4 scopes de visibilite. Elle doit etre synchrone (aucune requete DB) et rapide. Ecrire des tests unitaires exhaustifs couvrant tous les scopes et cas limites.

**Criteres d'acceptation**

- [ ] La fonction `canReceiveEvent` est exportee depuis `server/src/realtime/event-visibility.ts`
- [ ] Scope `company-wide` : retourne `true` pour tout acteur
- [ ] Scope `actor-only` : retourne `true` uniquement si `actor.actorId === vis.actorId`
- [ ] Scope `tag-filtered` : retourne `true` si au moins 1 tag commun entre l'acteur et l'evenement
- [ ] Scope `tag-filtered` : retourne `false` si tagIds vide cote acteur ou evenement
- [ ] Scope `agents` : retourne `true` si `resolveAgentTagOverlap` retourne `true` pour au moins 1 agentId
- [ ] `bypassTagFilter = true` : retourne `true` pour tous les scopes (admin/CAO bypass)
- [ ] Scope inconnu : retourne `false` (securite par defaut)
- [ ] Tests unitaires couvrent tous les scopes, le bypass admin, les cas limites (sets vides, acteurs non-matches)
- [ ] Couverture >= 90% sur ce fichier

**Fichiers a creer/modifier**

| Action | Fichier |
|--------|---------|
| Creer | `server/src/realtime/event-visibility.ts` |
| Creer | `server/src/realtime/__tests__/event-visibility.test.ts` |

---

### WS-SEC-04 — Creer le cache de tags des agents (`agent-tag-cache`)

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-04 |
| **Points** | 3 |
| **Dependencies** | Aucune |

**Description**

Creer le fichier `server/src/realtime/agent-tag-cache.ts` implementant un cache en memoire avec TTL (60s) pour les tags des agents. Le cache expose `getAgentTags(companyId, agentId)` (async, retourne `Set<string>`) et `invalidate(agentId)` (sync). Les tags sont charges depuis la table `tagAssignments` via Drizzle ORM. Ecrire des tests unitaires.

**Criteres d'acceptation**

- [ ] `agentTagCache(db)` retourne un objet avec `getAgentTags` et `invalidate`
- [ ] `getAgentTags` retourne les tagIds depuis le cache si < 60s, sinon refait la requete DB
- [ ] `invalidate(agentId)` supprime l'entree du cache pour forcer un rechargement
- [ ] Requete DB utilise `tagAssignments` filtre par `companyId`, `targetType="agent"`, `targetId=agentId`
- [ ] Tests unitaires avec mock DB verifient le comportement du TTL et de l'invalidation
- [ ] Aucune fuite memoire : le cache est borne (considerer un max entries ou cleanup periodique)

**Fichiers a creer/modifier**

| Action | Fichier |
|--------|---------|
| Creer | `server/src/realtime/agent-tag-cache.ts` |
| Creer | `server/src/realtime/__tests__/agent-tag-cache.test.ts` |

---

### WS-SEC-05 — Integrer le filtrage dans le handler WebSocket

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-05 |
| **Points** | 5 |
| **Dependencies** | WS-SEC-02, WS-SEC-03, WS-SEC-04 |

**Description**

Modifier `live-events-ws.ts` pour :

1. **Au handshake** (`authorizeUpgrade`) : charger le role et les tags de l'utilisateur connecte via `accessService.resolveRole()` et `accessService.getTagIds()`. Stocker dans le contexte WS etendu (`WsActorContext`).
2. **Au filtrage** : avant chaque `socket.send()`, appeler `canReceiveEvent()` et ignorer l'evenement si `false`.
3. **Stripping** : retirer le champ `visibility` de l'evenement avant envoi au client (metadonnee interne).
4. **Resolution agents** : utiliser `agentTagCache` pour resoudre les tags des agents, avec cache par connexion (`agentVisibilityCache`).

**Criteres d'acceptation**

- [ ] L'interface `WsActorContext` inclut `tagIds: ReadonlySet<string>`, `bypassTagFilter: boolean`, `agentVisibilityCache: Map<string, boolean>`
- [ ] Les tags utilisateur sont charges une fois au handshake (pas a chaque evenement)
- [ ] `canReceiveEvent` est appele pour chaque evenement avant `socket.send()`
- [ ] Les evenements filtres ne sont PAS envoyes au client (pas de fuite d'information)
- [ ] Le champ `visibility` est retire (`const { visibility, ...clientEvent } = event`) avant serialisation
- [ ] Les agents actors utilisent leurs propres tags
- [ ] Les admins (bypassTagFilter=true) recoivent tous les evenements
- [ ] Aucune regression : les clients existants continuent de recevoir les evenements `company-wide` normalement

**Fichiers a modifier**

| Action | Fichier |
|--------|---------|
| Modifier | `server/src/realtime/live-events-ws.ts` |

---

### WS-SEC-06 — Migrer les appels heartbeat (~10 call sites)

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-06 |
| **Points** | 5 |
| **Dependencies** | WS-SEC-02 |

**Description**

Migrer les ~10 appels `publishLiveEvent` dans `heartbeat.ts` pour ajouter `visibility: { scope: "agents", agentIds: [agentId] }`. Le heartbeat est le fichier le plus critique avec le volume d'evenements le plus eleve. Chaque call site a un `agentId` disponible dans le contexte.

Types d'evenements concernes : `heartbeat.run.queued`, `heartbeat.run.status`, `heartbeat.run.event`, `heartbeat.run.log`, `heartbeat.run.completed`, `heartbeat.issue_created`, `heartbeat.issue_updated`.

**Criteres d'acceptation**

- [ ] Tous les appels `publishLiveEvent` dans `heartbeat.ts` incluent `visibility: { scope: "agents", agentIds: [agentId] }`
- [ ] L'`agentId` utilise est celui du contexte de run/heartbeat (deja disponible dans le scope local)
- [ ] `bun run typecheck` passe
- [ ] Test manuel ou automatise : un utilisateur sans tag commun avec l'agent NE recoit PAS les evenements heartbeat de cet agent via WebSocket

**Fichiers a modifier**

| Action | Fichier |
|--------|---------|
| Modifier | `server/src/services/heartbeat.ts` |

---

### WS-SEC-07 — Migrer les appels trace (~10 call sites)

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-07 |
| **Points** | 3 |
| **Dependencies** | WS-SEC-02 |

**Description**

Migrer les appels `publishLiveEvent` dans `bronze-trace-capture.ts` (5 appels) et `trace-service.ts` (5 appels) pour ajouter `visibility: { scope: "agents", agentIds: [agentId] }`. L'`agentId` est disponible dans `opts.agentId`, `state.agentId`, ou le champ `agentId` de la trace.

Types d'evenements : `trace.created`, `trace.observation_created`, `trace.observation_completed`, `trace.completed`.

**Criteres d'acceptation**

- [ ] Tous les appels dans `bronze-trace-capture.ts` incluent `visibility` avec l'agentId correct
- [ ] Tous les appels dans `trace-service.ts` incluent `visibility` avec l'agentId correct
- [ ] `bun run typecheck` passe
- [ ] Les evenements trace ne sont recus que par les utilisateurs partageant un tag avec l'agent

**Fichiers a modifier**

| Action | Fichier |
|--------|---------|
| Modifier | `server/src/services/bronze-trace-capture.ts` |
| Modifier | `server/src/services/trace-service.ts` |

---

### WS-SEC-08 — Migrer les appels chat (~12 call sites)

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-08 |
| **Points** | 3 |
| **Dependencies** | WS-SEC-02 |

**Description**

Migrer les appels `publishLiveEvent` dans les fichiers lies au chat :
- `chat.ts` (4 appels) : `chat.channel_created`, `chat.channel_closed`, `chat.message_sent`
- `routes/chat.ts` (3 appels) : `chat.message_sent` (edit/delete)
- `chat-sharing.ts` (3 appels) : `chat.shared`, `chat.forked`
- `chat-context-link.ts` (2 appels) : `chat.context_linked`

La visibilite suit l'agent du channel : `visibility: { scope: "agents", agentIds: [agentId] }`.

**Criteres d'acceptation**

- [ ] Tous les appels dans les 4 fichiers chat incluent `visibility` avec l'agentId du channel
- [ ] L'agentId est recupere depuis le channel (deja disponible dans le contexte)
- [ ] `bun run typecheck` passe
- [ ] Les messages chat ne sont visibles que par les utilisateurs ayant acces a l'agent du channel

**Fichiers a modifier**

| Action | Fichier |
|--------|---------|
| Modifier | `server/src/services/chat.ts` |
| Modifier | `server/src/routes/chat.ts` |
| Modifier | `server/src/services/chat-sharing.ts` |
| Modifier | `server/src/services/chat-context-link.ts` |

---

### WS-SEC-09 — Migrer les appels restants (~65+ call sites)

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-09 |
| **Points** | 8 |
| **Dependencies** | WS-SEC-02 |

**Description**

Migrer tous les appels `publishLiveEvent` restants non couverts par WS-SEC-06/07/08. Chaque fichier a un pattern de visibilite specifique selon le groupe documente dans l'architecture.

**Groupe A — Agent-scoped** (`scope: "agents"`) :

| Fichier | Appels | Source agentId |
|---------|--------|----------------|
| `orchestrator.ts` | 3 | Agent ID du contexte d'orchestration |
| `compaction-watcher.ts` | 5 | Agent surveille |
| `compaction-reinjection.ts` | 3 | Agent compacte |
| `compaction-kill-relaunch.ts` | 3 | Agent relance |
| `cursor-enforcement.ts` | 3 | Agent du curseur |
| `mcp-connectors.ts` | 6 | Agent proprietaire du connecteur |
| `workflow-enforcer.ts` | 4 | Agent executant |
| `hitl-validation.ts` | 4 | Agent demandant validation |
| `routines.ts` | 8 | Agent executant la routine |
| `artifact.ts` | 4 | Agent proprietaire de l'artefact |
| `document.ts` | 3 | Agent du channel/document |
| `document-ingestion.ts` | 3 | Agent du document |
| `routes/documents.ts` | 1 | Agent du document |
| `feedback.ts` | 3 | Agent du feedback |
| `a2a-bus.ts` | 4 | Agent(s) concernes |
| `stages.ts` (services) | 1 | Agent en transition |

**Groupe C — Company-wide** (`scope: "company-wide"`, explicite) :

| Fichier | Appels |
|---------|--------|
| `audit.ts` | 2 |
| `activity-log.ts` | 2 |
| `dashboard-refresh.ts` | 2 |
| `workspace-context.ts` | 3 |
| `workspace-context-watcher.ts` | 2 |
| `workflows.ts` | 4 |
| `routes/stages.ts` | 2 |

**Groupe D — Actor-only** (`scope: "actor-only"`) :

| Fichier | Appels | Visibilite |
|---------|--------|------------|
| `folder.ts` | 4 | `actor-only` (proprietaire du dossier) |

**Groupe special — Drift** :

| Fichier | Appels | Visibilite |
|---------|--------|------------|
| `drift-monitor.ts` | 5 | `company-wide` (decision en attente, defaut safe) |

**Criteres d'acceptation**

- [ ] Tous les appels `publishLiveEvent` dans le codebase incluent un parametre `visibility` explicite
- [ ] Les agent-scoped utilisent `{ scope: "agents", agentIds: [agentId] }`
- [ ] Les company-wide utilisent `{ scope: "company-wide" }`
- [ ] `folder.ts` utilise `{ scope: "actor-only", actorId: userId }`
- [ ] `bun run typecheck` passe
- [ ] Aucun appel `publishLiveEvent` ne reste sans `visibility` explicite (verifiable par grep)

**Fichiers a modifier**

| Action | Fichier |
|--------|---------|
| Modifier | `server/src/services/orchestrator.ts` |
| Modifier | `server/src/services/compaction-watcher.ts` |
| Modifier | `server/src/services/compaction-reinjection.ts` |
| Modifier | `server/src/services/compaction-kill-relaunch.ts` |
| Modifier | `server/src/services/cursor-enforcement.ts` |
| Modifier | `server/src/services/mcp-connectors.ts` |
| Modifier | `server/src/services/workflow-enforcer.ts` |
| Modifier | `server/src/services/hitl-validation.ts` |
| Modifier | `server/src/services/routines.ts` |
| Modifier | `server/src/services/artifact.ts` |
| Modifier | `server/src/services/document.ts` |
| Modifier | `server/src/services/document-ingestion.ts` |
| Modifier | `server/src/routes/documents.ts` |
| Modifier | `server/src/services/feedback.ts` |
| Modifier | `server/src/services/a2a-bus.ts` |
| Modifier | `server/src/services/stages.ts` |
| Modifier | `server/src/services/audit.ts` |
| Modifier | `server/src/services/activity-log.ts` |
| Modifier | `server/src/services/dashboard-refresh.ts` |
| Modifier | `server/src/routes/workspace-context.ts` |
| Modifier | `server/src/services/workspace-context-watcher.ts` |
| Modifier | `server/src/services/workflows.ts` |
| Modifier | `server/src/routes/stages.ts` |
| Modifier | `server/src/services/folder.ts` |
| Modifier | `server/src/services/drift-monitor.ts` |

---

### WS-SEC-10 — Retirer le champ `visibility` avant envoi au client

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-10 |
| **Points** | 1 |
| **Dependencies** | WS-SEC-05 |

**Description**

S'assurer que le champ `visibility` est systematiquement retire de l'objet evenement avant `socket.send()`. Ce champ est une metadonnee interne au serveur et ne doit jamais etre expose aux clients. Verifier egalement que les listeners globaux (`subscribeAllLiveEvents`) ne sont pas impactes — ils sont server-side uniquement et n'ont pas besoin de filtrage.

**Criteres d'acceptation**

- [ ] Le destructuring `const { visibility, ...clientEvent } = event` est applique dans le handler WS avant `socket.send()`
- [ ] Un test unitaire verifie qu'un evenement avec `visibility` est envoye sans ce champ
- [ ] Les listeners globaux (`subscribeAllLiveEvents`) continuent de recevoir l'evenement complet (avec `visibility`)
- [ ] Aucune regression cote client : les types `LiveEvent` cote UI ne contiennent pas `visibility`

**Fichiers a modifier**

| Action | Fichier |
|--------|---------|
| Modifier | `server/src/realtime/live-events-ws.ts` (probablement deja fait dans WS-SEC-05, cette story valide et teste) |
| Modifier | `packages/shared/src/types/live.ts` — ajouter un type `ClientLiveEvent` = `Omit<LiveEvent, "visibility">` si pertinent |

---

### WS-SEC-11 — Test d'integration E2E du filtrage WebSocket

| Champ | Valeur |
|-------|--------|
| **ID** | WS-SEC-11 |
| **Points** | 5 |
| **Dependencies** | WS-SEC-05, WS-SEC-06 |

**Description**

Ecrire un test d'integration (Playwright ou test server-side) qui valide le filtrage de bout en bout :

1. Creer 2 utilisateurs (User A avec tag "marketing", User B avec tag "engineering")
2. Creer 1 agent avec tag "engineering"
3. Connecter les 2 utilisateurs via WebSocket
4. Emettre un evenement heartbeat pour l'agent
5. Verifier que User B recoit l'evenement et User A ne le recoit PAS
6. Emettre un evenement `company-wide`
7. Verifier que les 2 utilisateurs le recoivent
8. Tester le bypass admin : un admin recoit tout

**Criteres d'acceptation**

- [ ] Test passe : User A (tag "marketing") ne recoit PAS les evenements d'un agent tag "engineering"
- [ ] Test passe : User B (tag "engineering") recoit les evenements de l'agent tag "engineering"
- [ ] Test passe : Les 2 utilisateurs recoivent les evenements `company-wide`
- [ ] Test passe : Un admin (bypassTagFilter=true) recoit tous les evenements
- [ ] Test passe : Le champ `visibility` n'est PAS present dans les messages recus par les clients
- [ ] Test passe : `actor-only` — seul l'acteur cible recoit l'evenement
- [ ] Le test est reproductible et ne depend pas de timing (utiliser des promesses/attentes explicites)

**Fichiers a creer**

| Action | Fichier |
|--------|---------|
| Creer | `server/src/realtime/__tests__/ws-tag-filtering.integration.test.ts` (ou equivalent E2E) |

---

## Diagramme de dependances

```
WS-SEC-01 (Types shared)
  |
  +---> WS-SEC-02 (Publisher update)
  |       |
  |       +---> WS-SEC-06 (Migrate heartbeat)
  |       +---> WS-SEC-07 (Migrate traces)
  |       +---> WS-SEC-08 (Migrate chat)
  |       +---> WS-SEC-09 (Migrate remaining)
  |
  +---> WS-SEC-03 (canReceiveEvent filter)
  |       |
  |       +---> WS-SEC-05 (WS handler integration)
  |               |
  |               +---> WS-SEC-10 (Strip visibility)
  |               +---> WS-SEC-11 (Integration test)
  |
WS-SEC-04 (Agent tag cache) ---+
                                |
                    WS-SEC-05 --+
```

## Notes d'implementation

1. **Retro-compatibilite** : Le parametre `visibility` est optionnel avec defaut `company-wide`. Toutes les migrations (WS-SEC-06 a 09) sont independantes et peuvent etre faites en parallele.

2. **Securite par defaut** : Un scope inconnu retourne `false` (deny by default). Le defaut `company-wide` est temporaire pour la migration — une fois toutes les migrations terminees, envisager de rendre `visibility` obligatoire.

3. **Performance** : Le filtre `canReceiveEvent` est synchrone et n'effectue aucune requete DB. Les tags utilisateur sont charges une fois au handshake. Les tags agents sont caches 60s avec lazy-loading.

4. **Over-delivery acceptable** : Pendant la migration, les call sites non encore migres emettent en `company-wide` (comportement actuel). C'est une sur-livraison acceptable — jamais de sous-livraison.

5. **Verification post-migration** : Apres WS-SEC-09, un `grep -r "publishLiveEvent" --include="*.ts" | grep -v "visibility"` ne doit retourner que la definition de la fonction elle-meme.
