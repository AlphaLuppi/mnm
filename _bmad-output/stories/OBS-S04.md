# OBS-S04 : UI AuditLog -- Page Audit Log avec Tableau, Filtres et Export

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | OBS-S04 |
| **Titre** | UI AuditLog -- Page Audit Log avec Tableau, Filtres et Export |
| **Epic** | Epic OBS -- Observabilite & Audit (Noyau B) |
| **Sprint** | Batch 8 -- Drift + Audit UI |
| **Effort** | M (5 SP, 3-5j) |
| **Assignation** | Cofondateur (frontend) |
| **Bloque par** | OBS-S01 (Table audit_events + service -- DONE), OBS-S02 (Service audit emission -- DONE) |
| **Debloque** | DASH-S01 (API dashboards agreges) |
| **ADR** | ADR-007 (Observabilite) |
| **Type** | Frontend + API client (page UI + API client module, le backend est deja complet) |
| **FRs couverts** | REQ-OBS-03 (audit interface read-only), REQ-OBS-04 (12 filtres), REQ-OBS-05 (export CSV/JSON) |

---

## Description

### Contexte

MnM dispose d'un systeme d'audit complet cote backend (OBS-S01 + OBS-S02) :
- **Table `audit_events`** avec 12 colonnes (id, companyId, actorId, actorType, action, targetType, targetId, metadata, ipAddress, userAgent, severity, prevHash, createdAt)
- **Service `audit.ts`** avec 7 fonctions : emit, list, getById, count, exportCsv, exportJson, verifyChain
- **Routes `audit.ts`** avec 6 endpoints proteges par `audit:read` / `audit:export`
- **68+ points d'emission** integres dans 14 fichiers de routes (OBS-S02)
- **Types partages** dans `@mnm/shared` : AuditEvent, AuditListResult, AuditVerifyResult, filtres Zod

Il manque la page frontend pour visualiser ces evenements d'audit. La page existante "Activity" (`ui/src/pages/Activity.tsx`) est un journal simplifie d'activite (activity_log) -- elle ne consomme PAS les audit_events. La story OBS-S04 cree une page dediee "Audit Log" qui exploite l'API audit backend avec :
- DataTable avec colonnes triables (createdAt, action, actorType, targetType, severity)
- 12 filtres (actorId, actorType, action, targetType, targetId, severity, dateFrom, dateTo, search, limit, offset, sortOrder)
- Pagination serveur (limit/offset)
- Export CSV et JSON (telechargement streame)
- Verification d'integrite de la chaine de hachage
- Detail d'un evenement dans une modale (metadata JSONB visualisee)
- Virtualisation TanStack Virtual pour les grandes listes (optionnel MVP -- pagination suffit)

### Ce qui existe deja

1. **API backend audit** (`server/src/routes/audit.ts`) :
   - `GET /api/companies/:companyId/audit` -- liste avec 12 filtres + pagination (protege `audit:read`)
   - `GET /api/companies/:companyId/audit/count` -- nombre d'evenements (protege `audit:read`)
   - `GET /api/companies/:companyId/audit/export/csv` -- export CSV streame (protege `audit:export`)
   - `GET /api/companies/:companyId/audit/export/json` -- export JSON streame (protege `audit:export`)
   - `GET /api/companies/:companyId/audit/verify` -- verification integrite hash chain (protege `audit:read`)
   - `GET /api/companies/:companyId/audit/:id` -- detail d'un evenement (protege `audit:read`)

2. **Service audit** (`server/src/services/audit.ts`) :
   - `list(filters)` retourne `{ data: AuditEvent[], total: number, limit: number, offset: number }`
   - `getById(companyId, id)` retourne un `AuditEvent` complet
   - `count(filters)` retourne un nombre
   - `exportCsv(filters)` est un AsyncGenerator qui streame le CSV
   - `exportJson(filters)` est un AsyncGenerator qui streame le JSON
   - `verifyChain(companyId, dateFrom?, dateTo?)` retourne `AuditVerifyResult`

3. **Types partages** (`packages/shared/src/types/audit.ts`) :
   - `AuditEvent` : id, companyId, actorId, actorType, action, targetType, targetId, metadata, ipAddress, userAgent, severity, prevHash, createdAt
   - `AuditListResult` : data, total, limit, offset
   - `AuditVerifyResult` : valid, eventsChecked, firstEventId, lastEventId, brokenAt?
   - `AUDIT_ACTOR_TYPES` : ["user", "agent", "system"]
   - `AUDIT_SEVERITY_LEVELS` : ["info", "warning", "error", "critical"]
   - `AUDIT_TARGET_TYPES` : 14 types (agent, project, workflow, etc.)
   - `AUDIT_ACTIONS` : 65+ actions cataloguees

4. **Validateurs Zod** (`packages/shared/src/validators/audit.ts`) :
   - `auditEventFiltersSchema` : actorId, actorType, action, targetType, targetId, severity, dateFrom, dateTo, search, limit, offset, sortOrder
   - `auditExportFiltersSchema` : memes filtres sans limit/offset/sortOrder
   - `auditVerifySchema` : dateFrom, dateTo

5. **API client pattern** (`ui/src/api/client.ts`) :
   - `api.get<T>(path)`, `api.getText(path)`, `api.post<T>(path, body)`
   - Pour le telechargement de fichiers (CSV/JSON), il faut utiliser `fetch()` directement avec `blob()` car le client standard parse en JSON

6. **Route existante** (`ui/src/App.tsx` L145) :
   - `<Route path="activity" element={<RequirePermission permission="audit:read" showForbidden><Activity /></RequirePermission>} />`
   - La permission `audit:read` est deja utilisee pour la page Activity
   - La nouvelle page Audit Log sera sur une route separee `/audit`

7. **Sidebar** (`ui/src/components/Sidebar.tsx` L56, L163-165) :
   - `canViewActivity = hasPermission("audit:read")` est deja utilise pour Activity
   - Le lien "Activity" pointe vers `/activity`
   - On ajoutera un lien "Audit Log" en dessous qui pointe vers `/audit`

8. **Query keys** (`ui/src/lib/queryKeys.ts`) :
   - Pas de cle audit existante -- a ajouter

9. **Composants shadcn/ui disponibles** :
   - `Badge`, `Button`, `Dialog`, `Select`, `Input`, `Card`, `Tooltip`, `DropdownMenu`, `Table`
   - Pattern de table deja utilise dans Members.tsx (table HTML avec shadcn/ui styling)

10. **LiveEvents WebSocket** (`server/src/services/audit.ts` L107-119) :
    - Le service publie `audit.event_created` via WebSocket quand un evenement est cree
    - Le frontend peut ecouter ces evenements pour rafraichir la page en temps reel

### Ce qui manque

1. **API client audit** : Nouveau fichier `ui/src/api/audit.ts` avec les appels aux 6 endpoints
2. **Page AuditLog** : Nouveau composant `ui/src/pages/AuditLog.tsx`
3. **Composant AuditEventDetail** : Modale de detail d'un evenement (metadata JSON prettifiee)
4. **Route** : Ajouter `/audit` dans `ui/src/App.tsx`
5. **Sidebar** : Ajouter l'item "Audit Log" dans la sidebar
6. **Query keys** : Ajouter les cles pour audit

---

## Etat Actuel du Code (Analyse)

### Fichiers a creer

| Fichier | Role |
|---------|------|
| `ui/src/api/audit.ts` | API client pour les 6 endpoints audit |
| `ui/src/pages/AuditLog.tsx` | Page principale Audit Log avec DataTable, filtres, export, verification |
| `ui/src/components/AuditEventDetail.tsx` | Modale de detail d'un evenement audit |

### Fichiers a modifier

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `ui/src/App.tsx` | Routing | MODIFIE : ajouter Route `/audit` protegee par `audit:read` |
| `ui/src/components/Sidebar.tsx` | Navigation sidebar | MODIFIE : ajouter lien "Audit Log" avec icone `FileSearch` ou `ScrollText` |
| `ui/src/lib/queryKeys.ts` | Query keys React Query | MODIFIE : ajouter `audit` namespace |

### Fichiers de reference (non modifies)

| Fichier | Role |
|---------|------|
| `server/src/routes/audit.ts` | Routes API audit (6 endpoints) |
| `server/src/services/audit.ts` | Service audit (7 fonctions) |
| `packages/shared/src/types/audit.ts` | Types AuditEvent, AuditListResult, etc. |
| `packages/shared/src/validators/audit.ts` | Schemas Zod pour filtres |
| `ui/src/api/client.ts` | API client base (get, post, getText) |
| `ui/src/pages/Members.tsx` | Reference pattern page avec table, filtres, actions |
| `ui/src/pages/Activity.tsx` | Reference pattern page avec queries et filtres |
| `ui/src/components/PageSkeleton.tsx` | Skeleton loading |
| `ui/src/components/EmptyState.tsx` | Etat vide |
| `ui/src/context/CompanyContext.tsx` | useCompany() pour selectedCompanyId |
| `ui/src/context/BreadcrumbContext.tsx` | useBreadcrumbs() pour fil d'Ariane |
| `ui/src/hooks/usePermissions.tsx` | usePermissions() pour checks cote client |

### Conventions du codebase (a respecter)

1. **Pages pattern** : `useCompany()` pour le companyId, `useBreadcrumbs()` pour le fil d'Ariane, `useQuery()` pour les donnees
2. **API client** : `api.get<T>(path)`, `api.patch<T>(path, body)`, `api.post<T>(path, body)`
3. **Query keys** : Factories dans `ui/src/lib/queryKeys.ts` avec pattern `[namespace, companyId, ...params]`
4. **Error handling** : `isLoading` / `error` / `data` pattern avec `PageSkeleton` en loading
5. **Mutations** : `useMutation()` avec `onSuccess` qui invalide les queries
6. **shadcn/ui imports** : `import { Component } from "@/components/ui/component"`
7. **Lucide icons** : Import depuis `lucide-react`
8. **Tailwind** : Utility-first, classes directes dans JSX
9. **data-testid** : Format `data-testid="obs-s04-[element]"`
10. **Permission protection** : `<RequirePermission permission="..." showForbidden>` wrapper dans App.tsx

---

## Specification Technique Detaillee

### T1 : API client audit -- `ui/src/api/audit.ts`

Creer le module API client qui consomme les 6 endpoints audit backend.

```typescript
// ui/src/api/audit.ts
import type { AuditEvent, AuditListResult, AuditVerifyResult } from "@mnm/shared";
import { api } from "./client";

export interface AuditFilters {
  actorId?: string;
  actorType?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sortOrder?: "asc" | "desc";
}

function buildQuery(filters: AuditFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const auditApi = {
  list: (companyId: string, filters: AuditFilters = {}) =>
    api.get<AuditListResult>(`/companies/${companyId}/audit${buildQuery(filters)}`),

  count: (companyId: string, filters: Omit<AuditFilters, "limit" | "offset" | "sortOrder"> = {}) =>
    api.get<{ count: number }>(`/companies/${companyId}/audit/count${buildQuery(filters)}`),

  getById: (companyId: string, eventId: string) =>
    api.get<AuditEvent>(`/companies/${companyId}/audit/${eventId}`),

  verify: (companyId: string, dateFrom?: string, dateTo?: string) => {
    const params: Record<string, string> = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    return api.get<AuditVerifyResult>(`/companies/${companyId}/audit/verify${buildQuery(params)}`);
  },

  // Export functions use fetch() directly for blob download
  exportCsv: async (companyId: string, filters: Omit<AuditFilters, "limit" | "offset" | "sortOrder"> = {}) => {
    const qs = buildQuery(filters);
    const res = await fetch(`/api/companies/${companyId}/audit/export/csv${qs}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${companyId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportJson: async (companyId: string, filters: Omit<AuditFilters, "limit" | "offset" | "sortOrder"> = {}) => {
    const qs = buildQuery(filters);
    const res = await fetch(`/api/companies/${companyId}/audit/export/json${qs}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Export failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export-${companyId}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
```

**data-testid pour T1** : Pas de data-testid (module TS pur, pas de composant UI).

---

### T2 : Query keys audit -- `ui/src/lib/queryKeys.ts`

Ajouter les cles de cache pour les requetes audit.

```typescript
// Ajouter dans queryKeys :
audit: {
  list: (companyId: string, filters?: Record<string, unknown>) =>
    ["audit", companyId, "list", filters] as const,
  detail: (companyId: string, eventId: string) =>
    ["audit", companyId, "detail", eventId] as const,
  count: (companyId: string, filters?: Record<string, unknown>) =>
    ["audit", companyId, "count", filters] as const,
  verify: (companyId: string) =>
    ["audit", companyId, "verify"] as const,
},
```

---

### T3 : Route audit -- `ui/src/App.tsx`

Ajouter la route `/audit` protegee par la permission `audit:read`.

```tsx
// Ajouter APRES la route activity (L145) :
import { AuditLog } from "./pages/AuditLog";

<Route path="audit" element={
  <RequirePermission permission="audit:read" showForbidden>
    <AuditLog />
  </RequirePermission>
} />
```

---

### T4 : Sidebar audit -- `ui/src/components/Sidebar.tsx`

Ajouter un lien "Audit Log" dans la section Company, apres "Activity".

```tsx
// Import :
import { ScrollText } from "lucide-react";

// Apres le lien Activity (L163-165), ajouter :
{canViewActivity && (
  <SidebarNavItem
    data-testid="obs-s04-nav-audit"
    to="/audit"
    label="Audit Log"
    icon={ScrollText}
  />
)}
```

Le lien utilise la meme permission `audit:read` que Activity car les deux sont dans le meme domaine d'observabilite. L'icone `ScrollText` (lucide-react) represente un journal d'audit.

---

### T5 : Composant AuditEventDetail -- `ui/src/components/AuditEventDetail.tsx`

Modale qui affiche le detail complet d'un evenement audit. Utilisee quand on clique sur une ligne du tableau.

**Structure** :
- Dialog avec DialogHeader (titre = action, sous-titre = timestamp)
- Section "Event Info" : id, action, severity, actorType, actorId, targetType, targetId, ipAddress, userAgent
- Section "Metadata" : JSON prettifie de metadata JSONB (si non null)
- Section "Hash Chain" : prevHash (si non null)
- Bouton "Close"

**Props** :
```typescript
interface AuditEventDetailProps {
  event: AuditEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**data-testid elements** :

| data-testid | Element | Type |
|-------------|---------|------|
| `obs-s04-detail-dialog` | Dialog container | Dialog |
| `obs-s04-detail-title` | Titre (action) | h2 |
| `obs-s04-detail-timestamp` | Timestamp formatte | span |
| `obs-s04-detail-id` | ID de l'evenement | dd |
| `obs-s04-detail-action` | Action | dd |
| `obs-s04-detail-severity` | Badge severity | Badge |
| `obs-s04-detail-actor-type` | Type d'acteur | dd |
| `obs-s04-detail-actor-id` | ID acteur | dd |
| `obs-s04-detail-target-type` | Type de cible | dd |
| `obs-s04-detail-target-id` | ID de cible | dd |
| `obs-s04-detail-ip` | Adresse IP | dd |
| `obs-s04-detail-user-agent` | User agent | dd |
| `obs-s04-detail-metadata` | Bloc JSON metadata | pre |
| `obs-s04-detail-prev-hash` | Hash precedent | dd |
| `obs-s04-detail-close` | Bouton fermer | Button |

---

### T6 : Page AuditLog -- `ui/src/pages/AuditLog.tsx`

Page principale avec DataTable, filtres, export et verification.

#### T6.1 : Structure de la page

```
+============================================================+
| Audit Log                           [Verify] [Export v]     |  <-- Header
+============================================================+
| [Search...] [Actor Type v] [Severity v] [Date From] [Date To] [Clear] |  <-- Filters row 1
| [Action v] [Target Type v] [Target ID]                      |  <-- Filters row 2
+============================================================+
| Timestamp  | Action        | Actor   | Target | Severity    |  <-- Table header
|------------|---------------|---------|--------|-------------|
| 2026-03-14 | agent.created | user    | agent  | info        |  <-- Row (clickable)
| 2026-03-14 | access.denied | user    | secret | warning     |
| ...        | ...           | ...     | ...    | ...         |
+============================================================+
| Showing 1-50 of 1234 events    [< Prev]  Page 1  [Next >]  |  <-- Pagination
+============================================================+
```

#### T6.2 : State management

```typescript
// Filter state (useState)
const [search, setSearch] = useState("");
const [actorType, setActorType] = useState<string>("all");
const [severity, setSeverity] = useState<string>("all");
const [action, setAction] = useState<string>("all");
const [targetType, setTargetType] = useState<string>("all");
const [targetId, setTargetId] = useState("");
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");
const [page, setPage] = useState(0);
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
const pageSize = 50;

// Selected event for detail modal
const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
const [detailOpen, setDetailOpen] = useState(false);

// Verification state
const [verifyResult, setVerifyResult] = useState<AuditVerifyResult | null>(null);
const [verifyLoading, setVerifyLoading] = useState(false);

// Export loading
const [exportLoading, setExportLoading] = useState(false);
```

#### T6.3 : React Query usage

```typescript
// Build filters from state
const filters: AuditFilters = useMemo(() => ({
  ...(search && { search }),
  ...(actorType !== "all" && { actorType }),
  ...(severity !== "all" && { severity }),
  ...(action !== "all" && { action }),
  ...(targetType !== "all" && { targetType }),
  ...(targetId && { targetId }),
  ...(dateFrom && { dateFrom }),
  ...(dateTo && { dateTo }),
  limit: pageSize,
  offset: page * pageSize,
  sortOrder,
}), [search, actorType, severity, action, targetType, targetId, dateFrom, dateTo, page, sortOrder]);

const { data, isLoading, error } = useQuery({
  queryKey: queryKeys.audit.list(selectedCompanyId!, filters),
  queryFn: () => auditApi.list(selectedCompanyId!, filters),
  enabled: !!selectedCompanyId,
});
```

#### T6.4 : Filtres

Les filtres sont organises en 2 rangees :

**Rangee 1** :
- Search input (texte libre, debounce 300ms)
- Actor Type select (all, user, agent, system)
- Severity select (all, info, warning, error, critical)
- Date From input (type="datetime-local")
- Date To input (type="datetime-local")

**Rangee 2** :
- Action select (all, + toutes les actions du catalogue AUDIT_ACTIONS)
- Target Type select (all, + toutes les cibles de AUDIT_TARGET_TYPES)
- Target ID input (texte libre)
- Bouton "Clear Filters" (reset tous les filtres)

Quand un filtre change, on reset la page a 0.

#### T6.5 : Tableau

Colonnes :
1. **Timestamp** : `createdAt` formatte en date/heure locale (`toLocaleString()`)
2. **Action** : `action` avec texte tronque si trop long
3. **Actor** : `actorType` + `actorId` (tronque si UUID)
4. **Target** : `targetType` + `targetId` (tronque si UUID)
5. **Severity** : Badge colore (info=secondary, warning=outline/yellow, error=destructive, critical=destructive+bold)

Chaque ligne est cliquable -- ouvre la modale AuditEventDetail.

#### T6.6 : Pagination

- Affiche "Showing X-Y of Z events"
- Boutons "Previous" et "Next"
- Bouton "Previous" desactive si page === 0
- Bouton "Next" desactive si (page + 1) * pageSize >= total
- Numero de page affiche

#### T6.7 : Export

Dropdown menu avec 2 options :
- "Export CSV" -- appelle `auditApi.exportCsv(companyId, currentFilters)` (sans limit/offset)
- "Export JSON" -- appelle `auditApi.exportJson(companyId, currentFilters)` (sans limit/offset)

L'export respecte les filtres actifs (sauf pagination). Un spinner s'affiche pendant l'export.

Permission requise : `audit:export`. Si l'utilisateur n'a pas cette permission, le dropdown n'apparait pas. Utiliser `usePermissions()` pour verifier.

#### T6.8 : Verification d'integrite

Bouton "Verify Integrity" dans le header. Appelle `auditApi.verify(companyId)`.
Affiche le resultat dans un toast ou une alerte :
- Si `valid === true` : toast success "Hash chain verified: {eventsChecked} events checked"
- Si `valid === false` : toast error "Hash chain broken at event {brokenAt}"

---

### T7 : Severity badge helper

Composant ou fonction utilitaire pour rendre le badge severity avec la bonne couleur.

```typescript
function severityVariant(severity: string): "secondary" | "outline" | "destructive" {
  switch (severity) {
    case "critical": return "destructive";
    case "error": return "destructive";
    case "warning": return "outline";
    default: return "secondary";
  }
}

function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
```

---

## Mapping data-testid Complet

### Page AuditLog (`ui/src/pages/AuditLog.tsx`)

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s04-page` | Container page | div | Wrapper principal de la page |
| `obs-s04-header` | Header | div | Contient titre + boutons action |
| `obs-s04-title` | Titre page | h1 | "Audit Log" |
| `obs-s04-verify-button` | Bouton verification | Button | Lance la verification hash chain |
| `obs-s04-export-menu` | Menu export | DropdownMenuTrigger | Dropdown pour CSV/JSON |
| `obs-s04-export-csv` | Export CSV | DropdownMenuItem | Lance l'export CSV |
| `obs-s04-export-json` | Export JSON | DropdownMenuItem | Lance l'export JSON |
| `obs-s04-filters` | Conteneur filtres | div | Wrapper des 2 rangees de filtres |
| `obs-s04-filter-search` | Recherche textuelle | Input | Search avec debounce |
| `obs-s04-filter-actor-type` | Filtre actor type | SelectTrigger | Select all/user/agent/system |
| `obs-s04-filter-severity` | Filtre severity | SelectTrigger | Select all/info/warning/error/critical |
| `obs-s04-filter-date-from` | Date debut | Input | Input datetime-local |
| `obs-s04-filter-date-to` | Date fin | Input | Input datetime-local |
| `obs-s04-filter-action` | Filtre action | SelectTrigger | Select catalogue d'actions |
| `obs-s04-filter-target-type` | Filtre target type | SelectTrigger | Select catalogue de target types |
| `obs-s04-filter-target-id` | Filtre target ID | Input | Input texte libre |
| `obs-s04-filter-clear` | Reset filtres | Button | Clear tous les filtres |
| `obs-s04-table` | Tableau audit | table | Table HTML des evenements |
| `obs-s04-table-header` | En-tete tableau | thead | En-tetes des colonnes |
| `obs-s04-col-timestamp` | Colonne Timestamp | th | Header triable |
| `obs-s04-col-action` | Colonne Action | th | Header |
| `obs-s04-col-actor` | Colonne Actor | th | Header |
| `obs-s04-col-target` | Colonne Target | th | Header |
| `obs-s04-col-severity` | Colonne Severity | th | Header |
| `obs-s04-row-{eventId}` | Ligne evenement | tr | Ligne cliquable (ouvre detail) |
| `obs-s04-cell-timestamp-{eventId}` | Cellule timestamp | td | Date/heure locale |
| `obs-s04-cell-action-{eventId}` | Cellule action | td | Nom de l'action |
| `obs-s04-cell-actor-{eventId}` | Cellule actor | td | actorType + actorId |
| `obs-s04-cell-target-{eventId}` | Cellule target | td | targetType + targetId |
| `obs-s04-cell-severity-{eventId}` | Cellule severity | td | Badge severity |
| `obs-s04-pagination` | Conteneur pagination | div | Wrapper pagination |
| `obs-s04-pagination-info` | Info pagination | span | "Showing X-Y of Z events" |
| `obs-s04-pagination-prev` | Bouton precedent | Button | Page precedente |
| `obs-s04-pagination-page` | Numero de page | span | "Page N" |
| `obs-s04-pagination-next` | Bouton suivant | Button | Page suivante |
| `obs-s04-empty-state` | Etat vide | div | Affiche quand aucun evenement |
| `obs-s04-error-state` | Etat erreur | div | Affiche en cas d'erreur API |
| `obs-s04-loading` | Etat chargement | div | Skeleton loading |
| `obs-s04-verify-result` | Resultat verification | div | Toast/alerte resultat verification |
| `obs-s04-sort-order` | Bouton tri | Button | Toggle asc/desc |

### Composant AuditEventDetail (`ui/src/components/AuditEventDetail.tsx`)

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s04-detail-dialog` | Dialog container | Dialog | Modale de detail |
| `obs-s04-detail-title` | Titre (action) | DialogTitle | Nom de l'action |
| `obs-s04-detail-timestamp` | Timestamp | span | Date/heure complete |
| `obs-s04-detail-id` | ID evenement | dd | UUID complet |
| `obs-s04-detail-action` | Action | dd | Nom de l'action |
| `obs-s04-detail-severity` | Severity | Badge | Badge colore |
| `obs-s04-detail-actor-type` | Actor type | dd | user/agent/system |
| `obs-s04-detail-actor-id` | Actor ID | dd | UUID ou identifiant |
| `obs-s04-detail-target-type` | Target type | dd | Type de cible |
| `obs-s04-detail-target-id` | Target ID | dd | UUID ou identifiant |
| `obs-s04-detail-ip` | IP address | dd | Adresse IP (ou N/A) |
| `obs-s04-detail-user-agent` | User agent | dd | User agent (ou N/A) |
| `obs-s04-detail-metadata` | Metadata JSON | pre | JSON prettifie |
| `obs-s04-detail-prev-hash` | Hash precedent | dd | SHA-256 hash (ou N/A) |
| `obs-s04-detail-close` | Bouton fermer | Button | Ferme la modale |

### Navigation (`ui/src/components/Sidebar.tsx`)

| data-testid | Element | Type | Description |
|-------------|---------|------|-------------|
| `obs-s04-nav-audit` | Lien sidebar | SidebarNavItem | Navigation vers /audit |

**Total : 55 data-testid**

---

## Acceptance Criteria (Given/When/Then)

### AC1 : Page accessible et protegee

**Given** un utilisateur avec la permission `audit:read`
**When** il navigue vers `/audit`
**Then** la page Audit Log s'affiche avec le titre, le tableau, les filtres et les actions

**Given** un utilisateur SANS la permission `audit:read`
**When** il tente de naviguer vers `/audit`
**Then** la page Forbidden (403) s'affiche

### AC2 : Affichage des evenements audit

**Given** la page Audit Log chargee
**When** le composant monte
**Then** les 50 derniers evenements audit s'affichent (tries par createdAt DESC) avec les colonnes : Timestamp, Action, Actor, Target, Severity

**Given** aucun evenement audit pour cette company
**When** la page charge
**Then** un etat vide s'affiche avec le message "No audit events recorded yet."

### AC3 : Filtrage par type d'acteur

**Given** la page Audit Log avec des evenements de types user, agent, system
**When** l'utilisateur selectionne "agent" dans le filtre Actor Type
**Then** seuls les evenements avec actorType="agent" s'affichent
**And** la pagination se reset a la page 1
**And** le compteur total reflète le nombre filtre

### AC4 : Filtrage par severity

**Given** la page Audit Log avec des evenements de severite info, warning, error
**When** l'utilisateur selectionne "warning" dans le filtre Severity
**Then** seuls les evenements avec severity="warning" s'affichent

### AC5 : Filtrage par plage de dates

**Given** la page Audit Log
**When** l'utilisateur definit Date From = "2026-03-10" et Date To = "2026-03-13"
**Then** seuls les evenements dans cette plage de dates s'affichent

### AC6 : Recherche textuelle

**Given** la page Audit Log
**When** l'utilisateur tape "agent.created" dans le champ de recherche
**Then** les evenements dont action, targetType ou targetId contiennent "agent.created" s'affichent (apres debounce 300ms)

### AC7 : Reset des filtres

**Given** plusieurs filtres actifs (actorType, severity, search)
**When** l'utilisateur clique "Clear Filters"
**Then** tous les filtres reviennent a leur valeur par defaut (all/vide)
**And** la pagination revient a la page 1

### AC8 : Pagination

**Given** plus de 50 evenements audit
**When** l'utilisateur clique "Next"
**Then** les evenements 51-100 s'affichent
**And** le compteur affiche "Showing 51-100 of X events"
**And** le bouton "Previous" est actif

**Given** la premiere page
**When** l'utilisateur voit les boutons de pagination
**Then** le bouton "Previous" est desactive

**Given** la derniere page
**When** l'utilisateur voit les boutons de pagination
**Then** le bouton "Next" est desactive

### AC9 : Detail d'un evenement

**Given** le tableau avec des evenements
**When** l'utilisateur clique sur une ligne
**Then** une modale s'ouvre avec le detail complet de l'evenement (id, action, severity, actorType/actorId, targetType/targetId, ipAddress, userAgent, metadata JSON, prevHash)

**Given** la modale de detail ouverte
**When** l'utilisateur clique "Close"
**Then** la modale se ferme

### AC10 : Export CSV

**Given** la page Audit Log avec la permission `audit:export`
**When** l'utilisateur clique le bouton Export puis "Export CSV"
**Then** un fichier CSV est telecharge avec le nom `audit-export-{companyId}-{date}.csv`
**And** le CSV respecte les filtres actifs (sans pagination)

**Given** un utilisateur SANS la permission `audit:export`
**When** il voit le header de la page
**Then** le bouton Export n'apparait PAS

### AC11 : Export JSON

**Given** la page Audit Log avec la permission `audit:export`
**When** l'utilisateur clique le bouton Export puis "Export JSON"
**Then** un fichier JSON est telecharge avec le nom `audit-export-{companyId}-{date}.json`

### AC12 : Verification d'integrite

**Given** la page Audit Log
**When** l'utilisateur clique "Verify Integrity"
**Then** le systeme verifie la chaine de hachage SHA-256
**And** si valide : toast success "Hash chain verified: N events checked"
**And** si invalide : toast error "Hash chain broken at event {id}"

### AC13 : Sidebar navigation

**Given** un utilisateur avec la permission `audit:read`
**When** il voit la sidebar
**Then** un lien "Audit Log" est visible dans la section Company (apres "Activity")

**Given** un utilisateur SANS la permission `audit:read`
**When** il voit la sidebar
**Then** le lien "Audit Log" n'est PAS present dans le DOM

### AC14 : Severity badges visuels

**Given** le tableau avec des evenements de differentes severites
**When** la page s'affiche
**Then** les badges severity utilisent les couleurs appropriees :
- `info` : variant secondary (gris)
- `warning` : variant outline (jaune/orange)
- `error` : variant destructive (rouge)
- `critical` : variant destructive + font-bold (rouge gras)

### AC15 : Tri chronologique

**Given** le tableau affiche par defaut en ordre decroissant (plus recent en premier)
**When** l'utilisateur clique le bouton de tri
**Then** l'ordre s'inverse (ascendant, plus ancien en premier)
**And** le bouton reflète l'ordre actuel

---

## Test Cases pour l'Agent QA (Playwright)

### Groupe 1 : Rendu de la page et navigation

| ID | Test | Verification |
|----|------|-------------|
| T01 | Page AuditLog existe | Fichier `ui/src/pages/AuditLog.tsx` exporte `AuditLog` comme composant React |
| T02 | Route /audit declaree | `ui/src/App.tsx` contient `<Route path="audit"` avec `RequirePermission permission="audit:read"` |
| T03 | Import AuditLog dans App | `ui/src/App.tsx` importe `AuditLog` depuis `./pages/AuditLog` |
| T04 | Sidebar lien Audit Log | `ui/src/components/Sidebar.tsx` contient `data-testid="obs-s04-nav-audit"` et `to="/audit"` |
| T05 | Sidebar icone ScrollText | `ui/src/components/Sidebar.tsx` importe `ScrollText` de `lucide-react` |
| T06 | Sidebar permission guard | Le lien Audit Log est conditionnel a `canViewActivity` (ou `hasPermission("audit:read")`) |
| T07 | Breadcrumb Audit Log | `AuditLog.tsx` appelle `setBreadcrumbs([{ label: "Audit Log" }])` |

### Groupe 2 : API client audit

| ID | Test | Verification |
|----|------|-------------|
| T08 | Fichier api/audit.ts existe | `ui/src/api/audit.ts` existe et exporte `auditApi` |
| T09 | auditApi.list appelle le bon endpoint | Contient `/companies/${companyId}/audit` |
| T10 | auditApi.count appelle le bon endpoint | Contient `/companies/${companyId}/audit/count` |
| T11 | auditApi.getById appelle le bon endpoint | Contient `/companies/${companyId}/audit/${eventId}` |
| T12 | auditApi.verify appelle le bon endpoint | Contient `/companies/${companyId}/audit/verify` |
| T13 | auditApi.exportCsv telechargement blob | Utilise `fetch()` + `res.blob()` + `URL.createObjectURL` |
| T14 | auditApi.exportJson telechargement blob | Utilise `fetch()` + `res.blob()` + `URL.createObjectURL` |
| T15 | buildQuery construit les query params | Filtre les valeurs undefined/null/vides |

### Groupe 3 : Query keys

| ID | Test | Verification |
|----|------|-------------|
| T16 | audit.list query key | `queryKeys.ts` contient `audit.list` qui retourne `["audit", companyId, "list", filters]` |
| T17 | audit.detail query key | `queryKeys.ts` contient `audit.detail` qui retourne `["audit", companyId, "detail", eventId]` |
| T18 | audit.count query key | `queryKeys.ts` contient `audit.count` |
| T19 | audit.verify query key | `queryKeys.ts` contient `audit.verify` |

### Groupe 4 : Structure de la page

| ID | Test | Verification |
|----|------|-------------|
| T20 | data-testid page wrapper | `obs-s04-page` present dans AuditLog.tsx |
| T21 | data-testid header | `obs-s04-header` present |
| T22 | data-testid title | `obs-s04-title` present, contient "Audit Log" |
| T23 | data-testid verify button | `obs-s04-verify-button` present |
| T24 | data-testid export menu | `obs-s04-export-menu` present |
| T25 | data-testid table | `obs-s04-table` present |
| T26 | data-testid pagination | `obs-s04-pagination` present |

### Groupe 5 : Filtres

| ID | Test | Verification |
|----|------|-------------|
| T27 | data-testid filter container | `obs-s04-filters` present |
| T28 | data-testid filter search | `obs-s04-filter-search` present, type Input |
| T29 | data-testid filter actor type | `obs-s04-filter-actor-type` present, type SelectTrigger |
| T30 | data-testid filter severity | `obs-s04-filter-severity` present, type SelectTrigger |
| T31 | data-testid filter date from | `obs-s04-filter-date-from` present, type Input datetime-local |
| T32 | data-testid filter date to | `obs-s04-filter-date-to` present, type Input datetime-local |
| T33 | data-testid filter action | `obs-s04-filter-action` present, type SelectTrigger |
| T34 | data-testid filter target type | `obs-s04-filter-target-type` present, type SelectTrigger |
| T35 | data-testid filter target id | `obs-s04-filter-target-id` present, type Input |
| T36 | data-testid clear filters | `obs-s04-filter-clear` present, type Button |
| T37 | Actor Type options | Select contient "All", "user", "agent", "system" |
| T38 | Severity options | Select contient "All", "info", "warning", "error", "critical" |
| T39 | Target Type options | Select utilise AUDIT_TARGET_TYPES de @mnm/shared |
| T40 | Action options | Select utilise AUDIT_ACTIONS de @mnm/shared (ou un sous-ensemble) |

### Groupe 6 : Tableau

| ID | Test | Verification |
|----|------|-------------|
| T41 | Table header colonnes | 5 colonnes : Timestamp, Action, Actor, Target, Severity |
| T42 | data-testid colonnes | `obs-s04-col-timestamp`, `obs-s04-col-action`, `obs-s04-col-actor`, `obs-s04-col-target`, `obs-s04-col-severity` |
| T43 | Ligne cliquable | Les lignes `tr` ont un `onClick` qui ouvre la modale detail |
| T44 | data-testid ligne dynamique | Pattern `obs-s04-row-{eventId}` dans les lignes |
| T45 | data-testid cellules dynamiques | Pattern `obs-s04-cell-timestamp-{eventId}`, `obs-s04-cell-action-{eventId}`, etc. |
| T46 | Severity badge colore | Badge utilise `severityVariant()` pour determiner le variant |
| T47 | Sort order toggle | Bouton `obs-s04-sort-order` present, toggle entre asc/desc |

### Groupe 7 : Pagination

| ID | Test | Verification |
|----|------|-------------|
| T48 | data-testid pagination info | `obs-s04-pagination-info` affiche "Showing X-Y of Z events" |
| T49 | data-testid prev button | `obs-s04-pagination-prev` present |
| T50 | data-testid next button | `obs-s04-pagination-next` present |
| T51 | data-testid page number | `obs-s04-pagination-page` present |
| T52 | Prev disabled page 0 | Quand page === 0, `obs-s04-pagination-prev` a `disabled` |
| T53 | Next disabled derniere page | Quand (page+1)*pageSize >= total, `obs-s04-pagination-next` a `disabled` |
| T54 | useQuery avec limit/offset | `auditApi.list` est appele avec `limit: 50, offset: page * 50` |

### Groupe 8 : Export

| ID | Test | Verification |
|----|------|-------------|
| T55 | Export CSV option | `obs-s04-export-csv` present dans le dropdown |
| T56 | Export JSON option | `obs-s04-export-json` present dans le dropdown |
| T57 | Permission audit:export | Le menu export est conditionnel a `hasPermission("audit:export")` |
| T58 | Export CSV filename | Le nom du fichier CSV suit le pattern `audit-export-{companyId}-{date}.csv` |
| T59 | Export JSON filename | Le nom du fichier JSON suit le pattern `audit-export-{companyId}-{date}.json` |

### Groupe 9 : Verification

| ID | Test | Verification |
|----|------|-------------|
| T60 | Verify button appelle API | Cliquer `obs-s04-verify-button` appelle `auditApi.verify(companyId)` |
| T61 | Verify success message | Si `valid === true`, un message de succes est affiche |
| T62 | Verify failure message | Si `valid === false`, un message d'erreur est affiche avec `brokenAt` |

### Groupe 10 : Detail modale

| ID | Test | Verification |
|----|------|-------------|
| T63 | Fichier AuditEventDetail existe | `ui/src/components/AuditEventDetail.tsx` exporte `AuditEventDetail` |
| T64 | data-testid detail dialog | `obs-s04-detail-dialog` present |
| T65 | data-testid detail title | `obs-s04-detail-title` present, affiche l'action |
| T66 | data-testid detail timestamp | `obs-s04-detail-timestamp` present |
| T67 | data-testid detail id | `obs-s04-detail-id` present |
| T68 | data-testid detail action | `obs-s04-detail-action` present |
| T69 | data-testid detail severity | `obs-s04-detail-severity` present, type Badge |
| T70 | data-testid detail actor type | `obs-s04-detail-actor-type` present |
| T71 | data-testid detail actor id | `obs-s04-detail-actor-id` present |
| T72 | data-testid detail target type | `obs-s04-detail-target-type` present |
| T73 | data-testid detail target id | `obs-s04-detail-target-id` present |
| T74 | data-testid detail ip | `obs-s04-detail-ip` present |
| T75 | data-testid detail user agent | `obs-s04-detail-user-agent` present |
| T76 | data-testid detail metadata | `obs-s04-detail-metadata` present, affiche JSON prettifie |
| T77 | data-testid detail prev hash | `obs-s04-detail-prev-hash` present |
| T78 | data-testid detail close | `obs-s04-detail-close` present, ferme la modale |

### Groupe 11 : Etats de la page

| ID | Test | Verification |
|----|------|-------------|
| T79 | Loading state | `obs-s04-loading` ou `PageSkeleton` affiche pendant le chargement |
| T80 | Empty state | `obs-s04-empty-state` affiche quand `data.data.length === 0` |
| T81 | Error state | `obs-s04-error-state` affiche en cas d'erreur API |
| T82 | useCompany pattern | AuditLog.tsx utilise `useCompany()` pour `selectedCompanyId` |
| T83 | useBreadcrumbs pattern | AuditLog.tsx utilise `useBreadcrumbs()` et appelle `setBreadcrumbs` |

### Groupe 12 : Integration

| ID | Test | Verification |
|----|------|-------------|
| T84 | Types AuditEvent importes | AuditLog.tsx ou AuditEventDetail.tsx importe depuis `@mnm/shared` |
| T85 | AUDIT_ACTOR_TYPES utilises | Les filtres utilisent `AUDIT_ACTOR_TYPES` pour les options actor type |
| T86 | AUDIT_SEVERITY_LEVELS utilises | Les filtres utilisent `AUDIT_SEVERITY_LEVELS` pour les options severity |
| T87 | AUDIT_TARGET_TYPES utilises | Les filtres utilisent `AUDIT_TARGET_TYPES` pour les options target type |
| T88 | usePermissions pour export | AuditLog.tsx appelle `usePermissions()` et verifie `hasPermission("audit:export")` |

**Total : 88 test cases**

---

## Dependances

### Pre-requis (DONE)

| Story | Ce qu'elle fournit |
|-------|-------------------|
| **OBS-S01** | Table `audit_events`, service audit (emit, list, getById, count, exportCsv, exportJson, verifyChain), routes API, types partages |
| **OBS-S02** | 68+ points d'emission integres dans 14 fichiers de routes -- les donnees existent dans la DB |
| **RBAC-S04** | Enforcement permissions sur les routes audit (`audit:read`, `audit:export`) |
| **RBAC-S05** | Navigation masquee selon permissions (pattern `canViewActivity`) |

### Post-requis (debloque)

| Story | Ce qu'elle consommera |
|-------|----------------------|
| **DASH-S01** | Les dashboards agreges utiliseront le meme endpoint audit pour les metriques |

---

## Notes d'implementation

### Performance

1. **Pagination serveur** : OBLIGATOIRE. Ne jamais charger tous les evenements cote client. Le backend supporte `limit`/`offset`.
2. **Debounce search** : 300ms pour eviter les requetes excessives lors de la saisie.
3. **Query invalidation** : Ecouter les WebSocket events `audit.event_created` pour rafraichir la page (optionnel MVP, peut etre un `refetchInterval: 30_000` en alternative).

### Securite

1. **Permission `audit:read`** : Verifie cote route ET cote sidebar.
2. **Permission `audit:export`** : Le bouton export n'apparait que si l'utilisateur a cette permission.
3. **RLS** : Le backend filtre deja par `companyId` via RLS -- le frontend n'a pas besoin de filtrer.

### Accessibilite

1. **Lignes cliquables** : Utiliser `role="button"` et `tabIndex={0}` sur les lignes cliquables, avec `onKeyDown` pour Enter/Space.
2. **Badges severity** : Utiliser le triple encodage (couleur + texte + icone optionnel) pour ne pas reposer sur la couleur seule.
3. **Focus visible** : Les boutons de pagination et les filtres doivent avoir un focus ring visible.
4. **ARIA** : `aria-label` sur les selects de filtre, `aria-describedby` sur les champs de recherche.

### Edge cases

1. **Metadata null** : Si `metadata` est null, afficher "No metadata" dans la modale detail.
2. **Metadata volumineux** : Utiliser `JSON.stringify(metadata, null, 2)` avec `max-height` et `overflow-y: auto` sur le `<pre>`.
3. **UUID tronques** : Afficher les 8 premiers caracteres des UUID dans le tableau, UUID complet dans la modale.
4. **Dates invalides** : Valider les inputs datetime-local avant d'envoyer a l'API (convertir en ISO 8601 avec timezone offset).
5. **Export avec beaucoup de donnees** : Afficher un indicateur de chargement pendant l'export, desactiver le bouton.
6. **Filtre action avec 65+ options** : Grouper les actions par domaine (access.*, agent.*, workflow.*, etc.) dans le select pour faciliter la navigation.
