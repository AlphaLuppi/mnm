# Documentation MnM — Pour Claude (et humains)

> Tu débarques sur le repo. Lis ce fichier d'abord. Il te dit **par où commencer selon ce que tu veux faire**.

## Premier réflexe : 3 fichiers

Avant TOUTE intervention, lis dans cet ordre :

1. [`../CLAUDE.md`](../CLAUDE.md) — règles critiques (multi-tenant, no-polling, conventions, mission active).
2. [`./ARCHITECTURE.md`](./ARCHITECTURE.md) — stack, decisions techniques majeures, middleware chain.
3. [`./decision-log.md`](./decision-log.md) — décisions architecturales encore actives + recherches qui les justifient.

C'est ~25 minutes de lecture. Tu sors avec une carte mentale opérationnelle.

## Ensuite, selon ce que tu fais

### Tu codes une feature

→ [`./conventions/middleware-chain.md`](./conventions/middleware-chain.md) — comment câbler une route API
→ [`./conventions/rbac-tags.md`](./conventions/rbac-tags.md) — permissions et tag scope
→ [`./conventions/no-polling.md`](./conventions/no-polling.md) — règle absolue SSE/WebSocket
→ [`./conventions/git.md`](./conventions/git.md) — commit + push atomic, GPG, format

### Tu touches aux Governed Workflows (feature phare)

→ [`./governed-workflows/README.md`](./governed-workflows/README.md) — index
→ [`./governed-workflows/local-testing.md`](./governed-workflows/local-testing.md) — tester en local
→ [`./governed-workflows/scenarios.md`](./governed-workflows/scenarios.md) — scénarios end-to-end
→ [`./governed-workflows/handoff-artifacts.md`](./governed-workflows/handoff-artifacts.md) — artifacts entre steps
→ [`./governed-workflows/oauth-setup.md`](./governed-workflows/oauth-setup.md) — OAuth GitLab

### Tu écris ou modifies une roadmap

→ [`./B2B-enterprise-roadmap.md`](./B2B-enterprise-roadmap.md) — roadmap B2B consolidée
→ [`./HISTORY.md`](./HISTORY.md) — chronologie des jalons
→ [`./product/`](./product/) — vision, 3 piliers, autonomy continuum

### Tu démarres un nouveau chantier

Workflow Superpowers ([`./superpowers/`](./superpowers/)) :

1. **Plan** dans `superpowers/plans/YYYY-MM-DD-{topic}.md` — phases, étapes, critères d'acceptation, risques, rollback.
2. **Spec** (si besoin) dans `superpowers/specs/YYYY-MM-DD-{topic}-design.md` — contrats, data flow, file-level changes, decision log.
3. Implémentation contre le plan, mise à jour si décisions évoluent.
4. **Review** structurée dans `superpowers/reviews/` à la livraison.

Pas de plan/spec uniquement pour : typo, one-line fix, exploration pure, conversation.

## Structure du dossier `docs/`

```
docs/
├── README.md                  ← tu es ici
├── ARCHITECTURE.md            stack, multi-tenant, traces, config layers, CAO
├── decision-log.md            décisions architecturales encore actives
├── B2B-enterprise-roadmap.md  roadmap entreprise consolidée
├── HISTORY.md                 chronologie + métriques
├── INDEX.md                   index plat (références croisées)
├── conventions/
│   ├── git.md                 commit + push atomic, GPG, format
│   ├── middleware-chain.md    chaîne multi-tenant ordre + 5 couches sécurité
│   ├── no-polling.md          SSE/WebSocket exclusivement
│   └── rbac-tags.md           rôles dynamiques, tags additifs, isolation
├── governed-workflows/
│   ├── README.md              index feature phare
│   ├── local-testing.md
│   ├── scenarios.md
│   ├── handoff-artifacts.md
│   └── oauth-setup.md
├── product/
│   ├── vision.md              vision MnM consolidée
│   ├── three-pillars.md       Confiance / Contrôle / Transparence
│   └── autonomy-continuum.md  6 niveaux KPI-driven
└── superpowers/               workflow vivant : plans, specs, reviews
    ├── plans/
    ├── specs/
    └── reviews/
```

## Outils Claude disponibles dans ce repo

- `.claude/skills/gitnexus/` — skills GitNexus (impact analysis, refactoring, debug, explore)
- `.claude/skills/mnm-codebase-tour/` — tour guidé de la codebase (à invoquer avec `/mnm-codebase-tour`)
- `.claude/agents/` — subagents spécialisés MnM (architect, backend, frontend)
- `.claude/commands/` — slash commands MnM-spécifiques

## Archive privée

Le repo public **ne contient plus** :
- Le framework BMAD (`_bmad/`)
- Les artefacts BMAD legacy (stories, sprint plans, dashboard-v2 docs, blocks-platform docs)
- Les brainstorms historiques (`docs/history/`)
- Les recherches techniques en archive (`docs/research/`)

Ces artefacts sont conservés dans le repo privé [`AlphaLuppi/mnm-documentation`](https://github.com/AlphaLuppi/mnm-documentation) pour traçabilité. La synthèse vivante de ce qui shape encore le code est dans [`./decision-log.md`](./decision-log.md).

## Source de vérité

En cas de conflit entre cette doc et le code : **le code gagne**. Mets à jour la doc.

En cas de conflit entre la doc et `CLAUDE.md` : **`CLAUDE.md` gagne** (règles opérationnelles, mission active).
