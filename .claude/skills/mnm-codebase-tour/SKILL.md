---
name: mnm-codebase-tour
description: >
  Tour guidé de la codebase MnM pour onboarder rapidement sur le projet.
  À invoquer quand un agent débarque sur le repo et a besoin de comprendre
  l'architecture en moins de 30 minutes : structure monorepo, services
  backend clés, conventions, feature phare (Governed Workflows). Lit
  proactivement les bons fichiers et résume la mental map. Utiliser via
  `/mnm-codebase-tour` ou laisser Claude l'auto-invoquer quand l'utilisateur
  pose une question d'orientation générale ("comment ça marche", "où est X",
  "explique-moi le projet").
allowed-tools: Read, Glob, Grep, LS
---

# MnM Codebase Tour

Tu es l'agent qui aide Claude à se faire une carte mentale précise de MnM en moins de 30 minutes.

## Étapes du tour

### 1. Position produit (5 min)

Lis dans cet ordre :
- `README.md` — positionnement, problème, 3 piliers
- `docs/product/vision.md` — vision condensée
- `docs/product/three-pillars.md` — Confiance / Contrôle / Transparence

À retenir : **MnM n'est pas un IDE, c'est un cockpit de supervision**. Le compute agent se fait côté client (Claude Code, MCP, Desktop). Le serveur orchestre, score et trace.

### 2. Architecture technique (10 min)

Lis :
- `CLAUDE.md` — règles critiques (lire en entier, c'est la source de vérité opérationnelle)
- `docs/ARCHITECTURE.md` — stack + middleware chain + traces + config layers + CAO
- `docs/decision-log.md` — pourquoi des choix structurants

À retenir :
- Multi-tenant : 1 backend, N companies, 5 couches (auth → company → permission → tag scope → RLS)
- RBAC dynamique 100% en DB, pas de constantes hardcodées
- Pipeline traces Bronze/Silver/Gold avec enrichissement LLM hiérarchique
- Config Layers (priority merge) > JSONB monolithique
- Compute côté client, sandbox Docker optionnel

### 3. Structure monorepo (5 min)

```
mnm/
├── server/       Express API + middlewares + 71 services
├── ui/           React 18 + shadcn/ui + Tailwind
├── packages/     bun workspaces (gate-runner, mcp-server, shared types, …)
├── apps/desktop/ Tauri 2 desktop app
├── plugins/mnm/  Claude Code plugin (workflow harness)
├── e2e/          Playwright E2E tests
├── docker/       Configs déploiement
└── docs/         Documentation publique (tu y es)
```

Vérifie la cohérence avec :
- `package.json` (workspaces déclarées)
- `scripts/parity/data.ts` (web ↔ desktop parity tracker, OBLIGATOIRE à mettre à jour pour toute feature touchant l'UI)

### 4. Feature phare : Governed Workflows (5 min)

Lis :
- `docs/governed-workflows/README.md`
- Code : `packages/gate-runner/`, `server/src/routes/workflows/`, `ui/src/pages/WorkflowStudio.tsx`

À retenir : workflows-as-code versionnés en git, Studio Monaco multi-fichiers, AI Assistant Panel SSE, 4 gates canoniques + DSL custom, parité REST + MCP (14 endpoints).

### 5. Outils & conventions (5 min)

- `docs/conventions/git.md` — atomic commit + push, GPG fallback, format conventional
- `docs/conventions/middleware-chain.md` — ordre multi-tenant strict
- `docs/conventions/no-polling.md` — SSE/WebSocket exclusivement
- `docs/conventions/rbac-tags.md` — permissions vs organisation

GitNexus est obligatoire avant toute édition de symbole : run `gitnexus_impact({target, direction: "upstream"})` puis fix.

### 6. Workflow Superpowers (1 min)

Avant tout chantier non-trivial : créer un plan dans `docs/superpowers/plans/YYYY-MM-DD-{topic}.md`. Skip uniquement si typo, one-liner, exploration pure.

## Résumé en 5 lignes

> MnM est un cockpit B2B qui supervise des équipes utilisant des agents IA — sans remplacer Claude Code/Cursor. Stack React + Express + PostgreSQL (RLS) + Drizzle ORM en monorepo bun. Multi-tenant par défense en profondeur (5 couches). Feature phare : Governed Workflows (workflows-as-code git-first). Compute agent côté client (MCP, Desktop, CLI). Trois piliers : Confiance (scoring), Contrôle (continuum 6 niveaux), Transparence (traces hiérarchiques).

Si après cette lecture tu as encore une zone floue, dis-le clairement à l'utilisateur et propose de creuser un point précis.
