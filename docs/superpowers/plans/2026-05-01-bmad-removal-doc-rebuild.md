# Plan — Suppression BMAD + reconstruction doc publique

**Date :** 2026-05-01
**Auteur :** Tom (via Claude)
**Status :** Phase 1 — Planning, attente exécution

## Contexte

Le repo `mnm` contient encore beaucoup d'artefacts liés à BMAD (framework legacy de planification) qui ne servent plus :

- Framework installé : `_bmad/` (5.4M) + `.claude/commands/bmad-*.md` (76 commandes)
- Artefacts produits : `docs/archive/_bmad-legacy/` (2.6M)
- Historique produit : `docs/history/`, `docs/research/`, `docs/archive/` (mentions BMAD)

En parallèle, la doc publique du repo n'est pas optimisée pour Claude Code : éclatée entre `docs/INDEX.md`, `CLAUDE.md`, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/ARCHITECTURE.md`, plus de la doc historique/recherche qui dilue le signal.

## Objectifs

1. **Archiver** dans un repo privé `AlphaLuppi/mnm-documentation` :
   - Framework BMAD (`_bmad/`)
   - Commandes BMAD slash (`.claude/commands/bmad-*.md`)
   - Doc historique et archive (`docs/archive/`, `docs/history/`, `docs/research/`)
2. **Conserver** la feature produit MnM qui détecte BMAD chez les clients (code dans `server/src/services/`, `ui/src/components/`, etc.) — c'est utile pour les workspaces clients.
3. **Reconstruire** une doc publique propre, structurée pour navigation Claude Code (subagents, skills, commands, structure docs/).
4. **Synthétiser** le contenu historique/research utile pour la vision produit dans la nouvelle doc publique avant suppression.

## Hors scope

- Suppression de la feature MnM "détection workspace BMAD" (code conservé)
- Touches au code de production (serveur, UI, packages)
- Reformulation de l'architecture technique (déjà à jour dans `docs/ARCHITECTURE.md`)

## Phases

### Phase 0 — Préparatifs (quick)

- [x] Cartographie BMAD (faite, voir conversation)
- [x] Validation Tom des 4 ambiguïtés (1=garder code, 2=virer mention README, 3=mnm-documentation, 4=virer history+research mais scraper)

### Phase 1 — Création repo privé `AlphaLuppi/mnm-documentation`

- [ ] `gh repo create AlphaLuppi/mnm-documentation --private --description "MnM — archive privée : framework BMAD legacy, doc historique, brainstorms, recherches"`
- [ ] Cloner dans `C:\Users\andri\IdeaProjects\AlphaLuppi\mnm-documentation\`
- [ ] Initialiser README minimal expliquant le périmètre et le lien avec le repo public

### Phase 2 — Push archive complète vers le repo privé

Copier dans `mnm-documentation/` :

- [ ] `_bmad/` → `framework-bmad/`
- [ ] `.claude/commands/bmad-*.md` → `claude-commands-bmad/`
- [ ] `docs/archive/` → `archive/` (avec `_bmad-legacy/` à l'intérieur)
- [ ] `docs/history/` → `history/`
- [ ] `docs/research/` → `research/`
- [ ] Index README global qui pointe vers les sous-dossiers + indique le commit du repo public d'où vient chaque artefact

Atomic commit + push.

### Phase 3 — Scrape & synthèse pour la doc publique

Lancer un agent en parallèle (Explore subagent) pour :

- [ ] Lire `docs/history/visions/` (4 fichiers) → extraire **vision produit consolidée**
- [ ] Lire `docs/history/brainstorms/` (~17 fichiers) → extraire **décisions structurantes encore actives** (3 piliers, autonomy continuum, pods, tags, Gov Workflows)
- [ ] Lire `docs/history/architectures/` → extraire **décisions architecturales** non encore documentées dans `docs/ARCHITECTURE.md`
- [ ] Lire `docs/research/` (9 fichiers) → extraire **comparaisons et benchmarks** utiles à la prise de décision (Langfuse, Openclaw, Nanoclaw, Entire.io, GitNexus)

Output : un seul fichier de synthèse `docs/decision-log.md` court + une mise à jour de `docs/product/` si nécessaire.

### Phase 4 — Suppression dans le repo public

Une fois le push privé validé :

- [ ] `git rm -r _bmad/`
- [ ] `git rm .claude/commands/bmad-*.md`
- [ ] `git rm -r docs/archive/`
- [ ] `git rm -r docs/history/`
- [ ] `git rm -r docs/research/`
- [ ] Garder `.gitignore` à jour (entrée `_bmad-output/` peut rester)

### Phase 5 — Reconstruction doc publique structurée Claude-friendly

Cible : nouvelle structure `docs/` orientée navigation Claude Code.

```
docs/
├── README.md                      # Entry point — par où commencer (par rôle)
├── ARCHITECTURE.md                # Existant, nettoyer refs BMAD
├── product/
│   ├── vision.md                  # Synthèse vision (issu de Phase 3)
│   ├── three-pillars.md           # Existant, garder
│   └── autonomy-continuum.md      # Existant, garder
├── governed-workflows/            # Existant, garder
│   ├── README.md
│   ├── handoff-artifacts.md
│   ├── local-testing.md
│   ├── oauth-setup.md
│   └── scenarios.md
├── conventions/
│   ├── git.md                     # Atomic commit + push, GPG, pas de Co-Authored-By
│   ├── middleware-chain.md        # Multi-tenant chain (extrait de CLAUDE.md)
│   ├── no-polling.md              # Règle SSE/WebSocket
│   └── rbac-tags.md               # Dynamic RBAC + tag-based isolation
├── decision-log.md                # Synthèse Phase 3 (décisions historiques structurantes)
├── B2B-enterprise-roadmap.md      # Existant, garder
├── HISTORY.md                     # Existant, à condenser
├── INDEX.md                       # Existant, à réécrire (pointeurs propres)
└── superpowers/                   # Existant, garder (workflow vivant)
    ├── plans/
    ├── specs/
    └── reviews/
```

Plus :

- [ ] `.claude/commands/` — vider les bmad-*, garder ce qui est MnM-spécifique
- [ ] `.claude/skills/` — déjà gitnexus, ajouter `mnm-codebase-tour/` (skill d'onboarding Claude sur la codebase)
- [ ] `.claude/agents/` — créer 3-4 subagents spécialisés : `mnm-backend`, `mnm-frontend`, `mnm-architect`, `mnm-pm`

### Phase 6 — Nettoyage références doc

Mettre à jour pour retirer toute mention de BMAD framework / `_bmad/` / `_bmad-output/` / `docs/archive/_bmad-legacy/` :

- [ ] `CLAUDE.md` (lignes 14-16, 53)
- [ ] `CONTRIBUTING.md` (lignes 149-150, 190)
- [ ] `README.md` (lignes 84, 103 : retirer mention "Workflows BMAD XState legacy")
- [ ] `README.en.md` (équivalent)
- [ ] `docs/INDEX.md` (réécriture complète)
- [ ] `docs/ARCHITECTURE.md` (refs ponctuelles)
- [ ] `docs/HISTORY.md` (refs ponctuelles)

### Phase 7 — Verification & commit

- [ ] `grep -r "BMAD\|_bmad\|bmad" --include="*.md"` → ne doit plus rien remonter sauf code applicatif (D) et références neutres
- [ ] `bun run typecheck` (vérifier que rien ne casse)
- [ ] `gitnexus_detect_changes` (scope check)
- [ ] Atomic commit + push avec message conventional :
  ```
  chore: remove BMAD framework + reorganize public docs

  - archive _bmad/, .claude/commands/bmad-*.md, docs/{archive,history,research}/
    to private repo AlphaLuppi/mnm-documentation
  - synthesize historical decisions into docs/decision-log.md
  - reorganize docs/ structure for Claude Code navigation
  - nuke "Workflows BMAD XState" mention from README
  ```

## Risques & rollback

| Risque | Mitigation |
|---|---|
| Push privé incomplet → perte d'historique | Phase 2 atomic, vérification ls/du avant suppression Phase 4 |
| Référence cassée (lien doc → fichier supprimé) | Phase 6 grep exhaustif avant commit |
| Code applicatif casse à cause d'une dépendance sur _bmad/ | Aucune attendue (jamais require dans le code), validation typecheck Phase 7 |
| Tom voulait conserver un fichier précis | Rollback git sur le repo public, lecture depuis `mnm-documentation` |

## Acceptance criteria

1. ✅ Repo `AlphaLuppi/mnm-documentation` privé existe, contient l'archive complète, accessible.
2. ✅ Repo public ne contient plus de framework BMAD ni de commandes bmad-*.
3. ✅ Doc publique restructurée : `docs/` clair, orienté Claude Code.
4. ✅ Subagents et skills MnM-spécifiques en place dans `.claude/`.
5. ✅ Aucune référence cassée dans la doc.
6. ✅ Typecheck OK, code applicatif intact.
7. ✅ Atomic commit + push sur master.
