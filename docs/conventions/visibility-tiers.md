# Modèle 3-tier visibility/assignment/sharing

> **Invariant produit MnM** — toute feature qui touche au partage, à la visibilité ou à l'assignation suit ce modèle. Pas d'exception, pas d'autre modèle. Voir [`decision-log.md` §1.6](../decision-log.md).

## Les 3 niveaux

| Tier | Nom | Sémantique |
|---|---|---|
| 1 | **Private** | Seul le créateur (ou l'assigné direct) voit/utilise. Default sécurisé. |
| 2a | **Tags** | Partagé aux principals dont les tags **intersectent** ceux de la ressource. |
| 2b | **Principals** | Partagé à des utilisateurs (ou agents) **spécifiques** par id. |
| 3 | **Company enforced** | Imposé par la company à TOUT le monde. Ne se contourne pas. Sert pour audit/sécurité/policy. |

Tier 3 a la priorité absolue (un hook company-enforced s'exécute même si l'utilisateur ne le voit pas dans son picker). Tiers 2a/2b sont additifs (un user qui matche **soit** par tag **soit** par principal direct y accède). Tier 1 = absence des autres.

## Schema (template)

Pour chaque entité partageable :

```sql
-- Sur la table principale
ALTER TABLE <entity> ADD COLUMN visibility text NOT NULL DEFAULT 'private'
  CHECK (visibility IN ('private', 'tags', 'principals', 'company'));
ALTER TABLE <entity> ADD COLUMN created_by_principal_id uuid NOT NULL REFERENCES principals(id);

-- Tables de jointure (uniquement quand visibility nécessite)
CREATE TABLE <entity>_tags (
  <entity>_id uuid REFERENCES <entity>(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (<entity>_id, tag_id)
);

CREATE TABLE <entity>_principals (
  <entity>_id uuid REFERENCES <entity>(id) ON DELETE CASCADE,
  principal_id uuid REFERENCES principals(id) ON DELETE CASCADE,
  PRIMARY KEY (<entity>_id, principal_id)
);

-- Pour le tier 3 : flag company_enforced (peut être un type 'company' du field visibility)
-- ou colonne dédiée si on veut superposer "enforced + visible à un sous-groupe".
```

## Service helper (implémentation)

Un seul helper pur dans [`server/src/services/visibility.ts`](../../server/src/services/visibility.ts), générique sur les tables de jointure. Chaque feature concrète (Workflow Hooks, Step Assignments, …) fournit ses propres `hasTagIntersection` / `isPrincipalListed` pour ses tables `<entity>_tags` / `<entity>_principals` :

```ts
// server/src/services/visibility.ts
import type { VisibilityResource } from "@mnm/shared";

export type VisibilityResolvers = {
  hasTagIntersection: (resourceId: string, principalId: string) => Promise<boolean>;
  isPrincipalListed:  (resourceId: string, principalId: string) => Promise<boolean>;
};

export async function canPrincipalAccess(
  resource: VisibilityResource,
  principalId: string,
  resolvers: VisibilityResolvers,
): Promise<boolean> {
  if (resource.visibility === "company") return true;             // Tier 3
  if (resource.createdByPrincipalId === principalId) return true; // Tier 1
  if (resource.visibility === "principals") {
    return resolvers.isPrincipalListed(resource.id, principalId); // Tier 2b
  }
  if (resource.visibility === "tags") {
    return resolvers.hasTagIntersection(resource.id, principalId); // Tier 2a
  }
  return false;                                                   // Tier 1 (private), non créateur
}
```

L'implémentation est **pure** (testable sans DB) et **court-circuite** dans l'ordre tier 3 → tier 1 → tier 2b → tier 2a — un creator sur une ressource `principals` n'entraîne aucun roundtrip DB.

Côté feature, on wrap le helper avec ses queries Drizzle :

```ts
// server/src/services/workflow-hooks.ts (à venir, plan T2.6)
import { canPrincipalAccess } from "./visibility.js";
import { workflowHooksConfigTags, workflowHooksConfigPrincipals } from "@mnm/db";

export async function canPrincipalAccessHookConfig(
  db: Db,
  config: VisibilityResource,
  principalId: string,
) {
  return canPrincipalAccess(config, principalId, {
    hasTagIntersection: (configId, pid) => /* SELECT ... JOIN principal_tags ... */,
    isPrincipalListed:  (configId, pid) => /* SELECT 1 FROM workflow_hooks_config_principals WHERE ... */,
  });
}
```

## UI : `<VisibilityPicker>` partagé

Composant unique dans [`ui/src/components/visibility/VisibilityPicker.tsx`](../../ui/src/components/visibility/VisibilityPicker.tsx). Toute feature avec un partage l'utilise. Il propose les 4 options sous forme de Tabs et révèle conditionnellement le `<TagSelector>` ou `<PrincipalSelector>` selon le tier choisi.

```tsx
import { VisibilityPicker } from "@/components/visibility/VisibilityPicker";
import { EMPTY_VISIBILITY_VALUE, type VisibilityValue } from "@mnm/shared";

const [value, setValue] = useState<VisibilityValue>(EMPTY_VISIBILITY_VALUE);

<VisibilityPicker
  value={value}
  onChange={setValue}
  companyId={companyId}
  // Le tier 3 (company enforced) n'est cliquable que si l'user porte
  // la perm `<feature>:enforce` (ex: `hooks:enforce`).
  companyEnforcedAvailable={hasPermission("hooks:enforce")}
/>;
```

Pour afficher l'état dans une liste read-only, utiliser [`<VisibilityBadge>`](../../ui/src/components/visibility/VisibilityBadge.tsx) :

```tsx
<VisibilityBadge visibility={config.visibility} count={config.tagIds.length} />
```

Le composant lit ses options de membres / tags via les composants partagés [`<TagSelector>`](../../ui/src/components/principals/TagSelector.tsx) et [`<PrincipalSelector>`](../../ui/src/components/principals/PrincipalSelector.tsx) — qui consomment respectivement `tagsApi.list(companyId)` et `accessApi.listMembers(companyId)`. Les tag/principal ids sélectionnés sont conservés à travers les transitions (un toggle `tags` ↔ `principals` ne perd pas la sélection précédente).

## API : champ `effectiveAccess`

Les responses GET d'une liste/détail incluent un champ calculé serveur-side pour l'UI :

```json
{
  "id": "...",
  "visibility": "tags",
  "tags": ["frontend", "backend"],
  "effectiveAccess": {
    "canRead": true,
    "canEdit": false,
    "reason": "tag-intersection:frontend"
  }
}
```

L'UI ne doit jamais essayer de re-calculer l'access côté client.

## Anti-patterns explicites

- ❌ Booléen `is_public` sans niveau intermédiaire (tags/principals).
- ❌ Tier custom (« visible aux managers seulement », « visible si role>=X ») — les managers s'expriment via un **tag** `manager` ou un **rôle** dans la requête de filtre, pas via un nouveau tier.
- ❌ Tier « team » distinct des tags — un team est un tag, point.
- ❌ Picker UI custom au lieu de `<VisibilityPicker>`.
- ❌ Helper d'access ré-implémenté par feature au lieu de `canPrincipalAccess()`.
- ❌ Tier 3 sans audit log — quand une company enforce un truc, il faut tracer **qui** l'a enforced et **quand**.

## Features qui suivent ce modèle aujourd'hui

- **Config Layers** — référence canonique (`server/src/services/configLayers.ts`). Items = MCP servers, Skills, Hooks, Settings, Credentials.
- **Sandboxes** — tag-routed (memory `project_sandbox_tag_routing.md`).

## Features qui DOIVENT le suivre (à venir)

- **Workflow Hooks** (intégrations Jira/ClickUp company-shared) — premier pilote enterprise.
- **Workflow assignments** (assignation step/workflow à user/tag) — premier pilote enterprise.
- Toute future entité partageable.

## Liens

- [`docs/decision-log.md` §1.6](../decision-log.md) — décision formelle.
- [`docs/conventions/rbac-tags.md`](rbac-tags.md) — tags et rôles (sources de tier 2a et 3).
- Mémoire perso : `feedback_three_tier_visibility.md`.
