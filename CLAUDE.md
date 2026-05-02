# CLAUDE.md

MnM — Cockpit B2B de supervision pour orchestration d'agents IA.
Stack: React 18 + Express + PostgreSQL + Drizzle ORM. Monorepo bun workspaces (17 packages).
Langue: français pour la doc et le planning, anglais pour les identifiants techniques.

## Lecture obligatoire avant intervention

1. [`docs/README.md`](docs/README.md) — entry point doc (par où commencer selon ton rôle)
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — stack, multi-tenant, traces, config layers, CAO
3. [`docs/decision-log.md`](docs/decision-log.md) — décisions structurantes encore actives

Pour les conventions détaillées : [`docs/conventions/`](docs/conventions/).
Pour les patterns scopés (backend, frontend, database, testing, gitnexus, governed-workflows) : [`.claude/rules/`](.claude/rules/) — ces fichiers sont chargés automatiquement quand tu touches aux fichiers concernés.

## Règles absolues (non-négociables)

- **Repo public, zéro nom client** — ce repo est open source. Ne JAMAIS mentionner de nom de client, prospect, partenaire commercial ou personne externe identifiable dans le code, les commits, la doc, les plans superpowers, le decision-log, ou les conventions. Utiliser des termes neutres : "premier pilote enterprise", "client pilote", "une company", "un user", "premier prospect". Les noms réels vivent dans la mémoire perso (`~/.claude/projects/.../memory/`) qui n'est pas versionnée. Avant tout commit qui touche à de la doc/plan, grep le diff pour s'assurer qu'aucune entité externe n'est nommée.
- **Traçabilité humaine universelle** — TOUT ce qui est fait dans MnM doit être traçable à un utilisateur humain. Aucune action « anonyme » ni « service account » : un workflow est lancé par un user, un step est trigger par un user (ou par un agent dont le `createdByUserId` est un user), un hook s'exécute avec l'auth du user qui a triggered le run, le CAO/watchdog "agit" sous l'identité de l'admin instance qui l'a setup. Pour les credentials externes (Jira, ClickUp, …), pattern OAuth user-level (comme GitLab) : chaque user connecte son compte, le hook utilise le token user. Détails : [`docs/decision-log.md` §1.7](docs/decision-log.md). **Conséquence opérationnelle :** quand tu écris une feature qui exécute du code/HTTP/LLM côté serveur, demande-toi toujours « sous quelle identité humaine ça s'exécute ? » — la réponse doit être univoque et auditable.
- **Zero polling** — tous les updates temps réel via SSE/WebSocket sur `/events/ws`. Jamais `setInterval` ni `refetchInterval`. Détails : [`docs/conventions/no-polling.md`](docs/conventions/no-polling.md).
- **UI library components** — toujours importer depuis `ui/src/components/ui/`. Si une primitive shadcn manque, la créer là d'abord. Pas d'inline.
- **Multi-tenant explicite** — toutes les routes scopées company ont le préfixe `/companies/:companyId/`. Pas d'auto-injection, pas d'URL rewrite. Vérifié par middleware + RLS PostgreSQL fail-closed. Détails : [`docs/conventions/middleware-chain.md`](docs/conventions/middleware-chain.md).
- **RBAC dynamique** — rôles et permissions en DB (`roles`, `permissions`, `role_permissions`), jamais hardcodés. Pas de constante `BUSINESS_ROLES` / `PERMISSION_KEYS`. Détails : [`docs/conventions/rbac-tags.md`](docs/conventions/rbac-tags.md).
- **Tag-based isolation** — visibilité contrôlée par tags partagés (intersection non-vide). Enforced par `tagScopeMiddleware` monté sur `api.use("/companies/:companyId", ...)`.
- **Compute côté client** — l'exécution agent se fait sur la machine user (Claude Code, MCP, Desktop, CLI locale). Le serveur est API/data/orchestration. Docker sandbox optionnel pour utilisateurs non-tech.
- **LLM provider-agnostic** — V0 Anthropic uniquement, mais l'archi (Config Layer + helpers) est conçue pour multi-provider (OpenAI, Azure OpenAI, Bedrock, custom endpoint). Toute nouvelle feature qui utilise du LLM doit passer par le helper abstrait, pas hardcoder Anthropic. Détails : [`docs/decision-log.md` §4.5](docs/decision-log.md).
- **Modes de déploiement** — `local_trusted` (dev, zéro auth, single-company auto) ou `authenticated` (prod, BetterAuth + OAuth 2.1, multi-company).

## Web/Desktop parity tracker

MnM ship en web (`@mnm/ui`) et desktop (`apps/desktop` Tauri). Toute feature touchant `ui/src/pages/`, `ui/src/components/`, `apps/desktop/src-tauri/`, ou ajoutant un IPC command **doit aussi mettre à jour** [`scripts/parity/data.ts`](scripts/parity/data.ts) (status `done | dev-only | partial | missing | n/a`, `todo` rempli si reste du boulot).

```bash
bun run parity                 # rapport complet
bun run parity --missing       # web ✅ / desktop ❌
bun run parity --todo          # features avec todo ouvert
bun run parity --domain=agents # filtrer par domaine
```

Si vraiment pas pertinent → mention dans le PR body. Détails dans [`.claude/rules/frontend.md`](.claude/rules/frontend.md).

## Git

- **Atomic commit + push** — tout commit est immédiatement pushé. Jamais de commit local non pushé.
- **GPG fallback** — si `gpg: signing failed: Timeout`, retry avec `git -c commit.gpgsign=false commit ...`.
- Détails : [`docs/conventions/git.md`](docs/conventions/git.md).

## Dev commands

```bash
bun install         # install deps
bun run dev         # dev server + ui (postgres embedded)
bun run build       # build all packages
bun run typecheck   # 17/17 packages should pass
bun run test        # vitest unit
bun run test:e2e    # playwright E2E
```

## Workflow Superpowers (planning)

Avant tout chantier non-trivial, écrire un plan dans [`docs/superpowers/plans/YYYY-MM-DD-{topic}.md`](docs/superpowers/plans/). Si besoin d'une passe d'archi : spec dans `superpowers/specs/`. Reviews structurées dans `superpowers/reviews/` à la livraison.

Skip uniquement pour : typo, one-line fix, exploration pure, conversation.

## Outillage Claude

- **Subagents** : [`.claude/agents/`](.claude/agents/) — `mnm-architect`, `mnm-backend`, `mnm-frontend` (auto-délégation par `description`)
- **Skills** : [`.claude/skills/`](.claude/skills/) — `mnm-codebase-tour` (tour guidé en 30 min), `gitnexus/*` (impact, refactor, debug…)
- **Rules scopées** : [`.claude/rules/`](.claude/rules/) — chargées automatiquement par `paths:` quand tu édites les fichiers correspondants
