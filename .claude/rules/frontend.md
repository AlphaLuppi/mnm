---
name: frontend
description: Patterns frontend MnM (React 18 + shadcn/ui + Tailwind + SSE). Auto-chargée quand on édite du code UI ou desktop.
paths:
  - "ui/src/**/*.{ts,tsx}"
  - "apps/desktop/src/**/*.{ts,tsx}"
---

# Frontend MnM — Patterns à suivre

Stack : React 18 · Vite · shadcn/ui · Tailwind · React Query (TanStack) · Monaco editor · Tauri (desktop, parité requise).

> **Règle no-polling absolue** : voir [`docs/conventions/no-polling.md`](../../docs/conventions/no-polling.md). Pas de duplication ici.

## 1 — Composants UI : toujours shadcn

Toutes les primitives (Button, Switch, Dialog, Checkbox, Tabs, Sheet, Popover, Tooltip, Badge, Card, Skeleton, etc.) vivent dans `ui/src/components/ui/`. **Importer depuis là, jamais réimplémenter inline.**

```tsx
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
```

Si une primitive n'existe pas dans `ui/src/components/ui/`, **la créer là d'abord** (en suivant le pattern shadcn : Radix headless + cn() + variants), puis l'importer. Ne jamais inliner un Switch maison ni un Dialog custom dans une page.

## 2 — Data fetching : React Query avec clés versionnées

Toutes les query keys vivent dans `ui/src/lib/queryKeys.ts`. **Ajouter la clé là** au lieu d'écrire un tableau inline ; ça évite les invalidations cassées.

```tsx
import { queryKeys } from "@/lib/queryKeys";

const { data } = useQuery({
  queryKey: queryKeys.agents.detail(companyId, agentId),
  queryFn: () => agentsApi.get(companyId, agentId),
});
```

**Toute clé scopée à un tenant DOIT inclure `companyId` en premier param** (après le namespace). C'est la convention dans `queryKeys.ts` — ne pas y déroger : sans `companyId` dans la clé, deux tenants partagent un cache.

❌ Pas de `refetchInterval`, pas de `setInterval`, pas de `setTimeout` récursif. Pour du live → SSE/WebSocket.

## 3 — Live updates : SSE/WebSocket via le provider central

Une seule connexion WS est ouverte par session, gérée par `ui/src/context/LiveUpdatesProvider.tsx`. Elle reçoit les events serveur scopés au `companyId` actif et appelle `queryClient.invalidateQueries(...)` sur les clés concernées.

Pour s'abonner à un sous-flux (ex: governed run), créer un hook qui écoute un `CustomEvent` DOM dispatché par le provider :

```tsx
// ui/src/hooks/useGovernedRunEvents.ts (pattern existant)
useEffect(() => {
  function onUpdate(e: Event) {
    const detail = (e as CustomEvent<{ companyId: string; runId: string }>).detail;
    if (detail.companyId !== companyId || detail.runId !== runId) return;
    qc.invalidateQueries({
      queryKey: queryKeys.governedWorkflows.runDetail(companyId, runId),
    });
  }
  window.addEventListener("governed_run:updated", onUpdate);
  return () => window.removeEventListener("governed_run:updated", onUpdate);
}, [companyId, runId, qc]);
```

Pour un stream POST→SSE (ex: AI assistant), passer par `governedWorkflowsApi.streamAiChat(...)` qui wrappe `fetch` + lecture du flux. Voir `useAiAssistant` pour le pattern complet (state local, AbortController, callbacks `onToken`/`onFileProposal`/`onError`/`onDone`).

## 4 — Multi-tenant : `companyId` dans l'URL

Source de vérité = path. Le middleware backend lit `req.params.companyId` et applique RLS dessus.

```tsx
import { useParams } from "@/lib/router";
const { companyId } = useParams<{ companyId: string }>();

// Tous les appels API en dépendent
api.get(`/companies/${companyId}/agents/${agentId}`);
```

❌ Pas de `companyId` global muet, pas d'auto-injection silencieuse, pas de fallback `useCurrentCompany()` quand l'URL est censée le porter.

## 5 — Parity tracker : OBLIGATOIRE

Toute PR qui touche `ui/src/pages/`, `ui/src/components/`, `apps/desktop/src-tauri/`, ou ajoute une commande IPC **doit aussi toucher** `scripts/parity/data.ts`.

1. Trouver le domaine dans `parityData.domains` (ou en ajouter un).
2. Ajouter/éditer le `Feature` avec `web` et `desktop` PlatformState.
3. Statuts : `done | dev-only | partial | missing | n/a`.
4. Si l'une des deux plateformes n'est pas à jour, remplir `todo` (`code`, `config`, `tests`, `notes`).
5. Réutiliser un `BLOCKERS["..."]` existant plutôt que de répéter une description.
6. Vérifier : `bun run parity --missing` doit refléter l'état réel.

Si vraiment aucune entrée ne s'applique (refacto interne sans surface user-facing), le mentionner explicitement dans le PR body.

## 6 — Monaco editor : lazy + schémas en `beforeMount`

Monaco est lourd → **toujours `lazy()`** :

```tsx
const Monaco = lazy(() => import("@monaco-editor/react"));
```

Enregistrer les schémas JSON dans `beforeMount` (avant que l'éditeur ne soit créé) pour avoir la validation dès la première frappe :

```tsx
const handleBeforeMount: BeforeMount = (monaco) => {
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: true,
    schemas: [{ uri: SCHEMA_URI, fileMatch: ["*"], schema: workflowJsonSchema }],
  });
};
```

Voir `ui/src/pages/GovernedWorkflowEditor.tsx` et le Workflow Studio (multi-model) pour le pattern complet.

## 7 — AI Assistant : SSE Claude Sonnet

Pattern : `useAiAssistant({ companyId, workflowName, onApplyFile })` retourne `{ messages, streaming, sendPrompt, applyProposal, dismissProposal, stop, clear }`. Les helpers de transformation (`applyTokenDelta`, `addProposal`, `markProposalApplied`, …) sont **purs et exportés** pour permettre des tests sans React Testing Library.

Pour un nouveau panneau d'assistant : réutiliser `useAiAssistant` plutôt qu'un nouveau hook ; étendre le streaming côté serveur (`/ai/chat`) si un nouveau type d'event est nécessaire.

## 8 — Parité desktop (Tauri)

Le DMG est un thin client : URL backend configurable par profil + token en Keychain. Pas de backend embarqué, pas de sandbox locale. Toute feature doit fonctionner avec le path `/companies/:companyId/...` et SSE classique — ne pas introduire d'IPC qui contournerait le middleware multi-tenant.

## Anti-patterns à signaler / refuser

- `setInterval` / `refetchInterval` / `setTimeout` récursif → bug, jamais une feature.
- Primitive UI inline (un `<button>` stylé Tailwind, un Dialog custom) au lieu de `@/components/ui/...`.
- Query key sans `companyId` pour des données scopées tenant.
- `companyId` deviné via un hook context au lieu d'être lu dans l'URL.
- PR qui touche `ui/src/pages/` sans toucher `scripts/parity/data.ts` (et sans justification).
- Monaco importé en haut de fichier (non lazy) → bundle initial qui explose.
- Code desktop qui suppose un backend local ou un companyId implicite.

## Liens

- [`docs/conventions/no-polling.md`](../../docs/conventions/no-polling.md) — règle SSE/WebSocket
- [`docs/conventions/middleware-chain.md`](../../docs/conventions/middleware-chain.md) — flow multi-tenant côté serveur
- [`docs/conventions/rbac-tags.md`](../../docs/conventions/rbac-tags.md) — RBAC + tag scoping
- [`docs/README.md`](../../docs/README.md) — index docs
- [`scripts/parity/data.ts`](../../scripts/parity/data.ts) — parity tracker
- [`ui/src/lib/queryKeys.ts`](../../ui/src/lib/queryKeys.ts) — query keys centralisées
- [`ui/src/context/LiveUpdatesProvider.tsx`](../../ui/src/context/LiveUpdatesProvider.tsx) — WS provider central
