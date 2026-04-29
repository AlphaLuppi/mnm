# History

Pensée produit historique de MnM. Ces docs ont shapé le produit. Certains aspects ne sont pas implémentés tels quels mais ont guidé — et continueront à guider — les décisions produit. On les préserve intentionnellement.

Statut : non maintenu activement, valeur d'archive.

## Visions consolidées

Quatre fichiers de consolidation majeurs, à lire en priorité pour comprendre le "pourquoi" de MnM.

- [visions/vision-mnm-2026-04-07.md](visions/vision-mnm-2026-04-07.md) — Philosophie cockpit. Les 3 piliers fondateurs : Confiance (metrics), Contrôle (interrupt/steer), Transparence (HITL UX).
- [visions/vision-projects-v2-2026-04-06.md](visions/vision-projects-v2-2026-04-06.md) — Chat primaire PM, modèle feature-centric, dashboard composable.
- [visions/product-brief-mnm-v3-2026-04-08.md](visions/product-brief-mnm-v3-2026-04-08.md) — Management plane IA. Audience CTO/DSI/PM. Positionnement entreprise.
- [visions/governed-workflows-consolidated-2026-04-17.md](visions/governed-workflows-consolidated-2026-04-17.md) — DAG steps/gates versionnés git, MCP discovery-first, Nightly Synthesis.

## Brainstormings

Sessions itératives avec Tom, Gab, Niko et invités externes. Capture la trajectoire de la pensée produit avant consolidation.

Acteurs récurrents :
- Tom (co-fondateur, vision produit)
- Gab (dev, B2B/architecture)
- Niko (CEO)

Thèmes principaux :
- Tracing et observabilité (langfuse, gold/silver/bronze)
- Dashboard et visualisation cockpit
- Governed workflows (DAG steps/gates)
- View presets (abandonné — voir archive)
- Pods et déploiements multi-tenant
- B2B enterprise (terrain, interviews)

Voir [brainstorms/](brainstorms/) pour la liste complète (~17 fichiers).

## Architectures historiques

Décisions architecturales préservées pour traçabilité.

- [architectures/architecture-multi-tenant-2026-04-12.md](architectures/architecture-multi-tenant-2026-04-12.md) — Pivot multi-tenant distribué. Base du middleware chain actuel.
- [architectures/blocks-platform-progress.md](architectures/blocks-platform-progress.md) — Blocks Platform (json-render). 4 features cibles : View Presets, Dashboard CAO, Agent Forms, Inbox Interactive.
