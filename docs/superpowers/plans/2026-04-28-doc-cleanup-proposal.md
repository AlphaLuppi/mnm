# Proposition de réorganisation docs MnM — Synthèse Tom

**Date :** 2026-04-28
**Phase :** 2 (synthèse, à valider avant exécution)
**Sources :** 4 cartographies parallèles (`docs/superpowers/plans/2026-04-28-doc-cleanup.md`)

---

## TL;DR — Ce qu'on a trouvé

**~200 fichiers .md cartographiés** (hors framework BMAD `_bmad/`, skills, commands).

| Zone | Fichiers | Action principale |
|------|----------|-------------------|
| **Brainstormings + visions** (`_bmad-output/brainstorming/` + racine) | 27 | 11 vivants à garder en place, 16 à archiver dans `docs/history/` |
| **Recherches techniques** (`_research/`) | 9 | Tous précieux → migrer vers `docs/research/` |
| **Planning artifacts** (`_bmad-output/planning-artifacts/`) | 35 | 10 vivants, 3 livrés, 4 superseded, 2 abandonnés, 9 anciens, 5 à consolider en triples reviews |
| **User stories BMAD** (`_bmad-output/stories/`) | 75 | 59 shipped, 14 pending, 7 abandonnés (Docker/sandbox) |
| **Plans/specs Superpowers** (`docs/superpowers/`) | 44 | 30 historique features livrées (à garder), 9 sessions terminées (next-session-prompts, progress logs) à archiver |
| **Docs canoniques** (`docs/` + racine projet) | 14 | 12 à garder canoniques, 1 doublon mineur (oauth/gitlab setup), 1 prd ancien à archiver |

**Ce qu'on garde absolument intouché** (~120 fichiers) :
- Toutes les visions consolidées (`vision-mnm-2026-04-07`, `vision-projects-v2`, `product-brief-mnm-v3`, `governed-workflows-consolidated`)
- Tous les brainstormings vivants (stakeholder, dashboard-v2, view-presets, governed-workflows, etc.)
- Architecture multi-tenant + RBAC + traces + config-layers (specs vivantes)
- Tous les plans/specs Superpowers récents (T1-T7, UI, Workflow Studio, AI Assistant, artifact-persistence)
- CLAUDE.md, README.md, ARCHITECTURE.md, B2B-roadmap, HISTORY, ROADMAP-REMAINING

---

## Structure cible proposée

```
mnm/
├── CLAUDE.md                              ← inchangé
├── README.md                              ← inchangé
├── AGENTS.md                              ← inchangé (GitNexus index)
├── CONTRIBUTING.md                        ← inchangé
├── RELEASE-NOTES-B2B.md                   ← inchangé
├── ROADMAP-B2B-REMAINING.md               ← inchangé
│
├── docs/
│   ├── INDEX.md                           ← NEW : table des matières / guide navigation
│   ├── ARCHITECTURE.md                    ← inchangé (canonique)
│   ├── B2B-enterprise-roadmap.md          ← inchangé
│   ├── HISTORY.md                         ← inchangé
│   ├── prd.md                             ← MOVE → docs/archive/historical-prd.md
│   │
│   ├── governed-workflows/                ← NEW (consolidation)
│   │   ├── README.md                      ← NEW (index sous-dossier)
│   │   ├── local-testing.md               ← MOVE depuis docs/LOCAL-TESTING-*.md
│   │   ├── scenarios.md                   ← MOVE depuis docs/governed-workflows-scenarios.md
│   │   ├── handoff-artifacts.md           ← MOVE depuis docs/governed-workflows-handoff-artifacts.md
│   │   └── oauth-setup.md                 ← MERGE de oauth-setup.md + gitlab-setup.md
│   │
│   ├── research/                          ← NEW : migrer _research/
│   │   ├── README.md                      ← NEW
│   │   ├── agent-orchestration-patterns.md
│   │   ├── dashboard-ux-patterns.md
│   │   ├── llm-workflow-control.md
│   │   ├── realtime-workflows.md
│   │   ├── openclaw-deep-dive.md
│   │   ├── openclaw-auth-architecture.md
│   │   ├── nanoclaw-analysis.md
│   │   ├── entire-io-analysis.md
│   │   ├── git-nexus-evaluation.md        ← MOVE depuis _bmad-output/research-git-nexus-mnm.md
│   │   └── SYNTHESE-AGENT-ORCHESTRATION.md
│   │
│   ├── history/                           ← NEW : pensée produit historique
│   │   ├── README.md                      ← NEW
│   │   ├── visions/                       ← consolidations majeures
│   │   │   ├── vision-mnm-2026-04-07.md
│   │   │   ├── vision-projects-v2-2026-04-06.md
│   │   │   ├── product-brief-mnm-v3-2026-04-08.md
│   │   │   └── governed-workflows-consolidated-2026-04-17.md
│   │   ├── brainstorms/                   ← brainstormings (tous gardés)
│   │   │   ├── (les 18 fichiers _bmad-output/brainstorming/)
│   │   │   ├── brainstorming-projects-v2-2026-04-06.md
│   │   │   └── brainstorming-projects-v2-session2-2026-04-06.md
│   │   ├── architectures/                 ← anciennes archi de référence
│   │   │   ├── architecture-multi-tenant-2026-04-12.md
│   │   │   ├── architecture-roles-tags-2026-03-22.md
│   │   │   └── architecture-b2b.md
│   │   └── discovery/                     ← traces de méthode
│   │       ├── tactical-deleted.md
│   │       └── tactical-deleted.md
│   │
│   ├── archive/                           ← NEW : artifacts post-livraison
│   │   ├── README.md                      ← NEW
│   │   ├── historical-prd.md              ← depuis docs/prd.md
│   │   ├── sessions-completed/
│   │   │   ├── 2026-04-21-T1-T7/          ← 4 next-session-T*-prompt.md
│   │   │   ├── 2026-04-24-governed-workflows-ui/
│   │   │   │   ├── progress-2026-04-24-governed-workflows-ui.md
│   │   │   │   └── next-session-governed-workflows-ui-prompt.md
│   │   ├── shipped-epics/                 ← plans BMAD livrés
│   │   │   ├── epic-pod-per-user-pods-2026-03-21.md
│   │   │   ├── epic-deploy-artifact-deployment-2026-03-21.md
│   │   │   ├── epic-collaborative-chat.md
│   │   │   ├── epics-config-layers-2026-04-02.md
│   │   │   ├── epics-roles-tags-2026-03-22.md
│   │   │   ├── EXECUTION-TRACKER-V2.md
│   │   │   ├── tech-spec-bronze-silver-gold-2026-03-18.md
│   │   │   ├── tech-spec-pods-deployments-2026-03-21.md
│   │   │   └── ... (sprint-plannings, prd-b2b, product-brief-b2b)
│   │   ├── abandoned/                     ← directions abandonnées
│   │   │   ├── design-sandbox-enterprise-security.md
│   │   │   ├── design-sandbox-routing-adapter.md
│   │   │   ├── pm-review-sandbox-routing.md
│   │   │   ├── architecture-view-presets-2026-04-05.md  ← jamais implémentée
│   │   │   ├── epics-scale-trace.md                     ← jamais livrée
│   │   │   └── tech-spec-observability-suite.md         ← UI proposal périmée
│   │   ├── reviews/
│   │   │   ├── trace-pipeline-consolidated.md           ← MERGE des 3 reviews
│   │   │   ├── roles-tags-consolidated.md               ← MERGE arch + code review
│   │   │   ├── REVIEW-ADVERSARIAL-trace-pipeline.md     ← original conservé
│   │   │   ├── REVIEW-ARCHITECT-trace-pipeline.md
│   │   │   ├── REVIEW-QA-trace-pipeline.md
│   │   │   ├── REVIEW-ARCHITECT-roles-tags-2026-03-23.md
│   │   │   ├── REVIEW-CODE-roles-tags-2026-03-23.md
│   │   │   ├── UI-UX-AUDIT-REPORT.md
│   │   │   ├── LANGFUSE-ANALYSIS.md
│   │   │   └── E2E-TEST-ARCHITECTURE.md
│   │   └── 2026-04-07-historical-specs/   ← snapshots ponctuels
│   │       ├── pipeline-progress.md
│   │       ├── po-validation-report.md
│   │       └── sprint-plan.md
│   │
│   ├── superpowers/                       ← inchangé (workflow vivant)
│   │   ├── README.md                      ← NEW (index plans/specs/reviews)
│   │   ├── plans/                         ← T1-T7, UI, Workflow Studio, etc.
│   │   ├── specs/                         ← designs des plans
│   │   └── reviews/                       ← code reviews ponctuelles
│   │
│   └── stories/                           ← supprimé (1 orpheline migrée vers _bmad-output)
│
├── _bmad-output/                          ← REORGANISÉ mais conservé (legacy)
│   ├── README.md                          ← NEW : explique le statut legacy
│   ├── stories/
│   │   ├── STATUS.md                      ← NEW : index par statut
│   │   ├── _shipped/                      ← 59 stories livrées
│   │   ├── _pending/                      ← 14 stories à exécuter (+ RT-S01 migrée)
│   │   └── _abandoned/                    ← 7 stories Docker/sandbox
│   ├── planning-artifacts/                ← reste vide ou à supprimer après migration
│   ├── implementation-artifacts/          ← reste : 2 tech specs vivantes
│   ├── specs/                             ← reste : MCP server design
│   └── brainstorming/                     ← VIDE après migration vers docs/history/brainstorms/
│
├── _research/                             ← VIDE après migration vers docs/research/
│
└── _bmad/                                 ← framework, INTOUCHÉ
```

---

## Plan d'exécution proposé (en phases isolées)

Chaque phase = un commit atomique. Tom valide phase par phase ou en bloc.

### Phase 1 — Création de la structure cible (no-op sur fichiers)
- `mkdir -p docs/{INDEX.md,governed-workflows,research,history/{visions,brainstorms,architectures,discovery},archive/{sessions-completed,shipped-epics,abandoned,reviews}}`
- `mkdir -p _bmad-output/stories/{_shipped,_pending,_abandoned}`
- Pas de déplacement encore. Juste l'arborescence.
- **Risque : 0**

### Phase 2 — Migration des sessions terminées (faible risque)
- `git mv docs/superpowers/plans/next-session-T{4,5,6,7}-prompt.md → docs/archive/sessions-completed/2026-04-21-T1-T7/`
- `git mv docs/superpowers/plans/next-session-governed-workflows-ui-prompt.md → docs/archive/sessions-completed/2026-04-24-governed-workflows-ui/`
- `git mv docs/superpowers/plans/progress-2026-04-24-governed-workflows-ui.md → idem`
- `git mv docs/superpowers/specs/2026-04-07-{pipeline-progress,po-validation-report,sprint-plan}.md → docs/archive/2026-04-07-historical-specs/`
- `git mv docs/prd.md → docs/archive/historical-prd.md`
- **Risque : faible** (fichiers d'archive purs, jamais référencés ailleurs)

### Phase 3 — Migration `_research/` → `docs/research/`
- `git mv _research/* → docs/research/`
- Créer `docs/research/README.md` qui liste les recherches.
- Vérifier qu'aucun lien externe (CLAUDE.md, README.md) ne pointe vers `_research/`.
- **Risque : faible**

### Phase 4 — Migration brainstormings + visions → `docs/history/`
- `git mv _bmad-output/brainstorming/* → docs/history/brainstorms/`
- `git mv _bmad-output/{vision-*,product-brief-*,governed-workflows-consolidated-*}.md → docs/history/visions/`
- `git mv _bmad-output/{brainstorming-projects-v2-*}.md → docs/history/brainstorms/`
- `git mv _bmad-output/{architecture-multi-tenant-*}.md → docs/history/architectures/`
- `git mv _bmad-output/brainstorming/tactical-deleted.md, tactical-deleted.md → docs/history/discovery/`
- Créer `docs/history/README.md` qui explique la philosophie ("ces docs ont shapé MnM, on les préserve").
- **Risque : faible**

### Phase 5 — Tri des user stories par statut
- `git mv _bmad-output/stories/{59 shipped} → _shipped/`
- `git mv _bmad-output/stories/{14 pending} → _pending/`
- `git mv _bmad-output/stories/{7 abandoned} → _abandoned/`
- `git mv docs/stories/RT-S01-*.md → _bmad-output/stories/_pending/`
- Supprimer `docs/stories/` (vide).
- Créer `_bmad-output/stories/STATUS.md`.
- **Risque : faible** (les stories ne sont pas linkées depuis le code)

### Phase 6 — Migration planning-artifacts par catégorie
- Shipped epics → `docs/archive/shipped-epics/`
- Abandoned → `docs/archive/abandoned/`
- Reviews → `docs/archive/reviews/`
- Anciens prd/sprint-plannings/sprint-change → `docs/archive/shipped-epics/`
- **Vivants à garder dans `planning-artifacts/`** : aucun (tous migrés).
- **Risque : faible**

### Phase 7 — Consolidation `docs/governed-workflows/`
- `git mv docs/LOCAL-TESTING-GOVERNED-WORKFLOWS.md → docs/governed-workflows/local-testing.md`
- `git mv docs/governed-workflows-scenarios.md → docs/governed-workflows/scenarios.md`
- `git mv docs/governed-workflows-handoff-artifacts.md → docs/governed-workflows/handoff-artifacts.md`
- **MERGE** `docs/governed-workflows-oauth-setup.md` + `docs/governed-workflows-gitlab-setup.md` → `docs/governed-workflows/oauth-setup.md` (un seul doc unifié)
- Créer `docs/governed-workflows/README.md`.
- **Risque : moyen** (MERGE manuel — vérifier qu'on ne perd pas d'info)

### Phase 8 — Création des index
- `docs/INDEX.md` : table des matières maître
- `docs/superpowers/README.md` : statut des plans/specs (T1-T7 livrés, etc.)
- `docs/archive/README.md` : explique la disposition
- `docs/history/README.md` : explique la philosophie

### Phase 9 — Mise à jour CLAUDE.md
- Ajuster les chemins si CLAUDE.md référence des fichiers déplacés
- Mentionner la nouvelle structure dans la section "Documentation" si pertinent

### Phase 10 — Re-indexer GitNexus
- `npx gitnexus analyze` après stabilisation pour rafraîchir le graphe

---

## Risques globaux

1. **Liens cassés** : certains MDs référencent d'autres MDs. À vérifier avec `grep -r "_bmad-output/" docs/ CLAUDE.md` avant migration.
2. **CLAUDE.md** mentionne :
   - `docs/superpowers/plans/2026-04-24-governed-workflows-ui.md` ← reste à sa place
   - `docs/superpowers/plans/2026-04-24-workflow-studio.md` ← reste à sa place
   - `docs/superpowers/plans/progress-2026-04-24-governed-workflows-ui.md` ← MIGRÉ phase 2 → màj nécessaire
3. **Aucune perte d'information** : `git mv` préserve l'historique complet.
4. **Rollback** : `git revert` du commit suffit.

---

## Décisions à prendre par Tom

1. **Validation de la structure cible** : OK pour `docs/{history,research,archive,governed-workflows}` ? Autre nom préféré ?
2. **Exécution** : phase par phase (10 commits) ou bloc unique ?
3. **Sort des doublons** : garder les originaux en plus des consolidations (reviews trace, oauth/gitlab) ou seulement le merge ?
4. **`_bmad-output/`** : on garde ce nom (legacy) ou on renomme `_archive-bmad/` ?
5. **Stories pending → Superpowers plans** : on convertit DUAL-S01-S03, A2A-S02-S04, MU-S03/S05, ONB-S02-S04 en plans Superpowers maintenant, ou on laisse comme stories pour l'instant ?
6. **Phase 7 (merge oauth/gitlab)** : OK pour la fusion ? Ou tu préfères garder les deux séparés ?

---

## Détail des cartographies brutes

Les 4 cartographies détaillées (par fichier, justification, croisements) sont disponibles via :
- Agent A : brainstormings + visions + research
- Agent B : planning artifacts + tech specs
- Agent C : 75 user stories avec tableau par domaine
- Agent D : docs/ + superpowers/ + racine

(Stockées dans cette session — peuvent être ajoutées au repo en `docs/superpowers/plans/2026-04-28-doc-cleanup-cartographies.md` si tu veux trace écrite.)
