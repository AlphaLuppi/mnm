# Archive

Artifacts post-livraison conservés pour traçabilité. Non maintenus activement.

Pour la pensée produit historique (visions, brainstormings) voir [../history/](../history/).
Pour le travail courant voir [../superpowers/](../superpowers/).

## historical-prd.md

[historical-prd.md](historical-prd.md) — Ancien PRD interne (internal-product, refonte auth). Snapshot d'une étape antérieure du produit. Conservé pour contexte historique uniquement.

## sessions-completed/

[sessions-completed/](sessions-completed/) — Prompts et progress logs de sessions Superpowers terminées. Permet de retracer comment une feature a été livrée step-by-step.

- `2026-04-21-T1-T7/` — Prompts pour reprendre les sessions T4–T7 (terminées).
- `2026-04-24-governed-workflows-ui/` — Prompt + progress log U1–U8 (terminé). Référence : Governed Workflows UI.

## shipped-epics/

[shipped-epics/](shipped-epics/) — Epics BMAD livrées. ~21 fichiers couvrant :

- B2B enterprise transformation (`prd-b2b`, `ux-design-b2b`, `EXECUTION-TRACKER-V2`)
- Pods et déploiements (`epic-pod`, `epic-deploy`)
- Collaborative chat (`epic-chat`)
- Config layers (`epics-config-layers`)
- Roles & tags (`epic-roles-tags`)
- Sprint plannings divers

Code livré, pas de maintenance active sur ces docs. Pour le code courant voir le repo lui-même.

## abandoned/

[abandoned/](abandoned/) — Directions explorées puis abandonnées. Conservées pour expliquer pourquoi tel chemin n'a pas été pris.

- `design-sandbox-*` — Sandbox Docker. Déprioritisé 2026-03-21 : MnM privilégie les clients locaux (MCP, Desktop, CLI). La compute happens client-side.
- `architecture-view-presets` — View Presets. Modèle de données et API livrés (VP-S01) mais l'UI n'a jamais été implémentée. Couvert différemment par les widgets dashboard composables.
- `epics-scale-trace` — Scale du tracing. Direction abandonnée au profit du pipeline Bronze/Silver/Gold actuel.
- `tech-spec-observability-suite` — Suite observability complète style Langfuse. Remplacée par version simplifiée (gold = vue par défaut, pas une suite séparée).

## reviews/

[reviews/](reviews/) — Reviews et audits.

- `REVIEW-ARCHITECT-roles-tags`, `REVIEW-CODE-roles-tags` — Architecture + code review du système roles/tags.
- `REVIEW-ARCHITECT-trace-pipeline`, `REVIEW-ADVERSARIAL-trace-pipeline`, `REVIEW-QA-trace-pipeline` — Reviews multi-perspectives du pipeline tracing.
- `UI-UX-AUDIT-REPORT` — Audit UX général.
- `LANGFUSE-ANALYSIS` — Analyse comparative Langfuse pour l'observabilité.
- `E2E-TEST-ARCHITECTURE` — Stratégie tests E2E.

## 2026-04-07-historical-specs/

[2026-04-07-historical-specs/](2026-04-07-historical-specs/) — Snapshots ponctuels du 7 avril 2026.

- `pipeline-progress` — État du pipeline à cette date.
- `po-validation-report` — Rapport de validation PO.
- `sprint-plan` — Sprint plan de l'époque.

Captures d'instant, non actualisées.
