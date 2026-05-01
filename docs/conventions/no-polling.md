# Pas de polling — SSE/WebSocket exclusivement

## La règle

**JAMAIS** de :
- `setInterval(...)`
- `refetchInterval` dans un hook React Query
- `setTimeout` récursif pour rafraîchir
- Job qui re-query toutes les N secondes pour vérifier un état

**TOUJOURS** :
- Server-Sent Events (SSE) via `/events/ws` pour les updates serveur → client
- WebSocket pour le bidirectionnel (chat, validation badge interactif)
- Push depuis le serveur quand l'état change

## Pourquoi

1. **Scalabilité** — un broadcast SSE à 1000 clients coûte 1 push, pas 1000 queries.
2. **Latence** — l'utilisateur voit le changement en <100ms, pas 5s plus tard.
3. **Coût DB** — pas de queries inutiles toutes les N secondes pour des données qui n'ont pas bougé.
4. **Cohérence UI** — l'état est poussé, pas reconstruit chaque tick.

## Architecture

```
Server                                    Client
─────                                     ──────
event emitter (Node)        ──→  SSE  ──→  EventSource('/events/ws')
  - traceCompleted                            ↓
  - issueUpdated                          useLiveEvents()
  - workflowRunStateChanged                   ↓
  - aiAssistantStreaming                  React state update
```

## Comment écrire une feature live

1. **Côté serveur** : émettre un event quand l'état change.
   ```ts
   eventBus.emit("traceCompleted", { traceId, companyId, ... });
   ```

2. **Côté SSE handler** : filtrer par company + tags + abonnement.
   ```ts
   subscribe(req.actor.companyId, ["traceCompleted"], (evt) => {
     res.write(`data: ${JSON.stringify(evt)}\n\n`);
   });
   ```

3. **Côté UI** : hook `useLiveEvents` consomme.
   ```tsx
   const { events } = useLiveEvents(["traceCompleted"]);
   useEffect(() => { /* update local state */ }, [events]);
   ```

## Cas autorisés (rares)

- **Health check** d'un service externe (heartbeat outbound, pas inbound).
- **Reconnexion SSE** après déconnexion réseau (re-établir la connexion, pas poll).
- **Compteur visuel** purement décoratif (timer animation, pas data).

## Comment vérifier

```bash
grep -rn "setInterval\|refetchInterval" --include="*.ts" --include="*.tsx" ui/ server/
```

Toute occurrence dans le code applicatif est un **bug à corriger**, pas une feature.

## Liens

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — pipeline events
- [`../decision-log.md#15-zero-polling`](../decision-log.md) — décision
