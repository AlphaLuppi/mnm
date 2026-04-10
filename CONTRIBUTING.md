# Contribuer à MnM

Merci de vouloir contribuer ! MnM est open-source et construit pour accueillir une communaute autour de la supervision d'agents IA en entreprise. Ce document decrit tout ce qu'il faut savoir pour lancer MnM en local, comprendre le repo, et proposer des changements.

Pour la vision produit, voir le [README](README.md). Pour les decisions architecturales, voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Prerequis

- **Bun** >= 1.3
- **Node.js** >= 20
- **Docker** (optionnel en dev, requis en prod)
- **Git**

---

## Installation

```bash
git clone https://github.com/AlphaLuppi/mnm.git
cd mnm
bun install
```

---

## Lancer en dev

MnM utilise un PostgreSQL embarque par defaut — pas besoin de Docker pour demarrer :

```bash
bun run dev         # Lance server + ui + embedded postgres
```

Si tu preferes un PostgreSQL + Redis externes :

```bash
bun run dev:docker:up    # Lance PG + Redis via Docker Compose
bun run dev              # Lance le serveur contre ces services
```

Par defaut, l'UI est servie sur `http://localhost:5173` (Vite) et l'API sur `http://localhost:3001`.

---

## Deploiement

### Docker Compose (prod)

```bash
docker compose build server
docker compose up -d --wait
# Server sur http://127.0.0.1:3100 (mode authenticated, 41 tables RLS)
```

### Dokploy

```bash
docker compose -f docker-compose.dokploy.yml up -d
```

---

## Commandes utiles

```bash
bun install          # Installer les dependances
bun run dev          # Lancer en dev (server + ui)
bun run build        # Build tous les packages
bun run typecheck    # Verification TypeScript (13/13 packages)
bun run test:e2e     # Tests Playwright E2E
```

---

## CLI

MnM fournit une CLI distribuee sur npm (`@mnm/cli`) pour les operations d'admin :

```bash
npx @mnm/cli configure   # Configuration initiale
npx @mnm/cli onboard     # Onboarding interactif
npx @mnm/cli doctor      # Diagnostic de l'installation
npx @mnm/cli run         # Lancer le serveur
npx @mnm/cli db-backup   # Backup de la base
```

---

## Structure du repo

```
server/              Express backend (routes, services, middleware, realtime, auth)
ui/                  React frontend (pages, components, hooks, api)
packages/
  db/                Drizzle ORM schema, migrations
  shared/            Types partages
  adapters/          Adaptateurs agents (claude-local, cursor-local, codex-local, etc.)
  adapter-utils/     Utilitaires communs aux adaptateurs
  test-utils/        Factories et helpers de test
cli/                 CLI MnM (@mnm/cli, publie sur npm)
skills/              Skills Claude Code
e2e/                 Tests Playwright E2E
docs/                Documentation (architecture, history)
_bmad/               Framework BMAD (NE PAS MODIFIER)
_bmad-output/        Artifacts de planning, brainstorms, reviews, stories
```

---

## Conventions & regles critiques

Quelques regles strictes a respecter pour qu'un PR soit merge :

- **Zero polling** — Tous les updates temps reel passent par SSE/WebSocket (`/events/ws`). Pas de `setInterval` ou `refetchInterval`.
- **Composants UI** — Toujours utiliser les primitives de `ui/src/components/ui/`. Ne jamais inline un Switch, Button, Dialog, Checkbox, etc. Si un composant manque, le creer la d'abord.
- **Single-tenant** — 1 instance = 1 entreprise. `company_id` est auto-injecte et ne doit jamais apparaitre en UI.
- **RBAC dynamique** — Pas de roles hardcodes. Les permissions vivent en DB (`roles`, `permissions`, `role_permissions`).
- **Tag-based isolation** — L'acces aux agents/issues/traces est controle par les tags partages (middleware `TagScope`).
- **Agent permissions** — Les agents heritent des permissions de leur createur (`createdByUserId`).

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour les decisions architecturales completes.

---

## MCP Server (pour les devs)

MnM expose un serveur MCP que tu peux brancher a ton propre client Claude Code / Cursor pour piloter ton instance :

```bash
claude mcp add --transport http mnm http://localhost:3001/mcp
```

Au premier appel, un flow OAuth 2.1 s'ouvre dans le navigateur avec un ecran de consentement granulaire par domaine (read/write/admin). Les tools disponibles sont filtres selon les permissions reelles de l'utilisateur connecte.

Endpoints exposes :

| Endpoint | Role |
|---|---|
| `POST/GET/DELETE /mcp` | Transport Streamable HTTP (recommande) |
| `GET /mcp/sse` | Transport SSE legacy |
| `/.well-known/oauth-protected-resource` | Metadata resource server |
| `/.well-known/oauth-authorization-server` | Metadata AS |
| `/oauth/register`, `/oauth/authorize`, `/oauth/token` | OAuth 2.1 AS |

Details techniques et progression : `_bmad-output/specs/plans/mcp-progress.md`.

---

## GitNexus — Code Intelligence

Le codebase est indexe par [GitNexus](https://github.com/abhigyanpatwari/GitNexus) (knowledge graph du code source). Utilise-le pour comprendre l'architecture, trouver des flows, et estimer le blast radius avant d'editer un symbole.

```bash
npx gitnexus analyze                                       # Re-indexer
npx gitnexus query "auth validation"                       # Trouver des execution flows
npx gitnexus context "validateUser"                        # Vue 360 d'un symbole
npx gitnexus impact "SessionManager" --direction upstream  # Blast radius
```

Setup pour un nouveau dev :
1. `npx gitnexus setup` — configure le MCP GitNexus pour ton IDE (Cursor, Claude Code, VSCode)
2. `npx gitnexus analyze` — indexe le repo (~23s)
3. Le MCP est disponible dans ton IDE — pose des questions sur l'architecture

L'index est stocke dans `.gitnexus/` (gitignored). Les skills Claude Code sont dans `.claude/skills/gitnexus/`.

---

## Git workflow

- **Branches** : `feature/<slug>`, `fix/<slug>`, `refactor/<slug>`
- **Commits conventionnels** : `feat()`, `fix()`, `refactor()`, `test()`, `docs()`, `chore()`
- **Commit atomique + push** : chaque commit doit etre immediatement pushe. Pas de commits locaux en rade.
- **PR** : jamais de push direct sur `master`. Toute modification passe par une PR.

---

## Tester avant de push

```bash
bun run typecheck    # Doit passer sur les 13 packages
bun run test:e2e     # Tests Playwright E2E
```

Pour des tests unitaires, utilise Vitest. Pour les tests E2E, Playwright.

---

Merci pour ta contribution !
