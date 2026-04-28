# _bmad-output (legacy)

Statut : **legacy**. Le workflow actuel est Superpowers (`docs/superpowers/`). BMAD n'est plus utilisé pour les nouvelles features.

La majorité du contenu BMAD a déjà été migré :
- Brainstormings et visions → [`docs/history/`](../docs/history/)
- Planning artifacts livrés (epics, sprint plans, reviews) → [`docs/archive/`](../docs/archive/)

Ce qui reste ici, conservé pour traçabilité ou parce qu'encore actionnable :

## stories/

User stories BMAD triées par statut. Voir [stories/STATUS.md](stories/STATUS.md) pour l'index complet (75 stories : 54 shipped, 14 pending, 7 abandoned).

- `_shipped/` — Stories livrées avec code en prod (tables BD + routes + UI).
- `_pending/` — Stories à exécuter, dépendances majoritairement shipped. Candidates pour migration vers plans Superpowers.
- `_abandoned/` — Stories abandonnées (Docker sandbox déprioritisé 2026-03-21).

## implementation-artifacts/

Tech specs encore vivants, ready-for-dev :

- `auth-onboarding` — Spec onboarding + auth.
- `universal-document-viewer` — Spec viewer documents universel.

## specs/

Designs et plans MCP server :

- MCP server design — Architecture MCP côté MnM (cf. `project_mnm_mcp_server_api.md` en mémoire).
- `mcp-progress.md` — Statut d'avancement MCP.

## Règle

Ne plus créer de nouveau contenu BMAD ici. Tout nouveau plan ou spec va dans `docs/superpowers/plans/` ou `docs/superpowers/specs/`.
