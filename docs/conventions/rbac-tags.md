# RBAC dynamique + isolation par tags

## Modèle hybride : Roles + Tags

MnM combine deux mécanismes complémentaires :

| Mécanisme | Sémantique | Mutabilité | Stocké dans |
|---|---|---|---|
| **Roles** | Permissions stables (qui peut faire quoi) | Figé en DB | `roles`, `permissions`, `role_permissions` |
| **Tags** | Organisation volatile (qui voit quoi) | Fluide, archivable | `principal_tags`, `tag_definitions` |

Un user peut avoir 1 rôle + N tags. Un agent peut avoir 1 rôle (souvent dérivé de son créateur) + N tags.

## Roles (permissions)

- 91 permissions granulaires en DB (couvrent agents, issues, projects, chat, config-layers, workflows, traces, sandbox, users, admin, a2a, documents).
- Pas de constante hardcodée. **Aucun** `BUSINESS_ROLES`, `AGENT_ROLES`, `PERMISSION_KEYS` dans le code.
- Une nouvelle permission = un INSERT en SQL au moment de l'onboarding ou via migration.
- Vérification middleware : `requirePermission("workflows:write")`.

## Tags (organisation)

- Tags additifs : `team:dev`, `product:checkout`, `skill:rust`, `private:tom`, `team:qa`.
- Pas de hiérarchie. Un user peut être dans `team:dev` ET `product:checkout` ET `skill:rust` simultanément.
- **Sandbox tied to tags**, pas aux users. N'importe quel tag (user/team/role) peut avoir un sandbox.

## Tag-based isolation

Au sein d'une company, les tags filtrent **ce que le user voit** :
- Visibilité d'un agent / issue / trace : intersection non vide entre les tags du user et ceux de l'objet.
- Visibilité d'une config layer : `private` (créateur uniquement), `team` (tags partagés), `public` (tous), `company` (tous).

`tagScopeMiddleware` calcule le scope visible. RLS PostgreSQL applique le filtre fail-closed.

## Agent permissions (héritage)

Les agents **héritent les permissions** de leur créateur (`createdByUserId`). Un agent créé par un user `Lead` aura les mêmes permissions que ce Lead. Les tags suivent la même règle au moment de la création, mais peuvent être ajustés.

## CAO

Le CAO (Chief Agent Officer) est un agent système avec :
- `metadata.isCAO=true`
- Role `Admin`
- **Tous les tags** de la company (visibilité totale)
- `adapter_type="claude_local"`

## Onboarding company

Quand une nouvelle company est créée :
1. Rôles par défaut générés (Admin, Lead, Member, Viewer) — éditables après.
2. Permissions par défaut attachées par rôle — éditables après.
3. Tag set initial proposé via UI onboarding (le user choisit ses tags structurants).
4. CAO auto-créé.

**Pas de preset hardcodé** — tout est généré dynamiquement à l'onboarding et modifiable.

## Code

- `server/src/services/rbac.ts` — résolution permissions
- `server/src/middlewares/{requirePermission,tagScope}.ts` — enforcement
- `server/src/services/onboarding.ts` — bootstrap company

## Liens

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — vue d'ensemble
- [`./middleware-chain.md`](./middleware-chain.md) — où ça s'enforce
- [`../decision-log.md#12-hybrid-roles--tags-vs-hierarchie-pure`](../decision-log.md) — décision
