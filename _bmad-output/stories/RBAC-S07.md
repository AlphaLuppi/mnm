# RBAC-S07 : Badges Couleur par Role -- Specification Detaillee

## Metadonnees

| Champ | Valeur |
|-------|--------|
| **Story ID** | RBAC-S07 |
| **Titre** | Composant RoleBadge -- Badge shadcn/ui avec variant couleur par businessRole |
| **Epic** | Epic 2 -- RBAC & Permissions |
| **Sprint** | Sprint 2 (Phase 2) |
| **Effort** | S (1 SP, 0.5j) |
| **Priorite** | P2 |
| **Assignation** | Cofondateur |
| **Bloque par** | RBAC-S03 (businessRole migration -- constantes BUSINESS_ROLES, BUSINESS_ROLE_LABELS) |
| **Debloque** | Rien (story terminale, amelioration UX) |
| **ADR** | ADR-002 (RBAC 4 roles) |
| **Type** | Frontend (composant UI + integration Members page) |

---

## Description

### Contexte

RBAC-S03 a pose les fondations du champ `businessRole` sur `company_memberships` avec les 4 valeurs possibles : `admin`, `manager`, `contributor`, `viewer`. Les constantes `BUSINESS_ROLES`, `BUSINESS_ROLE_LABELS`, et le type `BusinessRole` sont exportes depuis `@mnm/shared`.

La page Members (MU-S02) affiche deja le role de chaque membre via un `<Select>` dropdown (pour le modifier) mais ne dispose pas d'un composant Badge visuel permettant d'identifier rapidement les roles par couleur.

Le Badge shadcn/ui existant dans `ui/src/components/ui/badge.tsx` supporte 6 variants (`default`, `secondary`, `destructive`, `outline`, `ghost`, `link`) mais aucune n'est mappee aux 4 business roles. Il ne faut **pas** modifier le composant Badge de base (composant shadcn/ui generique), mais creer un composant metier `RoleBadge` qui l'utilise.

### Ce que cette story fait

1. **Composant `RoleBadge`** : Nouveau composant dans `ui/src/components/RoleBadge.tsx` qui encapsule le `<Badge>` shadcn/ui avec des classes Tailwind specifiques par role
2. **Couleurs par role** : Chaque role a une combinaison couleur distincte et accessible (contraste WCAG AA)
3. **Integration Members page** : Ajout du `RoleBadge` dans la page Members, a cote du selecteur de role existant (dans le `<td>` du role) pour fournir un indicateur visuel
4. **Integration BulkInviteTab** : Ajout du `RoleBadge` dans les previews CSV pour afficher les roles avec couleur
5. **data-test-id** : Tous les elements du composant sont taggues pour les tests E2E

---

## Etat Actuel du Code (Analyse)

### Fichiers impactes

| Fichier | Role actuel | Modification |
|---------|-------------|-------------|
| `ui/src/components/RoleBadge.tsx` | N'existe pas | CREE : composant RoleBadge |
| `ui/src/pages/Members.tsx` | Page membres avec Select pour role | MODIFIE : ajout RoleBadge a cote du Select |
| `ui/src/components/BulkInviteTab.tsx` | Preview CSV avec label texte | MODIFIE : remplacement texte brut par RoleBadge dans preview |

### Fichiers de reference (non modifies dans cette story)

| Fichier | Role |
|---------|------|
| `ui/src/components/ui/badge.tsx` | Composant Badge shadcn/ui generique -- NE PAS MODIFIER |
| `packages/shared/src/constants.ts` | `BUSINESS_ROLES`, `BUSINESS_ROLE_LABELS`, `BusinessRole` (RBAC-S03) |
| `ui/src/lib/utils.ts` | Fonction `cn()` pour merge des classnames |

### Conventions du codebase (a respecter)

1. **Composants metier** : Fichier unique dans `ui/src/components/`, pas dans `ui/src/components/ui/` (reserve aux composants shadcn)
2. **Imports shadcn** : `import { Badge } from "@/components/ui/badge"` avec alias `@/`
3. **Imports shared** : `import { BUSINESS_ROLE_LABELS, type BusinessRole } from "@mnm/shared"`
4. **Tailwind classes** : Classes utilitaires inline, pas de fichiers CSS custom
5. **data-testid** : Format kebab-case avec prefix story-id
6. **Export** : Named export (pas de default export)

---

## Specification Technique Detaillee

### T1 : Creer le composant `RoleBadge` -- `ui/src/components/RoleBadge.tsx`

```typescript
import { BUSINESS_ROLE_LABELS, type BusinessRole } from "@mnm/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<BusinessRole, string> = {
  admin: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  manager: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  contributor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  viewer: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
};

interface RoleBadgeProps {
  role: BusinessRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const label = BUSINESS_ROLE_LABELS[role] ?? role;

  return (
    <Badge
      data-testid={`rbac-s07-role-badge-${role}`}
      variant="outline"
      className={cn(ROLE_STYLES[role], className)}
    >
      {label}
    </Badge>
  );
}
```

#### Design decisions

1. **Utilise `variant="outline"`** comme base car il fournit le border style de base depuis le Badge shadcn/ui, et les classes Tailwind custom surchargent les couleurs
2. **Record exhaustif `ROLE_STYLES`** : TypeScript force un style pour chaque `BusinessRole`, donc si un 5eme role est ajoute dans le futur, le compilateur signalera l'absence de style
3. **Support dark mode** : Chaque role a des classes `dark:` pour le mode sombre
4. **Pas de logique conditionnelle** : Un simple lookup dans un Record, O(1)

#### Couleurs par role

| Role | Light mode | Dark mode | Justification |
|------|-----------|-----------|---------------|
| `admin` | Rose/red bg + text | Rose dark bg + light text | Rouge = autorite, alerte, importance |
| `manager` | Blue bg + text | Blue dark bg + light text | Bleu = confiance, gestion, stabilite |
| `contributor` | Green bg + text | Green dark bg + light text | Vert = actif, contribution, productivite |
| `viewer` | Gray bg + text | Gray dark bg + light text | Gris = passif, observation, lecture seule |

---

### T2 : Integrer `RoleBadge` dans la page Members -- `ui/src/pages/Members.tsx`

#### Import a ajouter

```typescript
import { RoleBadge } from "../components/RoleBadge";
```

#### Modification du `MemberRow` -- cellule Role (ligne ~432-453)

Remplacer le contenu de la cellule `<td>` du role par un layout qui affiche le `RoleBadge` et conserve le `<Select>` pour la modification.

**AVANT** (lignes 433-453) :

```tsx
<td className="px-4 py-2.5 hidden sm:table-cell">
  <Select
    value={member.businessRole}
    onValueChange={(val) => onRoleChange(val as BusinessRole)}
  >
    <SelectTrigger
      data-testid={`mu-s02-member-role-${member.id}`}
      size="sm"
      className="w-[120px] h-7 text-xs"
    >
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {BUSINESS_ROLES.map((role) => (
        <SelectItem key={role} value={role}>
          {BUSINESS_ROLE_LABELS[role] ?? role}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</td>
```

**APRES** :

```tsx
<td className="px-4 py-2.5 hidden sm:table-cell">
  <div className="flex items-center gap-2">
    <RoleBadge role={member.businessRole} />
    <Select
      value={member.businessRole}
      onValueChange={(val) => onRoleChange(val as BusinessRole)}
    >
      <SelectTrigger
        data-testid={`mu-s02-member-role-${member.id}`}
        size="sm"
        className="w-[120px] h-7 text-xs"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {BUSINESS_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {BUSINESS_ROLE_LABELS[role] ?? role}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
</td>
```

**Explication** : Le `RoleBadge` est affiche comme indicateur visuel immediat, et le `Select` reste disponible pour modifier le role. Le `flex` avec `gap-2` les aligne horizontalement.

---

### T3 : Integrer `RoleBadge` dans les previews CSV -- `ui/src/components/BulkInviteTab.tsx`

#### Import a ajouter

```typescript
import { RoleBadge } from "./RoleBadge";
```

#### Modifications

Remplacer les deux occurrences ou le role est affiche en texte brut dans le preview CSV par le composant `RoleBadge`.

**Occurrence 1** (dans la table de preview, colonne Role -- environ ligne 420) :

**AVANT** :
```tsx
? BUSINESS_ROLE_LABELS[row.role as BusinessRole]
```

**APRES** : Remplacer le texte par `<RoleBadge role={row.role as BusinessRole} />` dans la cellule.

**Occurrence 2** (dans la section erreur/detail -- environ ligne 598) :

**AVANT** :
```tsx
? BUSINESS_ROLE_LABELS[row.role as BusinessRole]
```

**APRES** : Remplacer par `<RoleBadge role={row.role as BusinessRole} />`.

**Note** : Verifier le contexte exact de chaque occurrence lors de l'implementation. Le `RoleBadge` ne doit etre utilise que quand le role est valide (quand `BUSINESS_ROLES.includes(row.role)` est vrai). Si le role est invalide, garder l'affichage texte brut existant comme fallback.

---

## data-test-id Attributes

| Element | data-testid | Usage |
|---------|-------------|-------|
| Badge role admin | `data-testid="rbac-s07-role-badge-admin"` | Badge colore affichant "Admin" |
| Badge role manager | `data-testid="rbac-s07-role-badge-manager"` | Badge colore affichant "Manager" |
| Badge role contributor | `data-testid="rbac-s07-role-badge-contributor"` | Badge colore affichant "Contributor" |
| Badge role viewer | `data-testid="rbac-s07-role-badge-viewer"` | Badge colore affichant "Viewer" |

Le format du data-testid est dynamique : `rbac-s07-role-badge-${role}` ou `role` est la valeur du `BusinessRole`.

**Note** : Les data-testid existants de MU-S02 (`mu-s02-member-role-${member.id}`, etc.) restent inchanges sur le `Select`.

---

## Acceptance Criteria

### AC-01 : Composant RoleBadge existe et est exporte

```
Given le fichier ui/src/components/RoleBadge.tsx
When on l'importe
Then il exporte une fonction RoleBadge
And le composant accepte une prop obligatoire `role: BusinessRole`
And le composant accepte une prop optionnelle `className: string`
```

### AC-02 : Badge admin affiche en rose/rouge

```
Given un <RoleBadge role="admin" />
When il est rendu
Then le texte affiche est "Admin" (via BUSINESS_ROLE_LABELS)
And les classes contiennent "bg-rose-100" et "text-rose-700" (light mode)
And les classes contiennent "dark:bg-rose-950" et "dark:text-rose-300" (dark mode)
And le data-testid est "rbac-s07-role-badge-admin"
```

### AC-03 : Badge manager affiche en bleu

```
Given un <RoleBadge role="manager" />
When il est rendu
Then le texte affiche est "Manager"
And les classes contiennent "bg-blue-100" et "text-blue-700" (light mode)
And les classes contiennent "dark:bg-blue-950" et "dark:text-blue-300" (dark mode)
And le data-testid est "rbac-s07-role-badge-manager"
```

### AC-04 : Badge contributor affiche en vert

```
Given un <RoleBadge role="contributor" />
When il est rendu
Then le texte affiche est "Contributor"
And les classes contiennent "bg-green-100" et "text-green-700" (light mode)
And les classes contiennent "dark:bg-green-950" et "dark:text-green-300" (dark mode)
And le data-testid est "rbac-s07-role-badge-contributor"
```

### AC-05 : Badge viewer affiche en gris

```
Given un <RoleBadge role="viewer" />
When il est rendu
Then le texte affiche est "Viewer"
And les classes contiennent "bg-gray-100" et "text-gray-700" (light mode)
And les classes contiennent "dark:bg-gray-800" et "dark:text-gray-300" (dark mode)
And le data-testid est "rbac-s07-role-badge-viewer"
```

### AC-06 : RoleBadge integre dans la page Members

```
Given la page Members (/members) avec des membres ayant differents roles
When la page est chargee
Then chaque ligne de membre affiche un RoleBadge colore correspondant a son businessRole
And le RoleBadge est positionne a cote du Select de changement de role
And le Select de role existant (mu-s02-member-role-*) fonctionne toujours
```

### AC-07 : data-testid dynamique present pour chaque badge

```
Given la page Members avec au moins un membre admin et un membre contributor
When la page est chargee
Then un element avec data-testid="rbac-s07-role-badge-admin" est visible
And un element avec data-testid="rbac-s07-role-badge-contributor" est visible
```

### AC-08 : Le composant Badge shadcn/ui de base n'est pas modifie

```
Given le fichier ui/src/components/ui/badge.tsx
When on compare avec la version avant RBAC-S07
Then le fichier est identique (aucune modification)
```

### AC-09 : className custom est supporte

```
Given un <RoleBadge role="admin" className="ml-2" />
When il est rendu
Then les classes du role ET la classe "ml-2" sont presentes sur l'element
```

### AC-10 : Type-safety -- Record exhaustif sur BusinessRole

```
Given le Record ROLE_STYLES dans RoleBadge.tsx
When il est type comme Record<BusinessRole, string>
Then TypeScript impose que les 4 roles aient un style defini
And si un 5eme role est ajoute a BusinessRole, le compilateur signale l'erreur
```

### AC-11 : RoleBadge integre dans BulkInviteTab preview

```
Given un CSV importe avec des roles valides dans le BulkInviteTab
When le preview des lignes est affiche
Then les roles valides sont affiches via RoleBadge avec leur couleur
And les roles invalides restent en texte brut
```

---

## Plan de Tests E2E (Playwright)

### Fichier : `e2e/tests/RBAC-S07.spec.ts`

#### Tests composant RoleBadge (via page Members)

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 1 | RoleBadge admin visible | Naviguer sur /members, verifier presence `[data-testid="rbac-s07-role-badge-admin"]` | Element visible avec texte "Admin" |
| 2 | RoleBadge admin couleur rose | Verifier les classes CSS du badge admin | Contient `bg-rose-100` |
| 3 | RoleBadge contributor visible | Verifier presence `[data-testid="rbac-s07-role-badge-contributor"]` | Element visible avec texte "Contributor" |
| 4 | RoleBadge contributor couleur verte | Verifier les classes CSS du badge contributor | Contient `bg-green-100` |
| 5 | Changement de role met a jour le badge | Changer le role d'un membre via le Select, verifier que le badge change | Nouveau badge avec nouveau data-testid et nouvelles couleurs |
| 6 | Badge et Select coexistent | Verifier que le RoleBadge et le Select sont dans la meme cellule | Les deux elements sont presents dans la colonne Role |

#### Tests file-content (structure du composant)

| # | Test | Fichier verifie | Pattern attendu |
|---|------|-----------------|-----------------|
| 7 | RoleBadge exporte | `ui/src/components/RoleBadge.tsx` | `export function RoleBadge` |
| 8 | ROLE_STYLES contient admin | `ui/src/components/RoleBadge.tsx` | `admin.*bg-rose` |
| 9 | ROLE_STYLES contient manager | `ui/src/components/RoleBadge.tsx` | `manager.*bg-blue` |
| 10 | ROLE_STYLES contient contributor | `ui/src/components/RoleBadge.tsx` | `contributor.*bg-green` |
| 11 | ROLE_STYLES contient viewer | `ui/src/components/RoleBadge.tsx` | `viewer.*bg-gray` |
| 12 | ROLE_STYLES type Record<BusinessRole> | `ui/src/components/RoleBadge.tsx` | `Record<BusinessRole, string>` |
| 13 | Badge variant outline utilise | `ui/src/components/RoleBadge.tsx` | `variant="outline"` |
| 14 | data-testid dynamique | `ui/src/components/RoleBadge.tsx` | `rbac-s07-role-badge-\${role}` ou `rbac-s07-role-badge-` |
| 15 | Import BUSINESS_ROLE_LABELS | `ui/src/components/RoleBadge.tsx` | `BUSINESS_ROLE_LABELS.*@mnm/shared` |

#### Tests file-content (integration Members page)

| # | Test | Fichier verifie | Pattern attendu |
|---|------|-----------------|-----------------|
| 16 | Import RoleBadge dans Members | `ui/src/pages/Members.tsx` | `import.*RoleBadge` |
| 17 | RoleBadge utilise dans MemberRow | `ui/src/pages/Members.tsx` | `<RoleBadge` |
| 18 | Badge shadcn non modifie | `ui/src/components/ui/badge.tsx` | Fichier identique a la version pre-RBAC-S07 |

#### Tests dark mode (visuels, optionnels)

| # | Test | Description | Expected |
|---|------|-------------|----------|
| 19 | Dark mode admin | Activer dark mode, verifier que le badge admin a les classes dark | `dark:bg-rose-950` appliquee |
| 20 | Dark mode viewer | Activer dark mode, verifier que le badge viewer a les classes dark | `dark:bg-gray-800` appliquee |

### Couverture cible

| Module | Couverture cible |
|--------|-----------------|
| RoleBadge composant | 100% (4 roles x 2 modes = 8 combinaisons) |
| Integration Members | >= 90% |
| Integration BulkInviteTab | >= 80% |
| Badge shadcn/ui non-regression | 100% (verification fichier inchange) |

---

## Diagramme de Composant

```
RoleBadge (ui/src/components/RoleBadge.tsx)
    |
    |-- Props: { role: BusinessRole, className?: string }
    |
    |-- Depends on:
    |     |-- Badge (ui/src/components/ui/badge.tsx) -- variant="outline"
    |     |-- BUSINESS_ROLE_LABELS (@mnm/shared) -- pour le label affiche
    |     |-- BusinessRole type (@mnm/shared) -- pour le typage exhaustif
    |     |-- cn() (ui/src/lib/utils.ts) -- pour merge classes
    |
    |-- Used by:
    |     |-- Members page (ui/src/pages/Members.tsx) -- dans MemberRow
    |     |-- BulkInviteTab (ui/src/components/BulkInviteTab.tsx) -- dans preview CSV
    |
    |-- Renders:
          <Badge variant="outline" className={ROLE_STYLES[role]} data-testid="rbac-s07-role-badge-{role}">
            {BUSINESS_ROLE_LABELS[role]}
          </Badge>
```

---

## Risques et Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|------------|--------|------------|
| Couleurs Tailwind non incluses dans le bundle (purge) | Faible | Moyen | Les classes sont ecrites en dur dans le Record, Tailwind les detecte a la compilation |
| Contraste insuffisant en dark mode | Faible | Faible | Les combinaisons choisies (950 bg + 300 text) respectent WCAG AA. Verification visuelle par l'agent Review |
| Conflit avec les classes du Badge variant="outline" | Faible | Faible | `cn()` merge correctement les classes, les classes ROLE_STYLES surchargent celles du variant |
| BulkInviteTab -- role invalide passe a RoleBadge | Moyen | Faible | Ne passer RoleBadge que quand le role est valide (`BUSINESS_ROLES.includes()`). Fallback texte brut sinon |

---

## Definition of Done

- [ ] Fichier `ui/src/components/RoleBadge.tsx` cree avec le composant `RoleBadge`
- [ ] `ROLE_STYLES` est un `Record<BusinessRole, string>` exhaustif (type-safe)
- [ ] 4 couleurs distinctes : admin=rose, manager=blue, contributor=green, viewer=gray
- [ ] Support dark mode pour les 4 roles
- [ ] `data-testid="rbac-s07-role-badge-${role}"` present sur chaque badge
- [ ] Composant integre dans `Members.tsx` -- badge visible a cote du Select de role
- [ ] Composant integre dans `BulkInviteTab.tsx` -- roles affiches avec couleur dans le preview CSV
- [ ] Le fichier `ui/src/components/ui/badge.tsx` n'est PAS modifie
- [ ] `pnpm typecheck` passe sans erreur
- [ ] `pnpm test` passe sans regression
- [ ] Verification visuelle via Chrome MCP (light mode + dark mode)
