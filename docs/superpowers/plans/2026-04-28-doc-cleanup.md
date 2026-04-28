# Plan — Nettoyage et réorganisation de la documentation MnM

**Date :** 2026-04-28
**Auteur :** Tom (via Claude)
**Status :** Phase 1 — Cartographie

## Contexte

Au fil des sprints, la documentation s'est étalée dans plusieurs zones :

- `_bmad-output/` (legacy BMAD, ~140 fichiers) : brainstormings, planning-artifacts, stories, specs, visions
- `docs/` (workflow Superpowers moderne, ~50 fichiers) : ARCHITECTURE, prd, governed-workflows-*, plans/specs/reviews
- `_research/` (~9 fichiers) : recherches techniques (entire.io, nanoclaw, openclaw, agent orchestration)
- Racine : CLAUDE.md, README.md, AGENTS.md, CONTRIBUTING.md, RELEASE-NOTES-B2B.md, ROADMAP-B2B-REMAINING.md
- 1 story orpheline dans `docs/stories/`

**Total : 236 fichiers .md** (hors framework BMAD `_bmad/`, `.claude/skills/`, `.claude/commands/`).

Beaucoup de docs ont servi à brainstormer/concevoir des features dont la réalité finale a divergé. **Tom veut les conserver** — ce sont les origines historiques et certaines vont continuer à shaper le futur.

## Principes de tri (consigne Tom)

1. **GARDER** les brainstormings historiques même si la réalité a divergé.
   - Ils documentent l'évolution de la pensée produit.
   - Certains continuent à shaper le futur.
2. **GARDER** les visions et research docs (fondations).
3. **TRIER / ARCHIVER** ce qui est obsolète, doublon, périmé.
4. **CONSOLIDER** les zones redondantes (`_bmad-output/` vs `docs/`).
5. **NE RIEN SUPPRIMER** sans validation Tom — mode propose-only en phase 1.

## Phase 1 — Cartographie (4 agents en parallèle)

Chaque agent produit un **rapport markdown** avec, pour chaque fichier :
- Status proposé : `keep-as-is` / `move-to-archive` / `consolidate-into-X` / `obsolete-but-keep` / `redundant-with-Y`
- Justification courte (1-2 phrases)
- Ne touche à aucun fichier (lecture seule)

### Agent A — Brainstormings, visions, research
**Périmètre :**
- `_bmad-output/brainstorming/` (18 fichiers)
- `_bmad-output/*.md` racine (visions, brainstormings projets-v2, governed-workflows consolidated, product-brief, architecture-multi-tenant, research-git-nexus)
- `_research/` (9 fichiers)

**Mission :** identifier les fichiers historiques précieux (à conserver tels quels), ceux périmés (mais à archiver pas supprimer), et les éventuels doublons.

### Agent B — Planning artifacts, tech specs, architectures
**Périmètre :**
- `_bmad-output/planning-artifacts/` (30+ fichiers : architectures, epics, sprint plannings, reviews, tech specs, designs)
- `_bmad-output/implementation-artifacts/` (2 tech specs)
- `_bmad-output/specs/` (MCP server design + plans)

**Mission :** identifier ce qui est obsolète vs ce qui décrit l'architecture actuelle ou des décisions encore valides. Croiser avec `docs/ARCHITECTURE.md` et CLAUDE.md pour cohérence.

### Agent C — User stories
**Périmètre :**
- `_bmad-output/stories/` (~70 stories : A2A, CHAT, COMP, CONF, CONT, DASH, DRIFT, DUAL, MU, OBS, ONB, ORCH, PROJ, RBAC, SSO, TECH, VP)
- `docs/stories/RT-S01-remove-polling-ws-hardening.md` (orpheline)

**Mission :** pour chaque story, identifier si elle est livrée, abandonnée, en cours, ou à exécuter. Croiser avec `git log` et l'état du code.

### Agent D — Workflow Superpowers + docs racine
**Périmètre :**
- `docs/` racine (ARCHITECTURE, B2B-enterprise-roadmap, HISTORY, prd, governed-workflows-*, LOCAL-TESTING)
- `docs/superpowers/plans/` (25 plans)
- `docs/superpowers/specs/` (19 specs)
- `docs/superpowers/reviews/` (2 reviews)
- Racine : RELEASE-NOTES-B2B.md, ROADMAP-B2B-REMAINING.md, AGENTS.md, CONTRIBUTING.md

**Mission :** cohérence entre les plans/specs Superpowers récents et l'état actuel du code. Identifier les doublons avec `_bmad-output/`. Vérifier que les `next-session-*-prompt.md` sont obsolètes (sessions terminées).

## Phase 2 — Synthèse (après retour des 4 agents)

Présenter à Tom :
1. Une **structure cible** proposée (ex : `docs/archive/`, `docs/history/brainstorms/`, etc.)
2. Une **liste d'actions** triées par catégorie (move, consolidate, no-op)
3. Aucune action exécutée à ce stade — Tom valide d'abord.

## Phase 3 — Exécution (validée par Tom)

- Déplacements `git mv` pour préserver l'historique.
- Création d'un `docs/INDEX.md` final qui pointe vers les zones (current, archive, history, research).
- Commit atomique + push.

## Risques / précautions

- **Ne jamais supprimer un brainstorm**, même périmé.
- **Préserver l'historique git** : utiliser `git mv` jamais `rm + add`.
- **Pas de modification de `_bmad/`** (framework).
- **CLAUDE.md** est l'autorité — mettre à jour si on déplace des fichiers référencés.

## Acceptance criteria

- [ ] 4 rapports de cartographie produits (4 agents)
- [ ] Synthèse présentée à Tom
- [ ] Structure cible validée par Tom
- [ ] Aucune perte d'information (tout est préservé, juste réorganisé)
- [ ] CLAUDE.md mis à jour si pointeurs déplacés
- [ ] Index final dans `docs/INDEX.md`
